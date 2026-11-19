# PERSONAL PRODUCTIVITY & TIME MANAGEMENT APP
# Functional Requirements & Backend Feature Inventory — v2.0

> **Loại tài liệu:** Product Functional Specification (PRD + Business Requirements + Backend Feature Inventory)  
> **Ngày:** 17/11/2026  
> **Trạng thái:** Bản thiết kế nghiệp vụ đề xuất để review; **không phải schema/API đã triển khai**  
> **Đối tượng:** Product owner, backend developer, database designer, AI coding assistant  
> **Phạm vi:** Workspace theo Năm/Quý/Tháng/Tuần/Ngày, Goals, Projects, Tasks, Subtasks, Recurrence, Time Tracking, Calendar, Habits, Notes, Files, Analytics, Reviews, Reminders, Search, Views, Automation, Integration  
> **Kiến trúc đã thống nhất:** Frontend Next.js + TypeScript; Business Backend Python 3.14 + FastAPI theo **Hybrid Architecture**; MySQL 8.4 LTS; MinIO self-host; AI Service riêng theo Hybrid; OCR Service riêng; Qdrant + Ollama self-host  
> **Phong cách sản phẩm:** Intelligent Minimalism · Soft Blue + pastel accents · ít icon, ít thông tin thừa · nhanh và mượt  
> **Thay thế:** Feature Inventory v1.0 trong cuộc trao đổi; mở rộng thêm Planning Workspaces đa cấp và quy tắc nghiệp vụ chi tiết.

---

## 0. Executive Summary

Mục tiêu không phải sao chép toàn bộ Notion. Đây là **Personal Productivity OS**: một hệ thống thống nhất để quyết định **mình muốn đạt điều gì**, **cần làm gì**, **sắp xếp khi nào**, **đã thực sự làm bao lâu**, **kết quả ra sao** và **nên điều chỉnh gì**.

### Sáu trụ cột sản phẩm

1. **Plan:** Không gian lập kế hoạch Năm → Quý → Tháng → Tuần → Ngày, có mục tiêu, trọng tâm, phân bổ thời gian và tổng kết.
2. **Execute:** Tasks, subtasks, checklist, dependencies, trạng thái từng lần thực hiện và timer/focus.
3. **Organize:** Projects, categories, tags, notes/pages, saved views, attachments.
4. **Measure:** Task progress, goal progress, planned vs actual, activity heatmap, streaks và các bảng thống kê có định nghĩa rõ.
5. **Reflect:** Daily/weekly/monthly/quarterly/yearly reviews, bài học, các việc chuyển kỳ, đánh giá khả năng thực hiện.
6. **Assist:** AI service độc lập dùng backend tools để hỏi đáp, gợi ý lịch, tạo chart và xử lý file/OCR; **không trực tiếp ghi database nghiệp vụ**.

### Ranh giới cần giữ

- **Workspace** là không gian dữ liệu cá nhân. **Year/Quarter/Month/Week/Day** là *Planning Scopes/Views*, không mặc định là năm database hoặc workspace độc lập.
- **Task** là định nghĩa công việc; **Task Occurrence** là một lần cần thực hiện; **Time Entry** là bằng chứng thời gian đã dành. Không trộn ba loại này.
- **Goal** là kết quả mong đạt, **Project** là tập hợp công việc hướng đến đầu ra, **Plan** là cam kết/phân bổ nguồn lực trong một kỳ; chúng có thể liên kết nhưng không đồng nghĩa.
- **Calendar View** chỉ là cách xem lịch; không sao chép task/occurrence sang bảng lịch chỉ để hiển thị.
- **Các metric** phải tính từ dữ liệu chuẩn, không cộng tùy tiện số lần hoàn thành với giờ hoạt động.
- **AI/OCR** có vòng đời và container riêng, backend vẫn sở hữu xác thực, authorization, business state, MySQL và file metadata.

### Độ ưu tiên

| Mức | Định nghĩa | Quy tắc triển khai |
|---|---|---|
| **P0** | Cần để app có thể quản lý và thực hiện kế hoạch hằng ngày | Triển khai lõi trước; có test nghiệp vụ |
| **P1** | Làm sản phẩm hữu ích, hoàn chỉnh hơn và giống Notion | Thiết kế contract sớm, triển khai sau lõi |
| **P2** | Nâng cao, kết nối, tự động hóa, tùy chỉnh sâu | Chỉ làm khi nhu cầu thực tế rõ |
| **P3** | Nghiên cứu/định hướng dài hạn | Không làm phức tạp schema hiện tại chỉ để dự phòng |

### Nguyên tắc thiết kế API

- CRUD dùng REST resource; nghiệp vụ như `complete`, `reschedule`, `archive`, `rollover`, `close-period` có thể dùng action endpoint rõ nghĩa.
- `PATCH` hỗ trợ cập nhật từng phần; phân biệt **trường bị bỏ qua** với **trường được chủ động đặt thành `null`**.
- Mọi resource truy vấn theo user/workspace được kiểm soát ở server; không tin `user_id` do client tự khai.
- Có pagination, sorting, filtering; thay đổi trạng thái quan trọng có audit event và transaction.
- API có `version`, error code ổn định, validation có đường dẫn trường lỗi và idempotency khi cần.

---

## 1. Bức tranh nghiệp vụ toàn hệ thống

```text
PERSONAL WORKSPACE
│
├── VISION & DIRECTION
│   ├── Long-term vision / life areas
│   ├── Yearly goals
│   └── Annual review
│
├── PLANNING HORIZONS
│   ├── Year 2027
│   │   ├── Quarter Q1, Q2, Q3, Q4
│   │   ├── Months Jan...Dec
│   │   └── Yearly focus, capacity, milestones, reviews
│   ├── Month November
│   │   ├── Monthly goals and priorities
│   │   ├── Weekly plans
│   │   └── Monthly review
│   ├── Week 2026-W47
│   │   ├── Weekly outcomes
│   │   ├── Planned work blocks
│   │   └── Weekly review / rollover
│   └── Day 2026-11-17
│       ├── Top priorities
│       ├── Task occurrences / time blocks
│       ├── Focus sessions / actual time
│       └── Daily review
│
├── EXECUTION
│   ├── Projects → Tasks → Occurrences
│   ├── Subtasks, checklists, dependencies
│   └── Time entries / focus sessions
│
├── KNOWLEDGE & FILES
│   ├── Notes / pages / templates
│   └── MinIO attachments → OCR / AI indexing
│
└── INSIGHTS
    ├── Goals, projects, habits, progress
    ├── Planned vs actual, heatmap, trends
    └── Dashboards + AI-generated chart specs
```

### Phân biệt 6 khái niệm dễ bị nhầm

| Khái niệm | Trả lời câu hỏi | Ví dụ | Dữ liệu gốc |
|---|---|---|---|
| **Goal** | Muốn đạt kết quả gì? | Đạt 200 giờ IELTS trong năm | Goal + progress evidence |
| **Project** | Cần tổ chức những đầu việc nào? | Khóa luận tốt nghiệp | Project + task relations |
| **Task** | Việc cụ thể phải làm là gì? | Viết chương 2 | Task definition |
| **Occurrence** | Phải làm lần nào, ở ngày nào? | Học IELTS thứ Hai 20:00 | Occurrence |
| **Time Entry** | Thực tế đã làm lúc nào, bao lâu? | 20:10–21:05 | Time entry |
| **Planning Period** | Cam kết làm gì trong kỳ này? | Tuần 47 ưu tiên chương 2 | Period + selected items |

**Chỉ một nguồn sự thật cho mỗi khái niệm.** Link được dùng để nối các đối tượng, không sao chép dữ liệu và trạng thái giữa các kỳ.

---

## 2. Workspace và cấu trúc kế hoạch Năm → Quý → Tháng → Tuần → Ngày

### 2.1. Một workspace cá nhân, nhiều planning scopes

Bản đầu có thể chỉ có **một personal workspace**. Người dùng chuyển scope bằng thanh điều hướng **Year / Quarter / Month / Week / Today**, không cần tạo 365 workspace hay 12 bản sao task.

Mỗi scope có hai lớp:

1. **Dynamic view:** Tổng hợp task, goal, event, time entry theo `date range` và filter, luôn cập nhật.
2. **Saved plan/review:** Lưu những gì người dùng **đã chủ động cam kết, ưu tiên, ghi chú, đánh giá** trong kỳ; các mục này chỉ tồn tại khi được tạo.

### 2.2. Quan hệ giữa các kỳ

```text
Year Plan (2027)
├── Q1 Plan (01–03/2027)
│   ├── January Plan
│   │   ├── Week A (ISO or user-configured)
│   │   │   ├── Monday Daily Plan
│   │   │   ├── Tuesday Daily Plan
│   │   │   └── ...
│   │   └── Week B ...
│   ├── February Plan
│   └── March Plan
├── Q2 Plan
├── Q3 Plan
└── Q4 Plan
```

**Lưu ý quan trọng:** Tuần có thể trải qua hai tháng/hai năm. **Không được ép mỗi tuần chỉ thuộc duy nhất một tháng** bằng foreign key; quan hệ thời gian phải tính bằng khoảng ngày giao nhau. Kỳ có thể được liên kết logic để điều hướng, nhưng phép tính phải dựa trên khoảng thời gian và timezone.

### 2.3. Trạng thái một kỳ kế hoạch

- `DRAFT`: Đang lập kế hoạch.
- `ACTIVE`: Kỳ đang được theo dõi.
- `CLOSED`: Đã khóa bản tổng kết kỳ (vẫn có thể cho chỉnh sửa thông qua quy trình mở lại có audit).
- `ARCHIVED`: Lưu trữ kỳ kế hoạch/ghi chú; không xóa task và hoạt động gốc.

Không bắt buộc lưu `FUTURE` hay `PAST` vì suy ra được từ ngày. Một kỳ lịch có thể chưa có bản ghi `plan` trong DB.

### 2.4. Chức năng quản lý kế hoạch chung

| ID | Chức năng | Chi tiết hành vi và dữ liệu | Ưu tiên |
|---|---|---|---|
| PLAN-001 | Open Period | Mở kỳ Năm/Quý/Tháng/Tuần/Ngày theo timezone và lịch tuần tùy chọn | P0 |
| PLAN-002 | Create Saved Plan | Lưu bản kế hoạch với title/focus/notes, status ban đầu DRAFT | P0 |
| PLAN-003 | Edit Plan | Sửa focus, mục tiêu kỳ, ghi chú và ngân sách thời gian | P0 |
| PLAN-004 | Pin Period Item | Ghim task/project/goal vào một kỳ mà **không nhân bản resource** | P0 |
| PLAN-005 | Reorder Priorities | Thứ tự ưu tiên riêng cho kỳ, không nhất thiết đổi priority gốc của task | P0 |
| PLAN-006 | Add Planning Note | Nội dung định hướng/đánh giá kế hoạch | P0 |
| PLAN-007 | Link Parent Goal | Liên kết mục tiêu năm/quý/tháng hoặc cấp cao hơn | P1 |
| PLAN-008 | Period Capacity | Số giờ khả dụng, mức tải kế hoạch và giờ thực tế | P1 |
| PLAN-009 | Compare Plan vs Actual | Thời lượng/việc dự kiến so với thực tế đúng trong khoảng kỳ | P0 |
| PLAN-010 | Period Progress | Tính tiến độ mục tiêu và kế hoạch theo công thức được định nghĩa | P0 |
| PLAN-011 | Open / Close Review | Tạo tổng kết, đánh dấu đã hoàn tất review | P1 |
| PLAN-012 | Rollover Pending Work | Đề xuất chuyển việc chưa hoàn thành sang kỳ sau với preview | P0 |
| PLAN-013 | Copy Plan Template | Sinh bản nháp kế hoạch từ template | P1 |
| PLAN-014 | Cross-period Navigation | Quay về kỳ trước, sau, hiện tại, so sánh hai kỳ | P0 |
| PLAN-015 | Plan History | Ghi lịch sử thay đổi danh sách ưu tiên, focus, close/reopen | P1 |
| PLAN-016 | Restore Archived Plan | Khôi phục bản kế hoạch, không tác động dữ liệu thực hiện | P1 |

### 2.5. Chính sách chuyển việc sang kỳ sau (Rollover)

1. Truy vấn occurrence **chưa hoàn thành** trong kỳ và task chưa xếp lịch mà user chủ động chọn.
2. Xác định lý do: quá tải, phụ thuộc, trì hoãn chủ động, hủy hoặc thiếu thông tin.
3. Hiển thị **preview**: giữ nguyên / dời một occurrence / chỉ ghim task vào plan sau / bỏ qua.
4. Khi xác nhận, cập nhật bằng service nghiệp vụ; **không đổi trạng thái DONE trong quá khứ**, không tạo bản sao task.
5. Lưu event `ROLLOVER_APPLIED` và `source_period`, `target_period` nếu cần audit.
6. Trường hợp recurring task: dời một occurrence **không làm thay đổi** recurrence rule trong tương lai.
7. Xử lý conflict: nếu kỳ sau quá tải hoặc xung đột, đánh dấu để user xác nhận.

### 2.6. Ví dụ luồng kế hoạch

```text
Year Goal: 300 giờ học ngoại ngữ
  ↓ (phân rã / allocate)
Q1 Target: 70 giờ
  ↓
January Target: 24 giờ
  ↓
Week 3 Focus: 6 giờ học
  ↓
Tuesday: IELTS task occurrence 20:00–21:30
  ↓
Time entry: thực tế học 70 phút
  ↓
Weekly Review: 5h20m / 6h
  ↓
Monthly Review: cập nhật tổng từ time_entries, không tự cộng KPI thủ công
```

**Mục tiêu theo kỳ** là kế hoạch/target. **Giá trị thực tế** phải tính từ nguồn dữ liệu thực hoặc được nhập thủ công với provenance rõ ràng.

---

## 3. Yearly Workspace — Không gian năm

**Mục đích:** Chọn hướng đi lớn, các mục tiêu dài hạn, dự án trọng điểm, kế hoạch theo quý và nhìn lại toàn năm.

### 3.1. Thông tin chính trên màn hình năm

- Năm đang xem, year focus / theme, 3–5 kết quả ưu tiên (giới hạn gợi ý UX, backend không hardcode).
- Danh sách goal năm, tiến độ theo từng loại chỉ số.
- Danh sách project quan trọng và deadline dự kiến.
- Bốn quý, 12 tháng; summary ngắn và drill-down.
- Thời lượng mục tiêu/dự kiến/thực tế theo category, project.
- Các mốc (milestones), những thay đổi lớn và annual review.

### 3.2. Feature Inventory — Year Planning

| ID | Chức năng | Chi tiết xử lý | Ưu tiên |
|---|---|---|---|
| YEAR-001 | Year Overview | KPI, goals, projects, milestones, focus và lịch hoạt động năm | P0 |
| YEAR-002 | Set Year Theme | Đặt chủ đề/trọng tâm năm, có ghi chú | P1 |
| YEAR-003 | Define Annual Outcomes | Xác định outcomes/commitments gắn goal | P0 |
| YEAR-004 | Annual Goal Portfolio | Lọc goal theo status, category, target date, priority | P0 |
| YEAR-005 | Annual Project Roadmap | Xem các dự án trải dài năm và mốc hoàn thành | P1 |
| YEAR-006 | Quarter Roadmap | Phân bổ goals/milestones sang Q1–Q4 | P0 |
| YEAR-007 | Monthly Milestone Calendar | Xem milestone và target theo tháng | P1 |
| YEAR-008 | Yearly Time Budget | Đặt ngân sách giờ cho học, công việc, sức khỏe, cá nhân | P1 |
| YEAR-009 | Annual Active Time | Tổng thời gian thực tế đã ghi nhận trong năm | P0 |
| YEAR-010 | Goal Progress Breakdown | Số liệu đạt mục tiêu theo đơn vị riêng | P0 |
| YEAR-011 | Year-on-Year Comparison | So sánh metrics tương đương giữa hai năm | P1 |
| YEAR-012 | Annual Review | Thành tựu, khó khăn, bài học, điều chỉnh sang năm sau | P1 |
| YEAR-013 | Rollover Annual Goals | Chọn goal tiếp tục, đóng goal cũ hoặc tạo target năm mới | P1 |
| YEAR-014 | Annual Report Export | Xuất báo cáo từ dữ liệu đã tính, file ra MinIO | P2 |

**Không tự giả định năm dương lịch là năm học/năm tài chính.** Giai đoạn đầu dùng năm dương lịch, có thể bổ sung fiscal-year tùy chọn nếu thực sự cần.

### 3.3. Quy tắc đặc biệt

- Goal dài hạn kéo qua nhiều năm không được nhân bản nếu vẫn là **cùng một mục tiêu**; có thể có target/snapshot riêng từng kỳ.
- Báo cáo năm không tính những occurrence tương lai là thất bại.
- Giờ thực tế cộng từ time entry theo **phân bổ thời gian cắt theo biên ngày/năm**, tránh ghi toàn bộ phiên đêm sang một kỳ sai.
- Đóng review năm không đóng mọi task hoặc project chưa xong.

