import pytest
from httpx import AsyncClient

from app.modules.storage.services import storage_service


class _FakeMinioClient:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}

    async def put_object(
        self, bucket: str, object_key: str, data: bytes, content_type: str
    ) -> None:
        self.objects[(bucket, object_key)] = (data, content_type)

    async def get_object(
        self, bucket: str, object_key: str, range_header: str | None = None
    ) -> tuple[int, bytes, dict[str, str]]:
        item = self.objects.get((bucket, object_key))
        if item is None:
            return 404, b"", {}
        data, _ = item
        if range_header and range_header.startswith("bytes=0-"):
            return 206, data[:2], {"content-range": f"bytes 0-1/{len(data)}", "content-length": "2"}
        return 200, data, {"content-length": str(len(data))}

    async def delete_object(self, bucket: str, object_key: str) -> None:
        self.objects.pop((bucket, object_key), None)


@pytest.mark.asyncio
async def test_storage_upload_uses_user_id_key_and_owner_scope(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake_minio = _FakeMinioClient()
    monkeypatch.setattr(storage_service, "get_minio_client", lambda: fake_minio)

    owner_reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "storage_owner",
            "display_name": "Storage Owner",
            "email": "storage.owner@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert owner_reg.status_code == 201
    owner_id = owner_reg.json()["user"]["id"]
    owner_headers = {"Authorization": f"Bearer {owner_reg.json()['access_token']}"}

    other_reg = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "storage_other",
            "display_name": "Storage Other",
            "email": "storage.other@example.com",
            "password": "StrongPassword123",
            "confirm_password": "StrongPassword123",
            "accepted_policy": True,
        },
    )
    assert other_reg.status_code == 201
    other_headers = {"Authorization": f"Bearer {other_reg.json()['access_token']}"}

    # Upload avatar -> object key must use user_id, never username
    avatar_resp = await client.post(
        "/api/v1/storage/upload",
        headers=owner_headers,
        data={"folder": "avatars"},
        files={"file": ("my-avatar.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert avatar_resp.status_code == 201
    avatar_data = avatar_resp.json()
    assert avatar_data["object_key"].startswith(f"users/{owner_id}/avatars/")
    assert "storage_owner" not in avatar_data["object_key"]

    # Attach avatar to profile
    me_patch = await client.patch(
        "/api/v1/users/me",
        headers=owner_headers,
        json={"avatar_file_id": avatar_data["id"]},
    )
    assert me_patch.status_code == 200
    assert me_patch.json()["avatar_file_id"] == avatar_data["id"]

    # Other user cannot stream or attach owner's file
    forbidden_stream = await client.get(
        f"/api/v1/storage/files/{avatar_data['id']}/stream",
        headers=other_headers,
    )
    assert forbidden_stream.status_code == 404

    # Upload custom countdown sound (.mp3) and list sound catalog
    sound_resp = await client.post(
        "/api/v1/storage/upload",
        headers=owner_headers,
        data={"folder": "sounds/countdown"},
        files={"file": ("rain.mp3", b"ID3fakemp3bytes", "audio/mpeg")},
    )
    assert sound_resp.status_code == 201
    sound_id = sound_resp.json()["id"]

    catalog = await client.get("/api/v1/storage/sounds", headers=owner_headers)
    assert catalog.status_code == 200
    assert len(catalog.json()["defaults"]) == 2
    assert any(item["id"] == sound_id for item in catalog.json()["custom"])

    # Range request supported for audio streaming
    stream_resp = await client.get(
        f"/api/v1/storage/files/{sound_id}/stream",
        headers={**owner_headers, "Range": "bytes=0-1"},
    )
    assert stream_resp.status_code == 206
    assert stream_resp.content == b"ID"
