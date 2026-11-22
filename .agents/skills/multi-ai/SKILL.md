---
name: multi-ai
description: >-
  Chiến lược điều phối Multi-AI / Multi-Agent (Preset: Balanced) dùng chung cho
  cả Antigravity (Gemini) và OpenAI Codex: định tuyến model động theo vai trò
  (Main, BE, FE, AI, Test, Review) và độ nặng nhẹ của task (Light / Medium /
  Heavy), cô lập ngữ cảnh, bàn giao qua file/board và quy trình kiểm định.
---

# Multi-AI Orchestration Skill — Preset: Balanced (Antigravity ↔ Codex)

## Khi nào dùng

Kích hoạt skill này khi:
- Điều phối công việc đa tác nhân (Multi-Agent / Subagents / Swarm / Workflow) trong dự án **Personal Productivity & Time Management App**.
- Chuyển đổi phiên làm việc giữa **Antigravity (Gemini)** và **OpenAI Codex** mà vẫn giữ nguyên cấu trúc vai trò (`Main`, `BE`, `FE`, `AI`, `Test`, `Review`) và preset **Balanced**.
- Cần quyết định chọn model nào (`Argon`, `Neon`, `Hydrogen`, `3.8 Flash` trên Antigravity; hoặc `6.2 Sol`, `6 Sol`, `6 Luna` trên Codex) theo mức độ nặng nhẹ của từng task.

---

## 1. Bảng ánh xạ Model Preset: `Balanced` (Dual-Harness)

| Vai trò (Role) | Phạm vi phụ trách | Antigravity (Gemini) Model | OpenAI Codex Model (`config.toml` / `agents/*.toml`) |
|---|---|---|---|
| **`Main`** *(Orchestrator)* | Điều phối, phân rã kế hoạch, giữ kiến trúc & contracts, tổng hợp kết quả | **`Orchestrator (Neon)`** hoặc **`Gemini 4 Neon (Medium)`** | **`gpt-6.2-sol`** (`model_reasoning_effort = "medium"`, Plan mode: `"high"`) |
| **`BE`** *(Backend / DB / Infra)* | `backend/`, `infra/`, `contracts/` (FastAPI Python 3.14, MySQL 8.4, Alembic, MinIO) | **Dynamic 3-tier** theo task:<br>• *Light:* `Gemini 4 Hydrogen (Low/Medium)`<br>• *Medium:* `Gemini 4 Neon (Medium/High)` hoặc `Hydrogen (High)`<br>• *Heavy:* `Gemini 4 Argon (High)` | **Dynamic 2-tier** theo task:<br>• *Light/Medium (`be`):* `gpt-6-sol` (`medium`/`high`)<br>• *Heavy (`be_heavy`):* `gpt-6.2-sol` (`medium`/`high`) |
| **`FE`** *(Frontend / UI)* | `frontend/` (Next.js 16, React 19, Tailwind v4, shadcn Base UI, Soft Blue) | **`Gemini 4 Hydrogen (Medium)`** *(lên `Hydrogen (High)` cho interactive phức tạp)* | **`gpt-6-sol`** (`medium`; lên `high` cho drag-drop/calendar phức tạp) |
| **`AI`** *(AI Service / RAG / OCR)* | `ai-service/` (:8001 Pydantic AI, Ollama, Qdrant), `ocr-service/` (:8866 PaddleOCR) | **Dynamic 3-tier** theo task:<br>• *Light:* `Gemini 4 Hydrogen (Medium/High)`<br>• *Medium:* `Gemini 4 Neon (Medium/High)`<br>• *Heavy:* `Gemini 4 Argon (High)` | **`gpt-6.2-sol`** (`medium` mặc định; `high` cho planning engine / agent evals) |
| **`Test`** *(QA & Postman Docs)* | `*/tests/` (`TransactionalProxySession` pytest, Vitest) & `docs/postman/*_postman.md` (no `curl`) | **`Gemini 3.8 Flash (Medium)`** *(tier `flash_lite` / `flash`)* | **`gpt-6-luna`** (`model_reasoning_effort = "high"`) |
| **`Review`** *(Gatekeeper)* | Read-only review kiểm tra 12 Domain Invariants, security, ownership, contracts, test rules | **`Gemini 4 Hydrogen (High)`** *(hoặc `Medium` cho diff nhỏ)* | **`gpt-6-sol`** (`model_reasoning_effort = "high"`) |