---

## 4. Quarterly Workspace — Không gian quý

**Mục đích:** Chuyển chiến lược năm thành kế hoạch thực hiện 12–13 tuần; ít dự án trọng tâm, milestone rõ và đánh giá giữa năm.

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| QTR-001 | Quarter Overview | Hiển thị quý, 3 tháng, goal, workload, milestone và status | P0 |
| QTR-002 | Select Quarterly Priorities | Chọn 1–N mục tiêu ưu tiên, sắp xếp thứ tự | P0 |
| QTR-003 | Allocate Annual Goal | Phân bổ target của goal năm vào quý | P1 |
| QTR-004 | Quarterly Project Plan | Chọn project phải hoàn thành/tiến triển trong quý | P0 |
| QTR-005 | Define Quarter Outcomes | Đặt kết quả kỳ vọng, số đo minh bạch | P0 |
| QTR-006 | Milestone Scheduling | Xếp các mốc vào tháng/tuần | P1 |
| QTR-007 | Quarterly Capacity | Xem khả năng đáp ứng theo giờ và công việc | P1 |
| QTR-008 | Quarter Progress | Planned vs actual, milestone reached và goal values | P0 |
| QTR-009 | Monthly Breakdown | Tổng hợp các tháng có ngày giao với quý | P0 |
| QTR-010 | Mid-Quarter Check-in | Đánh giá giữa quý và điều chỉnh focus | P1 |
| QTR-011 | Quarterly Review | Thắng/thua/bài học/cải tiến quý sau | P1 |
| QTR-012 | Move To Next Quarter | Preview công việc/mục tiêu chưa xong | P1 |

**Quy tắc:** Các chỉ số hoàn thành trong quý dùng đúng timestamp/khoảng ngày, không chỉ dựa vào `created_at` của task. Quý chỉ là một kỳ kế hoạch, không được tạo task bản sao mỗi quý.

---

## 5. Monthly Workspace — Không gian tháng

**Mục đích:** Chốt trọng tâm 4–5 tuần, milestone, thời lượng mục tiêu, khối lượng việc và kế hoạch đều đặn.

### 5.1. Các vùng nội dung

- **Monthly Focus:** 1–3 điều quan trọng nhất.
- **Monthly Outcomes:** Goals và milestones cần đạt cuối tháng.
- **Monthly Board:** Projects/tasks nổi bật và tiến độ.
- **Calendar:** Ngày có lịch, deadline, time blocks.
- **Week Strip:** Các tuần giao với tháng; nhấn để chuyển sang trang tuần.
- **Progress:** Planned vs actual, completion, active hours, habit consistency.
- **Monthly Review:** Tổng kết, rollover và lựa chọn tháng sau.

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| MONTH-001 | Month Overview | KPI, goals, deadlines, occurrences và activity month | P0 |
| MONTH-002 | Set Monthly Focus | Trọng tâm tháng, vị trí ưu tiên và mô tả | P0 |
| MONTH-003 | Monthly Goal Targets | Đặt kỳ vọng cho từng goal tháng | P0 |
| MONTH-004 | Monthly Project Milestones | Chọn milestone dự án cần đạt | P0 |
| MONTH-005 | Monthly Task Backlog | Danh sách việc mục tiêu và việc chưa có lịch | P0 |
| MONTH-006 | Monthly Calendar | Date grid, all-day, event count, dự kiến workload | P0 |
| MONTH-007 | Monthly Weekly Breakdown | Tổng hợp tuần, tránh cộng trùng ở tuần giao tháng | P0 |
| MONTH-008 | Monthly Time Budget | Phân bổ số giờ cho category/project | P1 |
| MONTH-009 | Monthly Habit Targets | Số lần/giá trị mục tiêu trong tháng | P1 |
| MONTH-010 | Monthly Completion Trend | Tiến độ theo ngày, task và occurrence | P0 |
| MONTH-011 | Monthly Planned vs Actual | Dự kiến vs thực tế có cùng đơn vị, khoảng ngày | P0 |
| MONTH-012 | Monthly Workload Alerts | Cảnh báo ngày quá tải, deadline dày | P1 |
| MONTH-013 | Monthly Review | Đánh giá kết quả, khó khăn và cải tiến | P1 |
| MONTH-014 | Rollover To Next Month | Preview các việc chưa xong | P0 |
| MONTH-015 | Compare Months | So sánh theo metric tương đương và cùng quy ước | P1 |
| MONTH-016 | Month Template | Tạo plan theo mẫu (đầu tháng, cuối tháng...) | P2 |

### 5.2. Xử lý tuần giao tháng

Nếu tuần 30/11–06/12, màn hình tháng 11 chỉ thống kê **30/11** cho time metrics tháng 11. Màn hình tuần vẫn xem đầy đủ **30/11–06/12**. Không cắt tuần thành hai thực thể giả để phù hợp layout tháng.

---

## 6. Weekly Workspace — Không gian tuần

**Mục đích:** Lập kế hoạch thực thi thực tế nhất; phân phối task theo ngày, tạo time blocks, kiểm tra capacity và kết thúc tuần bằng review.

### 6.1. Trải nghiệm tuần

- Tiêu đề tuần theo locale và quy tắc tuần bắt đầu (thứ Hai hoặc Chủ nhật, mặc định thứ Hai).
- **Weekly Focus:** một số kết quả quan trọng nhất trong tuần.
- **Weekly Backlog:** task cần làm trong tuần nhưng chưa chọn giờ.
- **Weekly Time Blocks:** phân bổ giờ cụ thể theo ngày.
- **Progress:** completed occurrences, total planned minutes, actual minutes, overdue, goal contribution.
- **Daily Drill-down:** nhấn một ngày sang daily view.
- **Weekly Review:** điều gì tốt/chưa tốt, việc nào dời, vì sao.

| ID | Chức năng | Chi tiết xử lý | Ưu tiên |
|---|---|---|---|
| WEEK-001 | Weekly Overview | 7 ngày, workload, KPI, goal progress | P0 |
| WEEK-002 | Weekly Focus / Big 3 | Mục tiêu ưu tiên trong tuần | P0 |
| WEEK-003 | Weekly Backlog | Danh sách task được chọn nhưng chưa đặt thời điểm | P0 |
| WEEK-004 | Plan Task On Day | Gán occurrence hoặc xếp lịch task chưa schedule | P0 |
| WEEK-005 | Plan Time Block | Dự kiến start/end, duration và project/category | P0 |
| WEEK-006 | Drag Reschedule | Cập nhật một occurrence từ UI kéo-thả | P0 |
| WEEK-007 | Weekly Capacity | Tính giờ trống theo cấu hình working hours + hard blocks | P1 |
| WEEK-008 | Overload Detection | Cảnh báo tổng dự kiến vượt capacity | P1 |
| WEEK-009 | Weekly Task Progress | Tính completed/eligible theo kỳ | P0 |
| WEEK-010 | Weekly Focus Time | Tổng actual từ time entry theo tuần | P0 |
| WEEK-011 | Planned vs Actual Week | So sánh tổng, theo ngày/category/project | P0 |
| WEEK-012 | Weekly Goal Contribution | Mức đóng góp thực tế cho goal | P1 |
| WEEK-013 | Bulk Move Between Days | Xem trước và dời nhiều occurrence | P1 |
| WEEK-014 | Weekly Review | Note, outcomes, lessons, blockers, adjustments | P0 |
| WEEK-015 | Rollover To Next Week | Gợi ý + xác nhận giữ/dời/bỏ | P0 |
| WEEK-016 | Week Compare | So với tuần trước, theo đúng quy tắc | P1 |
| WEEK-017 | Weekly Template | Routine planning/review template | P2 |
| WEEK-018 | Lock Reviewed Week | Đánh dấu review chốt, audit khi mở lại | P2 |

### 6.2. Quy tắc nghiệp vụ

- Task lặp mỗi ngày không được đánh dấu hoàn thành cả tuần chỉ vì một lần DONE.
- Một task có thể được **ghim vào weekly plan** nhưng chưa có occurrence schedule giờ cụ thể.
- Không có dữ liệu time entry nghĩa là **chưa có bằng chứng thời gian**, không mặc định 0 giờ hoạt động đã được xác nhận.
- Có thể chấp nhận một lịch chồng giờ như cảnh báo thay vì chặn tuyệt đối; riêng quy tắc "hard conflict" do user cài mới có quyền chặn.
- Khi thao tác kéo-thả phải kiểm tra revision/version, tránh browser cũ ghi đè update gần nhất.

---

## 7. Daily Workspace / Today — Không gian ngày

**Mục đích:** Mở ứng dụng là biết nên làm gì ngay, còn bao nhiêu thời gian và tiến độ ra sao. Trải nghiệm **content-first**, ít biểu đồ/ít icon.

### 7.1. Cấu trúc UX gợi ý

1. Header ngày + lời nhắc trọng tâm.
2. 1–3 nhiệm vụ ưu tiên; click để Start / Complete / Reschedule.
3. Timeline ngày và unscheduled backlog (có thể thu gọn).
4. Thanh tiến độ ngắn: hoàn thành, thời gian thực tế, lịch kế tiếp.
5. Quick Add một dòng, quick timer; thông tin nâng cao chỉ khi mở detail.

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| DAY-001 | Today Overview | Tổng hợp theo ngày timezone của user | P0 |
| DAY-002 | Daily Focus | Chọn trọng tâm, ghi chú ngắn | P0 |
| DAY-003 | Top Priorities | Ghim và sắp 1–N task quan trọng hôm nay | P0 |
| DAY-004 | Today Occurrences | Việc được lên lịch hoặc đến hạn trong ngày | P0 |
| DAY-005 | Due / Overdue Section | Việc cần quan tâm nhưng chưa hoàn thành | P0 |
| DAY-006 | Daily Time Blocks | Trình bày lịch theo giờ, drag/resize | P0 |
| DAY-007 | Quick Add Task | Thêm task với tối thiểu title | P0 |
| DAY-008 | Start Focus | Bắt đầu time entry từ task/occurrence | P0 |
| DAY-009 | Pause / Stop Focus | Tạm dừng/kết thúc, ghi thời lượng thực | P0 |
| DAY-010 | Mark Occurrence Done | Hoàn thành chính xác occurrence đang xử lý | P0 |
| DAY-011 | Snooze / Move Task | Dời một occurrence hoặc lời nhắc | P0 |
| DAY-012 | Daily Capacity | Giờ có thể làm, giờ đã lên lịch, giờ còn trống | P1 |
| DAY-013 | Daily Completion | Completed / eligible occurrences | P0 |
| DAY-014 | Daily Actual Time | Tổng active time đã được ghi nhận | P0 |
| DAY-015 | Daily Habit Check-in | Thực hiện thói quen trong ngày | P1 |
| DAY-016 | Daily Notes / Reflection | Điều đã làm, khó khăn, tự đánh giá | P1 |
| DAY-017 | End-of-day Review | Chốt ngày, gợi ý chuyển việc chưa xong | P1 |
| DAY-018 | Tomorrow Preview | Xem ngày tiếp theo và chỉnh lịch | P1 |
| DAY-019 | Daily Activity Feed | Các sự kiện task/timer/check-in trong ngày | P1 |
| DAY-020 | Quick Replan | Đề xuất dời việc còn lại, có preview + xác nhận | P1 |

### 7.2. Quy tắc xác định task xuất hiện trong Today

**Không gộp ẩu ba nhóm:**

- **Scheduled today:** occurrence có `scheduled_date` bằng ngày địa phương; có thể có/không có giờ.
- **Due today:** deadline rơi vào ngày địa phương, dù được lên lịch ở ngày khác.
- **Overdue:** tới hạn trước thời điểm hiện tại, chưa thuộc trạng thái kết thúc; cách tính theo task all-day có chính sách riêng.

Một task/occurrence có thể thỏa nhiều điều kiện nhưng **chỉ hiện một lần trong danh sách chính** và đính metadata/section phù hợp.

### 7.3. Daily Review mẫu

- Hôm nay hoàn thành được kết quả nào?
- Kế hoạch ban đầu là bao nhiêu task/phút?
- Thời gian thực tế bao nhiêu (theo nguồn TIMER/MANUAL)?
- Còn gì chưa xong và tại sao?
- Chuyển sang ngày mai hay tiếp tục để nguyên?
- Đề xuất ngày mai cần ưu tiên gì (AI optional, không tự ghi)?

---

## 8. Inbox, Backlog và Quick Capture

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| INB-001 | Unscheduled Inbox | Task chưa xếp lịch và chưa archive | P0 |
| INB-002 | Quick Capture | Tạo task title-only, nội dung bổ sung sau | P0 |
| INB-003 | Capture Note | Lưu ý tưởng/ghi chú chưa phân loại | P1 |
| INB-004 | Process Inbox | Chọn Project, Category, Priority, Schedule | P0 |
| INB-005 | Bulk Triage | Phân loại/xếp lịch nhiều task | P1 |
| INB-006 | Duplicate Detection | Gợi ý task tên giống nhau, không tự merge | P1 |
| INB-007 | Archive / Delete | Dọn Inbox với retention rules | P0 |
| INB-008 | Capture from File/OCR | Tạo draft từ nội dung ảnh hoặc tài liệu | P2 |

Inbox là **view/query** theo trạng thái tổ chức, không bắt buộc là một database table với bản sao task.

---

## 9. Goals & Milestones — Hệ thống mục tiêu

### 9.1. Phân loại mục tiêu

| Loại goal | Đặc điểm | Ví dụ | Nguồn progress |
|---|---|---|---|
| **Quantitative** | Có target và đơn vị xác định | 200 giờ IELTS | Time entries đã xác thực |
| **Count-based** | Theo số lần hoặc số lượng | Đọc 12 cuốn sách | Measurement / manual entry |
| **Habit-based** | Dựa trên đều đặn/chuỗi | Tập 4 buổi/tuần | Habit check-ins |
| **Task-based** | Gắn với một tập công việc cụ thể | Hoàn thành 10 bài tập | Eligible task occurrences |
| **Milestone-based** | Theo cột mốc | Hoàn thành 3 chương khóa luận | Milestone status |
| **Qualitative** | Kết quả cần đánh giá thủ công | Cải thiện kỹ năng thuyết trình | Review với nguồn minh chứng |

**Không ép mọi goal thành `completed_tasks / total_tasks`.** Goal có **unit**, `target`, `measurement method`, `start/end`, `current evidence` và chính sách cập nhật riêng.

### 9.2. Mô hình Goal → Period Targets → Evidence

```text
Goal: 200 giờ IELTS đến 31/12
├── Goal Period Target: Q1 60 giờ
├── Goal Period Target: Q2 50 giờ
├── Goal Period Target: Q3 45 giờ
└── Goal Period Target: Q4 45 giờ

Actual goal progress
├── Linked time entries from category/project/task
├── Other verified measurements (nếu cấu hình)
└── Manual update with evidence/source (nếu cho phép)
```

Tổng target các kỳ **không bắt buộc** phải đúng 100% target mẹ trong lúc lập bản nháp; hệ thống cần cảnh báo tổng phân bổ thiếu/thừa. Không ghi tổng actual vào mỗi period target vì có thể tính lại từ nguồn gốc.

### 9.3. Feature Inventory

| ID | Chức năng | Chi tiết xử lý | Ưu tiên |
|---|---|---|---|
| GOAL-001 | Create Goal | Title, description, category, owner, goal type, target, unit, period | P0 |
| GOAL-002 | Edit Goal | Update một phần trường, audit thay đổi target | P0 |
| GOAL-003 | Goal Detail | Target, current value, milestones, linked entities, progress evidence | P0 |
| GOAL-004 | Goal List | Filter year/quarter/status/type/category/priority | P0 |
| GOAL-005 | Link Goal To Plan | Gắn goal vào năm/quý/tháng/tuần mà không copy goal | P0 |
| GOAL-006 | Link Project | Một goal có thể được hỗ trợ bởi nhiều project | P0 |
| GOAL-007 | Link Task | Task đóng góp vào goal, có thể điều chỉnh weight | P1 |
| GOAL-008 | Goal Target / Unit | Giá trị mục tiêu và đơn vị (`hours`, `times`, `pages`, ...) | P0 |
| GOAL-009 | Measurement Method | Chọn nguồn tính progress tự động/thủ công | P0 |
| GOAL-010 | Record Measurement | Ghi kết quả định lượng với thời điểm + nguồn | P0 |
| GOAL-011 | Auto Goal Progress | Tính từ time entries/check-ins/task evidence | P1 |
| GOAL-012 | Allocate Period Targets | Chia target ra quý/tháng/tuần | P0 |
| GOAL-013 | Period Progress Breakdown | Tổng hợp achievement trên từng kỳ | P0 |
| GOAL-014 | Add Milestone | Mục tiêu nhỏ, target date, dependencies | P0 |
| GOAL-015 | Complete / Reopen Milestone | Lưu status và thời điểm, audit | P0 |
| GOAL-016 | Goal Status | `NOT_STARTED`, `ACTIVE`, `ON_HOLD`, `ACHIEVED`, `CANCELLED` | P0 |
| GOAL-017 | Goal Health | Cảnh báo chậm so với tiến độ kỳ vọng | P1 |
| GOAL-018 | Goal Deadline | Deadline + cảnh báo mục tiêu gần đến hạn | P0 |
| GOAL-019 | Goal Timeline | Diễn biến progress theo các lần đo | P1 |
| GOAL-020 | Goal Forecast | Dự đoán theo dữ liệu thực, có uncertainty | P2 |
| GOAL-021 | Goal Reflection | Ghi bài học, thay đổi định hướng | P1 |
| GOAL-022 | Archive / Restore Goal | Lưu dữ liệu lịch sử, không xóa related evidence | P0 |
| GOAL-023 | Duplicate Goal Template | Tạo goal mới từ mẫu, không copy completion history | P1 |
| GOAL-024 | Goal Dashboard | KPI, progress, subtargets, milestones, trends | P1 |

