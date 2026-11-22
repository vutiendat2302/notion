# AI Service → Backend Scoped Internal Tool APIs (`aud=backend-tools`)

- Auth: `Authorization: Bearer <HS256 S2S JWT>` (`iss=ai-service`, `aud=backend-tools`, `sub=<user_id>`, `scope=read:context`)
- `GET /internal/v1/tools/context-entities`:
  - Returns verified `projects`, `categories`, `goals`, and today's `occurrences` owned strictly by `sub` (`user_id`), so AI never invents foreign IDs or accesses `productivity_db` directly.
