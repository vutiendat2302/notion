---
name: qa
description: "Kiểm thử chất lượng toàn hệ thống: FastAPI/MySQL, Next.js, AI evaluations, OCR datasets, RAG, contracts, concurrency, security, performance và regression trước khi bàn giao."
---

# Quality Assurance, Testing & Evaluation Skill

## Khi nào dùng

Khi viết/điều chỉnh test, review PR, kiểm tra regression, lập test matrix, đánh giá chất lượng AI/OCR, benchmark latency hoặc xác minh acceptance criteria.

## Test strategy

| Mức | Mục tiêu | Stack đề xuất |
|---|---|---|
| Static | lint, format, typecheck, secret scan | Ruff/Pyright; ESLint/TS |
| Unit | service/domain rules, parsers, chart validators | pytest/Vitest |
| Integration | MySQL FK/transactions, MinIO/Qdrant, API adapters | pytest + test DB/containers |
| Contract | Backend ↔ FE/AI/OCR schemas | OpenAPI/Pydantic, JSON schema |
| E2E | Today/task/calendar/reminder/goal flows | Playwright |
| AI evaluation | intent/entity, tool accuracy, groundedness, invalid outputs | golden dataset + Pydantic Evals nếu phù hợp |
| OCR evaluation | text, boxes, table cells, PDFs | labeled fixtures, WER/CER & structural metrics |
| Reliability | restart, retry, idempotency, offline/disconnect | scenario tests |

## Những test nghiệp vụ không được thiếu

### Task & recurrence

- Quick create với thông tin thiếu vẫn tạo draft/task theo contract; partial PATCH không xóa field không gửi.
- Chỉ occurrence hoàn thành, task definition không bị đặt DONE cho tất cả ngày.
- Generate recurrence chạy 2 lần không sinh trùng; sửa rule không xóa ngày DONE.
- Task chưa xếp lịch vẫn xuất hiện đúng trong Inbox; overdue tính từ ngày và status.
- Parent/subtask/checklist/dependencies không cycle và không đếm trùng progress.

### Planning & goals

- Kế hoạch year→quarter→month→week→day tham chiếu cùng task; rollover không clone.
- Tuần giao tháng/năm và timezone week-start đúng.
- Goal theo giờ/số lần/đơn vị tùy chọn tính đúng evidence, no-data không phải 0% thiếu căn cứ.

### Time tracking/analytics

- Start/pause/resume/stop, entry thủ công, session bỏ quên và qua nửa đêm.
- Hai phiên overlapping không cộng trùng active hours nếu metric là elapsed actual time.
- Planned vs actual khác nguồn; skipped/cancelled không lọt vào denominator trái định nghĩa.
- Heatmap ngày không có log phải được phân biệt no data và zero confirmed.

### Security & concurrency

- 401 unauthenticated, 403 owner mismatch, 404 có thể tránh lộ tồn tại resource theo policy.
- Client không thể tự đặt `user_id` để xem dữ liệu khác.
- Replay request create/reminder/ingestion không sinh trùng; optimistic locking 409 hoạt động.
- Upload path traversal, file MIME giả, oversized file, presigned URL expired.
- Internal AI tool token invalid/expired/scope mismatch; prompt injection trong OCR/RAG.

### AI / OCR / vector

- Task parsing tiếng Việt có chữ viết tắt/ngày tương đối/thiếu giờ/đổi lịch.
- Chart spec loại không hợp lệ hoặc metric không whitelist bị từ chối.
- Không có dữ liệu: AI phải thông báo không đủ bằng chứng, không bịa giá trị.
- OCR screenshot/PDF scan/bảng có provenance, partial failures và confidence threshold.
- Xóa/reindex file không để Qdrant trả chunks cũ; filter owner trước khi truy vấn.
- LLM/AI Service/OCR downtime không ảnh hưởng tính năng CRUD core.

## Quy tắc test code do AI tạo

- Sau khi hoàn thành bất kỳ tính năng/API nào, phải tuân thủ thêm `.agents/skills/test/SKILL.md`: viết hướng dẫn test **Postman** định dạng `.md` (không dùng `curl`) và chạy test `.py` qua **Transactional Proxy Session** (không lưu dữ liệu test vào DB thật).
- Không chấp nhận test chỉ mock toàn bộ implementation cần kiểm thử.
- Unit tests mock boundary (DB/network/model) có chủ đích; integration tests phải chạm MySQL thực và adapters theo đúng trường hợp.
- Dữ liệu test deterministic: freeze clock/timezone, seeded fixtures; không phụ thuộc giờ hiện tại.
- Mọi bug fix thêm regression test chứng minh trước sửa lỗi, sau sửa hết lỗi.
- Không bỏ qua test fail bằng skip/xóa assert nếu không có lý do và ticket.
- Coverage là chỉ số hỗ trợ, không thay thế kiểm thử business invariants.

## CI/Quality gate ví dụ (kiểm tra scripts trước khi chạy)

```bash
cd backend && uv run ruff check . && uv run pyright && uv run pytest
cd ../ai-service && uv run ruff check . && uv run pytest
cd ../frontend && pnpm lint && pnpm test && pnpm build
# OCR integration/benchmark chạy theo khả năng phần cứng và môi trường CI.
```

## Test report chuẩn

```markdown
### Verification
- Changed modules:
- Unit tests: PASS / FAIL / NOT RUN
- Integration tests (MySQL/MinIO/Qdrant/OCR): PASS / FAIL / NOT RUN
- Contract tests: PASS / FAIL / NOT RUN
- E2E/AI eval: PASS / FAIL / NOT RUN
- Metrics: latency p50/p95, recall/precision, OCR error (nếu có)
- Known risks:
- Regression evidence:
```

## Definition of Done

- [ ] Test đáp ứng business rules liên quan thay đổi.
- [ ] Có security, timezone, ownership, concurrency cases nếu tác động.
- [ ] Logs/metrics không lộ dữ liệu cá nhân.
- [ ] Báo cáo chính xác test đã chạy và giới hạn kiểm thử còn lại.