### 9.4. Business rules — Goals

1. `current_value` với nguồn **AUTO** phải có cách tính tái lập từ các bản ghi gốc.
2. Không cộng trùng thời lượng khi một time entry gắn cả project lẫn task cùng đóng góp vào một goal. Cần quy tắc attribution rõ.
3. Goal có progress quá target được phép hiển thị `>100%` ở giá trị thực, nhưng thanh progress có thể clamp ở 100% cho UI.
4. Thay đổi target sau khi đã đạt không được xóa lịch sử các lần đo; phải lưu `goal_target_changed`.
5. Với goal có target định lượng, đơn vị phải nhất quán; đổi đơn vị yêu cầu migration/conversion chính xác hoặc tạo goal mới.
6. Goal `ACHIEVED` không tự động complete tất cả task liên quan.
7. Goal thời hạn cuối năm không bắt buộc thuộc duy nhất Year Plan của năm đó; người dùng có thể gắn vào các kỳ khác nhau.

---

## 10. Project Management — Quản lý dự án

**Đơn vị nghiệp vụ:** Project là tập hợp task/milestone liên quan, thường có start date, target date, status, progress và tài liệu. Có thể thuộc 0..N goals thông qua links.

| ID | Chức năng | Chi tiết xử lý | Ưu tiên |
|---|---|---|---|
| PRJ-001 | Create Project | Tên, mô tả, dates, owner, category, color | P0 |
| PRJ-002 | Update Project | PATCH thuộc tính, track change | P0 |
| PRJ-003 | Project Detail | Summary, tasks, milestones, notes, files, analytics | P0 |
| PRJ-004 | Project List | Filter/search/sort/pagination | P0 |
| PRJ-005 | Project Status | `PLANNED`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED` | P0 |
| PRJ-006 | Link Project To Goal | Gắn một hoặc nhiều goals | P0 |
| PRJ-007 | Link Project To Period | Ghim vào Year/Quarter/Month/Week plan | P0 |
| PRJ-008 | Add / Move Task | Gắn task vào project, bảo toàn history | P0 |
| PRJ-009 | Project Sections | Nhóm việc như Backlog, In progress, Done | P1 |
| PRJ-010 | Milestones | Thêm/sửa/complete cột mốc | P0 |
| PRJ-011 | Project Priority | Độ ưu tiên cấp project | P1 |
| PRJ-012 | Project Completion | KPI hoàn thành theo thống kê có quy ước | P0 |
| PRJ-013 | Project Planned Hours | Tổng thời gian dự kiến, không cộng trùng subtask | P0 |
| PRJ-014 | Project Actual Hours | Tổng time entry liên quan, cắt theo kỳ | P0 |
| PRJ-015 | Project Deadline Health | Chậm tiến độ, milestone gần đến hạn | P1 |
| PRJ-016 | Project Timeline / Gantt | Schedule theo task/occurrence, dependency | P1 |
| PRJ-017 | Project Views | Table, Board, List, Calendar, Timeline | P1 |
| PRJ-018 | Project Template | Tạo dự án từ mẫu | P2 |
| PRJ-019 | Archive / Restore | Lưu trữ project, policy rõ với task con | P0 |
| PRJ-020 | Project Notes / Attachments | Ghi chú/file qua content và file services | P1 |
| PRJ-021 | Project Activity History | Timeline sự kiện nghiệp vụ quan trọng | P1 |
| PRJ-022 | Project Review | Tổng kết project, lessons learned, closure | P1 |

### Progress cấp Project — yêu cầu bắt buộc

- `TASK_COUNT_COMPLETION`: số task hợp lệ hoàn thành / số task hợp lệ. Với recurring task, phải định nghĩa rõ có dùng task gốc hay occurrence trong một kỳ.
- `OCCURRENCE_COMPLETION`: số occurrence DONE / số occurrence eligible trong kỳ.
- `MILESTONE_COMPLETION`: số milestone đạt / milestone tổng.
- `TIME_ALLOCATION`: actual minutes / planned minutes; **không** được gọi là tỷ lệ hoàn thành công việc.
- `WEIGHTED_PROGRESS` (P2): theo ước lượng hoặc weight công khai, không tự đoán.

Backend nên trả tên phương pháp và công thức/metadata kèm giá trị để UI không hiển thị con số thiếu ý nghĩa.

---

## 11. Task Management — CRUD, tổ chức và vòng đời

### 11.1. Trường dữ liệu người dùng thường chỉnh

- **Title** (bắt buộc, không toàn khoảng trắng), description/rich content, notes.
- Project, category, tags, priority, parent task, related tasks.
- Estimate (minutes), due date, scheduling preferences (ngày/giờ cụ thể theo occurrence).
- Recurrence rule (nếu lặp), checklist template, reminder policy.
- Links, attachments, custom properties (P2), archive metadata.

### 11.2. Feature Inventory — Task Core

| ID | Chức năng | Chi tiết xử lý | Ưu tiên |
|---|---|---|---|
| TASK-001 | Create Task | Tạo task title-only hoặc đầy đủ, validate business rules | P0 |
| TASK-002 | Quick Add | Tạo qua text input ngắn, lưu draft nếu chưa đủ | P0 |
| TASK-003 | Task Detail | Trả task core + related summary theo nhu cầu | P0 |
| TASK-004 | List / Pagination | Filter, sort, page/cursor, ownership | P0 |
| TASK-005 | Partial Update | PATCH chỉ trường được cung cấp; cho phép clear trường nullable | P0 |
| TASK-006 | Change Priority | Low/Medium/High/Urgent hoặc cấu hình rõ | P0 |
| TASK-007 | Assign Project | Chuyển project, bảo toàn occurrence/time entry | P0 |
| TASK-008 | Assign Category | Thêm/sửa category với authorization | P0 |
| TASK-009 | Add / Remove Tags | Quan hệ M:N, tránh tag trùng | P0 |
| TASK-010 | Set Estimate | Phút dự kiến; không tự động tạo time entry | P0 |
| TASK-011 | Set Due Date | Deadline riêng với scheduled date | P0 |
| TASK-012 | Schedule Single Task | Sinh/gắn occurrence đúng nghiệp vụ | P0 |
| TASK-013 | Duplicate Task | Copy selected fields/checklist template, không copy history | P0 |
| TASK-014 | Archive Task | Không xóa time entries/historical occurrences | P0 |
| TASK-015 | Restore Task | Khôi phục từ archive theo policy | P0 |
| TASK-016 | Soft Delete | Ẩn khỏi UI, có retention policy | P1 |
| TASK-017 | Permanent Delete | Xóa thật có confirmation và cleanup policy | P2 |
| TASK-018 | Bulk Update | Trả per-item success/error, idempotency phù hợp | P1 |
| TASK-019 | Bulk Archive / Move | Hành động hàng loạt có preview | P1 |
| TASK-020 | Reorder Task | Thứ tự hiển thị trong view/section | P0 |
| TASK-021 | Pin / Favorite | Ghim task, phân biệt priority nghiệp vụ | P1 |
| TASK-022 | Search Task | Search title, description, tags, filters | P0 |
| TASK-023 | Get Task Summary | Lấy KPIs cho card/list mà không nạp toàn history | P0 |
| TASK-024 | Task History | Timeline events và change diff | P1 |
| TASK-025 | Task Link / Unlink | Liên kết related task, goal, notes, files | P1 |
| TASK-026 | Task Template | Tạo từ template có chọn trường | P1 |
| TASK-027 | Manual Progress Entry | Chỉ khi task có progress định lượng độc lập, provenance | P2 |

### 11.3. Vòng đời Task vs Occurrence

**Task definition** không có trạng thái `DONE` mang ý nghĩa hoàn thành của **mọi** lần thực hiện. Một task có thể `ACTIVE/ARCHIVED` về mặt quản lý, nhưng lịch sử thực thi nằm ở occurrences.

**Occurrence status proposal:**

```text
NOT_STARTED → IN_PROGRESS → DONE
      ├────→ SKIPPED
      └────→ CANCELLED
DONE → NOT_STARTED  (Reopen có audit)
IN_PROGRESS → NOT_STARTED (Reset có audit)
```

- `OVERDUE` là thuộc tính **tính từ deadline/scheduled date + now + status**, không lưu cứng và dễ lỗi thời.
- `DONE` có `completed_at` và nguồn hành động.
- Hoàn thành task một lần = hoàn thành occurrence đơn tương ứng.
- Task định kỳ hôm nay DONE, occurrence ngày mai vẫn NOT_STARTED.

### 11.4. Thao tác chi tiết Task Occurrence

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| OCC-001 | Get Occurrence | Thông tin một lần thực hiện | P0 |
| OCC-002 | List Occurrences | Filter theo task/period/status/due | P0 |
| OCC-003 | Create One-off Occurrence | Tạo lịch một lần (theo policy) | P0 |
| OCC-004 | Mark In Progress | Đánh dấu đang làm, không bắt buộc auto-start timer | P0 |
| OCC-005 | Complete | Chuyển DONE và ghi completed_at một cách atomic | P0 |
| OCC-006 | Reopen | Khôi phục status với audit, không xóa time entries | P0 |
| OCC-007 | Skip | Bỏ qua một lần, có reason tùy chọn | P0 |
| OCC-008 | Cancel | Hủy một lần, phân biệt SKIPPED | P0 |
| OCC-009 | Reschedule | Đổi lịch cho occurrence cụ thể | P0 |
| OCC-010 | Change Duration | Sửa estimate thời lượng occurrence | P0 |
| OCC-011 | Add Completion Note | Kết quả thực hiện / evidence | P1 |
| OCC-012 | Get Occurrence Time | Thời gian thực tế gắn occurrence | P0 |
| OCC-013 | Bulk Complete | Phân nhóm item, validate từng item | P1 |
| OCC-014 | Reconcile Recurrence | Đồng bộ future occurrences theo rule có policy | P1 |
| OCC-015 | Occurrence Timeline | Lịch sử state/time changes | P1 |

### 11.5. Chính sách update linh hoạt

- `PATCH {"title":"..."}` chỉ sửa title, không buộc gửi project/priority/start time.
- `PATCH {"category_id":null}` chủ động xóa category nếu cho phép.
- Field không xuất hiện trong payload giữ nguyên.
- Nếu update recurring task phải phân biệt **`this_occurrence` / `future_occurrences` / `series_definition`** theo ngữ cảnh; không tự áp dụng cho toàn series.
- Resource có `updated_at`/revision hoặc optimistic concurrency, ngăn ghi đè im lặng từ hai thiết bị.

---

## 12. Task Details, Subtasks, Checklists và Dependencies

### 12.1. Chi tiết task — các tab/khối dữ liệu

| ID | Chức năng | Backend phải cung cấp | Ưu tiên |
|---|---|---|---|
| DETAIL-001 | General | Title, description, status of next occurrence, priority, metadata | P0 |
| DETAIL-002 | Properties | Project/category/tags/estimate/due/recurrence | P0 |
| DETAIL-003 | Schedule | Occurrences lịch sử và tương lai (có pagination) | P0 |
| DETAIL-004 | Progress | Completion metrics và phương pháp tính | P0 |
| DETAIL-005 | Planned vs Actual | Planned minutes vs time entries, date window | P0 |
| DETAIL-006 | Session History | Time entries theo task/occurrence | P0 |
| DETAIL-007 | Subtasks | Danh sách task con và parent progress | P0 |
| DETAIL-008 | Checklist | Template items + execution state | P0 |
| DETAIL-009 | Relationships | Task dependencies, related items | P1 |
| DETAIL-010 | Notes / Rich Content | Nội dung có cấu trúc với update/version | P1 |
| DETAIL-011 | Files | Link attachments + metadata MinIO | P1 |
| DETAIL-012 | History | Activity timeline và state changes | P1 |
| DETAIL-013 | Reminders | Quy tắc nhắc và lịch sử giao | P0 |
| DETAIL-014 | Charts | Trend, actual hours, completion, heatmap | P1 |

### 12.2. Subtasks

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| SUB-001 | Create Child Task | `parent_task_id`, kế thừa project theo policy | P0 |
| SUB-002 | Update Child | CRUD như task độc lập | P0 |
| SUB-003 | Nested Hierarchy | Hỗ trợ nhiều cấp, quy định max depth tùy nhu cầu | P1 |
| SUB-004 | Move Child | Đổi parent, chống self-link/ancestor cycle | P1 |
| SUB-005 | Reorder Children | Thứ tự hiển thị | P0 |
| SUB-006 | Child Completion | DONE là theo occurrence của subtask | P0 |
| SUB-007 | Parent Progress | Cách đếm con cần định nghĩa, tránh đếm trùng | P0 |
| SUB-008 | Rollup Estimate | Tổng ước lượng con, không tự cộng cha và con nếu là phần việc trùng | P1 |
| SUB-009 | Archive / Restore Hierarchy | Chính sách rõ với task con, có preview | P1 |

### 12.3. Checklists

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| CHK-001 | Add Checklist Item | Title, sort order, parent task | P0 |
| CHK-002 | Edit / Remove Item | Update template, preserve prior completion history | P0 |
| CHK-003 | Reorder Items | Thứ tự checklist | P0 |
| CHK-004 | Check Occurrence Item | State riêng theo một occurrence | P0 |
| CHK-005 | Uncheck Item | Undo theo occurrence | P0 |
| CHK-006 | Checklist Progress | Checked/eligible theo occurrence | P0 |
| CHK-007 | Reset For Next Occurrence | Lần thực hiện mới có checklist state mới | P0 |
| CHK-008 | Checklist Templates | Copy item definitions nhưng không copy tick history | P1 |

### 12.4. Dependencies

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| DEP-001 | Add Dependency | `blocks` / `blocked_by` theo một canonical relation | P1 |
| DEP-002 | Remove Dependency | Xóa relation, audit | P1 |
| DEP-003 | Detect Cycle | Chặn vòng lặp A→B→C→A | P1 |
| DEP-004 | List Blockers | Lấy task đang chặn, kèm status | P1 |
| DEP-005 | Blocked State | Dynamic computed state thay vì duplicate persisted flag | P1 |
| DEP-006 | Dependency Timeline | Gợi ý task nào nên làm trước | P2 |

### 12.5. Cần phân biệt 4 loại tiến độ

1. **Occurrence completion:** Đã hoàn thành lần thực hiện nào.
2. **Checklist completion:** Các bước trong **một** occurrence đã tick đến đâu.
3. **Subtask completion:** Các công việc con được hoàn thành theo chính sách nào.
4. **Time effort:** Đã dành bao nhiêu phút so với dự kiến (không tương đương % công việc hoàn thành).

Backend trả metric cùng `metric_type` và `window`, không trả một trường `progress_percent` chung cho mọi hoàn cảnh.

---

## 13. Recurring Tasks & Recurrence Engine

**Phạm vi khởi đầu:** `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, intervals, weekdays, start/end, exceptions; không cần hỗ trợ toàn bộ iCalendar RRULE v1.

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| REC-001 | Create Rule | Frequency, interval, start/end, timezone | P0 |
| REC-002 | Select Weekdays | Multi-weekday cho lịch tuần | P0 |
| REC-003 | Select Monthday | Lặp ngày N mỗi tháng, xử lý tháng thiếu ngày | P1 |
| REC-004 | Yearly Rule | Lặp theo ngày/tháng cụ thể | P1 |
| REC-005 | Custom Interval | Mỗi 2 ngày, 3 tuần... | P0 |
| REC-006 | Rule Preview | Trả N occurrences tương lai, chưa commit | P0 |
| REC-007 | Generate Occurrences | Sinh trên demand hoặc rolling horizon theo policy | P0 |
| REC-008 | Idempotent Generation | Unique recurrence key + transaction/constraint | P0 |
| REC-009 | Pause / Resume | Tạm dừng sinh mới, giữ lịch sử | P0 |
| REC-010 | Edit One Occurrence | Dời/bỏ/cập nhật một lần không tác động series | P0 |
| REC-011 | Edit Future Series | Sửa từ mốc tương lai, bảo toàn lịch sử | P0 |
| REC-012 | Edit Definition | Chỉnh template chỉ theo policy đã xác nhận | P0 |
| REC-013 | Exceptions | Exdate/override date/time cho một lần | P1 |
| REC-014 | End By Date / Count | Dừng sau date hoặc N occurrences hợp lệ | P1 |
| REC-015 | Reconcile Future | Regenerate only safe future, preserve overrides | P1 |
| REC-016 | Detect Gap / Duplicate | Health checks cho lịch lặp | P1 |
| REC-017 | Rule History | Audit old/new rule version | P1 |

