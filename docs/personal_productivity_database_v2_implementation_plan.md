# PERSONAL PRODUCTIVITY & TIME MANAGEMENT APP
# DATABASE v2.0 — LEAN & SCALABLE DESIGN / IMPLEMENTATION PLAN

> **Document type:** Database Work Breakdown Structure (WBS) & Technical Implementation Plan  
> **Status:** Proposed plan — review before schema and migrations  
> **Audience:** Product owner, backend engineer, database engineer, AI coding assistant  
> **Stack:** MySQL 8.4 LTS · InnoDB · Python 3.14 · FastAPI · SQLAlchemy 2.x · Alembic · asyncmy · DataGrip · Docker Compose  
> **Architecture:** Backend Hybrid · AI Service Hybrid độc lập · OCR Service độc lập · MinIO · Qdrant · Ollama (self-hosted)

---

## 0. Mục tiêu và giới hạn

### 0.1. Mục tiêu

Thiết kế **database đơn giản nhất có thể nhưng không đánh đổi tính đúng đắn của nghiệp vụ**, phục vụ hệ thống quản lý kế hoạch cá nhân từ **Năm → Quý → Tháng → Tuần → Ngày**, Goals, Projects, Tasks, Recurrence, Time Tracking, Habits, Reminders, Analytics; sẵn sàng bổ sung Notes, Files, AI và iOS sau này.

Công việc được thực hiện **theo kết quả/tiêu chí nghiệm thu**, không gắn thời gian triển khai hay deadline. Tài liệu này là **kế hoạch thực hiện**, chưa phải ERD hoặc DDL chính thức.

### 0.2. Quy tắc không thỏa hiệp

1. Không tạo bảng để mô phỏng từng màn hình: không có `daily_tasks`, `weekly_tasks`, `monthly_tasks`, `yearly_tasks` riêng.
2. **Task definition ≠ Task occurrence ≠ Time entry**. Trạng thái hoàn thành của lần thực hiện đặt tại occurrence, không đặt thành trạng thái lịch sử chung của task gốc.
3. Không coi kế hoạch là hoạt động thực tế. Analytics chỉ dựa trên nguồn dữ liệu có định nghĩa.
4. Không xóa lịch sử hoàn thành khi đổi recurrence rule, archive task hoặc chuyển kỳ kế hoạch.
5. Không sử dụng JSON làm nơi chứa quan hệ cốt lõi chỉ để giảm số lượng bảng. JSON chỉ dùng cho metadata/cấu hình linh hoạt có giới hạn và validation.
6. **Backend sở hữu `productivity_db`**. AI Service **không truy cập trực tiếp** các bảng nghiệp vụ; gọi API/tool có kiểm soát qua Backend.
7. File nhị phân nằm ở **MinIO**, embedding nằm ở **Qdrant**, quan hệ/nghiệp vụ nằm ở **MySQL**.
8. Bảng mới chỉ được thêm khi có use case + yêu cầu dữ liệu + ràng buộc/toàn vẹn không thể đáp ứng tốt với mô hình hiện có.
9. Mọi thay đổi cấu trúc chạy qua **Alembic migrations**, không chỉnh schema thủ công trên DataGrip rồi quên version control.
10. Toàn bộ khóa ngoại, quyền sở hữu, timezone, unique constraint, transaction và hành vi lỗi đều phải được kiểm thử.

### 0.3. Ranh giới giai đoạn

| Giai đoạn | Kết quả mong muốn | Phạm vi |
|---|---|---|
| **Core MVP** | Dùng được mỗi ngày | Identity tối thiểu, Projects/Categories, Task/Occurrence/Recurrence, Planning Periods/Items, Goals, Time Entries, Reminders |
| **Productivity+** | Kế hoạch và thống kê phong phú | Checklists, Tags, Habits, tiến độ Goals, Notification delivery, History, Dashboard/View, Notes, File metadata |
| **AI + Knowledge** | Đọc tài liệu, AI chart, RAG | AI metadata riêng, MinIO, OCR jobs, Qdrant vector index, action proposal |
| **Advanced** | Tự động hóa/tích hợp | Automation rules, external sync, custom fields nâng cao, advanced reporting |

**Lưu ý về số bảng:** Khoảng **15 bảng** chỉ là *mốc tham khảo cho lõi thu gọn*, không phải chỉ tiêu cứng. Nếu muốn đầy đủ checklist, refresh sessions, reminder attempts, goal measurements và audit history ngay MVP, số bảng sẽ tăng hợp lý. Quyết định dựa trên nghiệp vụ và integrity, **không cắt bảng bằng mọi giá**.

---

## 1. Phần A — Đóng băng phạm vi và lập ma trận nghiệp vụ

### Việc cần làm

