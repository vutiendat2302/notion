"""Minimal async S3 Signature V4 client for MinIO object storage."""

import hashlib
import hmac
import os
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import quote

import httpx

from app.core.config import get_settings


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str = "us-east-1") -> bytes:
    k_date = _sign(f"AWS4{secret_key}".encode(), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, "s3")
    return _sign(k_service, "aws4_request")


def resolve_minio_endpoint() -> tuple[str, bool]:
    settings = get_settings()
    endpoint = settings.minio_endpoint
    in_docker = Path("/.dockerenv").exists()
    if not in_docker and endpoint.startswith("minio:"):
        port = os.getenv("MINIO_API_PORT", "9010")
        endpoint = f"127.0.0.1:{port}"
    return endpoint, settings.minio_secure


class MinioS3Client:
    def __init__(self) -> None:
        settings = get_settings()
        self.endpoint, self.secure = resolve_minio_endpoint()
        self.access_key = settings.minio_root_user
        self.secret_key = settings.minio_root_password
        self.scheme = "https" if self.secure else "http"
        self.region = "us-east-1"

    def _signed_headers(
        self,
        method: str,
        canonical_uri: str,
        payload_hash: str,
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, str]:
        now = datetime.now(UTC)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")

        headers: dict[str, str] = {
            "host": self.endpoint,
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
        }
        if extra_headers:
            for k, v in extra_headers.items():
                headers[k.lower()] = v

        sorted_keys = sorted(headers.keys())
        canonical_headers = "".join(f"{k}:{headers[k].strip()}\n" for k in sorted_keys)
        signed_headers_str = ";".join(sorted_keys)
        canonical_request = "\n".join(
            [
                method.upper(),
                canonical_uri,
                "",
                canonical_headers,
                signed_headers_str,
                payload_hash,
            ]
        )
        credential_scope = f"{date_stamp}/{self.region}/s3/aws4_request"
        string_to_sign = "\n".join(
            [
                "AWS4-HMAC-SHA256",
                amz_date,
                credential_scope,
                hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
            ]
        )
        key = _signing_key(self.secret_key, date_stamp, self.region)
        signature = hmac.new(key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
        headers["authorization"] = (
            f"AWS4-HMAC-SHA256 Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers_str}, Signature={signature}"
        )
        return headers

    def _canonical_uri(self, bucket: str, object_key: str | None = None) -> str:
        if object_key is None:
            return f"/{quote(bucket, safe='')}"
        encoded_key = "/".join(quote(part, safe="") for part in object_key.split("/"))
        return f"/{quote(bucket, safe='')}/{encoded_key}"

    async def ensure_bucket(self, bucket: str) -> None:
        empty_hash = hashlib.sha256(b"").hexdigest()
        uri = self._canonical_uri(bucket)
        url = f"{self.scheme}://{self.endpoint}{uri}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            head_headers = self._signed_headers("HEAD", uri, empty_hash)
            resp = await client.head(url, headers=head_headers)
            if resp.status_code == 200:
                return
            put_headers = self._signed_headers("PUT", uri, empty_hash)
            put_resp = await client.put(url, headers=put_headers)
            put_resp.raise_for_status()

    async def put_object(
        self, bucket: str, object_key: str, data: bytes, content_type: str
    ) -> None:
        await self.ensure_bucket(bucket)
        payload_hash = hashlib.sha256(data).hexdigest()
        uri = self._canonical_uri(bucket, object_key)
        headers = self._signed_headers(
            "PUT",
            uri,
            payload_hash,
            extra_headers={"content-type": content_type},
        )
        url = f"{self.scheme}://{self.endpoint}{uri}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(url, content=data, headers=headers)
            resp.raise_for_status()

    async def get_object(
        self, bucket: str, object_key: str, range_header: str | None = None
    ) -> tuple[int, bytes, dict[str, str]]:
        empty_hash = hashlib.sha256(b"").hexdigest()
        uri = self._canonical_uri(bucket, object_key)
        extra: dict[str, str] = {}
        if range_header:
            extra["range"] = range_header
        headers = self._signed_headers("GET", uri, empty_hash, extra_headers=extra or None)
        url = f"{self.scheme}://{self.endpoint}{uri}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers)
            return resp.status_code, resp.content, dict(resp.headers)

    async def delete_object(self, bucket: str, object_key: str) -> None:
        empty_hash = hashlib.sha256(b"").hexdigest()
        uri = self._canonical_uri(bucket, object_key)
        headers = self._signed_headers("DELETE", uri, empty_hash)
        url = f"{self.scheme}://{self.endpoint}{uri}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.delete(url, headers=headers)
            if resp.status_code not in (200, 204, 404):
                resp.raise_for_status()