---

## 2. Ma trận định tuyến động (Dynamic Task Complexity Routing) cho `BE` và `AI`

Để tránh lãng phí quota model lớn cho việc cơ học nhưng vẫn đảm bảo độ chính xác tuyệt đối ở các bài toán kiến trúc/dữ liệu khó, **`Main` Orchestrator** phân loại task trước khi spawn `BE` hoặc `AI`:

### 2.1. Phân loại độ nặng nhẹ cho `BE` (`backend/`, `infra/`, `contracts/`)

| Mức độ | Dấu hiệu nhận biết (Task Signals) | Antigravity Model | Codex Agent / Model |
|---|---|---|---|
| **🟢 Light** *(Cơ học, 1–2 files)* | • Thêm/sửa Pydantic schema, DTO, mapper, enum, config.<br>• CRUD endpoint đơn giản đã có sẵn pattern và bảng DB.<br>• Sửa lỗi lint/typecheck (`ruff`, `pyright`) hoặc bug nhỏ cục bộ. | `Gemini 4 Hydrogen (Low)` hoặc `Gemini 4 Hydrogen (Medium)`<br>*(Subagent tier: `flash`)* | Agent: `be`<br>`model = "gpt-6-sol"`<br>`reasoning_effort = "low"` hoặc `"medium"` |
| **🟡 Medium** *(Nghiệp vụ chuẩn, 3–6 files)* | • Viết Service + Repository cho module chuẩn (`projects`, `categories`, `tags`, `goals`, `habits`, `files`).<br>• Viết query lọc theo khoảng ngày `[start_date, end_date_exclusive)`, pagination, partial `PATCH` (`model_fields_set`).<br>• Viết migration Alembic đơn giản không có khóa/ràng buộc phức tạp. | `Gemini 4 Neon (Medium)` / `Gemini 4 Neon (High)` hoặc `Gemini 4 Hydrogen (High)`<br>*(Subagent tier: `inherit`)* | Agent: `be`<br>`model = "gpt-6-sol"`<br>`reasoning_effort = "medium"` hoặc `"high"` |
| **🔴 Heavy** *(Kiến trúc, Concurrency, Core Engine)* | • Thuật toán sinh `TaskOccurrence` lặp (RRULE idempotent, exception, không ghi đè lịch sử `DONE`).<br>• Alembic migration có `BINARY(16)` UUIDv7, Virtual Generated Column (`active_user_lock`), XOR `CHECK` + `ON DELETE RESTRICT` (MySQL Error 3823).<br>• Rollover kế hoạch `Year → Quarter → Month → Week → Day`, Time Tracking qua nửa đêm, Reminder `FOR UPDATE SKIP LOCKED`, Optimistic Locking `409`.<br>• AI Gateway & Internal Tool APIs (`/internal/v1/ai-tools/*`), scoped token, action proposal confirmation. | `Gemini 4 Argon (High)` *(hoặc `Gemini 4 Hydrogen (XHigh)` khi Argon hết quota)*<br>*(Subagent tier: `pro`)* | Agent: `be_heavy`<br>`model = "gpt-6.2-sol"`<br>`reasoning_effort = "high"` |

### 2.2. Phân loại độ nặng nhẹ cho `AI` (`ai-service/`, `ocr-service/`)

