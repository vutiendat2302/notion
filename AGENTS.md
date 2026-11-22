# AGENT.md — Quy chuẩn AI Coding toàn dự án

> **Dự án:** Personal Productivity & Time Management App  
> **Phiên bản hướng dẫn:** 1.0.0  
> **Ngôn ngữ làm việc:** Tiếng Việt; tên hàm, biến, API, mã nguồn và commit dùng tiếng Anh nhất quán.  
> **Vai trò:** Quy tắc nền cho Codex/Claude Code/AI coding agent, áp dụng tại thư mục gốc repository.

## 1. Mục tiêu sản phẩm và phạm vi

Xây dựng ứng dụng quản lý kế hoạch cá nhân, có khả năng mở rộng nhưng **không tái tạo toàn bộ Notion**. Bao gồm:

- Không gian kế hoạch **Năm → Quý → Tháng → Tuần → Ngày**; Inbox/Today, review, rollover có kiểm soát.
- Goals, Projects, Tasks, Subtasks/Checklist, Recurrence, Task Occurrences, Time Tracking, Habits, Reminders.
- Analytics có định nghĩa metric rõ ràng; dashboard và biểu đồ tùy chỉnh.
- Ghi chú, file, ảnh, PDF; OCR, RAG và AI Assistant khi tới giai đoạn tương ứng.
- Web được triển khai trước; React Native iOS là giai đoạn sau, vẫn dùng chung business backend.
- Một người dùng trước, nhưng mô hình quyền sở hữu dữ liệu phải chính xác, không hardcode người dùng toàn hệ thống.

**Nguyên tắc:** làm đúng nghiệp vụ và bảo vệ dữ liệu trước, sau đó mới làm đẹp, tối ưu và mở rộng. Không thêm tính năng hoặc phụ thuộc chỉ vì "hiện đại".

## 2. Kiến trúc đã thống nhất (bắt buộc)

```text
Web Next.js / iOS React Native (sau này)
                │ HTTPS
                ▼
       Backend FastAPI :8000 ──────► MySQL 8.4 (productivity_db)
           │        │
           │        └──────────────► MinIO (file gốc)
           │ internal authenticated HTTP
           ▼
       AI Service FastAPI :8001 ───► Ollama / provider cloud nếu được bật
           │        │
           │        ├──────────────► Qdrant (embeddings/index)
           │        ├──────────────► MySQL (ai_metadata_db riêng)
           │        └──────────────► OCR Service :8866
           │                                │
           └──── Backend internal tool APIs ◄┘ (chỉ qua đường được cấp phép)
```

- **Frontend chỉ gọi Backend public API**; không gọi thẳng AI Service, MySQL, MinIO admin API hay Ollama.
- **Backend** sở hữu quy tắc nghiệp vụ và `productivity_db`, xác thực người dùng, quyền sở hữu, transactions và thực hiện write.
- **AI Service là process/container độc lập**, kiến trúc Hybrid (feature ngoài, layer trong), không đặt trong `backend/app/modules/ai`.
- AI Service đọc dữ liệu nghiệp vụ **qua internal tool API có scope**; không được truy cập trực tiếp `productivity_db`. Có thể sở hữu `ai_metadata_db` riêng.
- **OCR Service** chạy độc lập, Python 3.12 (giảm rủi ro dependency OCR), nhận ảnh/tài liệu đã cấp quyền.
- **MinIO**: file gốc và artifact lớn. **Qdrant**: vector index. **MySQL**: dữ liệu quan hệ. Không thay thế vai trò lẫn nhau.
- Không thiết kế hệ thống theo giả định cloud trả phí; mục tiêu triển khai Docker Compose self-host Ubuntu.

## 3. Technology baseline

| Phần | Công nghệ đã thống nhất |
|---|---|
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide |
| Web interactions | Motion, native scroll ưu tiên; Lenis dùng chọn lọc; dnd-kit theo nhu cầu |
| Backend | Python 3.14, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, `asyncmy`, `uv` |
| Database | MySQL 8.4 LTS, InnoDB, `utf8mb4`, DataGrip |
| AI | Python 3.14, FastAPI, Pydantic AI, Ollama local, structured outputs |
| OCR | Python 3.12, PaddleOCR 3.x, PP-StructureV3 khi cần, Pillow/OpenCV |
| Storage | MinIO tự host, Qdrant tự host, persistent Docker volumes |
| Delivery | Docker Compose, Git, lint/typecheck/test, OpenAPI contracts |

