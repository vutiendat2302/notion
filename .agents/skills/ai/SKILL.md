---
name: ai
description: "Triển khai AI Service độc lập FastAPI/Pydantic AI Python 3.14 theo Hybrid Architecture, task intelligence, planning, analytics, chart spec, agent tools, RAG, memory và LLM local."
---

# AI Service Engineering — Hybrid & Pydantic AI Skill

## Khi nào dùng

Dùng khi xây AI Agent/LLM integration, task parsing, smart planning, natural language analytics, AI chart/dashboard, RAG, memory, model routing, structured output, tool calling hoặc AI evaluation.

## Nguyên tắc kiến trúc

**AI Service là FastAPI application/container độc lập với Backend**, dùng Python 3.14, Pydantic AI, Ollama local. Frontend không gọi AI Service trực tiếp. Backend là cổng auth/authorization và nơi áp dụng nghiệp vụ.

```text
Frontend → Backend public AI Gateway → AI Service orchestrator
                                   ├─► Ollama local (hoặc cloud được user bật)
                                   ├─► Backend internal read tools → Services → MySQL
                                   ├─► OCR Service → text/layout/table
                                   ├─► Qdrant → semantic retrieval
                                   └─► ai_metadata_db (chỉ AI-owned state)
                  ◄─ Validated AI result / action proposal ◄─
Frontend ← Backend kiểm tra response & confirmation ←
```

**Không cho model trực tiếp truy vấn `productivity_db`, sinh SQL tùy ý để chạy, thực thi code hay ghi task vào DB.**

## Cấu trúc Hybrid chuẩn

```text
ai-service/app/
├── main.py
├── core/                 # config, auth, telemetry, rate limits
├── providers/            # Ollama/cloud adapters, model selection
├── shared/               # output contracts/typed common tools
└── modules/
    ├── task_intelligence/
    │   ├── api/
    │   ├── services/
    │   ├── agents/
    │   ├── tools/
    │   ├── schemas/
    │   └── prompts/
    ├── planning/
    │   ├── api/
    │   ├── services/
    │   ├── agents/
    │   ├── engines/
    │   └── schemas/
    ├── analytics/
    ├── visualization/
    ├── document_intelligence/
    ├── rag/
    └── memory/           # chỉ khi có use case rõ
```

Không ép mọi module phải có đủ các thư mục; `agents` và `tools` có khi không cần. Tính năng hợp lệ đầu tiên có thể dùng một agent/chung model, chưa cần multi-agent orchestration.

## Năng lực AI theo nhóm

| Domain | Use case | Kết quả cho phép |
|---|---|---|
| Task Intelligence | nhập task tiếng Việt, trích xuất ngày/giờ/lặp/priority; breakdown | `TaskDraft`, `ClarificationNeeded`, `SubtaskProposal` |
| Natural Language Search | hỏi còn deadline gì, thời gian đã học | `AnswerWithEvidence` từ tool data |
| Planning | daily/weekly plan, replan, workload balance | `ScheduleProposal`, không tự commit |
| Analytics | insights, planned vs actual, streak | lời giải thích có nguồn/số đo thật |
| Visualization | tạo chart/dashboard theo câu hỏi | `ChartSpec`/`DashboardSpec` dạng JSON allowlist |
| RAG | tìm kiếm ghi chú/tài liệu đã index | trả chunks có provenance/file/page |
| Document Intelligence | OCR → trích task từ ảnh/PDF | bản nháp cần xác nhận |
| Memory | preference user cho phép lưu | user editable, có expire/delete |

## Structured outputs & grounded evidence

- Dùng Pydantic v2 models và validation; model output là **candidate**, không phải dữ liệu đáng tin.
- Parse task: phân biệt trường được nói rõ, trường ước đoán, trường còn thiếu. "Tối mai" không tự tạo giờ bắt đầu nếu user chưa định nghĩa mặc định.
- Analytics: chỉ Backend Analytics Service tính metric; AI diễn giải và đề xuất, kèm `metric_id`, period, unit, data status.
- RAG: trả `file_id`, `chunk_id`, page/section offsets và excerpt có giới hạn. Không bịa nguồn, không khẳng định không có tài liệu khi index chưa hoàn tất.
- Chart spec: allowed `line|bar|area|pie|scatter|heatmap` theo implementation; dataset key là metric registry đã duyệt, không tùy ý frontend code.
- Dashboard spec: widget types/layout/filter và data query spec; **không để LLM sinh JSX/JS/CSS/SQL để thi hành**.
- Action proposal: `proposal_id`, requested_action, target IDs, before/after, impact, expiry, version/hash; user confirm đi qua Backend.

