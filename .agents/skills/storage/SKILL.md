---
name: storage
description: "Thiết kế lưu trữ self-host với MinIO + Qdrant + MySQL metadata: upload file, object keys, ACL, OCR/RAG ingestion, embedding lifecycle, backup/restore và dữ liệu nhất quán."
---

# Storage, MinIO, Qdrant & RAG Data Lifecycle Skill

## Khi nào dùng

Khi xây upload/download file, MinIO buckets, metadata, Qdrant collection, embeddings, document ingestion, OCR artifacts, xóa/đổi file, backup object/vector hoặc semantic search index.

## Storage responsibilities

| Storage | Nguồn sự thật | Không nên lưu |
|---|---|---|
| MySQL `productivity_db` | file metadata, ownership, attachment relation, trạng thái business | file gốc lớn, embeddings |
| MySQL `ai_metadata_db` | ingestion jobs, document/chunk indexing metadata, conversation state | join trực tiếp vào task tables |
| MinIO | file/ảnh/PDF gốc, OCR artifact lớn, export | authorization rules chỉ có trong object tags |
| Qdrant | vector embeddings + payload index | file nhị phân gốc, canonical task state |
| Ollama | model runtime/cache | nguồn dữ liệu nghiệp vụ |

**Hạ tầng self-host Ubuntu**, không mặc định AWS S3/R2. Giao thức MinIO là S3-compatible; không cần AWS account.

## Object storage pattern

- Một bucket hoặc vài bucket theo **retention/access policy** (không tách bucket cho mọi đuôi file nếu không cần).
- Object key ổn định không chứa tên file nhạy cảm: ví dụ `users/<opaque-owner-id>/files/<file-id>/original`; tránh path traversal.
- Metadata MySQL lưu `file_id`, `owner_id`, `object_key`, `bucket`, `mime_type`, `size`, `sha256`, `status`, `created_at`.
- Backend xác thực upload/download; có thể phát **presigned URL ngắn hạn** có hạn mức MIME/size, không dùng public bucket mặc định.
- Xử lý không đồng bộ: file upload hoàn tất → job/OCR/indexing; trạng thái `pending/processing/ready/failed` có retry.
- Khi file được đính kèm nhiều nơi, gỡ attachment không đồng nghĩa xóa object nếu còn references.
- Xóa quyền truy cập có hiệu lực tại Backend trước; chạy cleanup object/vector theo job có retry.

## MinIO lifecycle & risk policy

MinIO Community là thành phần user chọn để tự host, **nhưng phải kiểm tra tình trạng bảo trì/security của image cụ thể**. Không kéo `latest` không kiểm soát, không phơi console công khai, không lưu root credentials trong repo. Chuẩn bị ADR cho rủi ro bảo trì và kế hoạch chuyển sang S3-compatible alternative khi cần; không tự đổi provider nếu chưa được yêu cầu.

## Qdrant collection design

- Không mở collection cho tất cả dữ liệu task có cấu trúc; SQL queries là ưu tiên cho task analytics.
- Lựa chọn collection theo **embedding model/dimension/index policy**, không tạo nhiều collection chỉ để chia UI tab.
- Payload tối thiểu: `owner_id`, `file_id`, `document_version`, `chunk_id`, `page_number`, `content_type`, `embedding_model`, `indexed_at`.
- Mọi semantic search phải filter quyền theo owner/scope, rồi backend kiểm tra lại file permission ở response nếu cần.
- Embedding model/version thay đổi cần kế hoạch reindex, không trộn vector dimensions vào collection không tương thích.
- Qdrant là index có thể xây lại từ nguồn gốc (MySQL + MinIO/OCR extracts) nếu không giữ unique canonical facts trong Qdrant.

## Ingestion state machine

```text
UPLOADED → QUEUED → EXTRACTING → EXTRACTED → CHUNKING
         → EMBEDDING → INDEXING → READY
         ↘ FAILED_RETRYABLE / FAILED_TERMINAL / CANCELLED
```

- Idempotency: dùng `file_id + version + pipeline_version + embedding_model` để chống xử lý trùng.
- Lưu processing checkpoint và lỗi có cấu trúc, tránh retry vô hạn.
- OCR artifacts/text có thể lưu MinIO; metadata/chunk references ở AI metadata DB; Qdrant lưu điểm index.
- Thay file: tạo version mới, index xong mới chuyển active version; xóa vector version cũ sau khi không còn được dùng.
- Xóa file: mark deletion, revoke URLs, remove vector/index, remove object, update metadata; có quarantine/retention nếu cần.

## Tính nhất quán giữa các hệ thống

Không có transaction ACID xuyên MySQL + MinIO + Qdrant. Dùng **state machine + idempotent jobs + reconciler**:

1. Commit file metadata/job trong MySQL.
2. Upload/object xác thực checksum.
3. OCR/embedding/index async từng bước có checkpoints.
4. Chỉ công bố `READY` sau khi kiểm tra vector/file references.
5. Reconciliation jobs tìm orphan object, thiếu index, job stuck, version mismatch.
6. Cleanup và restore có thể chạy lại an toàn.

## Backup / Disaster Recovery

- MySQL: consistent backup + restore test, bao gồm cả hai logical DB nếu AI metadata được dùng.
- MinIO: backup files/buckets/policies riêng, mã hóa và kiểm tra hash/restore.
- Qdrant: snapshots và/hoặc reindex plan; kiểm tra mapping model version.
- Backup không nằm duy nhất trong cùng ổ đĩa với dữ liệu gốc, nếu muốn chịu được hỏng ổ.
- Không coi Docker volume hoặc MinIO bucket tự thân là backup.

## Definition of Done

- [ ] File không public mặc định, có owner check và giới hạn upload.
- [ ] Metadata ↔ Object ↔ Vector có ID rõ, xử lý retry/xóa/version.
- [ ] Qdrant filter đúng owner và document status.
- [ ] Có restore test và cách đối soát orphan references.
- [ ] Không gọi dịch vụ cloud trả phí ngoài phạm vi tự host.