- [ ] Đọc Functional Specification v2.0 và liệt kê nhóm use case **bắt buộc cho MVP**.
- [ ] Phân loại từng use case: **cần lưu dữ liệu gốc / tính toán được / UI-only / thuộc AI Service / thuộc Storage**.
- [ ] Chốt phạm vi **Year, Quarter, Month, Week, Day Workspace**: xem dữ liệu theo kỳ, đặt mục tiêu theo kỳ, ưu tiên kỳ, review kỳ; không nhân bản Task.
- [ ] Chốt sự khác biệt giữa `Task`, `Occurrence`, `Checklist`, `Subtask`, `Habit`, `Goal`, `Project`, `Plan Item`.
- [ ] Chốt một người dùng trước nhưng vẫn có owner field ở dữ liệu quan trọng.
- [ ] Chốt các quyết định còn bỏ ngỏ: subtask depth, task unscheduled, habit độc lập, tính toán goal progress, review/rollover, thông báo local/server, ghi chú.
- [ ] Tạo bảng mapping **Feature ID → Domain → Entity → API → Metric → Test**.
- [ ] Ghi **ADR (Architecture Decision Record)** cho mọi quyết định có thể ảnh hưởng schema.

### Đầu ra

- `docs/database/00_scope_and_assumptions.md`
- `docs/database/feature_entity_matrix.md`
- `docs/adr/` (quyết định thiết kế)
- Danh sách rõ: **MVP / Later / Won't build now**.

### Tiêu chí nghiệm thu

Một chức năng P0 có chủ sở hữu dữ liệu và luồng xử lý; không tạo bảng chỉ vì có UI hoặc chart tương ứng.

---

## 2. Phần B — Chuẩn kiến trúc MySQL và quy ước dữ liệu

### Việc cần làm

- [ ] Chốt MySQL **8.4 LTS + InnoDB**, cấu hình `utf8mb4` và collation mặc định.
- [ ] Chốt chuẩn ID (UUIDv7 lưu `BINARY(16)` hoặc phương án khác) và cách Python serialize/deserialize; **kiểm thử round-trip thật**.
- [ ] Chuẩn timezone: **timestamp UTC**, user timezone `Asia/Ho_Chi_Minh`; phân biệt `DATE` với `DATETIME(6)`.
- [ ] Chốt naming conventions: `snake_case`, tên FK/unique/index có ý nghĩa, FK `*_id`.
- [ ] Chốt trường metadata dùng chung: `created_at`, `updated_at`, `archived_at` khi cần, `version` cho optimistic locking ở thực thể dễ bị đồng thời sửa.
- [ ] Chốt chính sách nullable, giá trị mặc định, soft delete/archive và cascading delete.
- [ ] Phân biệt **operational state** và **derived state** để tránh lưu dữ liệu trùng.
- [ ] Cấu hình Async SQLAlchemy Engine/Session; một session trên mỗi unit of work, không dùng chung AsyncSession giữa các coroutine đồng thời.
- [ ] Chốt transaction ownership trong tầng Service/Unit of Work; Repository không tự ý commit.
- [ ] Chốt schema migration versioning, migration review và rollback/restore strategy.
- [ ] Chốt backup, restore, quyền MySQL và cách secrets được cấu hình.

### Đầu ra

- `docs/database/01_database_conventions.md`
- `infra/mysql/my.cnf` (khi quyết định thông số cụ thể)
- `backend/app/db/engine.py`, `session.py`, `base.py` (khi bắt đầu code)
- Docker Compose development, healthchecks, persistent volume, account quyền tối thiểu.

### Tiêu chí nghiệm thu

FastAPI kết nối được MySQL local bằng asyncmy; Alembic chạy được migration; DataGrip đọc được schema qua tài khoản phù hợp; UTF-8/emoji, timezone và transaction được kiểm thử.

---

## 3. Phần C — Logical Data Model tổng thể và module ownership

### Việc cần làm

- [ ] Nhóm các entity theo bounded contexts: Identity, Planning, Goals, Projects, Tasks, Time Tracking, Reminders, Habits, Content/Files, Analytics configuration.
- [ ] Vẽ **domain diagram tổng thể** với quan hệ và chiều phụ thuộc, sau đó ERD nhỏ cho từng domain.
- [ ] Gán ownership mỗi entity cho đúng **Backend Hybrid module**; tránh hai module cùng ghi một bảng.
- [ ] Phân loại **source of truth**, dữ liệu snapshot, derived/read model, external storage references.
- [ ] Quy định mô hình quan hệ 1–N, N–N, optional FK; tránh quan hệ đa hình không có FK nếu có thể dùng FK cụ thể.
- [ ] Phân loại bảng phải tạo ngay và bảng chỉ nằm trong future model.

### Phân chia module khuyến nghị

