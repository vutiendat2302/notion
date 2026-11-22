# Backend ↔ AI Service Internal Contracts (`:8000/:8010` → `:8001`)

- Auth: `Authorization: Bearer <HS256 S2S JWT>` (`iss=productivity-backend`, `aud=ai-service`, `sub=<user_id>`, `ttl<=120s`)
- Headers: `X-Correlation-ID`
- `POST /internal/v1/agent/plan-from-input`:
  - Request: `{ "user_id", "locale", "message", "timezone", "today_date", "preferred_agent"?, "user_api_key"?, "model_override"?, "image_base64"?, "image_mime_type"?, "conversation_id"? }`
  - Pipeline:
    1. If image attached → call `OCR Service :8866/internal/v1/ocr/extract` (`PaddleOCR` / `PP-StructureV3`).
    2. Embed query via Ollama `bge-m3` → query Qdrant (`owner_user_id` scoped) + verify entities via Backend Internal Tools (`GET /internal/v1/tools/context-entities`).
    3. Route structured `ProposedTaskItem[]` generation to `local` (Ollama `qwen3:8b`, default), `claude` (`claude-sonnet-4-6`), `codex` (`gpt-5.4`), or `gemini` (`gemini-3-flash-preview`) based on `preferred_agent` and user/server key availability, falling back safely to Local Ollama when cloud is disabled or unconfigured.
  - Response: `{ "ai_run_id", "conversation_id", "provider", "model_id", "reply_message", "ocr_text"?, "proposed_tasks": [...], "citations": [...] }`
- `POST /internal/v1/rag/index-entity`:
  - Upserts user-scoped entity text into Qdrant using `bge-m3` (`owner_user_id` payload required).