### 13.1. Quy tắc quan trọng

- Các occurrence đã `DONE/SKIPPED/CANCELLED` và đã có time entries **không bị xóa** khi rule thay đổi.
- Sửa rule tuần này không được retroactively viết lại các lần đã hoàn thành trong tháng trước.
- Chọn ngày 31 mỗi tháng: phải quyết định **skip month** hay **last day of month** (đề xuất `SKIP` mặc định, user có thể chọn `CLAMP_TO_LAST_DAY`).
- Timezone người dùng mặc định Việt Nam, nhưng thiết kế nên giữ `timezone` theo rule và chuyển đúng ngày địa phương.
- Sinh lịch trùng do scheduler retry phải bị unique constraint ngăn chặn.
- Dời một occurrence không được sinh lại occurrence mới ở ngày cũ nếu record đã được override.

---

## 14. Calendar, Timeline & Scheduling

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| CAL-001 | Day / Week / Month Calendar | Tổng hợp occurrences theo date-range | P0 |
| CAL-002 | Timeline View | Ngày, tuần, time blocks theo start/end | P0 |
| CAL-003 | All-day Tasks | Trường scheduled_date không bắt buộc start_at | P0 |
| CAL-004 | Schedule Task | Chọn occurrence, start_at, end_at hoặc duration | P0 |
| CAL-005 | Drag / Resize | Dời/đổi thời lượng với validation | P0 |
| CAL-006 | Calendar Filters | Project, category, tag, status, priority | P0 |
| CAL-007 | Schedule Conflict Check | Hard/soft conflicts tùy resource + policy | P0 |
| CAL-008 | Free Slots | Trả khoảng trống từ working hours và blocks | P1 |
| CAL-009 | Working Hours | Cấu hình khả dụng theo ngày trong tuần | P1 |
| CAL-010 | Day / Week Capacity | Tổng planned minutes so với available minutes | P1 |
| CAL-011 | Deadline Calendar | Hiển thị deadline khác với scheduled start | P0 |
| CAL-012 | Project Calendar | Lịch theo project | P0 |
| CAL-013 | Unscheduled Queue | Backlog kéo vào lịch | P0 |
| CAL-014 | Preview Changes | API dry-run cho bulk scheduling | P1 |
| CAL-015 | Personal Events | Sự kiện độc lập với task (nếu phát sinh) | P2 |
| CAL-016 | Recurring Event Display | Hiển thị recurring occurrences theo window | P0 |
| CAL-017 | Week Start Preference | Thứ Hai/Chủ nhật theo settings | P0 |
| CAL-018 | Cross-device Sync | API source of truth và event/updated_at strategy | P1 |

### 14.1. Phân biệt deadline và schedule

- `due_at` = thời hạn mong muốn hoàn thành.
- `scheduled_start/end` = khung giờ dự định thực hiện.
- `completed_at` = thời điểm đã hoàn thành.
- `time_entry.started/ended_at` = bằng chứng hoạt động thực tế.

Không tự coi task có due date là đã được xếp lịch time block.

---

## 15. Time Tracking, Focus & Pomodoro

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| TIME-001 | Start Timer | Tạo/đánh dấu timer session duy nhất theo policy | P0 |
| TIME-002 | Pause Timer | Lưu điểm tạm dừng, không tính interval pause | P0 |
| TIME-003 | Resume Timer | Lưu điểm nối lại, guard duplicate calls | P0 |
| TIME-004 | Stop Timer | Chốt duration, timestamps, status; idempotent | P0 |
| TIME-005 | Manual Entry | Nhập thời gian đã làm, nguồn `MANUAL` | P0 |
| TIME-006 | Edit Time Entry | Thay đổi khoảng giờ/duration, có audit | P0 |
| TIME-007 | Delete Entry | Soft delete/correction và recompute analytics | P1 |
| TIME-008 | Link / Unlink Occurrence | Gắn vào lần thực hiện hoặc independent activity | P0 |
| TIME-009 | Timer Recovery | Lấy phiên active sau refresh/login thiết bị mới | P0 |
| TIME-010 | Abandoned Timer | Cảnh báo timer bị bỏ quên, chốt thủ công | P0 |
| TIME-011 | Time Overlap Check | Phát hiện hai phiên overlapping cùng user | P0 |
| TIME-012 | Cross-midnight Split | Phân bổ phút đúng mỗi ngày/tháng/năm | P0 |
| TIME-013 | Daily Focus Summary | Tổng phút theo source/category/project | P0 |
| TIME-014 | Weekly/Monthly Focus | Tổng hợp dựa time entries hợp lệ | P0 |
| TIME-015 | Pomodoro Profile | Work/break durations, cycles | P1 |
| TIME-016 | Focus Breaks | Ghi break riêng, không cộng vào active time | P1 |
| TIME-017 | Focus Session Notes | Ghi kết quả làm việc | P1 |
| TIME-018 | Timer Session History | Danh sách phiên, phân trang | P0 |
| TIME-019 | Planned vs Actual | Cùng đơn vị minutes, cửa sổ kỳ chính xác | P0 |
| TIME-020 | Timer Restrictions | Rule một timer active/user hoặc per-device policy | P0 |

### 15.1. Quy định lưu thời gian

- Timestamps lưu UTC theo convention MySQL `DATETIME(6)`; mọi API timestamp phải có timezone/UTC rõ.
- **Không tin elapsed seconds của browser** làm nguồn sự thật; xác định bằng mốc thời gian server và thông tin pause intervals.
- Nếu cho phép `duration_seconds` do user nhập thủ công, phải validate và lưu `source=MANUAL`.
- `Active Time` không tự tăng khi trạng thái occurrence chuyển DONE.
- Khi có hai time entries overlapping, quyết định metric **union of time intervals** hoặc kiểm soát không overlap; không cộng trùng im lặng.
- Nếu máy chủ bị tắt giữa phiên, backend cần policy khôi phục: báo người dùng kiểm tra và xác nhận điểm kết thúc.

---

## 16. Habits, Routines & Consistency

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| HAB-001 | Create Habit | Name, type, frequency, unit, start date | P1 |
| HAB-002 | Update / Archive Habit | Chỉnh cấu hình, bảo toàn check-in | P1 |
| HAB-003 | Boolean Check-in | Done/not done theo ngày/kỳ | P1 |
| HAB-004 | Quantitative Log | Ví dụ 2 lít nước, 5 km chạy bộ | P1 |
| HAB-005 | Habit Schedule | Mỗi ngày/mỗi thứ/N lần tuần | P1 |
| HAB-006 | Edit / Undo Check-in | Audit correction và recompute streak | P1 |
| HAB-007 | Habit Calendar | Lịch check-in và missed dates | P1 |
| HAB-008 | Habit Streak | Current/longest streak theo lịch mục tiêu | P1 |
| HAB-009 | Habit Completion Rate | Eligible periods vs completed periods | P1 |
| HAB-010 | Habit Period Targets | Target tuần/tháng/quý/năm | P1 |
| HAB-011 | Link Goal | Habit là evidence cho goal | P1 |
| HAB-012 | Habit Reminder | Nhắc theo lịch mục tiêu | P1 |
| HAB-013 | Habit History | Logs, sửa đổi, notes | P1 |
| HAB-014 | Habit Analytics | Trend, consistency, distribution | P1 |
| HAB-015 | Habit Templates | Mẫu routine sáng/tối | P2 |
| HAB-016 | Routine Group | Nhóm habit/task thành routine (nếu cần) | P2 |

**Quan trọng:** Habit check-in có thể không phải một task occurrence. Hai domain có thể liên kết nhưng không bắt buộc chồng bảng. Không đánh dấu bỏ habit chỉ vì không có record nếu người dùng chưa xác nhận ngày đó.

---

## 17. Analytics & Progress Metrics — Thống kê toàn hệ thống

### 17.1. Các nhóm metric được phép

| Nhóm | Metric | Đơn vị | Nguồn dữ liệu chuẩn |
|---|---|---|---|
| Tasks | Created tasks | task | tasks.created_at |
| Tasks | Done occurrences | occurrence | task_occurrences.completed_at/status |
| Tasks | Completion rate | % | eligible occurrences, DONE occurrences |
| Tasks | Overdue count | occurrence | due/scheduled date + now + status |
| Tasks | Reschedule count | event | occurrence schedule history |
| Time | Actual focus time | seconds/minutes/hours | time_entries có hiệu lực |
| Time | Planned work time | minutes/hours | planned occurrences/blocks |
| Time | Estimate variance | minutes / % | planned vs actual cùng population |
| Habits | Habit consistency | % | habit schedules/check-ins |
| Goals | Goal achievement | theo đơn vị goal | goal progress evidence |
| Projects | Milestone completion | % | project milestones |
| Reviews | Plan adherence | % theo định nghĩa | plan commitments + actual |
| Activity | Daily activity | minutes, completed count | time entries + occurrence events |

### 17.2. Feature Inventory — Analytics

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| ANA-001 | Productivity Overview | Dashboard metrics cho Today/Week/Month/Year | P0 |
| ANA-002 | Created vs Completed | So sánh số task mới và occurrence hoàn thành | P0 |
| ANA-003 | Completion by Period | Thống kê completion rate theo ngày/tuần/tháng | P0 |
| ANA-004 | Completion by Category | Filter theo category, tránh đếm trùng | P0 |
| ANA-005 | Completion by Project | Theo project và khoảng ngày | P0 |
| ANA-006 | Completion by Priority | Theo priority tại thời điểm metric policy | P1 |
| ANA-007 | Status Distribution | Not started / in progress / done / skipped / cancelled | P0 |
| ANA-008 | Overdue Trend | Số quá hạn tại những mốc đo hoặc truy vấn lịch sử | P1 |
| ANA-009 | Time Allocation by Category | Actual minutes theo nhóm | P0 |
| ANA-010 | Time Allocation by Project | Actual minutes theo dự án | P0 |
| ANA-011 | Time Allocation by Task | Chi tiết thời lượng từng task | P0 |
| ANA-012 | Planned vs Actual | Daily/weekly/monthly/yearly variance | P0 |
| ANA-013 | Estimate Accuracy | Mean/median relative error theo policy | P1 |
| ANA-014 | Focus Session Statistics | P50/P95 duration, totals, average | P1 |
| ANA-015 | Focus by Hour | Khung giờ thực tế tập trung | P1 |
| ANA-016 | Focus by Weekday | So sánh thứ trong tuần | P1 |
| ANA-017 | Activity Heatmap | Calendar intensity theo metric chọn | P0 |
| ANA-018 | Completed Tasks Heatmap | Mật độ occurrence DONE trong ngày | P0 |
| ANA-019 | Active Time Heatmap | Mật độ phút hoạt động trong ngày | P0 |
| ANA-020 | Habit Heatmap | Mật độ check-in/goal achievement | P1 |
| ANA-021 | Focus Streak | Chuỗi ngày có >= ngưỡng hoạt động do user cấu hình | P1 |
| ANA-022 | Habit Streak | Theo mục tiêu habit không phải task mặc định | P1 |
| ANA-023 | Goal Trajectory | Giá trị goal theo thời gian | P1 |
| ANA-024 | Weekly Comparison | Tuần hiện tại vs tuần trước, quy định partial-week | P1 |
| ANA-025 | Monthly Comparison | Tháng hiện tại vs tháng trước, normalize nếu cần | P1 |
| ANA-026 | Quarterly Comparison | Hiệu suất quý theo cùng metric | P1 |
| ANA-027 | Annual Comparison | Hiệu suất năm, chuẩn hóa khoảng ngày nếu cần | P1 |
| ANA-028 | Plan Adherence | Tỷ lệ thực hiện cam kết kỳ (khác task completion) | P1 |
| ANA-029 | Workload Distribution | Phân bố kế hoạch theo ngày/tuần | P1 |
| ANA-030 | Delay / Rollover Analysis | Task hoãn, lý do, số lần chuyển kỳ | P1 |
| ANA-031 | Task Funnel | Created → scheduled → started → completed | P1 |
| ANA-032 | Project Progress Analytics | Milestones, task completion, actual effort | P1 |
| ANA-033 | Goal Progress Analytics | Targets vs actual theo period | P1 |
| ANA-034 | Data Quality Indicators | Missing timer, manual entry, overlap, orphan links | P1 |
| ANA-035 | Export Metric Dataset | Trả dữ liệu đã chuẩn hóa để export/report | P1 |

### 17.3. Công thức chuẩn — ví dụ chính thức cần thống nhất

**Completion Rate of occurrences** (trong khoảng `[start, end)`):

```text
eligible = occurrences có ngày dự kiến/hạn thuộc kỳ,
           đã đến hạn theo thời điểm báo cáo,
           không bị loại bởi cancellation policy
completed = eligible có status DONE
completion_rate = completed / eligible * 100   (eligible > 0)
```

- Nếu `eligible = 0`, trả `null`/`N/A`, **không** mặc định 100%.
- `SKIPPED` có thể nằm trong mẫu số nhưng không là tử số; cần quyết định policy và công bố trong response.
- `CANCELLED` thường loại khỏi denominator nếu bị hủy hợp lệ trước hạn, nhưng phải định nghĩa rõ.
- Recurring occurrences tương lai chưa đến hạn không tính là lỗi.

**Active Time:**

```text
active_seconds = duration of valid time intervals
                 (minus pause/break, no accidental overlap double count)
```

**Planned vs Actual:**

```text
variance_minutes = actual_minutes - planned_minutes
```

Giá trị âm: thực tế ít hơn kế hoạch, **không mặc định là tốt/xấu**. Kế hoạch chưa làm xong có thể khiến actual thấp; cần giải thích theo ngữ cảnh.

**Plan Adherence:** Cần tách `committed items` và `completed committed items` theo policy (ví dụ những gì đã được chọn vào Weekly Plan trước deadline freeze) để không có chỉ số ảo khi người dùng liên tục thêm/bỏ task.

### 17.4. Metric API contract

Mỗi response metric nên cung cấp:

- `metric_key`, `value`, `unit`, `granularity`, `period_start`, `period_end`, `timezone`.
- `filters` (project/category/goal...) và `calculation_version`.
- `source_type`, `included_statuses`, `excluded_statuses`, `data_coverage` khi cần.
- `series`/`breakdown` tùy biểu đồ; `as_of` thời điểm snapshot/query.
- `is_partial_period` để không so sánh tuần đang chạy với tuần đủ 7 ngày mà không chú thích.

---

## 18. Reviews & Retrospectives — Tổng kết ngày/tuần/tháng/quý/năm

**Review là một artifact nghiệp vụ**, không chỉ là một ô ghi chú. Một review có `period_type`, `range`, `status`, `answers`, `metric_snapshot_reference`, `submitted_at`, `updated_at` và mốc phiên bản.

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| REV-001 | Daily Review | Hôm nay đạt gì, việc còn lại, bài học | P1 |
| REV-002 | Weekly Review | Kết quả, khó khăn, chủ đề tuần sau | P0 |
| REV-003 | Monthly Review | Goal progress, milestone, time allocation, lessons | P1 |
| REV-004 | Quarterly Review | So với cam kết quý, điều chỉnh chiến lược | P1 |
| REV-005 | Annual Review | Thành tựu, lessons, ưu tiên năm tới | P1 |
| REV-006 | Review Template | Questions/sections theo period | P1 |
| REV-007 | Auto-prefill Metrics | Tính số liệu thực tại thời điểm mở review | P1 |
| REV-008 | Edit Review Draft | Lưu bản nháp, không bắt đóng kỳ | P0 |
| REV-009 | Submit / Close Review | Xác nhận nội dung, lưu timestamp/audit | P1 |
| REV-010 | Reopen Review | Mở lại review, lịch sử thay đổi | P1 |
| REV-011 | Attach Evidence | Link task/project/chart/note/file vào review | P1 |
| REV-012 | Compare Reviews | So sánh các kỳ với cùng câu hỏi/metrics | P2 |
| REV-013 | Rollout Next-period Actions | Chuyển action items sang plan sau với preview | P1 |
| REV-014 | Export Review | Markdown/PDF theo template, PII safe | P2 |