| Mức độ | Dấu hiệu nhận biết (Task Signals) | Antigravity Model | Codex Agent / Model |
|---|---|---|---|
| **🟢 Light** | • Khai báo Pydantic output schemas (`TaskDraft`, `ChartSpec`, `ClarificationNeeded`), config, healthcheck.<br>• Tinh chỉnh prompt template hoặc parser regex/date đơn giản. | `Gemini 4 Hydrogen (Medium)`<br>*(Subagent tier: `flash`)* | Agent: `ai`<br>`model = "gpt-6.2-sol"`<br>`reasoning_effort = "low"` hoặc `"medium"` |
| **🟡 Medium** | • Tích hợp Ollama provider, Qdrant vector ingestion/search, PaddleOCR / PP-StructureV3 pipeline.<br>• Kết nối HTTP client gọi Backend internal read tools (`/internal/v1/ai-tools/*`). | `Gemini 4 Neon (Medium)` hoặc `Gemini 4 Neon (High)`<br>*(Subagent tier: `inherit`)* | Agent: `ai`<br>`model = "gpt-6.2-sol"`<br>`reasoning_effort = "medium"` |
| **🔴 Heavy** | • Constraint-based Smart Planning Engine (kết hợp hard rules với LLM proposal).<br>• Multi-step Pydantic AI agent orchestration, prompt injection defense, action proposal safety token, golden evaluation suite tiếng Việt. | `Gemini 4 Argon (High)`<br>*(Subagent tier: `pro`)* | Agent: `ai`<br>`model = "gpt-6.2-sol"`<br>`reasoning_effort = "high"` |

---

## 3. Quy trình Điều phối Chuẩn 4 Pha (`Main → Workers → Test → Review`)

```text
[User Request]
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│ Pha 1: MAIN ORCHESTRATOR (Neon Medium / GPT-6.2 Sol Medium)  │
│ - Đọc AGENTS.md,IMPLEMENTATION_PLAN.md & chốt API Contract   │
│ - Chia task độc lập theo ranh giới thư mục (không đụng file) │
│ - Chấm độ nặng nhẹ (Light / Medium / Heavy) để chọn Model    │
└───────────────┬──────────────────────┬───────────────────────┘
                │                      │
       (Chạy song song hoặc tuần tự theo phụ thuộc contract)
                ▼                      ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│ Pha 2A: BE / AI Subagent  │  │ Pha 2B: FE Subagent       │
│ - BE: Argon/Neon/Hydrogen │  │ - FE: Hydrogen / 6 Sol    │
│   hoặc 6.2 Sol / 6 Sol    │  │ - Chỉ sửa frontend/       │
│ - AI: Argon/Neon/Hydrogen │  │ - Bám Soft Blue &         │
│   hoặc 6.2 Sol            │  │   OpenAPI contract        │
└───────────────┬───────────┘  └───────────────┬───────────┘
                └──────────────┬───────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Pha 3: TEST SUBAGENT (Gemini 3.8 Flash / GPT-6 Luna High)    │
│ - Viết & chạy pytest qua TransactionalProxySession (0 DB rác)│
│ - Viết/chạy test FE (Vitest/Playwright)                      │
│ - Viết docs/postman/<id>_<feature>_postman.md (0 dùng curl)  │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Pha 4: REVIEW SUBAGENT (Gemini 4 Hydrogen / GPT-6 Sol High)  │
│ - Read-only diff audit: 12 Domain Invariants, Auth Ownership,│
│   MySQL constraints, Contract sync, Test & Postman compliance│
│ - Nếu có [P0]/[P1] -> Main giao lại đúng Worker sửa (FixLoop)│
└──────────────────────────────┬───────────────────────────────┘
                               ▼
                    [Main tổng hợp & Bàn giao]
```

### Nguyên tắc Vệ sinh Ngữ cảnh (Context Hygiene) & Chống Xung đột File
1. **Không để 2 worker cùng sửa 1 file**: `BE` chỉ sửa `backend/`, `infra/`, `contracts/`; `FE` chỉ sửa `frontend/`; `AI` chỉ sửa `ai-service/`, `ocr-service/`; `Test` chỉ sửa `*/tests/` và `docs/postman/`.
2. **Brief ngắn gọn, tự chứa (Self-contained Brief)**: Subagent khởi tạo với ngữ cảnh sạch (`fork_turns: "none"` trên Codex hoặc worker mới trên Antigravity). `Main` chỉ truyền:
   - Mục tiêu cụ thể của task & danh sách file được phép sửa.
   - Đường dẫn tài liệu/contract cần đọc (không copy-paste cả file dài vào prompt).
   - Tiêu chí nghiệm thu (lệnh test cần chạy).
