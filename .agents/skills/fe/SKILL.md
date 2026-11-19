---
name: fe
description: "Phát triển frontend Next.js/TypeScript theo Intelligent Minimalism, màu Soft Blue pastel, UI ít icon, giao diện Today/Tasks/Calendar/Goals, charts, animation và tối ưu trải nghiệm."
---

# Frontend Engineering & Design System Skill

## Khi nào dùng

Khi code/sửa UI, component, layout, biểu đồ, interaction, responsive, UX states, web performance, accessibility hoặc tích hợp API vào Next.js.

## Technology baseline

- **Next.js 16**, App Router; **React 19 + TypeScript strict**.
- **Tailwind CSS 4**, **shadcn/ui** (chọn một primitive backend, ưu tiên Base UI trong dự án mới và không trộn tùy tiện), **Lucide React**.
- **TanStack Query** cho remote state; **Zustand** cho local UI state nhỏ; **nuqs** cho URL filters; không trùng một state tại 3 nơi.
- **React Hook Form + Zod** cho form; `date-fns` cho xử lý ngày định dạng hiển thị.
- **Motion for React** cho tương tác quan trọng; CSS transitions cho hover/focus đơn giản.
- **dnd-kit** cho reorder; **FullCalendar** cho calendar khi tới module; **Recharts + shadcn Charts** cho analytics.
- **next-themes**, **Sonner**, **cmdk** theo use case; **Lenis** chỉ sử dụng có chọn lọc.
- Font: Geist Sans / Geist Mono, fallback font hỗ trợ dấu tiếng Việt đầy đủ.
- `pnpm` và lockfile trong version control.

## Design philosophy — bắt buộc

**Intelligent Minimalism · Soft Blue + Colorful Accents · Calm · Fast**.

- Nội dung chính là trung tâm; không dùng icon thuần trang trí, không nhồi card/tin phụ và không đặt dashboard chart ở mọi màn hình.
- Ít thao tác: inline edit, quick add, undo, keyboard shortcuts, contextual actions.
- Dùng whitespace, typography, hierarchy và tỉ lệ để tạo cảm giác cao cấp; tránh glassmorphism, gradient dày, shadow nặng.
- Chế độ sáng/tối đều được thiết kế; không đổi màu tự động thiếu kiểm soát.

### Bảng màu tham chiếu

| Token | Hex | Mục đích |
|---|---|---|
| `--canvas` | `#F7F9FC` | Nền ứng dụng sáng |
| `--surface` | `#FFFFFF` | Bề mặt, card, dialog |
| `--primary` | `#5D83BB` | CTA, selected, link chính |
| `--primary-soft` | `#E8EFF9` | Selected/hover background |
| `--foreground` | `#27354B` | Chữ chính |
| `--border` | `#E5EAF0` | Border dịu |
| `--accent-lavender` | `#A99ADB` | Sáng tạo/Study |
| `--accent-sage` | `#8CB9A5` | Habit/Health |
| `--accent-peach` | `#F0B28D` | Personal |
| `--accent-rose` | `#E6A0B0` | Goals |
| `--accent-butter` | `#E6C879` | Lưu ý |
| `--accent-sky` | `#8DBDDB` | Calendar |

Màu nhấn là **ngữ nghĩa**; tránh 6 màu xuất hiện đồng thời chỉ để trang trí. Tỉ lệ tham khảo: neutral ~75%, soft blue ~15%, accents ~10%; không coi đó là luật cứng.

### UI tokens & interaction

- Spacing dựa trên grid 4 px, phổ biến 8/12/16/24; radius khoảng 8–12 px.
- Hover 120–180 ms, phần lớn transition 120–220 ms; tôn trọng `prefers-reduced-motion`.
- Native scroll mặc định; không dùng Lenis toàn cục cho nested scrolling, calendar, drag/drop, mobile.
- Tránh animated counters/loading lâu; phản hồi việc nhấn nhanh với trạng thái disable/loading phù hợp.
- Ít icon; khi text rõ nghĩa hơn icon thì ưu tiên text. Icon cùng kích cỡ/nét, có aria-label nếu là icon-only.
- Không lạm dụng toasts; inline feedback, undo và error recovery ưu tiên.

## Cấu trúc khuyến nghị

```text
frontend/src/
├── app/                  # routes, layouts, server/client boundary
│   ├── (auth)/
│   └── (workspace)/      # today, year, quarter, month, week, tasks, calendar...
├── components/ui/        # shadcn components; chỉnh tập trung
├── components/layout/
├── components/shared/
├── features/             # tasks, planning, goals, analytics, time-tracking...
├── hooks/
├── lib/                  # API client, date, validation, design utilities
├── providers/
├── stores/
├── types/
└── styles/
```

Trong `features/<name>/` ưu tiên nhóm `components/`, `hooks/`, `api/`, `schemas/` khi đã đủ độ phức tạp. Không tạo folder rỗng.

## Quy tắc tích hợp data

- Frontend gọi **Backend API**, không gọi trực tiếp AI/OCR/MySQL/MinIO admin/Ollama.
- Typed API client theo OpenAPI/DTO; serialize ngày giờ với timezone rõ ràng.
- TanStack Query xử lý fetch/cache/invalidation; không tự sao chép server state sang Zustand.
- Các cập nhật optimistic chỉ dùng khi có rollback/undo, xử lý 409 conflict và lỗi mạng.
- Task completion từ **occurrence**, không lấy `tasks.status` giả định; active time từ `time_entries`.
- Không tính các metric tài chính/năng suất trong component; backend sở hữu định nghĩa metric.
- AI chart nhận `ChartSpec` đã validate, render bằng component allowlist; **không eval JS/JSX do AI sinh**.

## Luồng trang cốt lõi

| Trang | Nội dung ưu tiên |
|---|---|
| Today | 1–3 ưu tiên, thời gian còn lại, lịch sắp đến, quick add |
| Year / Quarter | mục tiêu, milestones, progress ở độ khái quát |
| Month / Week | kế hoạch, workload, rollover, review |
| Tasks | list/table/board có filter, inline edit, search |
| Task Detail | properties, occurrence history, subtasks, time entries, statistics |
| Calendar | day/week/month, time-block, drag resize, xung đột |
| Analytics | chỉ số có ý nghĩa, chart/heatmap, giải thích nguồn dữ liệu |
| Settings | theme, timezone, week start, notifications |

## Checklist triển khai một màn hình

1. Đọc use case và API contract; xác định empty/loading/error/not-found/unauthorized.
2. Đặt thông tin chính trên một màn hình, progressive disclosure cho chi tiết phụ.
3. Bố trí desktop/mobile; màn hình nhỏ có thể ưu tiên bottom navigation nhưng tránh lạm dụng icon.
4. Semantic HTML, focus management, keyboard use, labels, ARIA phù hợp.
5. Test 320px, 375px, tablet và desktop; giữ scroll đúng tự nhiên.
6. Kiểm thử khi API chậm, không có dữ liệu, 401/403/409/500, mất mạng.
7. Theo dõi bundle và rerender; virtualize danh sách dài nếu đo được nhu cầu.

## Commands gợi ý (chỉ chạy nếu package scripts tương ứng tồn tại)

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Definition of Done

- [ ] Phù hợp Soft Blue và ít icon/ít nhiễu.
- [ ] Không có text tràn, layout shift lớn hoặc animation gây khó chịu.
- [ ] Có accessibility và reduced motion.
- [ ] Không tự gọi nội bộ AI/OCR hoặc dùng dữ liệu giả làm production.
- [ ] Có test cho hành vi tương tác quan trọng, trạng thái lỗi và responsive.
