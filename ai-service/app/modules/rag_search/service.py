"""RAG Vector Service using Ollama bge-m3 embeddings + Qdrant user-scoped collection."""

import uuid
from typing import Any

import httpx
from app.core.config import get_ai_settings


class QdrantRagService:
    async def embed_text(self, text: str) -> list[float] | None:
        settings = get_ai_settings()
        url = f"{settings.resolved_ollama_origin()}/api/embed"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    url,
                    json={"model": settings.ollama_embedding_model, "input": text},
                )
                if resp.status_code != 200:
                    return None
                data = resp.json()
                embeddings = data.get("embeddings") or []
                return list(embeddings[0]) if embeddings else None
        except httpx.HTTPError:
            return None

    async def ensure_collection(self, vector_size: int = 1024) -> bool:
        settings = get_ai_settings()
        base = settings.resolved_qdrant_url()
        col = settings.qdrant_collection
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                chk = await client.get(f"{base}/collections/{col}")
                if chk.status_code == 200:
                    return True
                put = await client.put(
                    f"{base}/collections/{col}",
                    json={"vectors": {"size": vector_size, "distance": "Cosine"}},
                )
                return put.status_code in (200, 201)
        except httpx.HTTPError:
            return False

    async def upsert_entity(
        self,
        *,
        owner_user_id: str,
        entity_type: str,
        entity_id: str,
        text: str,
    ) -> bool:
        vec = await self.embed_text(text)
        if not vec or not await self.ensure_collection(len(vec)):
            return False
        settings = get_ai_settings()
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{owner_user_id}:{entity_type}:{entity_id}"))
        url = f"{settings.resolved_qdrant_url()}/collections/{settings.qdrant_collection}/points"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.put(
                    url,
                    json={
                        "points": [
                            {
                                "id": point_id,
                                "vector": vec,
                                "payload": {
                                    "owner_user_id": owner_user_id,
                                    "entity_type": entity_type,
                                    "entity_id": entity_id,
                                    "text": text,
                                },
                            }
                        ]
                    },
                )
                return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def search_user_context(
        self, *, owner_user_id: str, query_text: str, limit: int = 5
    ) -> list[dict[str, Any]]:
        vec = await self.embed_text(query_text)
        if not vec:
            return []
        settings = get_ai_settings()
        url = f"{settings.resolved_qdrant_url()}/collections/{settings.qdrant_collection}/points/search"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    json={
                        "vector": vec,
                        "limit": limit,
                        "with_payload": True,
                        "filter": {
                            "must": [
                                {"key": "owner_user_id", "match": {"value": owner_user_id}}
                            ]
                        },
                    },
                )
                if resp.status_code != 200:
                    return []
                return [
                    dict(hit.get("payload", {}))
                    for hit in resp.json().get("result", [])
                    if hit.get("payload")
                ]
        except httpx.HTTPError:
            return []
