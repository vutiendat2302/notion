---
name: db
description: "Thiết kế cơ sở dữ liệu MySQL 8.4 gọn nhưng bền vững: domain model, ERD, data dictionary, constraints/indexes, SQLAlchemy, Alembic, planning periods và kiểm thử dữ liệu."
---

# Database Architecture & MySQL Engineering Skill

## Khi nào dùng

Khi phân tích entity, tạo/đổi bảng, ERD, indexes, constraints, MySQL migrations, data integrity, SQLAlchemy models hoặc quy trình backup/restore.

## Stack và nguyên tắc

- **MySQL 8.4 LTS, InnoDB, `utf8mb4`**, SQLAlchemy 2.x/`asyncmy`, Alembic, **DataGrip** là DB IDE.
- Self-host MySQL trên Ubuntu với persistent volume; không thay DB thành PostgreSQL.
- **Lean & Scalable:** số bảng là hệ quả của yêu cầu, không là mục tiêu. ~15 bảng lõi là mốc tham khảo; **bản 81 bảng trước đây không phải kế hoạch triển khai**.
- `productivity_db` chỉ do Backend sở hữu. Nếu AI cần metadata thì tạo logical database `ai_metadata_db` với credentials riêng, không cho AI join vào bảng nghiệp vụ.
- MinIO chứa file, Qdrant chứa vector; MySQL chứa metadata, ACL, quan hệ, jobs/processing state khi phù hợp.

## Những entity cần kiểm tra đầu tiên

| Domain | Candidate entities (chưa mặc định duyệt DDL) |
|---|---|
| Identity | `users`, `user_settings`, `auth_sessions` nếu auth cần |
| Projects/Taxonomy | `projects`, `categories`, `tags` và mapping khi cần |
| Tasks | `tasks`, `task_occurrences`, `recurrence_rules` |
| Planning | `planning_periods`, `plan_items` |
| Goals | `goals`, goal links/measurements nếu có use case |
| Time Tracking | `time_entries`, active timer state nếu cần bền vững |
| Reminder | `reminders`, delivery attempts nếu cần idempotency/trace |
| Extensions | habits, notes, file metadata, dashboard config, audit events |

Không tạo `daily_tasks`, `weekly_tasks`, `monthly_tasks`, `yearly_tasks`, hay bảng riêng cho từng chart. Checklist state của task lặp phải xem xét theo occurrence, không tick chung nếu yêu cầu reset mỗi lần.

## Chuẩn định nghĩa dữ liệu

- Tên bảng/cột `snake_case`; PK có quy chuẩn nhất quán, FK `*_id`.
- Thảo luận UUIDv7 (`BINARY(16)`/TEXT) hoặc BIGINT theo index/storage/API và **kiểm thử round-trip**; không tùy tiện trộn kiểu khóa.
- Timestamp instant lưu UTC theo policy; MySQL `DATETIME(6)` **không chứa timezone**, phải convert ở tầng ứng dụng. `DATE` dùng cho ngày nghiệp vụ theo timezone user.
- `created_at`, `updated_at`, `archived_at`, `version` có khi thực sự cần; không sao chép mọi field vào mọi bảng.
- Unique/composite unique, FK, `CHECK` có tác dụng thực tế; lưu ý MySQL UNIQUE với nullable columns và semantics collation.
- `JSON` chỉ cho metadata/cấu hình thay đổi có schema validation; quan hệ cốt lõi phải có cấu trúc và FK.
- Delete/archive policy rõ ràng, tránh cascade vô ý xóa history/time entries/file metadata.
- Index xuất phát từ query pattern và EXPLAIN, không tạo index dàn trải trên mọi cột.

## Quy trình thiết kế một bảng

1. **Use cases:** ai tạo/đọc/sửa/xóa? query pattern/volume?
2. **Owner module:** ai có quyền write? module khác đọc qua interface nào?
3. **Primary facts:** dữ liệu gốc hay derived/cached/snapshot? có thể tái tạo không?
4. **Data dictionary:** cột, MySQL type, precision/length, nullable/default, enum policy.
5. **Relationships:** PK/FK, cardinality, uniqueness, orphan prevention.
6. **Constraints:** invalid state, timestamps, idempotency/duplicate prevention.
7. **Access/Index:** owner/date/status/composite index phù hợp EXPLAIN.
8. **Migrations:** up/down strategy, data backfill và compat với code cũ.
9. **Tests:** null/invalid, FK, unique, concurrent insert, timezone, archive, restore.
10. **Documentation:** update ERD, dictionary và ADR khi quyết định ảnh hưởng thiết kế.

### Mẫu bảng tài liệu

```markdown
### <table_name>
- Owner module:
- Use case / Source of truth:
- PK / Foreign keys:
| Cột | MySQL type | NULL | Default | Ràng buộc | Mô tả |
|---|---|---|---|---|---|
- Unique constraints:
- Indexes (gắn query cụ thể):
- Delete/archive policy:
- Không lưu / dữ liệu tính được:
- Migration strategy:
- Tests:
```

## Recurrence / planning / analytics integrity

- Task definition, occurrence và time entry là ba entity có trách nhiệm khác nhau.
- Unique key/chống duplicate khi generate recurrence lại; rule edits không làm mất các occurrence DONE.
- Planning periods year/quarter/month/week/day: mô hình chung, period identity rõ timezone/week-start, tránh kỳ bị trùng logic.
- `plan_items` lưu membership/commitment theo kỳ; **không clone task** khi rollover.
- Analytics query đọc nguồn gốc có metric registry: planned vs actual, period boundaries, cancelled/skipped exclusions.
- Hỗ trợ kiểm tra overlap time entries, timer open quên đóng và timezone cross-midnight.

## Migrations & vận hành

```bash
# Ví dụ; chỉ áp dụng khi môi trường đã cấu hình và DB dev đã backup đúng
cd backend
uv run alembic current
uv run alembic revision --autogenerate -m 'describe_change'
# REVIEW migration trước khi chạy, đặc biệt ALTER/DROP/index
uv run alembic upgrade head
```

- Không coi autogenerate là source of truth; kiểm tra DDL, type/constraint/index, tên bảng và data backfill.
- Không đổi schema trực tiếp bằng DataGrip rồi bỏ qua Alembic.
- Không tự ý xóa volumes hoặc downgrade trên production; chuẩn bị restore test.
- DB test dùng MySQL cùng nhánh phiên bản; tách credentials dev/test/prod.

## Definition of Done

- [ ] Bảng xuất phát từ feature đã duyệt, không thêm bảng vì đẹp sơ đồ.
- [ ] ERD + Data Dictionary + ORM model + migration đồng nhất.
- [ ] FK/unique/index và ownership checks có test.
- [ ] Migration chạy lại được từ DB trống; dữ liệu cũ an toàn.
- [ ] Không có timezone, recurrence, archive hoặc concurrency regression.
