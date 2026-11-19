---
name: contracts
description: "Chuẩn hóa API contracts cho Next.js ↔ Backend ↔ AI Service ↔ OCR và internal tools: OpenAPI, DTO/versioning, lỗi, idempotency, auth, chart spec và action proposals."
---

# API & Cross-Service Contracts Skill

## Khi nào dùng

Khi tạo/sửa REST endpoint, JSON schema, OpenAPI, generated client, Backend→AI request, AI→Backend tool call, OCR output, upload jobs, chart/action specification hoặc cơ chế errors/retries.

## Quan hệ giao tiếp

| Kết nối | Hình thức | Auth | Quyền |
|---|---|---|---|
| Web/iOS → Backend | Public HTTPS REST | User session/token | Theo owner và resource |
| Backend → AI Service | Private HTTP | Service credential, delegated user context | Chỉ tác vụ AI đã định nghĩa |
| AI Service → Backend internal tools | Private HTTP | Service identity + scoped user authorization | Read-only trừ confirmation flow |
| AI Service → OCR Service | Private HTTP | Service credential + file grant | Trích xuất file cho phép |
| Backend ↔ MinIO | S3-compatible SDK/presigned URL | Credentials giới hạn | Owner-based file access |

**AI→Backend internal tool không được gọi Backend AI Gateway** để tránh cyclic recursion.

## Canonical contract conventions

- `/api/v1` cho public, `/internal/v1` cho nội bộ; có API version riêng ở schema contract nếu breaking.
- `snake_case` hoặc `camelCase` chọn nhất quán một chuẩn trong JSON; nêu rõ mapping FE/BE, không trộn tùy ý. Baseline đề xuất `snake_case` trong Python DTO, typed client sinh tự động.
- ID kiểu opaque string trong JSON (dù MySQL lưu `BINARY(16)`/khác); timestamp ISO 8601 có offset; lịch ngày đơn thuần dạng `YYYY-MM-DD`.
- Pagination: hạn mức, cursor/page, stable sort; filters/metrics/fields sử dụng allowlist.
- PATCH: absent khác explicit null; validate `model_fields_set`; có version precondition khi cần.
- Correlation/request ID; thống nhất `error.code`, message người dùng hiểu, details hữu hạn; không trả stack trace/secrets.
- Các thao tác dễ retry có `idempotency_key` và server-side dedup.
- `429`, `409`, `422`, `503`, `504` phải có semantics khác nhau; retry chỉ khi an toàn.

### Error response ví dụ

```json
{
  "error": {
    "code": "RESOURCE_CONFLICT",
    "message": "Dữ liệu đã thay đổi, vui lòng tải lại.",
    "details": {"resource_type": "task"}
  },
  "request_id": "<correlation-id>"
}
```

## Contract cho AI

- `AIRequest`: `operation`, `user_context_ref`, `request_id`, `input`, `capabilities_allowed`, `metadata`.
- `AIResponse`: discriminated union `answer`, `task_draft`, `chart`, `dashboard`, `schedule_proposal`, `clarification`, `error`.
- `ChartSpec`: type từ whitelist, `metric_id`, dimensions/series, filters, units, provenance và data date.
- `ActionProposal`: target resource ID + `expected_version`, preview changes, risk, expiration và server-issued confirmation proof.
- `OCRResult`: file_id, page/block/bbox, text, confidence, engine/version, warnings, partial state.
- Contract **không chứa** raw database password, object admin URL hay provider API key.

## Schema evolution

- Thay đổi backward compatible: thêm optional field với default; tránh thay nghĩa field hiện có.
- Breaking change: versioning/consumer migration. Backend giữ compatibility trong cửa sổ nâng cấp Web+iOS đã duyệt.
- OpenAPI và schema sources đặt trong `contracts/`, generated SDK không sửa bằng tay.
- Kiểm thử contract Provider/Consumer giữa Backend, AI và OCR; mock từ schema chứ không tự chế JSON sai type.

## Quy trình khi sửa contract

1. Xác định producers/consumers, migration impact.
2. Sửa schema chính, tạo example hợp lệ và ví dụ lỗi.
3. Generate typed client nếu có.
4. Cập nhật Backend implementation, AI/OCR adapters, FE usage.
5. Thêm contract regression tests và integration smoke tests.
6. Ghi changelog breaking/nonbreaking, tránh silent API drift.

## Definition of Done

- [ ] OpenAPI/DTO đúng với response thực tế.
- [ ] Có auth scope, version, idempotency và error semantics rõ.
- [ ] Chart/AI structured output được validate đầy đủ.
- [ ] Không vòng lặp Backend↔AI và không lộ internal service endpoints ra FE.
- [ ] Unit/contract/integration tests cập nhật đồng bộ.