**Phiên bản package cụ thể**: xác định sau khi giải quyết dependency và chạy test, khóa bằng `uv.lock`/`pnpm-lock.yaml`; không tự bịa phiên bản pin.

## 4. Nguồn tài liệu và thứ tự ưu tiên khi có xung đột

1. Chỉ thị mới nhất của người dùng trong task hiện tại.
2. File này (`AGENT.md` / `AGENTS.md`) và skill liên quan.
3. `personal_productivity_database_v2_implementation_plan.md` — phương án DB gọn, đúng nghiệp vụ.
4. `personal_productivity_functional_spec_v2_notion.md` — yêu cầu và phạm vi chức năng.
5. `v2.md` — hạ tầng AI/OCR/MinIO/Qdrant self-host.
6. `personal_productivity_ai_technical_spec_hybrid_v2_notion.md` — AI Hybrid/service boundaries.
7. `personal_productivity_frontend_spec_notion.md` — frontend, design system.
8. `personal_productivity_backend_spec_hybrid_notion.md` — **chỉ tham khảo cấu trúc Hybrid**; các đoạn PostgreSQL là **lỗi thời**.

**Tuyệt đối không dùng DB Design v1 gồm 81 bảng làm lệnh triển khai.** Khoảng 15 bảng lõi là mốc tham khảo, không phải chỉ tiêu cứng. Mọi bảng mới phải có use case, ownership, constraints, query và lý do tồn tại.

Nếu tài liệu tham chiếu chưa được chép vào repository, không giả định AI agent đã đọc được nội dung đó; sử dụng các quy tắc đã tóm tắt trong bộ skill và nêu rõ phần chưa có căn cứ.

## 5. Áp dụng skills theo loại task

| Phạm vi thay đổi | Skill cần đọc |
|---|---|
| Phạm vi sản phẩm, kế hoạch năm/quý/tháng/tuần/ngày | `.skill/product/skill.md` |
| Web, UI/UX, interaction, biểu đồ | `.skill/fe/skill.md` |
| REST API, service, authorization, transactions | `.skill/be/skill.md` |
| ERD, MySQL, data dictionary, migrations | `.skill/db/skill.md` |
| AI agents, RAG, chart generation, LLM | `.skill/ai/skill.md` |
| OCR, layout, bảng biểu, PDF scan | `.skill/ocr/skill.md` |
| MinIO, Qdrant, file/embedding lifecycle | `.skill/storage/skill.md` |
| Docker, Ubuntu, networking, deployment | `.skill/infra/skill.md` |
| OpenAPI, Backend↔AI↔OCR, types, errors | `.skill/contracts/skill.md` |
| Automated tests, quality gates, regression | `.skill/qa/skill.md` |
| Postman docs (`.md`, không dùng `curl`) & Proxy `.py` tests | `.agents/skills/test/SKILL.md` |
| Điều phối Multi-AI / Multi-Agent (Antigravity Gemini & Codex) | `.agents/skills/multi-ai/SKILL.md` |
| React Native, iPhone, SideStore (về sau) | `.skill/mobile/skill.md` |

Một task có thể cần nhiều skill. Ví dụ: upload PDF → `be`, `storage`, `ocr`, `ai`, `contracts`, `qa`.

## 6. Luồng bắt buộc trước, trong và sau khi code

### Trước khi sửa

1. Đọc task, kiểm tra repository thực tế, cấu trúc và conventions đã có; **không tạo lại thứ đã tồn tại**.
2. Xác định feature ID/use case, owner của module và ranh giới service.
3. Đọc `AGENT.md` và skill liên quan; xem migrations/contracts hiện hành.
4. Đưa ra kế hoạch ngắn: file sẽ sửa, API/DB ảnh hưởng, cách kiểm thử.
5. Nếu phải chọn quyết định nghiệp vụ/DDL không thể suy ra an toàn, trình bày phương án và điểm chưa chốt; không tự ý thay đổi hướng kiến trúc.

### Trong khi code