| Module | Sở hữu | Không sở hữu |
|---|---|---|
| `auth`/`users` | Users, preferences, auth sessions khi triển khai | Task business data |
| `tasks` | Task, occurrence, recurrence, checklist/subtask, dependencies | Time entry |
| `planning` | Planning period, plan membership, review/rollover khi cần | Bản sao Tasks |
| `projects` | Project metadata, project milestones khi cần | Task execution status |
| `goals` | Goal definitions, targets, progress evidence khi cần | Timer sessions |
| `time_tracking` | Time entries, active timer state khi cần | Occurrence definition |
| `reminders` | Reminder rules/delivery state | Task status |
| `habits` | Habit definitions and logs | Task source-of-truth |
| `analytics` | Metric definitions, query/read models | Kết quả tính lại được, nếu chưa cần snapshot |
| `content`/`files` | Notes and file metadata | File binary / embeddings |
| `ai_gateway` | AI service communication + authorization | AI models, embeddings, MySQL AI metadata |

### Đầu ra và nghiệm thu

- `docs/database/02_domain_model.md`
- `docs/database/erd_overview.mmd`
- Mỗi entity chỉ có một nơi ghi dữ liệu chính, các module khác truy xuất qua service/read interface được phép.

---

## 4. Phần D — Chi tiết Core Identity, Projects và Taxonomy

### 4.1. Identity & Settings

- [ ] `users`: identity, credentials/password hash policy, account state; không lưu password plaintext.
- [ ] `user_settings`: timezone, tuần bắt đầu, locale, theme, notification preferences liên quan nghiệp vụ.
- [ ] Đánh giá cần `auth_sessions`/refresh token rotation **ngay MVP hay triển khai cùng Auth**; không nhét danh sách session tùy tiện vào cột JSON ở `users`.
- [ ] Chốt unique email/login handle phù hợp collation, owner-bound queries.

### 4.2. Projects

- [ ] `projects`: tên, mô tả, status, dates, archived flag, owner.
- [ ] Project–Task one-to-many theo chính sách sản phẩm, hoặc N–N nếu có use case thực; mặc định giữ **một task thuộc tối đa một project** cho gọn.
- [ ] Thống kê tiến độ Project lấy từ task/occurrence; xác định mẫu số và có/không tính subtask.

### 4.3. Categories & Tags

- [ ] `categories`: nhóm công việc và màu nhận diện Soft Blue/accent.
- [ ] Có thể hoãn `tags`/`task_tags` tới khi cần multi-tag; không nhét nhiều tag bằng string phân cách dấu phẩy.

### Đầu ra / nghiệm thu

Data dictionary, FK, unique, indexes, module CRUD use cases, seed tối thiểu và test owner isolation.

---

## 5. Phần E — Task, Occurrence, Recurrence: lõi quan trọng nhất

### 5.1. Task Definition

- [ ] `tasks`: định nghĩa công việc, description, project/category, priority, estimated duration, archive, parent task (nếu bật subtask).
- [ ] Tạo nhanh với dữ liệu tối thiểu; patch field-by-field; không buộc người dùng nhập đầy đủ mới tạo.
- [ ] Phân biệt `due_at` (deadline) và `scheduled_start/end` của lần thực hiện.
- [ ] Quy định task một lần không có lịch: tạo occurrence khi nào? **Đề xuất:** có một occurrence `unscheduled` nếu cần trạng thái hoàn thành, nhưng không bịa ngày.
- [ ] Chống vòng lặp parent–child nếu hỗ trợ nested subtasks.

### 5.2. Occurrence

- [ ] `task_occurrences`: status của mỗi lần, scheduled date/start/end, completed_at, provenance, recurrence key.
- [ ] Status transitions hợp lệ: NOT_STARTED → IN_PROGRESS → DONE; hỗ trợ SKIPPED, CANCELLED, REOPEN theo policy.
- [ ] Overdue tính động, **không lưu status `OVERDUE`** như source of truth.
- [ ] Chỉ sửa một occurrence hay sửa toàn bộ future occurrences; ghi scope rõ ràng.
- [ ] Unique key chống sinh trùng recurrence; enforce bằng database constraint.

### 5.3. Recurrence

- [ ] `recurrence_rules`: daily/weekly/monthly/yearly, interval, weekdays, start/end condition, timezone.
- [ ] Chốt policy khi chỉnh recurrence: **chỉ future occurrences chưa hoàn thành**, giữ lịch sử.
- [ ] Chốt sinh occurrence on-demand hoặc rolling window; job idempotent, không tạo vô hạn bản ghi.
- [ ] Xử lý ngày không tồn tại (ngày 31), leap year, cuối tháng, tuần giao tháng, timezone/DST nếu hỗ trợ user nhiều timezone.
- [ ] Kiểm thử concurrent recurrence generation, transaction rollback, pause/resume rule.

### 5.4. Subtasks & Checklist (có thể bật ngay sau lõi)

- [ ] Với subtask: dùng quan hệ `parent_task_id` hoặc bảng quan hệ khi use case thực sự cần; không nhầm checklist.
- [ ] Với checklist lặp: **checklist definition** khác **trạng thái checklist của occurrence**; có thể cần 2 bảng mới, không cố gộp chung trạng thái tick.
- [ ] Task dependencies nếu cần phải có validation chống cycles.

### Đầu ra

`docs/database/03_tasks_data_dictionary.md` · ERD Tasks · status/recurrence decision tables · SQLAlchemy models · Alembic migrations · test suite.