### Review questions mẫu

| Kỳ | Bộ câu hỏi gợi ý |
|---|---|
| **Ngày** | 3 việc quan trọng đã xong? Có gì ngoài kế hoạch? Sửa điều gì ngày mai? |
| **Tuần** | Cam kết nào đạt? Thời gian đi đâu? Vì sao việc bị dời? Tuần tới tập trung gì? |
| **Tháng** | Goal nào tiến triển? Project nào chậm? Phân bổ thời gian có phù hợp? |
| **Quý** | Kết quả so với năm? Giữ, ngừng, tăng đầu tư vào việc gì? |
| **Năm** | Các kết quả lớn? Kỹ năng/định hướng thay đổi? Trọng tâm năm sau? |

Review draft cần hỗ trợ khôi phục khi mất kết nối; số liệu tự động có thể thay đổi sau lúc review được viết, vì vậy nếu lưu snapshot thì phải đánh dấu rõ `as_of` và không biến snapshot thành nguồn sự thật.

---

## 19. Dashboard, Charts và Saved Views kiểu Notion

### 19.1. Dashboard

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| DASH-001 | Default Dashboard | Today/Week/Month/Year overview phù hợp từng scope | P0 |
| DASH-002 | Create Custom Dashboard | Title, description, layout, filters | P1 |
| DASH-003 | Add / Remove Widget | KPI/chart/table/heatmap/progress/timeline | P1 |
| DASH-004 | Reorder / Resize Widgets | Lưu layout theo màn hình/viewport | P1 |
| DASH-005 | Widget Filter | Project, category, goal, period, metric | P1 |
| DASH-006 | Widget Data Source | Cho phép metric keys được backend đăng ký | P1 |
| DASH-007 | Save Visualization Style | Chart type, legend, axis, unit, colors | P1 |
| DASH-008 | Save / Duplicate Dashboard | Không copy dữ liệu thực, chỉ copy spec | P1 |
| DASH-009 | Refresh Chart Data | Query lại số liệu, cache theo policy | P1 |
| DASH-010 | AI-created Dashboard Spec | Backend validate spec AI trả về trước lưu | P1 |
| DASH-011 | Export Dashboard | PDF/ảnh dùng renderer an toàn | P2 |
| DASH-012 | Archive Dashboard | Giữ cấu hình cũ để restore | P1 |

### 19.2. Saved Views cho Tasks / Projects / Pages

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| VIEW-001 | Table View | Columns, sort, filters, pagination | P1 |
| VIEW-002 | List View | Minimal list, grouping, quick actions | P0 |
| VIEW-003 | Board View | Kanban theo status/priority/project | P1 |
| VIEW-004 | Calendar View | Cùng occurrences, không copy dataset | P0 |
| VIEW-005 | Timeline View | Planned start/end và group | P0 |
| VIEW-006 | Gallery View | Card/cover cho pages/project nếu cần | P2 |
| VIEW-007 | Chart View | Metrics/series thống nhất | P1 |
| VIEW-008 | Create Saved View | Tên + resource type + filter spec | P1 |
| VIEW-009 | Update Saved View | Patch column/filter/sort/group/layout | P1 |
| VIEW-010 | Duplicate View | Sao chép cấu hình view, không copy data | P1 |
| VIEW-011 | Default View | Chọn view mặc định theo module | P1 |
| VIEW-012 | Group / Subgroup | Thuộc tính cho phép, giới hạn query hợp lý | P1 |
| VIEW-013 | Advanced Filters | AND/OR nested filters với allowlisted fields | P1 |
| VIEW-014 | Column Settings | Hide/show/order/width theo màn hình | P1 |
| VIEW-015 | Custom Properties | Chỉ sau khi chốt model dynamic property | P2 |

**Không lưu generated chart JavaScript hoặc SQL tùy ý**. Chỉ lưu `chart_spec`/`saved_view_spec` đã kiểm tra bằng schema và danh sách metric/query được backend cho phép.

### 19.3. Chart types tối thiểu

- Line/area: xu hướng theo thời gian.
- Bar/stacked bar: completion by category/project.
- Donut: phân bổ thời gian có tổng và nguồn dữ liệu rõ.
- Heatmap: ngày hoạt động theo phút/số task/số habit check-in.
- Scatter: estimated duration vs actual duration (P2).
- Burndown/burnup: remaining plan vs calendar (P2).
- Goal progress: meter/line + milestones.

Color tokens theo **Soft Blue** và pastel accents, không dùng màu trang trí khiến chart khó so sánh; một metric phải có màu nhất quán trong cùng ngữ cảnh.

---

## 20. Notes, Pages, Rich Text và Knowledge Organization

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| PAGE-001 | Create Page | Title, parent, icon/cover optional (ít icon) | P1 |
| PAGE-002 | Rich Text | Heading, list, link, code, quote, checklist | P1 |
| PAGE-003 | Nested Pages | Tạo trang con, chống vòng lặp parent | P1 |
| PAGE-004 | Update / Autosave | Debounced save + revision check | P1 |
| PAGE-005 | Delete / Restore | Soft delete với policy con và file | P1 |
| PAGE-006 | Search Pages | Full-text/title/indexing theo nhu cầu | P1 |
| PAGE-007 | Link Task / Project / Goal | Reference chéo không copy content | P1 |
| PAGE-008 | Attach Files | Metadata MySQL, blob MinIO | P1 |
| PAGE-009 | Markdown Import / Export | Định dạng chuẩn, tối thiểu đủ phục hồi | P1 |
| PAGE-010 | Page History | Revisions nếu cần, tránh lưu toàn bộ text mỗi gõ | P2 |
| PAGE-011 | Page Templates | Tạo nhanh daily/weekly review, project page | P2 |
| PAGE-012 | OCR / Index Content | Tạo job gửi AI service qua backend, opt-in | P2 |
| NOTE-001 | Quick Note | Tạo note nhẹ không cần page hierarchy | P1 |
| NOTE-002 | Note to Task | Tạo draft task từ note với user confirm | P2 |

**V1 nên dùng rich-text JSON schema/Markdown nhất quán**, không nhất thiết tự xây full Notion Block Database ngay. Đây là điểm phức tạp riêng biệt, không được làm chậm Task/Calendar/Goals.

---

## 21. Files, Attachments, MinIO, OCR & Document Workflow

### 21.1. Ownership và storage

- **Backend File Module** kiểm soát xác thực, ownership, metadata, object key, upload/download và quyền dùng file.
- **MinIO self-host** lưu original file và artifacts: ảnh, PDF, DOCX, OCR output, report exports.
- **OCR Service (Python 3.12 dự kiến)** chuyên tiền xử lý ảnh, PaddleOCR và layout/table recognition.
- **AI Service (Python 3.14)** nhận kết quả OCR, trích task/knowledge, tạo embedding và RAG qua Qdrant.
- **Qdrant** lưu vectors và metadata phục vụ tìm kiếm; không thay MySQL hoặc MinIO.

### 21.2. Feature Inventory

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| FILE-001 | Upload File | Backend validate loại file, dung lượng, ownership | P1 |
| FILE-002 | Download / Preview | Kiểm tra quyền trước khi trả stream/signed URL | P1 |
| FILE-003 | File Metadata | Object key, MIME, checksum, size, created_at, status | P1 |
| FILE-004 | Attach File | Gắn vào task/project/page/goal/review | P1 |
| FILE-005 | Remove Attachment | Gỡ link, không xóa blob nếu còn tham chiếu | P1 |
| FILE-006 | Rename Display Name | Sửa tên hiển thị, không nhất thiết đổi object key | P1 |
| FILE-007 | Delete File | Cleanup blob + metadata + derived data qua job | P1 |
| FILE-008 | Checksum / Dedup | Tránh upload trùng nếu policy cho phép | P2 |
| FILE-009 | Processing Status | `UPLOADED`, `QUEUED`, `PROCESSING`, `READY`, `FAILED` | P1 |
| FILE-010 | OCR Request | Gửi yêu cầu xử lý tới AI/OCR pipeline, có permission | P1 |
| FILE-011 | OCR Result | Text + confidence + pages + bbox/table structure | P1 |
| FILE-012 | OCR Correction | User sửa text quan trọng, lưu provenance | P1 |
| FILE-013 | Document Index | Chunk + embeddings + Qdrant upsert | P2 |
| FILE-014 | Document Search | Tìm file metadata và semantic search nếu index | P2 |
| FILE-015 | File Versioning | Lưu phiên bản tài liệu theo nhu cầu | P2 |
| FILE-016 | Export Report to MinIO | Lưu artifacts có TTL/retention policy | P2 |
| FILE-017 | Retry Failed Job | Có backoff, max attempts, idempotency | P1 |
| FILE-018 | Orphan Cleanup | Dọn file/artifact/vector không còn tham chiếu | P1 |

### 21.3. Pipeline ảnh/PDF mẫu

```text
User uploads image/PDF
  → Backend validates + stores original in MinIO
  → MySQL stores file metadata + processing job
  → AI Service requests OCR (through private service contract)
  → OCR Service: preprocess → text OCR → layout/table (if needed)
  → AI Service receives normalized OCR document
  → optional: embeddings → Qdrant index
  → optional: structured Task Draft / Summary / Search Answer
  → Backend validates and exposes result to user
  → User confirms before any task/project/goal creation
```

**Không đưa text OCR confidence thấp vào Task Service như dữ liệu chắc chắn.** Mọi ngày giờ, deadline, số liệu quan trọng thiếu bằng chứng phải xác nhận.

### 21.4. Job states và khôi phục

- Job có `job_id`, `file_id`, `source_version`, `status`, `attempt_count`, `last_error_code`, `created_at`, `started_at`, `finished_at`.
- Retry không sinh thêm file vector trùng; dùng `file_id + version + chunk_index + embedding_model_version` để dedup.
- Khi file được sửa/xóa: đánh dấu index cũ stale, tạo job reindex/delete, có thể retry.
- Job failed phải có endpoint xem lỗi và thử lại, không chặn xem file gốc.
- Cần chống ZIP/PDF decompression bomb, MIME giả, file vượt size, malicious document payload.

---

## 22. Reminders & Notifications

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| REM-001 | Create Reminder Rule | Relative/absolute, target occurrence/task/goal | P0 |
| REM-002 | Multiple Reminders | Nhiều mốc nhắc cho một resource | P0 |
| REM-003 | Edit / Delete Reminder | Update rule, không phá lịch sử đã gửi | P0 |
| REM-004 | Due / Deadline Reminder | Nhắc trước deadline theo period/timezone | P0 |
| REM-005 | Recurring Occurrence Reminder | Nhắc từng occurrence duy nhất | P0 |
| REM-006 | Snooze | Hoãn một delivery hoặc rule theo policy | P1 |
| REM-007 | Quiet Hours | Khung giờ không làm phiền, exception quan trọng | P1 |
| REM-008 | Register Device | Web push subscriptions; iOS sau này | P0 |
| REM-009 | Send Web Notification | Web Push và status gửi | P0 |
| REM-010 | In-app Notification | Read/unread, notification inbox | P0 |
| REM-011 | Delivery Dedup | Khóa duy nhất cho reminder+occurrence+channel | P0 |
| REM-012 | Retry Delivery | Retry giới hạn, backoff + no duplicate effect | P0 |
| REM-013 | Notification History | Gửi thành công/thất bại/theo channel | P0 |
| REM-014 | Daily Agenda Digest | Thông báo tổng hợp đầu ngày | P1 |
| REM-015 | Weekly Review Reminder | Nhắc review Chủ nhật hoặc lịch cấu hình | P1 |
| REM-016 | Goal Milestone Alert | Báo các milestone sắp đến hạn | P1 |
| REM-017 | Missed Task Reminder | Theo policy, không spam | P1 |
| REM-018 | Notification Preferences | Mute, channel opt-in, quiet hours | P0 |
| REM-019 | Mobile Local Notification Contract | Đồng bộ lịch nhắc tới iOS native sau này | P1 |

### 22.1. Yêu cầu hoạt động self-host

- Scheduler/worker phải chạy độc lập với HTTP request, nằm trong stack Docker hoặc process được giám sát.
- Nếu máy Ubuntu offline/mất điện, cloud-free server push không đảm bảo gửi đúng thời điểm. Có policy catch-up khi phục hồi và không gửi hàng loạt thông báo quá hạn vô nghĩa.
- iOS native sau này có thể lên lịch local notification cho các việc đã sync; không trộn local-delivered và server-delivered thành hai thông báo trùng.
- App có thể hoạt động đầy đủ mà không cần AI Service chạy.

---

## 23. Search, Filters, Taxonomy & Custom Properties

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| SEARCH-001 | Global Search | Search across tasks/projects/goals/notes/metadata | P0 |
| SEARCH-002 | Search Suggestions | Suggestions theo title/recency và ownership | P1 |
| SEARCH-003 | Advanced Filters | AND/OR, allowlist thuộc tính và operators | P1 |
| SEARCH-004 | Sort / Pagination | Cursor/offset tùy resource; stable order | P0 |
| SEARCH-005 | Saved Search | Lưu query/filter spec | P1 |
| SEARCH-006 | Recent Searches | Lưu tùy chọn và chính sách riêng tư | P2 |
| CAT-001 | Create / Edit Category | Name, accent color, order | P0 |
| CAT-002 | Merge / Archive Category | Không xóa lịch sử, reassign có preview | P1 |
| CAT-003 | Category Summary | Số task, active time, goal/project associations | P1 |
| TAG-001 | Create / Edit / Delete Tag | Label, color, uniqueness scope | P0 |
| TAG-002 | Attach Many Tags | Task-tags many-to-many | P0 |
| TAG-003 | Tag-based Views | Filter, group và stats | P1 |
| PROP-001 | Custom Field Definitions | Type, name, options, validation, sort/filter | P2 |
| PROP-002 | Custom Field Values | Per resource, type-safe representation | P2 |
| PROP-003 | Field Schema Migration | Đổi kiểu có kiểm tra dữ liệu cũ | P3 |

**Search MVP** dùng MySQL indexes và full-text có kiểm thử tiếng Việt; tìm kiếm ngữ nghĩa ở AI/RAG chỉ dùng khi đã index tài liệu và có nhu cầu thực tế. Không dùng Qdrant thay thế search ID/date/status thông thường.

---

## 24. Templates, Automation & Smart Defaults

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| TMP-001 | Task Template | Task fields, checklist definitions, recurrence defaults | P1 |
| TMP-002 | Project Template | Project sections, milestone/task draft structures | P2 |
| TMP-003 | Daily Plan Template | Focus/questions/routine cho ngày | P1 |
| TMP-004 | Weekly Plan Template | Weekly goals, review questions, priorities | P1 |
| TMP-005 | Monthly / Year Template | Mẫu plan kỳ có cấu trúc | P2 |
| TMP-006 | Note / Review Template | Rich content blocks, prompts | P1 |
| TMP-007 | Duplicate Template | Copy structure, not existing completion data | P1 |
| AUTO-001 | Rule Definition | Event trigger + safe condition + action | P2 |
| AUTO-002 | Schedule Trigger | Time-based job / periodic execution | P2 |
| AUTO-003 | Task State Trigger | Khi occurrence DONE/RESCHEDULED... | P2 |
| AUTO-004 | Safe Action Catalog | Chỉ actions được phép, schema-validated | P2 |
| AUTO-005 | Preview / Test Automation | Dry-run trước khi enable | P2 |
| AUTO-006 | Automation Logs | Record status, idempotency, retries | P2 |
| AUTO-007 | Disable / Pause Automation | Quản lý từng rule | P2 |
| SMART-001 | Remember Last View | Cất filter/layout gần nhất có giới hạn | P0 |
| SMART-002 | Default Current Date | Mặc định theo timezone user, không theo server timezone | P0 |
| SMART-003 | Suggested Duration | Gợi ý từ task estimate hoặc recent history | P1 |
| SMART-004 | Safe Quick Actions | Không bắt nhập hàng chục trường cho task đơn giản | P0 |

Không tạo automation engine hoặc event bus phức tạp khi chỉ cần vài quy tắc. Bắt đầu bằng domain events nhỏ và worker quản lý rõ.

---

