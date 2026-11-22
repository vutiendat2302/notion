from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class AISettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_ENV_FILE) if ROOT_ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "development"
    s2s_signing_secret: str = "CHANGE_ME_LOCAL_S2S_SECRET_AT_LEAST_32_CHARS"
    ai_service_audience: str = "ai-service"
    backend_tool_audience: str = "backend-tools"
    backend_internal_base_url: str = "http://backend:8000"
    ocr_internal_url: str = "http://ocr-service:8866"
    qdrant_url: str = "http://qdrant:6333"
    qdrant_collection: str = "personal_knowledge_v1"
    ollama_base_url: str = "http://ollama:11434/v1"
    ollama_model: str = "qwen3:8b"
    ollama_embedding_model: str = "bge-m3"
    ai_default_agent: str = "local"
    ai_allow_cloud: bool = False
    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    openai_api_key: str = ""
    codex_model: str = "gpt-5.4"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"
    ai_cloud_api_key: str = ""
    ai_request_timeout_seconds: int = 45

    def resolved_ollama_origin(self) -> str:
        origin = self.ollama_base_url.removesuffix("/v1").rstrip("/")
        if not Path("/.dockerenv").exists() and "://ollama:" in origin:
            return "http://127.0.0.1:11444"
        return origin

    def resolved_qdrant_url(self) -> str:
        if not Path("/.dockerenv").exists() and "://qdrant:" in self.qdrant_url:
            return "http://127.0.0.1:6343"
        return self.qdrant_url.rstrip("/")

    def resolved_backend_url(self) -> str:
        if not Path("/.dockerenv").exists() and "://backend:" in self.backend_internal_base_url:
            return "http://127.0.0.1:8010"
        return self.backend_internal_base_url.rstrip("/")

    def resolved_ocr_url(self) -> str:
        if not Path("/.dockerenv").exists() and "://ocr-service:" in self.ocr_internal_url:
            return "http://127.0.0.1:8866"
        return self.ocr_internal_url.rstrip("/")

    def resolved_gemini_key(self) -> str:
        return (self.gemini_api_key or self.ai_cloud_api_key).strip()


@lru_cache(maxsize=1)
def get_ai_settings() -> AISettings:
    return AISettings()