### Tiêu chí nghiệm thu

Tạo/sửa/hoàn thành task đơn và task lặp chính xác; không mất lịch sử, không sinh trùng occurrence; không ghi nhận hoàn thành nhầm giữa các ngày.

---

## 6. Phần F — Planning Workspaces Năm → Quý → Tháng → Tuần → Ngày

### 6.1. Planning Periods

- [ ] `planning_periods`: `period_type` (YEAR/QUARTER/MONTH/WEEK/DAY nếu phải lưu), `start_date`, `end_date` **exclusive hoặc inclusive nhất quán**, owner, optional title, state.
- [ ] **Không tạo bản ghi kỳ ngày/tuần vô hạn**: view theo lịch được suy ra từ date range; tạo bản ghi period khi user có nội dung kế hoạch/review cần lưu.
- [ ] Unique period theo owner + kind + start_date theo policy; canonical week-start.
- [ ] Chốt period hierarchy: năm–quý–tháng–tuần–ngày không phải cây FK cứng tuyệt đối vì **tuần có thể giao tháng/quý/năm**; xử lý bằng khoảng ngày và membership phù hợp.

### 6.2. Plan Items

- [ ] `plan_items`: các mục được chủ động đưa vào kế hoạch, thứ tự, priority trong kỳ, trạng thái pin/focus (không nhân bản task).
- [ ] Link tới Task/Occurrence/Goal/Project bằng FK có thể kiểm chứng; nếu chỉ cần 2 loại thì không dùng generic `target_type,target_id` thiếu FK.
- [ ] Một task xuất hiện ở nhiều kỳ không có nghĩa có nhiều Task definition.
- [ ] Chốt `rollover`: dời lịch occurrence, chuyển membership, hay ghi suggestion — **ba hành vi khác nhau**.
- [ ] Không ghi `completed` vào plan item thay cho occurrence/habit log.

### 6.3. Review & Progress

- [ ] Xem Today / Week / Month / Quarter / Year từ một query service có filter chuẩn.
- [ ] KPI kỳ dựa trên occurrences, time entries, goal measurements, không cộng trùng phần giao kỳ.
- [ ] Review cuối kỳ có thể lưu sau bằng `period_reviews` nếu cần nội dung đánh giá thủ công.

### Đầu ra / nghiệm thu

ERD Planning, period boundary examples, plan membership rules, rollover semantics, test cho tuần giao tháng và các múi giờ khác nhau.

---

## 7. Phần G — Goals & Progress

### Việc cần làm

- [ ] `goals`: title, description, metric type/unit, target, baseline, start/end, status, owner.
- [ ] `goal_links`: liên kết Goal với Task/Project theo FK và constraint rõ ràng; cân nhắc tách link tables nếu nhiều kiểu đối tượng.
- [ ] Phân biệt **goal target**, **goal progress measurement**, **derived progress**; chọn source of truth cho từng loại.
- [ ] Goal dạng task completion, số giờ, số buổi, số lượng (trang sách/km) không dùng một công thức cho tất cả.
- [ ] Goal theo năm/quý/tháng được gắn period hoặc date range, không copy goal mới mỗi lần xem.
- [ ] Chốt milestone/period targets/evidence: nếu người dùng cần nhập tiến độ thủ công thì sẽ cần `goal_measurements` trong phase tiếp theo.
- [ ] Tránh double-count goal nhiều task hoặc project có task con.

### Đầu ra / nghiệm thu

Metric specification cho từng goal type, ERD, examples, tests (target thay đổi không sửa lịch sử, aggregate không double-count).

---

## 8. Phần H — Time Tracking & Focus

### Việc cần làm

- [ ] `time_entries`: `occurrence_id` có thể NULL, `started_at`, `ended_at`, source (TIMER/MANUAL), duration policy, owner.
- [ ] Chốt Start/Pause/Resume/Stop, lost connection, app closed, chạy trên hai thiết bị.
- [ ] **Đề xuất MVP:** mỗi đoạn active có start/end riêng; pause đóng đoạn, resume tạo đoạn mới; nếu cần gom vào một focus session sau này thêm `timer_sessions`.
- [ ] Chống timer trùng chạy; hoặc cho phép chồng thời gian có chủ đích và xử lý thống kê union intervals.
- [ ] Timezone UTC storage, group theo user timezone, xử lý phiên qua nửa đêm và sửa thủ công.
- [ ] Lưu estimated time ở Task/Occurrence phù hợp; actual chỉ từ time entries có hiệu lực.
- [ ] Xác định chính sách correction và audit khi sửa lịch sử time entry.

### Đầu ra / nghiệm thu

Timer state machine, time entry data dictionary, test double-start, concurrent stop, pause/resume, midnight, negative duration, manual edit.

---

## 9. Phần I — Reminders & Notification Reliability

### Việc cần làm