### Ví dụ output contract minh họa

```json
{
  "kind": "chart",
  "title": "Giờ học theo ngày",
  "metric_id": "active_minutes_by_day",
  "filters": {"category_id": "<id>", "period": "last_30_days"},
  "chart": {"type": "line", "x_key": "date", "series": ["active_minutes"]},
  "evidence": {"source": "backend_analytics_service", "data_as_of": "<ISO8601>"}
}
```

Đây là contract thiết kế đề xuất, chưa được coi là schema production cho đến khi `contracts/` có version chính thức.

## Tool calling — chuẩn bảo mật

- Tool registry theo **allowlist** và intent-specific scopes: `search_tasks`, `get_calendar_range`, `get_goal_progress`, `get_analytics_metric`, `get_file_excerpt`.
- AI Service gọi **Backend internal API** với service credential, delegated authenticated user context được Backend ký/xác minh, timeout và correlation ID.
- Internal tool route không gọi ngược AI Orchestrator để tránh loop.
- Tool read trả tối thiểu dữ liệu cần cho câu hỏi; giới hạn record/page và thời gian truy vấn.
- Tool write không cấp trực tiếp cho LLM trong MVP. Dùng proposal → Backend xác nhận → service write.
- Mọi content từ RAG/OCR/người dùng là **dữ liệu không đáng tin**, không nâng thành system instructions (prompt injection defense).

## Planning algorithm — AI hỗ trợ, rules quyết định

1. Backend cung cấp task/occurrences, working hours, fixed events, deadlines, estimate và priorities.
2. Constraint engine kiểm tra overlapping, duration, non-working windows, min breaks và target scope.
3. LLM đề xuất thứ tự và lý do khi hữu ích, không quyết định kết quả bất hợp lệ.
4. Engine chấm feasible, chỉ trả phương án hợp lệ (hoặc giải thích vì sao không thể xếp).
5. Frontend hiển thị preview/diff; chỉ sau confirmation Backend mới cập nhật occurrences.

## Provider & cost policy

- Mặc định Ollama self-host; local mode hoạt động offline nếu hạ tầng sẵn sàng.
- Cloud provider là **opt-in**, không fallback âm thầm từ local lên cloud khi dữ liệu cá nhân nhạy cảm.
- Tách adapter/model interface, không hardcode model ID vào business rules.
- Set maximum requests/tools/tokens, timeout và backoff hữu hạn; phân biệt model unavailable với bad prompt và tool failure.
- Không log toàn bộ prompt/tài liệu theo mặc định; thông tin debug cần masking và retention.
- Đo: intent accuracy, entity F1, tool correctness, groundedness, invalid output, action proposal safety, latency P50/P95, cost, fallback.

## AI evaluation và kiểm thử

- Test bằng dataset tiếng Việt thực tế: task rút gọn, chữ viết tắt, ngày tương đối, thiếu giờ, nhiều task trong một câu, dời/hủy, đồng âm, ảnh OCR lỗi.
- Golden tests cho `TaskDraft`, `ChartSpec`, `ScheduleProposal` và `ClarificationNeeded`.
- Mock provider/tools cho unit tests; kiểm tra integration với local Ollama và Backend internal API tách riêng.
- Regression: AI trả JSON sai, không có vector, tài liệu chưa index, question no-data, hallucinated citations, prompt injection, tool timeout.

## Definition of Done

- [ ] Không kết nối MySQL nghiệp vụ từ AI Service.
- [ ] Output được Pydantic + backend domain validation kiểm tra.
- [ ] Ghi/xóa/dời lịch chỉ qua confirmation Backend.
- [ ] Chart có metric/period/evidence; không tạo fake numbers.
- [ ] AI bị lỗi thì app core vẫn hoạt động.
- [ ] Có evaluation dataset, logging an toàn, giới hạn tài nguyên và context.