3. **Subagent không tự đẻ thêm Reviewer riêng**: Chỉ `Main` mới là người gọi `Test` và `Review` sau khi Worker hoàn thành.

---

## 4. Cách Thực Thi Cụ Thể Trên Từng Công Cụ

### 4.1. Khi bạn đang dùng **Antigravity (Gemini)**

1. **Chế độ Subagent thường (`invoke_subagent`)**:
   - Gọi custom agent đã khai báo trong `.agents/agents/{be,fe,ai,test,review}.md`:
     - `Test`: `invoke_subagent(TypeName="test", Role="QA & Postman Tester", Model="flash_lite", Prompt="...")`
     - `FE`: `invoke_subagent(TypeName="fe", Role="Frontend Engineer", Model="flash", Prompt="...")`
     - `Review`: `invoke_subagent(TypeName="review", Role="Architecture Reviewer", Model="flash", Prompt="...")`
     - `BE` / `AI`: chọn `Model="flash"` (Light — Hydrogen), `Model="inherit"` (Medium — Neon), hoặc `Model="pro"` (Heavy — Argon).
   - Nếu chạy `BE` và `FE` song song có ghi file, đặt `Workspace="share"` để mỗi subagent có working copy riêng, sau đó hợp nhất.

2. **Chế độ `/swarm` (Khi bạn gõ `/swarm` cho feature lớn)**:
   - Coordinator (`Main` — `Orchestrator (Neon)` / `Gemini 4 Neon (Medium)`) dùng tool `swarm{action:"add"}` và ghim đúng tên model theo yêu cầu:
     - `BE`: `model: "Gemini 4 Argon (High)"` (Heavy) | `"Gemini 4 Neon (High)"` (Medium) | `"Gemini 4 Hydrogen (Medium)"` (Light), `workspace: "share"`
     - `FE`: `model: "Gemini 4 Hydrogen (Medium)"` (hoặc `"Gemini 4 Hydrogen (High)"`), `workspace: "share"`
     - `AI`: `model: "Gemini 4 Argon (High)"` | `"Gemini 4 Neon (High)"` | `"Gemini 4 Hydrogen (Medium)"`, `workspace: "share"`
     - `Test`: `model: "Gemini 3.8 Flash (Medium)"`, `workspace: "inherit"`
     - `Review`: `model: "Gemini 4 Hydrogen (High)"`, `workspace: "inherit"`
   - Khi một worker trong `/swarm` cần đổi model theo độ nặng nhẹ của task tiếp theo (ví dụ `be` chuyển từ task migration nặng sang sửa DTO nhẹ), Coordinator gọi:
     `swarm{action:"model", name:"be", model:"Gemini 4 Hydrogen (Medium)"}` (giữ nguyên hội thoại của worker mà không cần `kill`).

### 4.2. Khi bạn đang dùng **OpenAI Codex**

- Cấu hình `.codex/config.toml` đã thiết lập sẵn `Main` là `gpt-6.2-sol` (`medium`) và `review_model = "gpt-6-sol"`.
- Các custom agents trong `.codex/agents/` đã được gắn sẵn model chuẩn:
  - `be` → `gpt-6-sol` (`medium`)
  - `be_heavy` → `gpt-6.2-sol` (`high`)
  - `fe` → `gpt-6-sol` (`medium`)
  - `ai` → `gpt-6.2-sol` (`medium`)
  - `test` → `gpt-6-luna` (`high`)
  - `review` → `gpt-6-sol` (`high`)
- Khi giao việc cho Codex, Main Agent sẽ gọi `spawn_agent` với `agent_type` tương ứng (`"be"`, `"be_heavy"`, `"fe"`, `"ai"`, `"test"`, `"review"`) và `fork_turns = "none"`, hoặc truyền trực tiếp `model` + `reasoning_effort` khi cần nâng/hạ bậc cho từng task.