1. Thay đổi nhỏ, rõ mục đích; ưu tiên code dễ đọc trước abstraction.
2. Giữ data contracts và backwards compatibility trừ khi có yêu cầu breaking change.
3. Thay đổi DB phải đi với migration và test; thay đổi API phải cập nhật schema/contract/test.
4. Không sửa code ngoài scope; không tự thêm framework, DB, queue, microservice hoặc cloud subscription.
5. Không log mật khẩu/token, nội dung tài liệu nhạy cảm, dữ liệu hội thoại đầy đủ hoặc khóa MinIO.
6. Không mặc định HTTP success khi downstream lỗi; có timeout, lỗi có kiểu, retry giới hạn và trace/correlation ID.

### Trước khi bàn giao

- Kiểm tra format/lint/typecheck/test đúng ngôn ngữ và module bị tác động (không giả vờ đã chạy).
- Kiểm tra nhập liệu không hợp lệ, auth/ownership, timezone, idempotency, duplicate, concurrency, các trường hợp không có dữ liệu.
- Báo cáo ngắn: đã thay đổi gì, file nào, test nào chạy/không chạy, rủi ro và việc cần review.
- Không khẳng định chức năng đã deploy hoặc dữ liệu đã migration nếu chưa thực sự thực hiện.

## 7. Domain invariants — không được phá

1. `Task` (định nghĩa) **khác** `TaskOccurrence` (một lần thực hiện) **khác** `TimeEntry` (thời gian thực tế).
2. `DONE`, `SKIPPED`, `CANCELLED`, `IN_PROGRESS` thuộc occurrence, không ghi một lần hoàn thành thành trạng thái vĩnh viễn của task lặp.
3. Recurrence generation **idempotent**, không tự tạo vô hạn; sửa rule không ghi đè lịch sử đã hoàn thành.
4. `Year/Quarter/Month/Week/Day` là planning scopes; **không tạo 5 bản sao task hoặc 5 bảng task riêng**.
5. Planned time không phải actual time; analytics không suy diễn active time từ calendar.
6. Mọi aggregate có metric definition, kỳ, đơn vị, timezone, nguồn dữ liệu và điều kiện loại trừ.
7. Repository không tự commit; Service/UoW làm transaction ownership. Mapper không query DB.
8. Mọi record truy xuất phải được kiểm tra owner từ authentication context, không tin `user_id` client gửi.
9. AI **không tự thực thi SQL, JavaScript, JSX hoặc thay đổi nghiệp vụ**; chỉ xuất structured spec/đề xuất được kiểm định.
10. Các thao tác AI gây ghi/xóa/dời lịch phải qua backend business service và user confirmation theo mức độ rủi ro.
11. File trong MinIO, metadata trong MySQL; vector trong Qdrant; xóa/cập nhật phải dọn toàn bộ references theo job có theo dõi.
12. Web và iPhone phải dùng chung HTTP API contract; dữ liệu trên mobile chỉ là bản sao cache cục bộ.

## 8. UX/design principles (áp dụng cho mọi màn hình)

**Intelligent Minimalism + Soft Blue & Colorful Accents.** Ít icon, ít chữ phụ, giảm số card, ưu tiên content-first. Base gợi ý `#F7F9FC` / `#FFFFFF` / `#27354B`, primary `#5D83BB`, accent: lavender `#A99ADB`, sage `#8CB9A5`, peach `#F0B28D`, rose `#E6A0B0`, butter `#E6C879`, sky `#8DBDDB`.

- Phản hồi tương tác tức thời; transition có chọn lọc 120–220ms; native scrolling là mặc định.
- Không ép Lenis cho dashboard/calendar/nested scroll; không lạm dụng gradient, shadow hay animation.
- Empty/error/loading states, keyboard navigation, reduced motion và mobile touch đều phải được kiểm thử.

## 9. Quy tắc bảo mật và hành động phá hủy

- Không chạy `DROP`, `TRUNCATE`, `alembic downgrade` trên dữ liệu thực, xóa volumes hoặc xóa file người dùng nếu không có yêu cầu rõ ràng và phương án backup/restore.
- Không đưa MySQL, Qdrant, MinIO console, Ollama, OCR hoặc AI internal endpoints ra Internet.
- Secrets qua `.env` không commit; `.env.example` chỉ có placeholder.
- MinIO Community cần theo dõi tình trạng bảo trì và bản vá; cô lập mạng, giới hạn quyền, chuẩn bị phương án thay thế nếu xuất hiện rủi ro không thể chấp nhận.
- Mọi tool call AI đều có allowlist, token service, user scope và audit/correlation ID. Chặn vòng lặp Backend ↔ AI.