## 25. Users, Authentication, Settings & Data Privacy

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| USER-001 | Login / Logout | Sessions với revoke và expiry | P0 |
| USER-002 | Refresh Session | Rotation, reuse detection khi cần | P0 |
| USER-003 | Change Password | Argon2id, revoke sessions theo policy | P0 |
| USER-004 | Single-user Bootstrap | Khởi tạo tài khoản chủ, khóa public signup mặc định | P0 |
| USER-005 | Profile | Name, language, timezone, avatar optional | P0 |
| USER-006 | Timezone | IANA zone, mặc định `Asia/Ho_Chi_Minh` | P0 |
| USER-007 | Week Start | Monday/Sunday, calendar scope consistent | P0 |
| USER-008 | Working Hours | Capacity calculation, ngày nghỉ | P1 |
| USER-009 | Theme | Light/Dark/System | P0 |
| USER-010 | Accent Palette | Soft Blue base, lavender/sage/peach/rose/amber/sky | P0 |
| USER-011 | Default Views | Startup page, saved view, compactness | P1 |
| USER-012 | Device Registration | Browser/iOS device metadata + push tokens | P1 |
| USER-013 | Session Management | Xem và revoke thiết bị | P1 |
| USER-014 | Data Export | Tải dữ liệu cá nhân theo quyền | P1 |
| USER-015 | Account Deletion | Export/retention confirmation, xóa có kiểm soát | P2 |
| USER-016 | Internal Service Authorization | Backend↔AI/OCR xác thực machine identities | P0 |
| USER-017 | Audit Sensitive Actions | Log auth, security changes và destructive operations | P0 |
| USER-018 | Rate Limits / Abuse Prevention | Đặc biệt auth, upload, AI gateway | P0 |

Mặc dù chỉ một người dùng, **mọi query phải scope theo owner/workspace**. AI service không được phép dùng user_id do model sinh, chỉ nhận context server đã xác minh.

---

## 26. Import / Export, Notion Migration, Backup & Restore

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| DATA-001 | Export Tasks / Projects | CSV/JSON với metadata và mapping | P1 |
| DATA-002 | Export Time Entries | CSV/JSON theo date range, timezone | P1 |
| DATA-003 | Export Goals / Habits | Dữ liệu và evidence, không mất đơn vị | P1 |
| DATA-004 | Export Notes | Markdown/HTML/JSON theo khả năng | P1 |
| DATA-005 | Export Dashboard / Reviews | Config + các metric snapshot tham chiếu | P2 |
| DATA-006 | Import CSV / JSON | Mapping + validation + preview + transactional batches | P1 |
| DATA-007 | Import Notion Export | Mapping pages/databases/tasks, giữ provenance | P2 |
| DATA-008 | Import Dry Run | Báo lỗi/duplicate/field unknown trước ghi | P1 |
| DATA-009 | Import Job History | Trạng thái, warning, lỗi từng dòng | P1 |
| DATA-010 | Export Archive | Toàn bộ dữ liệu người dùng + metadata links | P2 |
| DATA-011 | DB Backup | `mysqldump`/MySQL Shell với lịch và retention | P0 vận hành |
| DATA-012 | MinIO Backup | Object copy ra ổ/thiết bị khác, verify checksum | P0 vận hành |
| DATA-013 | Qdrant Snapshot | Snapshot cho vector index, có thể rebuild từ nguồn | P1 vận hành |
| DATA-014 | Restore Drill | Kiểm thử khôi phục staging/offline định kỳ | P0 vận hành |
| DATA-015 | Data Integrity Audit | FK consistency, orphan file, stale vectors | P1 |

Nếu Notion export không có time-entry/completion-history thì không được tạo lịch sử giả. Mọi imported task cần `source`, `import_batch_id`, `external_id` khi có.

---

## 27. Activity History, Audit & Data Integrity

| ID | Chức năng | Chi tiết | Ưu tiên |
|---|---|---|---|
| HIST-001 | Task Event Log | Created, updated, archived, restored, deleted | P0 |
| HIST-002 | Occurrence Status Log | DONE/SKIPPED/CANCELLED/REOPENED transitions | P0 |
| HIST-003 | Recurrence Change Log | Old/new rule + effective date | P0 |
| HIST-004 | Schedule Change Log | Old/new start/end, reason/source | P0 |
| HIST-005 | Goal Target Change | Target change + version/history | P1 |
| HIST-006 | Time Entry Correction | Trước/sau thời lượng và lý do | P0 |
| HIST-007 | Plan/Rollover History | Source/target periods, selected items | P1 |
| HIST-008 | File Delete/Index Audit | Artifacts, OCR, RAG lifecycle | P1 |
| HIST-009 | AI Action Proposal Audit | Proposal/confirmed/rejected/expired/executed | P1 |
| HIST-010 | Security Audit | Auth, session revoke, internal API rejections | P0 |
| HIST-011 | Restore From Archive | Có rules phục hồi, sự kiện traceable | P1 |
| HIST-012 | Recalculate Read Models | Recompute cached aggregates khi cần | P1 |

**Activity events không phải event sourcing toàn bộ hệ thống.** Dùng audit event cho nghiệp vụ quan trọng; nguồn dữ liệu chính vẫn là các bảng domain với transaction rõ.

---

## 28. AI Gateway & Integration Contracts (không gộp AI vào Backend)

### 28.1. Nguyên tắc phân chia

```text
Next.js / React Native
        │ public HTTPS API
        ▼
Business Backend (FastAPI, Python 3.14)
        ├── Tasks / Planning / Goals / Analytics / File Services
        ├── Business MySQL
        ├── MinIO gateway
        └── AI Gateway (internal HTTP client)
                      │ private authenticated HTTP
                      ▼
AI Service (FastAPI, Python 3.14, Hybrid)
        ├── Task Intelligence / Planning / Analytics / Visualization
        ├── Document Understanding / RAG / Memory
        ├── Ollama + optional provider
        ├── Qdrant
        └── OCR Service (Python 3.12, PaddleOCR)
```

### 28.2. Backend supports AI without surrendering business logic

| ID | Chức năng | Backend responsibility | Ưu tiên |
|---|---|---|---|
| AIG-001 | AI Request Proxy | Authenticate user, request limits, call AI service | P1 |
| AIG-002 | Get Task Context | Return authorized task summaries for tool calls | P1 |
| AIG-003 | Get Plan Context | Return period goals, priorities, calendars | P1 |
| AIG-004 | Get Analytics Dataset | Deterministic metric APIs, no raw SQL | P1 |
| AIG-005 | Get Goal Context | Target vs actual, evidence | P1 |
| AIG-006 | Create Task Draft | Validate suggested fields; not committed yet | P1 |
| AIG-007 | Schedule Proposal | Return dry-run with conflicts, warnings, revisions | P1 |
| AIG-008 | Confirm Proposed Actions | Confirm by authenticated user with expiry/revision check | P1 |
| AIG-009 | Chart Spec Validation | Only approved metrics/chart schemas | P1 |
| AIG-010 | Document Access Grant | Short-lived authorized file access; no raw bucket credential | P1 |
| AIG-011 | OCR Request / Status | Mediate job state, artifact refs, permission checks | P1 |
| AIG-012 | AI Usage / Error Info | Track latency, tokens (if known), model, failures | P1 |
| AIG-013 | Revoke/Cancel Job | Cancel pending heavy jobs if supported | P2 |

### 28.3. AI feature set bổ sung, không thay nghiệp vụ chính

- Smart Task Creation / Task Breakdown.
- Natural Language Search qua backend tools.
- Daily/Weekly Planning và Smart Rescheduling.
- AI-generated Chart/Dashboard Specs dựa trên metric API.
- Productivity Insights / Weekly Review Summaries.
- OCR extraction from images/PDF, draft tasks from documents.
- Semantic retrieval tài liệu bằng Qdrant (RAG), có nguồn trích và confidence.

**AI có quyền đề xuất; Backend có quyền xác thực, validate, preview và thực thi.** Khi AI service down, CRUD, Calendar, Timer, Analytics truyền thống vẫn hoạt động.

---

## 29. Gợi ý module boundaries trong FastAPI Hybrid Backend

**Không tạo một module cho mỗi màn hình.** Các màn hình Year/Month/Week/Today có thể cùng dùng `planning` + `analytics` + `tasks` + `calendar`; UI scope là khái niệm product, không nhất thiết là DB/domain riêng.

| Backend module | Sở hữu nghiệp vụ | Không nên sở hữu |
|---|---|---|
| `auth` / `users` | Account, login, session, preferences | Task/goal state |
| `workspace` | Personal workspace settings và root navigation metadata | Bản sao tasks theo năm |
| `planning` | Saved plans, period commitments, priorities, reviews, rollovers | Task/occurrence state gốc |
| `goals` | Goal definition, period targets, progress evidence, milestones của goal | Actual time session của time_tracking |
| `projects` | Project, sections, project milestones, project relations | Checklist execution state |
| `tasks` | Task, occurrence, recurrence, subtasks, checklist, dependencies | Calendar read-only view tables |
| `calendar` | Query calendar, capacity/free slots, scheduling coordination | Occurrence gốc bị sao chép |
| `time_tracking` | Timer lifecycle, time entries, focus session state | Estimated work defined on task |
| `habits` | Habit schedules, check-ins, streaks | Task occurrence completion nếu không phải task |
| `reminders` | Reminder rules, schedules, deliveries, devices | Chính sách sửa task tùy tiện |
| `taxonomy` | Categories, tags, entity tagging | Project business logic |
| `analytics` | Metric/query definitions, aggregated read models | Thao tác cập nhật business state |
| `dashboards` | Dashboard/widget config, chart/view specs | Generated metric facts as primary data |
| `views` | Saved filters, sorting, grouping, visible columns | Bản sao table/board task |
| `content` | Pages, notes, revisions, rich text | MinIO blob bytes |
| `files` | File metadata, attachments, MinIO interaction, lifecycle | OCR/LLM inference |
| `templates` | Templates, template instantiation | Tự ý đánh dấu historical tasks DONE |
| `activity` | Audit events, change history and tracing | Event-sourcing bắt buộc toàn app |
| `search` | Search interfaces, query composition | Raw LLM inference |
| `integrations` | Import/export, external calendars later | Logic kiểm tra task nội bộ |
| `ai_gateway` | Proxy, internal auth, tools allowlist, proposal confirmation | Agents, models, RAG code |

### 29.1. Cấu trúc thư mục Hybrid gợi ý

```text
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   └── v1/router.py                  # Router registration
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   └── logging.py
│   ├── db/
│   │   ├── base.py
│   │   ├── engine.py
│   │   └── session.py
│   ├── modules/
│   │   ├── planning/
│   │   │   ├── api/
│   │   │   │   ├── plans_controller.py
│   │   │   │   └── reviews_controller.py
│   │   │   ├── services/
│   │   │   │   ├── period_service.py
│   │   │   │   ├── plan_service.py
│   │   │   │   ├── rollover_service.py
│   │   │   │   └── review_service.py
│   │   │   ├── repositories/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   │   ├── requests/
│   │   │   │   └── responses/
│   │   │   ├── mappers/
│   │   │   └── domain/
│   │   ├── tasks/
│   │   │   ├── api/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── models/
│   │   │   ├── schemas/requests/
│   │   │   ├── schemas/responses/
│   │   │   ├── mappers/
│   │   │   └── domain/
│   │   ├── goals/
│   │   ├── projects/
│   │   ├── calendar/
│   │   ├── time_tracking/
│   │   ├── habits/
│   │   ├── reminders/
│   │   ├── analytics/
│   │   ├── dashboards/
│   │   ├── views/
│   │   ├── content/
│   │   ├── files/
│   │   ├── activity/
│   │   ├── taxonomy/
│   │   ├── search/
│   │   ├── integrations/
│   │   └── ai_gateway/
│   ├── workers/
│   │   ├── reminder_worker.py
│   │   └── ingestion_job_worker.py
│   └── shared/
├── alembic/
│   └── versions/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contracts/
│   └── e2e/
├── pyproject.toml
├── uv.lock
└── Dockerfile

ai-service/                         # HOÀN TOÀN RIÊNG
└── app/
    ├── core/
    ├── providers/
    └── modules/
        ├── task_intelligence/
        ├── planning/
        ├── analytics/
        ├── visualization/
        ├── document_intelligence/
        └── rag/

ocr-service/                        # CONTAINER RIÊNG
└── app/
    ├── api/
    ├── engines/
    ├── preprocessing/
    └── schemas/
```

Các thư mục chỉ khởi tạo khi có code thật. `analytics` và `calendar` có thể là query modules nhỏ, không cần repository CRUD đầy đủ nếu không sở hữu entity.

### 29.2. Luồng request chuẩn

```text
Frontend
   → FastAPI Router (schema validation, auth)
   → Domain Service (business rules, permissions)
   → Repository (SQLAlchemy query, no business decisions)
   → MySQL Transaction
   → Service (assemble result, transaction boundary)
   → Mapper (when needed)
   → Pydantic Response DTO
   → Frontend
```

Quy tắc cross-module: Services có thể gọi **public domain service interfaces**/read models của module khác, không lén truy cập repository hoặc model nội bộ; những transaction nhiều module cần một cơ chế transaction boundary thống nhất.

---

## 30. Gợi ý logical data model (chưa phải ERD chính thức)

Tài liệu này nhằm quyết định nghiệp vụ trước khi tạo migrations. Các entity bên dưới là **candidate models**, phải review duplication, relationship cardinality, indexes và storage costs.

| Domain | Entity candidates | Ghi chú quyết định |
|---|---|---|
| Identity | `users`, `user_settings`, `sessions`, `devices` | Một user trước, chuẩn bị multi-user |
| Workspace | `workspaces`, `workspace_members` (defer) | Có thể chỉ cần một workspace row |
| Planning | `planning_periods`/`saved_plans`, `plan_items`, `period_priorities` | Chỉ lưu period khi được tạo plan/review |
| Reviews | `period_reviews`, `review_sections`, `review_actions` | Có thể dùng JSON có schema cho answers |
| Goals | `goals`, `goal_period_targets`, `goal_progress_evidence`, `goal_links` | Định nghĩa evidence rõ, không duplicate actual |
| Projects | `projects`, `project_sections`, `milestones`, `project_goal_links` | Milestone có thể dùng chung entity nếu cần |
| Tasks | `tasks`, `task_occurrences`, `recurrence_rules`, `recurrence_exceptions` | Chống trùng bằng key/index |
| Subtasks | `tasks.parent_task_id`, `task_dependencies` | Chống vòng lặp |
| Checklist | `checklist_items`, `occurrence_checklist_states` | Template vs execution separated |
| Time | `time_entries`, `timer_states` hoặc `focus_sessions` | Decide timer persistence approach |
| Habits | `habits`, `habit_logs`, `habit_schedules` | Không ép làm task |
| Reminders | `reminder_rules`, `reminder_deliveries`, `push_subscriptions` | History + dedup |
| Taxonomy | `categories`, `tags`, `task_tags` | Many-to-many tags |
| Views | `saved_views` | Validated filters/config JSON |
| Dashboards | `dashboards`, `dashboard_widgets` | Chart config, not chart data cache default |
| Content | `pages`, `page_revisions` / `blocks` | Chọn content model sau |
| Files | `files`, `file_links`, `file_processing_jobs` | S3-compatible MinIO objects |
| Templates | `templates` | JSON schema versioning |
| Activity | `activity_events`, `audit_logs` (nếu cần tách) | Không trùng với change history domain |
| AI Metadata | `conversations`, `messages`, `ai_jobs` trong logical DB riêng | AI service sở hữu, không đọc business DB trực tiếp |

### 30.1. Quy tắc xây ERD phải tuân thủ

1. **Một source of truth:** Tránh bảng `yearly_tasks`, `monthly_tasks`, `weekly_tasks`, `daily_tasks` chứa bản sao task.
2. **Period dimension:** Year/Quarter/Month/Week/Day là `period_type + date range` cộng saved plan/review nếu có.
3. **Task ↔ Period:** Dùng quan hệ `plan_items` khi cần ghi nhận *cam kết trong kỳ*; không dùng nó thay occurrence schedule.
4. **Task ↔ Goal:** Dùng typed links/attribution rule, không gắn cố định một goal ID nếu một task có thể phục vụ nhiều goal.
5. **Project ↔ Goal:** M:N nếu cần, ràng buộc ownership.
6. **Task hierarchy:** Parent FK có thể self-reference, kiểm tra cycle ở service.
7. **Checklist:** Template definitions và occurrence tick states tách rõ.
8. **Recurrence:** Unique recurrence key và versioning/effective range khi sửa series.
9. **Time entries:** UTC + source + link optional, không cộng trùng interval.
10. **Deleted/history:** Mọi cascade delete phải được review, đặc biệt attachments/history.
11. **File blob:** Không lưu original bytes trong MySQL; MinIO object key + metadata.
12. **Vector data:** Qdrant embeddings không phải source of truth, index có thể rebuild.
13. **Indexes:** Ưu tiên user_id + scheduled_date, task_id, status, period range, created_at, updated_at, project_id; xác định từ query patterns thật.
14. **MySQL datetime:** `DATETIME(6)` không chứa timezone; ứng dụng tự enforce UTC cho instant timestamps, `DATE` cho local calendar dates.
15. **UID:** UUID storage format (`BINARY(16)` hay char) phải nhất quán giữa Python ORM và API string.
16. **Explicit constraints:** Unique, FK, checks và transactional isolation phù hợp với InnoDB; không chỉ dựa validation frontend.

