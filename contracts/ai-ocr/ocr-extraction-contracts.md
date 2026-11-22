# AI Service ↔ OCR Service Internal Contract (`:8866`)

- `POST /internal/v1/ocr/extract`:
  - Auth: `Authorization: Bearer <HS256 S2S JWT>` (`aud=ocr-service`)
  - Input: `multipart/form-data` (`file`) or JSON (`image_base64`, `mime_type`, `enable_layout`, `enable_table`, `lang="vi"`)
  - Output: `{ "text": str, "blocks": [{ "text", "confidence", "bbox", "block_type" }], "tables_html": [str], "avg_confidence": float, "engine": str }`