## 10. Mẫu bàn giao chuẩn

```text
Tóm tắt:
- ...
Phạm vi thay đổi:
- ...
API/DB/migrations/contracts ảnh hưởng:
- ...
Kiểm thử thực tế:
- PASS: ...
- CHƯA CHẠY: ... (lý do)
Rủi ro / quyết định cần duyệt:
- ...
```

## 11. Điều phối Multi-AI (Model Preset: `Balanced` — Antigravity & Codex)

Dự án hỗ trợ chuyển đổi linh hoạt giữa **Antigravity (Gemini)** và **OpenAI Codex** với cùng kiến trúc Multi-Agent 6 vai trò (chi tiết tại `.agents/skills/multi-ai/SKILL.md` và `docs/MULTI_AI_ORCHESTRATION.md`):

| Vai trò | Phạm vi thư mục | Antigravity (Gemini) | OpenAI Codex (`.codex/`) |
|---|---|---|---|
| **`Main`** *(Orchestrator)* | Điều phối, phân rã plan, giữ kiến trúc & contracts | `Orchestrator (Neon)` / `Gemini 4 Neon (Medium)` | `gpt-6.2-sol` (`medium`) |
| **`BE`** *(Backend / DB / Infra)* | `backend/`, `infra/`, `contracts/` | **Dynamic 3-tier** theo độ nặng nhẹ:<br>• *Light:* `Gemini 4 Hydrogen (Low/Medium)`<br>• *Medium:* `Gemini 4 Neon (Medium/High)`<br>• *Heavy:* `Gemini 4 Argon (High)` | **Dynamic 2-tier** theo độ nặng nhẹ:<br>• *Light/Medium (`be`):* `gpt-6-sol` (`medium`/`high`)<br>• *Heavy (`be_heavy`):* `gpt-6.2-sol` (`high`) |
| **`FE`** *(Frontend / UI)* | `frontend/` (Next.js 16, Soft Blue) | `Gemini 4 Hydrogen (Medium/High)` | `gpt-6-sol` (`medium`) |
| **`AI`** *(AI / RAG / OCR)* | `ai-service/`, `ocr-service/` | **Dynamic 3-tier** theo độ nặng nhẹ:<br>• *Light:* `Gemini 4 Hydrogen`<br>• *Medium:* `Gemini 4 Neon`<br>• *Heavy:* `Gemini 4 Argon (High)` | `gpt-6.2-sol` (`medium`/`high`) |
| **`Test`** *(QA & Postman)* | `*/tests/`, `docs/postman/` | `Gemini 3.8 Flash (Medium)` | `gpt-6-luna` (`high`) |
| **`Review`** *(Gatekeeper)* | Read-only diff audit (12 Invariants, Security, Test rules) | `Gemini 4 Hydrogen (High)` | `gpt-6-sol` (`high`) |

**Quy tắc điều phối bắt buộc:**
1. **Cô lập ranh giới file**: Không để 2 subagents cùng sửa một file trong lúc chạy song song (`BE` chỉ sửa `backend/infra/contracts`, `FE` chỉ sửa `frontend/`, `AI` chỉ sửa `ai-service/ocr-service`, `Test` chỉ sửa `*/tests/` & `docs/postman/`).
2. **Luồng 4 bước chuẩn**: `Main` (chốt contract & chia task) → `BE` / `FE` / `AI` (triển khai) → `Test` (chạy pytest qua `TransactionalProxySession` không lưu dữ liệu vào DB thật + viết Postman `.md` tuyệt đối không dùng `curl`) → `Review` (read-only kiểm định trước khi bàn giao).

> File `AGENTS.md` là bản tương thích Codex của `AGENT.md`. Bộ skill chuẩn nằm ở `.agents/skills/<tên>/SKILL.md`, custom agents cho Antigravity nằm ở `.agents/agents/<tên>.md`, và cấu hình Codex nằm ở `.codex/config.toml` cùng `.codex/agents/<tên>.toml`.
