---
name: product
description: "Phân tích nghiệp vụ Personal Productivity, workspace năm/quý/tháng/tuần/ngày, mục tiêu, task và phạm vi feature khi lên kế hoạch hoặc viết acceptance criteria."
---

# Product & Functional Analysis Skill

## Khi nào dùng

Áp dụng khi nhận yêu cầu mới, phân tích UX flow, phân rã tính năng, xây use case, xác định business rules, P0/P1/P2, lập API scope hoặc review tính nhất quán của hệ thống.

## Trách nhiệm và mục tiêu

- Biến câu hỏi "cần làm gì" thành **Use Case → Business Rules → Data Ownership → API → Tests**.
- Duy trì tính thống nhất của kế hoạch đa cấp; không vì UI mà tạo dữ liệu trùng.
- Giữ thiết kế **personal-first**: đủ chức năng nhưng không xây cơ chế tổ chức nhiều tenant phức tạp khi chưa cần.
- Không đặt deadline hoặc ước lượng thời gian nếu người dùng không yêu cầu.

## Phạm vi nghiệp vụ chuẩn

| Nhóm | Nhiệm vụ chính | Nguyên tắc |
|---|---|---|
| Workspace | Today, Inbox, Upcoming, Recents, Favorites | Inbox có thể là truy vấn, không phải một project giả |
| Planning | Yearly, Quarterly, Monthly, Weekly, Daily; rollover, review | Một task/occurrence được tham chiếu, không nhân bản |
| Goals | Goals, milestones, targets, measurable evidence | Metric có đơn vị và nguồn dữ liệu rõ |
| Projects | Metadata, task membership, tiến độ, deadline | Tránh cộng trùng parent task & subtask |
| Tasks | CRUD, priority, status mỗi occurrence, detail | Definition khác execution |
| Task hierarchy | Subtasks, checklists, dependencies | Khác nhau về tính độc lập và vòng đời |
| Recurrence | Rules, exception, preview, generate | Không sửa lịch sử đã hoàn thành |
| Calendar | Day/week/month/timeline, time blocking | Calendar là view của occurrence; event độc lập mới có entity riêng |
| Time tracking | Start/pause/resume/stop, manual entries | Actual time dựa trên time entries |
| Analytics | Overview, trends, heatmap, planned vs actual | Backend tính số, AI chỉ diễn giải |
| Content | Notes, files, templates, import/export | Mở rộng khi business case rõ |
| AI | Smart task, planner, natural query, chart, OCR/RAG | Proposal rồi xác nhận trước write |

## Quy trình phân tích một feature

1. **Mục tiêu người dùng:** tình huống, đầu vào, hành động, kết quả kỳ vọng.
2. **Actors:** một người dùng trước; agent chỉ là bên được ủy quyền có giới hạn.
3. **State machine:** trạng thái hợp lệ; ai được chuyển; undo/reopen; lỗi/cancel.
4. **Dữ liệu gốc:** entity sở hữu, thuộc tính, quan hệ, invariants.
5. **Derived data:** có thể tính runtime hay cần snapshot có phiên bản và lý do.
6. **Boundary:** Backend, AI, OCR, storage, mobile; không gộp trách nhiệm.
7. **API contract:** path/resource, request, response, error, idempotency.
8. **Edge cases:** timezone, task chưa xếp lịch, lặp, chuyển kỳ, dữ liệu thiếu, concurrent edits.
9. **Acceptance criteria:** kịch bản tích cực/tiêu cực, test dữ liệu và UI.
10. **Priority:** P0 là dùng mỗi ngày; P1 mở rộng sau, P2 khi chứng minh nhu cầu.

## Planning workspaces — quy tắc không được bỏ qua

- **Year:** mục tiêu trọng tâm, roadmap, project chính, so sánh tiến độ theo quý.
- **Quarter:** bẻ mục tiêu năm thành milestone và target trong quý.
- **Month:** phân bổ mục tiêu/thời gian, backlog, review tháng.
- **Week:** chọn ưu tiên, workload, lên lịch, weekly review và rollover.
- **Day:** Today, timeline, làm việc thực tế, review cuối ngày.
- **Cross-period:** tuần giao tháng, task nhiều kỳ, chuyển kỳ kế hoạch, đóng/mở review; không tự tạo mới task khi chỉ chuyển kỳ.
- **Kỳ kế hoạch** không phải là một bản sao của calendar. Có thể lưu `planning_period` và `plan_item` nếu use case cần priority, commitment hay review riêng.

## Vòng đời nhiệm vụ phải mô tả riêng

- Task definition: title, description, estimate, project, category, archived state.
- Occurrence: scheduled date/time, execution status, completed time, reschedule events.
- Time entry: phiên thực tế, có thể nhiều phiên/occurrence hoặc không gắn task.
- Checklist item: bước thực hiện; với task lặp, check state có thể cần theo occurrence.
- Habit: có thể tracking định lượng (km, phút, cốc nước), không ép thành task trong mọi tình huống.
- Goal: metric có target/unit/period và evidence; không mặc định `%` bằng số task done.

## Output template

```markdown
### Feature: <tên>
- ID / module / priority:
- User story:
- Preconditions:
- Input / output:
- Happy path:
- Alternative flows:
- Business rules / invariants:
- Data entities & ownership:
- API candidates:
- Security/privacy:
- Edge cases:
- Acceptance criteria:
- Không làm trong đợt này:
```

## Kiểm tra trước nghiệm thu

- [ ] Mỗi feature có outcome quan sát được và owner module.
- [ ] Không nhân bản Task vì màn hình năm/tháng/tuần/ngày.
- [ ] Không ghép planned với actual trong metric.
- [ ] Không biến mọi ý tưởng thành P0 hoặc một bảng mới.
- [ ] Tính đúng trạng thái task lặp và tiến độ mục tiêu.
- [ ] Với action AI: có preview, xác nhận, audit và đường fallback không AI.