- [ ] `reminders`: nội dung, target occurrence/goal tùy phạm vi, trigger time, channel, delivery status, retry, dedupe identifier.
- [ ] Phân biệt **reminder rule** và **delivery attempts**; ban đầu có thể dùng một bảng cho lời nhắc đơn giản, nhưng tách `reminder_rules` và `reminder_deliveries` khi cần lịch lặp và retry/audit chính xác.
- [ ] Trước khi gửi, worker claim công việc bằng transaction an toàn; chạy lại không gửi trùng ngoài ý muốn.
- [ ] Chính sách khi đổi giờ occurrence, cancel task hoặc revoke notification device.
- [ ] Chốt server push vs local notification iOS; server tự host tắt thì không thể bảo đảm server push đúng hạn.
- [ ] Log lỗi gửi, retry có giới hạn, trạng thái acknowledged/snoozed khi có tính năng.

### Đầu ra / nghiệm thu

Reminder state diagram, deduplication rules, migration và worker integration tests.

---

## 10. Phần J — Habits, Notes, Files và Views (mở rộng có điều kiện)

### 10.1. Habits

- [ ] `habits` + `habit_logs`: lịch/tần suất, check-in, định lượng, source, streak từ event thực tế.
- [ ] Không ép habit định lượng thành task completion; policy khi check-in nhiều lần/ngày.

### 10.2. Notes & Pages

- [ ] Xác định rich text đơn giản hay block-based editor; **không xây Notion clone toàn bộ** trong MVP.
- [ ] `pages` và tùy chọn `page_revisions` chỉ khi có nhu cầu ghi chú/restore/versioning.

### 10.3. Files & MinIO

- [ ] `files`: metadata, owner, object key, checksum, MIME, content size, processing state.
- [ ] File gốc ở MinIO; không chứa file binary trong MySQL; chống path traversal và MIME giả.
- [ ] Có chiến lược dọn file orphan, permission check, content scanning nếu nhận file không tin cậy.

### 10.4. Saved Views & Dashboards

- [ ] `saved_views` chỉ lưu filter/sort/visible columns được validation.
- [ ] `dashboards`/`dashboard_widgets` thêm khi cần tùy biến layout; không tạo bảng riêng cho từng loại chart.
- [ ] Metric/chart specs được xác thực theo allowlist, không nhận SQL hoặc JavaScript tự do.

### Đầu ra / nghiệm thu

Mỗi tính năng mở rộng có 1 bản schema proposal, quyết định **Add now / Defer**, migration riêng, test dữ liệu và bảo mật.

---

## 11. Phần K — AI Metadata, OCR, RAG và trách nhiệm storage

### Việc cần làm

- [ ] Thiết kế ranh giới **`productivity_db` (Backend owned)** và **`ai_metadata_db` (AI Service owned)** nếu AI cần persistence riêng.
- [ ] AI metadata tối thiểu khi triển khai: conversations/messages, job states, document references, tool/action approvals; tránh tạo 10 bảng ngay khi chưa có use case.
- [ ] Khi upload: Backend xác thực → ghi metadata MySQL → lưu file MinIO → phát job → AI Service/OCR xử lý → lưu chunks/index trạng thái → vector vào Qdrant.
- [ ] OCR Service dùng runtime Python riêng (không ép PaddleOCR chạy Python 3.14); xử lý screenshot, ảnh văn bản, scan PDF, bảng biểu; trả confidence và layout.
- [ ] AI Service đọc dữ liệu nghiệp vụ **qua internal API** của Backend; không có SQL credentials vào `productivity_db`.
- [ ] Lưu `document_id`, `source_version`, `chunk_id`, `model_version`, trạng thái indexing; hỗ trợ reindex khi model embedding đổi.
- [ ] Khi xóa file: thực hiện quy trình xóa metadata, object và vectors theo job có retry (không giả định distributed transaction giữa MySQL/MinIO/Qdrant).
- [ ] Không xem Qdrant là source of truth; có khả năng rebuild vector index từ file/chunks đã được lưu.
- [ ] Các AI action thay đổi task/plan chỉ là **proposal**, Backend xác thực lại và user xác nhận.

### Đầu ra / nghiệm thu

Storage ownership diagram, upload/OCR/RAG sequence diagram, object/vector lifecycle, contract tests giữa Backend–AI–OCR, failure/retry tests.

---

## 12. Phần L — Data Dictionary và ERD chi tiết từng bảng

Với **mỗi bảng được chấp thuận**, hoàn thành một bản data dictionary theo cùng mẫu:

| Trường đặc tả | Bắt buộc mô tả |
|---|---|
| Table & owner module | Nguồn dữ liệu, module duy nhất có quyền ghi |
| Purpose | Bảng tồn tại để giải quyết use case nào |
| Columns | Tên, MySQL type, NULL/NOT NULL, default |
| Primary key | Kiểu ID và chiến lược cấp ID |
| Foreign keys | Bảng đích, ON DELETE/UPDATE policy |
| Unique / CHECK | Integrity rules, điều kiện hạn chế giá trị |
| Indexes | Câu truy vấn cần tối ưu và lý do index |
| State transitions | Nếu là bảng có trạng thái |
| Temporal policy | DATE/UTC timestamps, archived/deleted, lịch sử |
| Privacy | Owner, dữ liệu nhạy cảm, retention |
| API/DTO mapping | Request/response tương ứng |
| Queries | Read/write queries điển hình |
| Tests | Happy path, invalid input, concurrency, integrity |
| Evolution | Dự kiến thay đổi tương thích với migration |