### 30.2. Quyết định còn mở — phải review trước viết migration

| Vấn đề | Phương án/đề xuất | Trạng thái |
|---|---|---|
| Materialize planning period | Chỉ lưu khi user tạo saved plan/review | Đề xuất |
| Week identity | ISO week vs user-configured start | Cần chốt |
| Recurrence generation | On demand/rolling 30–90 ngày | Cần chốt |
| Checklist status | Per occurrence, template definitions per task | Đề xuất mạnh |
| Goal evidence | Domain links + normalized source facts | Cần thiết kế chi tiết |
| Goal/project progress | Multiple named metrics, no single implicit percent | Đề xuất mạnh |
| Task hierarchy depth | Unlimited with guard vs max depth | Cần chốt |
| Timer storage | Separate timer state vs time entry open session | Cần chốt |
| Overlapping time entries | Disallow vs warn + union metric | Cần chốt |
| All-day overdue policy | End of local day vs due instant | Cần chốt |
| Deleted task retention | Archive/soft delete vs hard delete after time | Cần chốt |
| Notes rich text | JSON document vs block table | Cần chốt |
| Review snapshot | Store computed snapshot reference vs live metrics | Cần chốt |
| Custom properties | P2, tránh triển khai dynamic schema quá sớm | Đề xuất |

---

## 31. REST API Inventory — bản draft phục vụ thiết kế

**Prefix:** `/api/v1`. Tất cả ví dụ đều cần auth/ownership; đây chưa phải OpenAPI đã khóa.

### 31.1. Workspace & Planning

| Method | Path | Mục đích |
|---|---|---|
| GET | `/workspace` | Personal workspace overview + settings |
| GET | `/planning/periods/{type}/{key}` | Overview theo năm/quý/tháng/tuần/ngày |
| PUT | `/planning/periods/{type}/{key}/plan` | Create/update saved plan |
| GET | `/planning/periods/{type}/{key}/plan` | Saved plan details |
| PATCH | `/planning/plans/{plan_id}` | Update focus/notes/status |
| POST | `/planning/plans/{plan_id}/items` | Pin goal/project/task vào period plan |
| PATCH | `/planning/plans/{plan_id}/items/{id}` | Reorder/update plan commitment |
| DELETE | `/planning/plans/{plan_id}/items/{id}` | Unpin item (không xóa nguồn) |
| POST | `/planning/periods/{type}/{key}/rollover/preview` | Kiểm tra các lựa chọn chuyển kỳ |
| POST | `/planning/rollovers/confirm` | Áp dụng kết quả user xác nhận |
| GET | `/planning/periods/{type}/{key}/review` | Lấy review |
| PUT | `/planning/periods/{type}/{key}/review` | Upsert review draft |
| POST | `/planning/periods/{type}/{key}/review/submit` | Chốt review có audit |
| POST | `/planning/periods/{type}/{key}/review/reopen` | Mở review có audit |

**`{key}` nên là canonical representation đã được validation**, ví dụ `2027`, `2027-Q1`, `2027-11`, `2027-W47`, `2027-11-17`; chuẩn week phải thống nhất trước khi code. Có thể thay bằng query parameters nếu thuận tiện cho timezone.

### 31.2. Tasks, Occurrences, Recurrence

| Method | Path | Mục đích |
|---|---|---|
| POST | `/tasks` | Create task |
| GET | `/tasks` | List/filter/search/sort |
| GET | `/tasks/{id}` | Get task detail |
| PATCH | `/tasks/{id}` | Partial update |
| POST | `/tasks/{id}/duplicate` | Duplicate selected fields |
| POST | `/tasks/{id}/archive` | Archive |
| POST | `/tasks/{id}/restore` | Restore |
| GET | `/tasks/{id}/progress` | Named metrics with period/filter |
| POST | `/tasks/{id}/subtasks` | Create subtask |
| GET | `/tasks/{id}/subtasks` | List children |
| GET | `/tasks/{id}/occurrences` | Occurrence list |
| POST | `/tasks/{id}/occurrences` | Create one-off as allowed |
| GET | `/occurrences/{id}` | Occurrence detail |
| PATCH | `/occurrences/{id}` | Update schedule/properties |
| POST | `/occurrences/{id}/complete` | Complete |
| POST | `/occurrences/{id}/reopen` | Reopen |
| POST | `/occurrences/{id}/skip` | Skip |
| POST | `/occurrences/{id}/cancel` | Cancel |
| POST | `/occurrences/{id}/reschedule` | Move one occurrence |
| PUT | `/tasks/{id}/recurrence` | Create/update rule |
| GET | `/tasks/{id}/recurrence/preview` | Preview next occurrences |
| POST | `/tasks/{id}/checklist-items` | Add checklist item |
| PATCH | `/occurrences/{id}/checklist/{item_id}` | Check/uncheck per occurrence |
| POST | `/tasks/{id}/dependencies` | Add dependency |

### 31.3. Goals, Projects, Habits

| Method | Path | Mục đích |
|---|---|---|
| POST/GET | `/goals` | Create/list goals |
| GET/PATCH | `/goals/{id}` | Detail/update goal |
| GET | `/goals/{id}/progress` | Actual evidence + period targets |
| PUT | `/goals/{id}/period-targets/{period_key}` | Allocate goal target |
| POST | `/goals/{id}/measurements` | Manual goal evidence |
| POST | `/goals/{id}/milestones` | Goal milestone |
| POST/GET | `/projects` | Create/list projects |
| GET/PATCH | `/projects/{id}` | Detail/update |
| GET | `/projects/{id}/progress` | Project metrics |
| POST | `/projects/{id}/milestones` | Create milestone |
| POST/GET | `/habits` | Create/list habit |
| PATCH | `/habits/{id}` | Update habit |
| POST | `/habits/{id}/check-ins` | Check-in |
| PATCH | `/habits/{id}/check-ins/{log_id}` | Correct/undo check-in |
| GET | `/habits/{id}/stats` | Streaks/completion |

### 31.4. Calendar, Timer, Reminders

| Method | Path | Mục đích |
|---|---|---|
| GET | `/calendar/events?start=&end=` | Events theo khoảng `[start,end)` |
| GET | `/calendar/free-slots?start=&end=` | Free slots theo working hours |
| POST | `/calendar/scheduling/preview` | Validate proposed changes |
| POST | `/calendar/scheduling/confirm` | Apply user-confirmed proposal |
| POST | `/time-entries/start` | Start focus |
| POST | `/time-entries/{id}/pause` | Pause |
| POST | `/time-entries/{id}/resume` | Resume |
| POST | `/time-entries/{id}/stop` | Stop |
| POST | `/time-entries` | Manual entry |
| GET | `/time-entries` | List/filter |
| PATCH | `/time-entries/{id}` | Correct entry |
| GET | `/time-entries/active` | Recover timer state |
| POST/GET | `/reminders` | Create/list reminder |
| PATCH | `/reminders/{id}` | Update reminder |
| POST | `/reminders/{id}/snooze` | Snooze delivery |
| GET | `/notifications` | In-app notifications |
| POST | `/devices/push-subscriptions` | Register push device |

### 31.5. Analytics, Views, Content, Files & AI Gateway

| Method | Path | Mục đích |
|---|---|---|
| GET | `/analytics/overview` | Overview metrics by period |
| GET | `/analytics/completion` | Completion breakdown |
| GET | `/analytics/time-allocation` | Project/category distribution |
| GET | `/analytics/planned-vs-actual` | Duration variance |
| GET | `/analytics/heatmap` | Active time / completed count / habits |
| POST/GET | `/dashboards` | Create/list custom dashboards |
| GET/PATCH | `/dashboards/{id}` | Load/update dashboard spec |
| POST/GET | `/saved-views` | Create/list saved views |
| GET/PATCH | `/saved-views/{id}` | View spec and layout |
| POST/GET | `/pages` | Create/list pages |
| GET/PATCH | `/pages/{id}` | Page content |
| POST | `/files` | Upload/init upload flow |
| GET | `/files/{id}` | Metadata |
| GET | `/files/{id}/download` | Authorized download/presigned URL |
| POST | `/files/{id}/ocr-jobs` | OCR/document processing request |
| GET | `/files/{id}/processing` | Job status/results |
| GET | `/search` | Scoped resource search |
| POST | `/ai/requests` | AI gateway request |
| POST | `/ai/action-proposals/{id}/confirm` | User confirms authorized proposal |

### 31.6. API Response Conventions — đề xuất

```json
{
  "data": {
    "id": "uuid",
    "title": "Học tiếng Anh"
  },
  "meta": {
    "request_id": "req_...",
    "as_of": "2026-11-17T08:15:00Z"
  }
}
```

```json
{
  "error": {
    "code": "OCCURRENCE_CONFLICT",
    "message": "Lần thực hiện đã được cập nhật trên thiết bị khác.",
    "details": {
      "resource_id": "uuid",
      "expected_revision": 3,
      "actual_revision": 4
    }
  }
}
```

- Trường thời gian dùng ISO 8601/UTC và `DATE` theo calendar semantics.
- `request_id` và error codes ổn định để debug.
- Paginated responses có `items` và `next_cursor`/`page` theo endpoint.
- `PATCH` không tự set default cho các field absent.
- Cân nhắc `Idempotency-Key` cho tạo job/bulk mutations/confirm actions.

---

## 32. End-to-End Use Cases quan trọng

### UC-01 — Lập kế hoạch năm rồi triển khai xuống ngày

**Bước 1:** Tạo Year Plan 2027 và Goal "Học IELTS 200 giờ".

**Bước 2:** Phân target theo quý: Q1 60 giờ, Q2 50 giờ, Q3 45 giờ, Q4 45 giờ.

**Bước 3:** Month Plan tháng 1 đặt target 22 giờ; Weekly Plan tuần 1 chọn 6 giờ học.

**Bước 4:** Tạo Task "IELTS practice" và recurrence thứ 2/4/6; sinh occurrences.

**Bước 5:** Daily Plan xếp lịch occurrence hôm nay 20:00–21:30.

**Bước 6:** Bật timer; học thực tế 75 phút; mark occurrence DONE.

**Bước 7:** Analytics cộng 75 phút vào actual theo nguồn thực; goal progress tăng theo measurement rule.

**Bước 8:** Weekly/Monthly/Annual Workspace truy vấn tổng hợp từ source-of-truth; không cộng tay vào từng workspace.

**Acceptance:** Goal actual đồng nhất bất kể xem qua Day, Week, Month, Year ở cùng kỳ; một phiên không bị đếm hai lần.

### UC-02 — Task chưa hoàn thành, chuyển sang tuần sau

**Given:** Occurrence X tuần 47 NOT_STARTED, có deadline thứ Sáu.

**When:** Người dùng chọn rollover sang tuần 48.

**Then:** Backend tạo preview, cảnh báo deadline cũ, kiểm tra conflict; chỉ reschedule occurrence khi user xác nhận, có audit old/new time; không duplicate task.

**Acceptance:** Retry confirm không sinh occurrence trùng hoặc dời hai lần, lịch sử tuần 47 vẫn phản ánh công việc chưa hoàn thành ở tuần đó.

### UC-03 — Checklist reset với task lặp

**Given:** Task "Daily review" có 4 checklist items; occurrence hôm nay đã tick 4/4.

**When:** Occurrence ngày mai được sinh.

**Then:** Checklist ngày mai có cùng definitions nhưng trạng thái chưa tick.

**Acceptance:** Sửa template checklist không xóa lịch sử tick của occurrence hôm qua.

### UC-04 — Một task nằm trong project và nhiều goal

**Given:** Task "Học IELTS" thuộc project IELTS và góp phần cho 2 goals (hours, consistency).

**When:** Có time entry 60 phút và occurrence DONE.

**Then:** Goal hours nhận 60 phút, goal consistency có một event hoàn thành theo policy.

**Acceptance:** Cùng 60 phút không bị nhân đôi trong tổng focus time của project hay workspace.

### UC-05 — Chỉnh kế hoạch năm sau khi đã có kết quả

**Given:** Q1 target 50 giờ, actual 32 giờ đã có historical records.

**When:** User đổi Q1 target thành 65 giờ.

**Then:** Target hiện tại đổi thành 65, lưu event target_changed; actual vẫn 32.

**Acceptance:** Historical time entries và goal evidence không bị sửa.

### UC-06 — Timer bị mất mạng / tắt máy

**Given:** Timer đang chạy, laptop mất kết nối.

**When:** User mở app trên iPhone.

**Then:** Backend trả trạng thái timer dựa trên server persistence, hiển thị thời điểm start và cảnh báo cần xác nhận nếu phiên đáng ngờ.

**Acceptance:** Không tự chốt 10 giờ focus giả do máy offline qua đêm.

### UC-07 — AI tạo biểu đồ bằng tiếng Việt

**Given:** User hỏi "So sánh thời gian làm việc dự kiến và thực tế tháng này".

**When:** Frontend gửi Backend `/ai/requests`.

**Then:** Backend xác thực và gọi AI Service; AI gọi analytics tool nội bộ do Backend cấp; backend tính metrics; AI tạo chart spec whitelist; Backend validate và trả frontend.

**Acceptance:** Không chạy raw SQL hoặc JSX AI sinh; không tiết lộ data user khác; chart đúng nguồn dữ liệu.

### UC-08 — Upload ảnh kế hoạch và tạo draft task

**Given:** User upload ảnh chụp kế hoạch học.

**When:** Backend lưu MinIO và tạo OCR job.

**Then:** OCR Service trả text/confidence; AI Service đề xuất task drafts; Backend validate; frontend hiển thị bản nháp để xác nhận.

**Acceptance:** Chưa xác nhận thì không xuất hiện task thật; OCR nhầm giờ cần hỏi lại.

### UC-09 — Chỉnh sửa task trên hai thiết bị

**Given:** Web đang mở revision 3, iPhone vừa lưu revision 4.

**When:** Web PATCH dựa trên revision 3.

**Then:** Backend trả conflict rõ (hoặc field-level merge policy), không ghi đè silent.

**Acceptance:** Dữ liệu mới không mất; UI có nút reload/review conflict.

### UC-10 — Weekly review khi tuần giao tháng

**Given:** Tuần 30/11–06/12, người dùng mở Weekly Review từ Month View tháng 11.

**When:** Backend tính weekly metrics.

**Then:** Kỳ tuần vẫn từ 30/11 tới 06/12; Monthly November metrics chỉ gồm ngày tháng 11.

**Acceptance:** Tổng daily bucket của tháng 11 khớp monthly metric; weekly metric có thể khác hợp lệ.

---

## 33. Testing Matrix — các trường hợp bắt buộc