### Chất lượng ERD

- [ ] 1 ERD overview chỉ thể hiện domain boundaries.
- [ ] 1 ERD Tasks + Occurrences + Recurrence.
- [ ] 1 ERD Planning + Goals + Projects.
- [ ] 1 ERD Time Entries + Reminders.
- [ ] 1 ERD Content + Files + AI boundary (khi triển khai).
- [ ] Đánh dấu các quan hệ **logical-only** vì qua service boundaries, không vẽ giả cross-service FK.

### Đầu ra

`docs/database/data_dictionary/*.md` · `docs/database/erd/*.mmd` · review checklist.

---

## 13. Phần M — SQLAlchemy Models, Alembic và Repository Integration

### Việc cần làm

- [ ] Tạo `Base`, naming conventions và custom type decorators đã kiểm thử trên MySQL.
- [ ] Models đặt theo **module Hybrid**; metadata import tập trung để Alembic thấy đầy đủ model.
- [ ] Viết migration thành các đợt logic, theo thứ tự parent → child FKs.
- [ ] Review migration SQL tạo indexes/constraints; không chạy tự động mọi autogenerate lên production mà không đọc diff.
- [ ] Viết seed data **development only**, idempotent, không sửa dữ liệu production.
- [ ] Tạo repository với query owner-scoped và pagination phù hợp.
- [ ] Service điều phối transaction và rollback khi lỗi; không trả ORM trực tiếp cho frontend.
- [ ] API DTO dùng Pydantic v2; mapping kiểm soát tránh lazy-loading ngầm và N+1.
- [ ] Tạo contract tests đồng bộ response shape với Next.js và AI Gateway.

### Đầu ra / nghiệm thu

Schema tạo được từ empty DB; migration upgrade lặp lại không gây sai; query CRUD thành công; test rollback/FK/unique và application integration.

---

## 14. Phần N — Analytics đúng dữ liệu, dễ mở rộng

### Việc cần làm

- [ ] Viết **Metric Catalog**: completion rate, overdue, completion trend, active hours, estimated vs actual, streak, goal attainment, plan carryover.
- [ ] Với mỗi metric chốt formula, denominator, time range, timezone, inclusion/exclusion, missing-data policy.
- [ ] Lấy dữ liệu từ Tasks/Occurrences/Time Entries/Habit Logs, không lưu song song bảng riêng chỉ để dựng từng chart.
- [ ] Thống kê theo day/week/month/quarter/year từ **date range** chuẩn; chốt tuần giao tháng/năm.
- [ ] Kiểm tra double-count khi session chồng nhau, task cha/con, goal gắn nhiều tasks.
- [ ] Định nghĩa API đọc theo metric, không cho AI gửi tùy ý SQL.
- [ ] Nếu truy vấn thật sự chậm sau khi đo, xem xét index, read model hoặc snapshot có version — chưa thêm sớm.

### Đầu ra / nghiệm thu

`docs/analytics/metric_catalog.md`, SQL query examples, test cases với dataset cố định và expected values.

---

## 15. Phần O — Security, backup, recovery, observability

### Việc cần làm

- [ ] Database users theo quyền tối thiểu: backend runtime, migration user, readonly admin, AI metadata user.
- [ ] MySQL/MinIO/Qdrant/Ollama nội bộ Docker network, không public port thẳng ra Internet; DataGrip kết nối localhost/SSH tunnel.
- [ ] TLS và internal auth cho kết nối qua mạng không tin cậy; secrets không commit Git.
- [ ] Backup MySQL **consistent**, MinIO objects và Qdrant snapshot/cấu hình khi có dữ liệu.
- [ ] Chốt thứ tự khôi phục và consistency model cross-store; có reindex path cho Qdrant.
- [ ] Test restore trên môi trường riêng, không dừng ở việc backup file thành công.
- [ ] Log DB slow queries, migration state, deadlocks, pool exhaustion, failed jobs, orphaned files.
- [ ] Quy định retention và deletion, đặc biệt khi xóa tài khoản/file/tài liệu dùng AI.

### Đầu ra / nghiệm thu

`docs/ops/backup_restore_runbook.md`, script backup/restore được test, security checklist, monitoring dashboard tối thiểu.

---

## 16. Phần P — Bộ test dữ liệu bắt buộc trước khi mở rộng

### Test nghiệp vụ lõi

- [ ] Tạo Task với title tối thiểu → có thể lên lịch sau, không yêu cầu thông tin không cần thiết.
- [ ] Task hoàn thành hôm nay không làm occurrence ngày mai tự DONE.
- [ ] Recurrence job chạy song song / chạy lại → không tạo duplicate.
- [ ] Đổi recurrence rule → lịch sử DONE vẫn nguyên.
- [ ] Dời một occurrence → các lần lặp khác không đổi.
- [ ] Task unscheduled vẫn hiện Inbox và có thể hoàn thành theo policy.
- [ ] Parent/subtask không tạo cycle.
- [ ] Checklist task lặp reset trạng thái từng lần, không ghi đè checklist lịch sử.
- [ ] Thay đổi planning period membership không tạo bản sao task.
- [ ] Tuần giao tháng/năm không làm mất hoặc đếm trùng công việc.
- [ ] Rollover phân biệt move membership và reschedule occurrence.
- [ ] Goal liên kết nhiều task/project không tính trùng số liệu.
- [ ] Timer duplicate start/concurrent stop được xử lý an toàn.
- [ ] Time entry qua nửa đêm được chia đúng khi thống kê theo local date.
- [ ] Pause/resume không cộng thời gian nghỉ vào active duration.
- [ ] Reminder job chạy lại không gửi trùng trái policy.

### Test cơ sở dữ liệu / dịch vụ

- [ ] Invalid FK/unique/check → lỗi và rollback đúng.
- [ ] User A không đọc/sửa dữ liệu User B dù tự sửa request ID.
- [ ] Cập nhật từ 2 thiết bị xử lý conflict theo optimistic locking / transaction policy.
- [ ] Migration từ empty database và upgrade giữa versions đều chạy được.
- [ ] Restore từ backup và đối soát dữ liệu thành công.
- [ ] AI Service không có quyền query MySQL nghiệp vụ.
- [ ] Upload OCR thất bại giữa pipeline → job có thể retry, không sinh file/vector orphan không thể xử lý.
- [ ] Delete document → eventual cleanup cả MinIO và Qdrant.
- [ ] Analytics trả con số nhất quán với fixture test và định nghĩa metric.

---

## 17. Trình tự triển khai theo phụ thuộc — không gắn thời gian

| Thứ tự | Work package | Điều kiện bắt đầu | Điều kiện hoàn thành |
|---:|---|---|---|
| 1 | Scope + ADR | Functional Spec v2.0 | Chốt MVP và decisions |
| 2 | DB conventions + Docker | Scope | MySQL local chạy, kết nối được, migration skeleton |
| 3 | Overview ERD + module ownership | Decisions | Không có trùng ownership |
| 4 | Identity + Projects + Categories | Conventions | CRUD + FK + owner tests |
| 5 | Tasks + Occurrences + Recurrence | Identity/Projects | Recurrence + status + history tests |
| 6 | Planning Periods + Plan Items | Tasks, Goals draft | Year/Quarter/Month/Week/Day tests |
| 7 | Goals + link/progress rules | Planning/Tasks | Metric và evidence tests |
| 8 | Time Entries + timer semantics | Occurrences | Session/midnight/concurrency tests |
| 9 | Reminders + worker semantics | Occurrences | Reliable delivery/dedup tests |
| 10 | Analytics queries + metric catalog | Core data | Expected-value tests |
| 11 | Habits / Checklists / Notes / Files | Core ổn định | Module-specific tests |
| 12 | AI metadata + OCR/RAG integration | Backend APIs, MinIO/Qdrant | Contract, retry, deletion tests |
| 13 | Backup/restore + release hardening | Modules deployed | Recovery/security checks |

**Lưu ý:** ERD và DTO có thể phác thảo trước triển khai API; không cần đợi mọi bảng hoàn tất mới xây frontend mock UI. Nhưng không tạo migration hàng loạt cho toàn bộ roadmap khi chưa có use case cụ thể.

---

## 18. Đề xuất danh sách bảng Core v2 để review (không phải schema cuối)

> Chỉ để hình dung quy mô. Tên bảng và số lượng sẽ được chốt theo constraints thực tế.

| # | Bảng | Sở hữu | Lý do có bảng |
|---:|---|---|---|
| 01 | `users` | users | Identity |
| 02 | `user_settings` | users | Tùy chọn người dùng |
| 03 | `projects` | projects | Dự án |
| 04 | `categories` | taxonomy | Nhóm công việc |
| 05 | `tasks` | tasks | Task definitions |
| 06 | `task_occurrences` | tasks | Mỗi lần thực hiện |
| 07 | `recurrence_rules` | tasks | Quy tắc lặp |
| 08 | `time_entries` | time_tracking | Thời gian thực tế |
| 09 | `planning_periods` | planning | Kỳ kế hoạch có dữ liệu cần lưu |
| 10 | `plan_items` | planning | Membership/prioritization của kỳ |
| 11 | `goals` | goals | Định nghĩa mục tiêu |
| 12 | `goal_links` | goals | Goal ↔ task/project links |
| 13 | `habits` | habits | Thói quen |
| 14 | `habit_logs` | habits | Lịch sử thực hiện |
| 15 | `reminders` | reminders | Lời nhắc cơ bản |