| ID | Test Case | Kết quả mong đợi |
|---|---|---|
| T-001 | Create task title-only | Thành công, defaults hợp lệ |
| T-002 | Create task title whitespace | Validation error |
| T-003 | PATCH chỉ title | Các field khác không đổi |
| T-004 | PATCH category_id null | Category được clear đúng policy |
| T-005 | PATCH unknown field | Reject hoặc policy explicit |
| T-006 | List tasks other user | Không trả dữ liệu |
| T-007 | Task archive + restore | Không mất occurrences/time entries |
| T-008 | Duplicate task | Không duplicate completed history |
| T-009 | Complete one occurrence | Không complete future series |
| T-010 | Reopen DONE occurrence | Status đổi, audit; time entries nguyên |
| T-011 | Daily recurrence repeat job | Không duplicate occurrence |
| T-012 | Weekly recurrence weekday selection | Ngày sinh chính xác |
| T-013 | Monthly repeat day 31 | Theo policy skip/clamp, không silently shift |
| T-014 | Edit this occurrence | Future series unchanged |
| T-015 | Edit future series | Past DONE preserved |
| T-016 | Pause recurrence | No new occurrences generated while paused |
| T-017 | Recurrence timezone local date | Không lệch ngày |
| T-018 | Subtask parent self-link | Reject |
| T-019 | Subtask nested cycle A→B→A | Reject |
| T-020 | Subtask move to new project | Policy consistent with parent/owner |
| T-021 | Checklist tick today | Tomorrow checklist unchecked |
| T-022 | Remove checklist item | Historical completion still auditable |
| T-023 | Task dependency cycle | Reject |
| T-024 | Task progress zero eligible | null/N/A, not 100% |
| T-025 | Cancelled occurrence denominator | Theo published metric policy |
| T-026 | Skipped occurrence denominator | Theo published metric policy |
| T-027 | Future occurrence excluded | Không bị tính missed prematurely |
| T-028 | One-off task & recurring task in dashboard | Metrics comparable and defined |
| T-029 | Two time entries same task | Tổng đúng |
| T-030 | Overlapping time entries | Warn/reject/union theo policy |
| T-031 | Timer start duplicated | Không tạo hai active timers tùy policy |
| T-032 | Timer stop duplicated | Same result; không double duration |
| T-033 | Timer pause/resume | Pause interval không tính active |
| T-034 | Timer across midnight | Split theo local date chính xác |
| T-035 | Timer abandoned 24h | Flag for correction, not fictitious focus |
| T-036 | Manual time entry | Source MANUAL preserved |
| T-037 | Edit historic time entry | Analytics recalc correctly |
| T-038 | Annual goal with quarterly targets | Target allocation+actual no double count |
| T-039 | Change goal target | Evidence unchanged, audit exists |
| T-040 | Goal progress over target | Value > target accurate, UI may clamp |
| T-041 | Link one time entry to multiple goals | Workspace focus time counted once |
| T-042 | Project with parent+subtask | No double counting by default |
| T-043 | Week crossing month | Week view vs monthly view correct |
| T-044 | Week crossing year | ISO/week key and scope consistent |
| T-045 | Week start setting changed | View/navigation consistent, stored data intact |
| T-046 | Month of February leap year | Date-range correct |
| T-047 | Saved plan item pinned then removed | Original task remains |
| T-048 | Rollover one-off occurrence | Only chosen occurrence changes |
| T-049 | Rollover recurring occurrence | Recurrence rule unchanged |
| T-050 | Retry rollover confirmation | Idempotent, no duplicate |
| T-051 | Close/reopen weekly review | Audit and revision correct |
| T-052 | Update plan after close | Policy enforced |
| T-053 | Daily Today double classification | Same occurrence not shown twice |
| T-054 | Dashboard chart spec invalid | Reject, not executed |
| T-055 | Chart metric unauthorized | Reject by backend |
| T-056 | Analytics query with partial week | `is_partial_period` exposed |
| T-057 | Heatmap scheduled-only day | No fake activity |
| T-058 | Heatmap manual entry day | Credited with source label |
| T-059 | Repeat reminders after worker retry | No duplicate delivery record |
| T-060 | Server offline catch-up | Honors notification catch-up policy |
| T-061 | Upload unsupported MIME | Reject |
| T-062 | Upload oversized file | Reject |
| T-063 | Delete file referenced by task | Policy and cleanup safe |
| T-064 | Re-OCR same file version | No duplicate vectors/job effects |
| T-065 | OCR uncertain date | Draft requests confirmation |
| T-066 | AI proposes mass reschedule | Preview + authenticated confirmation required |
| T-067 | AI service unavailable | Core CRUD works normally |
| T-068 | AI attempts raw SQL | Refused, only allowlisted tools |
| T-069 | iPhone/web conflicting PATCH | Conflict response, no silent loss |
| T-070 | Import Notion without history | No invented completed_at/time entries |
| T-071 | Restore MySQL backup to test instance | Entities and links valid |
| T-072 | Restore MinIO object | Object accessible, checksum matches |
| T-073 | Qdrant index missing | Rebuild possible from metadata/source |
| T-074 | MySQL FK/unique violation | Controlled error & rollback |
| T-075 | DataGrip/manual SQL accidental changes | DB roles and backups limit blast radius |
| T-076 | Duration zero/negative | Reject or policy-defined zero |
| T-077 | Duplicate goal measurement | Unique/idempotency prevents double count |
| T-078 | Goal achieved early | Future period targets remain explainable |
| T-079 | User changes timezone | Instant data intact, date bucketing recomputed |
| T-080 | Task due date vs scheduled date | UI and overdue logic distinct |

Bộ test trên là **acceptance baseline**, chưa bao gồm unit tests cho từng repository/service và load/security tests. Mỗi tính năng P0 cần happy path, validation, authorization, retry/idempotency và edge cases tương ứng.

---

## 34. Non-Functional Requirements — các tiêu chuẩn chất lượng

### 34.1. Correctness & Consistency

- ACID transactions khi sửa business state liên quan nhiều bảng.
- FK/unique/index constraints tại MySQL thay vì chỉ ở Pydantic.
- Idempotent commands: recurring occurrence generation, reminder delivery, OCR ingestion, AI action confirmation, rollover.
- Preserve history cho completed occurrences, time entries, goal evidence và reviews.
- Không lưu trường `OVERDUE` theo trạng thái tĩnh; tính từ thời điểm.

### 34.2. Performance (mục tiêu khởi đầu, cần đo thực tế)

| Operation | SLO khởi đầu đề xuất | Lưu ý |
|---|---|---|
| List Tasks (100 items) | P95 < 500ms tại local network | Excludes browser rendering |
| Today Summary | P95 < 700ms | Query optimization/indexes |
| Day/Week Calendar | P95 < 800ms | Date-range + bounded result |
| Task Detail | P95 < 700ms | Không eager load toàn bộ history |
| Standard Analytics | P95 < 1.5s | Thử nghiệm và profiling |
| AI Request | Budget per task | Không hứa P95 nếu local LLM thiếu GPU |
| OCR Job | Async status-based | Không giữ HTTP request mở lâu |

Đây là **target**, không phải đo đạc đã hoàn thành. Khi self-host server yếu, cần điều chỉnh dựa trên benchmark thực.

### 34.3. Accessibility & UX

- Frontend tối giản, ưu tiên ít icon, tránh thông tin dày đặc.
- Soft Blue là theme base; pastel accents dùng có ý nghĩa, không làm giảm contrast.
- Keyboard navigation, focus visible, Reduced Motion, native scrolling ưu tiên.
- Quick Add và inline editing, hạn chế modal và loading dài.
- User có thể dùng app bình thường dù AI/OCR Service offline.

### 34.4. Self-host Operations

- Docker Compose với healthchecks, persistent volumes, restart policies.
- MySQL, MinIO, Qdrant, Ollama, OCR chỉ private/internal network; frontend từ ngoài truy cập Backend qua HTTPS/VPN được kiểm soát.
- Không public cổng 3306/6333/9000/11434/OCR lên Internet.
- Backup ra ổ/thiết bị khác, không chỉ cùng ổ đang chạy.
- Monitoring tối thiểu: container health, disk space, MySQL backup success, reminder backlog, OCR jobs failure.

### 34.5. Security & Privacy

- Session/auth token an toàn; role owner tối thiểu, service-to-service credentials riêng.
- No direct FE→DB / FE→Ollama / FE→AI Service.
- Upload scan/size limit, content-type checks, private file access.
- Không log raw personal notes/AI prompts mặc định vào console production.
- AI model không có quyền delete/update nếu không qua confirmation service.

---

## 35. Roadmap triển khai backend theo phase

| Phase | Phạm vi | Điều kiện hoàn thành |
|---|---|---|
| **0. Foundations** | ERD, MySQL, Auth, migration, Docker, logs, CI | Có backup, restore test, schema constraints |
| **1. Core Tasks** | Task CRUD, occurrences, recurrence, subtasks/checklist | T-001…T-028 core pass |
| **2. Planning Spaces** | Today/Week/Month/Quarter/Year read views, saved plans, priorities | Cross-period scope và rollover logic correct |
| **3. Scheduling & Time** | Calendar, time blocks, timer, reminders | Calendar, timer, reminder tests pass |
| **4. Goals & Projects** | Goal targets, goal evidence, milestones, project progress | Metrics target vs actual reproducible |
| **5. Analytics** | Completion, planned/actual, heatmap, comparative reports | Metric specs + tests, no double count |
| **6. Habits & Reviews** | Habits, daily/weekly/monthly/yearly reviews | Streaks/reviews/rollovers accurate |
| **7. Knowledge & Views** | Notes, saved views, dashboards, MinIO attachments | File ownership and storage lifecycle safe |
| **8. AI & OCR Integrations** | AI gateway, OCR pipeline, chart specs, RAG | Core remains functional without AI |
| **9. Extended** | Templates, import Notion, automation, native iOS | Contract backward compatibility |

**P0 khả dụng sớm:** Auth + Tasks + Occurrences + Today + Week + Month + Calendar + Timer + Reminders + Basic Analytics. Năm/Quý nên có read-only summary và goal listing ngay, còn Annual Reviews/Quarter Forecast có thể là P1.

### 35.1. Definition of Done cho một backend feature

- [ ] Business flow và acceptance criteria được mô tả rõ.
- [ ] Endpoint/Pydantic schema có validation và error code.
- [ ] Auth/ownership tại server, không tin client-provided IDs.
- [ ] Service giữ business logic; repository chỉ thao tác DB.
- [ ] Alembic migration có FK/unique/index/rollback strategy khi thay đổi DB.
- [ ] Unit tests cho nghiệp vụ + integration tests với MySQL thật.
- [ ] Test idempotency/duplicate/transaction khi áp dụng.
- [ ] OpenAPI contract cập nhật và frontend typed client tương thích.
- [ ] Audit/history phù hợp, không xóa completed history ngoài policy.
- [ ] Logs/health/backup impact được review.
- [ ] Không thêm AI/cloud dependency bắt buộc cho chức năng cơ bản.

---

## 36. Danh sách cần chốt để tiến sang ERD/MySQL Schema

> Các câu hỏi này **chưa phải blocker** để xây bản frontend mock. Nhưng trước khi tạo migrations production, phải đưa quyết định vào tài liệu DB chính thức.

1. Planning period dùng lưu `plan` theo `year/quarter/month/week/day` hay chỉ một model `plan` có `period_type`/range? Đề xuất một model thống nhất với constraints.
2. Cách định danh tuần: ISO week vs first-day setting, và quy tắc khi người dùng đổi tùy chọn.
3. Goal period targets lưu tỷ lệ phân bổ, số đo tuyệt đối hay hỗ trợ cả hai?
4. Goal tự động tính từ source event nào, tránh double counting khi link nhiều project/task?
5. Review snapshot cần khóa số liệu hay luôn dùng live query? Nếu snapshot, versioning như nào?
6. Recurrence rolling horizon bao xa (30/60/90 ngày), điều kiện sinh lại và sửa future series?
7. Task one-off có bắt buộc occurrence một lần hay có unscheduled definition? Đề xuất **unscheduled definition trước; tạo occurrence khi lên lịch/đánh dấu bắt đầu/hoàn thành**, với invariants rõ.
8. Checklist tick theo occurrence: bắt buộc cho tất cả recurring tasks? Đề xuất có.
9. Delete/Archive cascade của Project/Task/Page/File hoạt động ra sao?
10. Timer storage, lock giữa thiết bị, overlap detection và orphan session.
11. Overdue cho all-day task xác định theo cuối ngày local hay due instant?
12. Habit model độc lập hay liên kết Task trong trường hợp habit phức tạp?
13. Base progress definitions (task/project/goal/plan) có metric keys nào?
14. Notes rich text lưu JSON document hay page block relational?
15. Multi-user ngay từ đầu hay single-user bootstrap với `user_id` chuẩn?
16. AI metadata DB và access policy, job ownership, idempotency keys.

---

## 37. Appendix — glossary / thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| Workspace | Root scope của dữ liệu cá nhân/đội ngũ |
| Planning Scope | Khoảng ngày xem: Year/Quarter/Month/Week/Day |
| Saved Plan | Cam kết có chủ đích trong một planning period |
| Period Review | Artifact tổng kết kỳ với evidence, notes và decisions |
| Plan Item | Link resource (task/project/goal) tới period plan |
| Goal | Kết quả mong đạt, có metric/target và evidence |
| Goal Period Target | Target phân bổ cho một khoảng kỳ |
| Project | Nhóm công việc hướng tới kết quả cụ thể |
| Task | Định nghĩa công việc gốc |
| Occurrence | Một lần thực hiện task, có schedule/status riêng |
| Recurrence Rule | Quy tắc tạo occurrences trong tương lai |
| Checklist Definition | Các bước trong task template |
| Occurrence Checklist State | Tick state của checklist trong một lần thực hiện |
| Subtask | Task có parent task, giữ lifecycle riêng |
| Dependency | Quan hệ công việc A cần trước B |
| Time Entry | Bằng chứng thời gian thực tế, timer hoặc manual |
| Planned Duration | Dự kiến, **không phải active time** |
| Active Time | Thời gian được ghi nhận từ valid time entries |
| Activity Heatmap | Visualization theo active time/completed/habit metrics |
| Rollover | Chuyển cam kết hoặc occurrence chưa xong sang kỳ sau |
| Chart Spec | JSON hợp lệ định nghĩa visualization, không có JS/SQL tùy ý |
| AI Gateway | Backend component xác thực/điều phối AI request |
| MinIO | Object Storage tự host lưu file và artifacts |
| Qdrant | Vector DB lưu embeddings và payload indexes |
| OCR | Nhận dạng chữ/bảng từ ảnh/PDF scan trong service riêng |

---

## 38. Appendix — hướng dẫn cho AI coding assistants

Khi giao Codex/Claude Code triển khai một feature từ tài liệu này:

1. Nêu rõ **Feature ID**, actors, input, expected outputs và acceptance tests.
2. Đầu tiên kiểm tra ownership module, current database schema và interfaces; không tạo duplicate models/tables.
3. Lập kế hoạch thay đổi `models → migrations → repository → service → mapper/schema → api → tests` theo nhu cầu, không buộc mọi feature phải thêm mapper/interface rỗng.
4. Kiểm tra boundary `Task` vs `Occurrence` vs `Time Entry`.
5. Lập contract cho năm/quý/tháng/tuần/ngày bằng date ranges và saved plan semantics, không copy tasks.
6. Analytics phải có công thức, datasource, timezone, inclusion/exclusion policy.
7. Không cho AI Service trực tiếp ghi `productivity_db`; đi qua Backend API/Business Services.
8. Test ít nhất happy path, validation, authorization, concurrency, idempotency, history preservation.
9. Không sửa schema production mà không có Alembic migration và rollback/forward strategy.
10. Không tự triển khai các feature P1/P2 chỉ vì gặp thuật ngữ trong tài liệu.

### Prompt mẫu cho implementation

```text
Implement Feature IDs [LIST] for Personal Productivity App.

Architecture:
- Business Backend: Python 3.14 + FastAPI, Hybrid (feature-first, layered-inside).
- MySQL 8.4 + SQLAlchemy + Alembic.
- AI/OCR are independent services, not part of Business Backend modules.
- Preserve Task → Occurrence → Time Entry semantics.
- Planning periods are scopes with optional saved plans, not replicated tasks.

Before coding:
1. Inspect existing models, migrations, services and API contracts.
2. List affected modules and database changes.
3. Write acceptance tests based on Feature Specification.
4. Identify ambiguous business decisions; use documented proposals or flag them.

Implementation rules:
- Validate via Pydantic; enforce invariants in Service + MySQL constraints.
- Keep repositories focused on persistence.
- Support partial PATCH, authorization and audit events where relevant.
- Ensure idempotency/concurrency/history preservation.
- Update OpenAPI, integration tests and documentation.
- Do not add unrelated features.
```

---

## 39. Tóm tắt quyết định và bước tiếp theo

### Đã chốt theo hướng dự án

- **FE:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui; Intelligent Minimalism, Soft Blue + pastel accents.
- **BE:** Python 3.14, FastAPI, **Hybrid Architecture** (feature → layer), service nghiệp vụ độc lập.
- **DB:** MySQL 8.4 LTS, InnoDB; DataGrip; SQLAlchemy + Alembic; self-host Docker.
- **Storage:** MinIO local cho files, Qdrant local cho vectors, Ollama local cho inference.
- **AI:** Service Hybrid độc lập; **OCR:** service/container độc lập, Python runtime tương thích PaddleOCR.
- **Business core:** Task definition ≠ occurrence ≠ time entry.
- **Product core:** Năm → Quý → Tháng → Tuần → Ngày là planning scopes; Goals/Projects/Tasks liên kết, không sao chép.

### Chưa chốt (cần giải quyết ở ERD / API Design)

- Cách persist saved plans/reviews, week keys, rollover semantics.
- Goal progress evidence attribution và KPI formula registry.
- Recurrence generation/update policy; checklist occurrence snapshot policy.
- Timer overlap, archive/delete, dashboard spec versioning và content blocks model.

### Deliverables tiếp theo

1. **Business Domain Model & ERD:** chốt entities, cardinality, owner, lifecycle, indexes.
2. **MySQL Physical Schema:** kiểu dữ liệu, constraints, migrations, sample seed.
3. **OpenAPI Contracts P0:** request/response, error codes, pagination, idempotency.
4. **Test Plan:** seed dataset theo ngày/tuần/tháng/năm, recurring tasks, timelines, metrics.
5. **Implementation Backlog:** Jira/Epics/Stories theo Feature IDs của tài liệu này.

> **Nguyên tắc cuối:** Thiết kế BE để hỗ trợ hệ thống quản lý cá nhân nhiều nghiệp vụ, nhưng UI luôn ưu tiên ít thông tin, thao tác nhanh, tập trung và dễ dùng mỗi ngày. Sản phẩm sẽ thành công khi giúp người dùng ra quyết định tốt hơn và đo lường đúng hoạt động thật, không phải khi có nhiều màn hình hoặc nhiều biểu đồ nhất.