### Những bảng **rất có khả năng cần thêm** khi triển khai thật

- `auth_sessions`: refresh token rotation, revoke thiết bị.
- `checklist_items`, `occurrence_checklist_states`: checklist tách definition / trạng thái từng lần.
- `goal_measurements`: bằng chứng đo lường và lịch sử nhập tiến độ thủ công.
- `reminder_deliveries`: trạng thái lần gửi/retry chính xác.
- `activity_events`: audit hành động quan trọng.
- `files`: metadata khi bật MinIO upload.
- `pages`, `saved_views`, `dashboards`, `dashboard_widgets`: chỉ khi bật các tính năng tương ứng.

**Tổng số bảng không phải KPI.** Chỉ thêm khi nó giúp database giữ đúng dữ liệu, constraint và vòng đời nghiệp vụ.

---

## 19. Checklist review bắt buộc cho AI coding assistant

- [ ] Đọc Functional Spec, Backend Hybrid Spec, Database Architecture, ADR và Data Dictionary trước khi sửa DB.
- [ ] Đề xuất entity → relationship → constraint → migration → API → tests theo thứ tự.
- [ ] Không thay đổi tên bảng/cột hoặc ownership mà không có migration và rationale.
- [ ] Không tạo duplicate data chỉ để hiển thị chart hoặc workspace khác.
- [ ] Không dùng generic repository cho tất cả nghiệp vụ nếu query/constraint cần đặc thù.
- [ ] Không query DB từ router; không tự commit ở repository; không trả ORM trực tiếp ra API.
- [ ] Không để AI Service kết nối trực tiếp `productivity_db`.
- [ ] Không lưu file binary trong MySQL hoặc vectors vào bảng SQL thay Qdrant.
- [ ] Không xóa dữ liệu lịch sử để làm các test pass.
- [ ] Cập nhật ERD, Data Dictionary, API contracts và tests cùng migration.
- [ ] Luôn kiểm tra quyền truy cập, rollback, idempotency, concurrency và restore.

---

## 20. Danh sách tài liệu cần xuất sau từng phần

```text
personal-productivity/
└── docs/
    ├── database/
    │   ├── 00_scope_and_assumptions.md
    │   ├── 01_database_conventions.md
    │   ├── 02_domain_model.md
    │   ├── feature_entity_matrix.md
    │   ├── tables_inventory.md
    │   ├── data_dictionary/
    │   │   ├── identity.md
    │   │   ├── projects_taxonomy.md
    │   │   ├── tasks_occurrences_recurrence.md
    │   │   ├── planning.md
    │   │   ├── goals.md
    │   │   ├── time_tracking.md
    │   │   ├── reminders.md
    │   │   └── extensions.md
    │   ├── erd/
    │   │   ├── overview.mmd
    │   │   ├── tasks.mmd
    │   │   ├── planning_goals.mmd
    │   │   └── tracking_reminders.mmd
    │   └── migration_plan.md
    ├── analytics/
    │   └── metric_catalog.md
    ├── ops/
    │   └── backup_restore_runbook.md
    └── adr/
```

### Definition of Done cho **toàn bộ Database v2 Core**

1. ERD và Data Dictionary của tất cả bảng **đã chọn cho MVP** được review.
2. Các invariant `Task → Occurrence → Time Entry` và Planning/Goals được kiểm thử.
3. Migrations tái tạo được schema từ MySQL trống; có recovery plan.
4. FastAPI Hybrid repositories/transactions hoạt động đúng; Web/iOS/AI không truy cập trực tiếp DB.
5. Bộ test dữ liệu, concurrency, timezone, owner isolation và backup/restore đều đạt.
6. Không có bảng thừa chỉ để phục vụ màn hình, nhưng cũng không gộp bảng làm mất ràng buộc dữ liệu.

---

## 21. Tài liệu nguồn trong dự án

- `personal_productivity_functional_spec_v2_notion.md` — phạm vi nghiệp vụ Year/Quarter/Month/Week/Day, Tasks, Goals, Analytics, Files, AI.
- `personal_productivity_backend_spec_hybrid_notion.md` — Backend Hybrid architecture.
- `personal_productivity_database_architecture_notion.md` — MySQL, SQLAlchemy, Alembic, DataGrip.
- `personal_productivity_ai_technical_spec_hybrid_v2_notion.md` và `v2.md` — AI độc lập, MinIO/OCR/Qdrant.
- `personal_productivity_database_design_v1.md` — inventory 81 bảng **chỉ dùng làm reference để chọn lọc**, không phải implementation baseline.

> **Kết luận:** Bản thiết kế DB v2 phải đi từ **use cases và business invariants**, không đi từ mong muốn có nhiều bảng hoặc ít bảng. Tách đủ để dữ liệu đúng, gộp đủ để hệ thống dễ hiểu, và triển khai theo từng nhóm nghiệp vụ có thể nghiệm thu độc lập.
