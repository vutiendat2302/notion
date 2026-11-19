# Personal Productivity App — Frontend Specification

> **Version:** 1.0  
> **Updated:** 17/11/2026  
> **Status:** Định hướng FE được thống nhất — triển khai web trước  
> **Product:** Personal Productivity & Time Management App  
> **Platforms:** Web desktop/mobile trước; iOS app native (React Native + Expo, cài qua SideStore) ở giai đoạn sau  
> **Design direction:** **Intelligent Minimalism × Soft Blue × Colorful Accents × Performance-first**

---

## 0. Tóm tắt định hướng — đọc trước khi code

**Mục tiêu:** Xây dựng một ứng dụng quản lý kế hoạch cá nhân hiện đại, nhẹ, rất mượt và dễ sử dụng mỗi ngày. Người dùng mở app phải nhanh chóng biết **hôm nay cần làm gì, việc nào quan trọng, khi nào thực hiện và đã hoàn thành đến đâu**.

**Triết lý cốt lõi:** Ít thành phần hơn, nhưng thông minh hơn. Ưu tiên nội dung và thao tác thực tế thay vì trang trí.

### Những quyết định đã thống nhất

- **Web-first:** Phát triển Next.js trước; mobile native triển khai sau, cùng dùng API/backend.
- **Soft Blue là màu nền tảng**, phối neutral nhẹ và các màu pastel phụ: Lavender, Sage, Peach, Rose, Butter, Sky.
- **Ít icon, ít chữ thừa, ít card**; dùng typography, khoảng trắng và bố cục để phân cấp thông tin.
- **Native scrolling mặc định**; Lenis chỉ cho các khu vực được chứng minh là cần, không bật toàn app.
- **Motion có chọn lọc**, không animation phô trương hoặc chuyển cảnh dài.
- **Dark mode được thiết kế riêng**, không chỉ đảo màu Light mode.
- **Responsive + touch-friendly** từ đầu; desktop ưu tiên tốc độ thao tác bàn phím, mobile ưu tiên chạm.
- **Không bắt buộc AI** cho bản đầu tiên; các tương tác “thông minh” có thể dùng rules, defaults, context và UX tốt.
- **Frontend có thể làm với mock data trước**, nhưng phải giữ đúng data contract, không tự làm sai quan hệ Task / Occurrence / Time Entry.

### Không thuộc phạm vi FE giai đoạn đầu

- Không triển khai backend, schema hay authentication server ngay trong repo frontend.
- Không tích hợp AI trả phí chỉ để tạo cảm giác “smart”.
- Không phát triển React Native song song với web.
- Không dùng nhiều animation, parallax, 3D, glassmorphism, gradient mạnh.
- Không cài tất cả thư viện cùng lúc khi chưa có màn hình sử dụng.

---

## 1. Frontend Tech Stack — cấu hình đề xuất

| Hạng mục | Công nghệ | Vai trò | Ưu tiên |
| --- | --- | --- | --- |
| Framework | **Next.js 16 + React 19** | App Router, rendering, routing, code splitting | **Core** |
| Language | **TypeScript (strict)** | Kiểu dữ liệu, contract, tăng độ an toàn | **Core** |
| Styling | **Tailwind CSS 4** | Utility CSS, responsive, design tokens | **Core** |
| UI Components | **shadcn/ui (Base UI primitives)** | Component có thể tùy chỉnh, accessibility | **Core** |
| Icons | **Lucide React** | Icon thống nhất, chỉ dùng khi cần | **Core** |
| Animation | **Motion for React (`motion`)** | Transitions, presence, spring nhẹ | Theo màn hình |
| Smooth Scroll | **Lenis** | Cuộn mượt có chọn lọc | Optional |
| Drag & Drop | **dnd-kit (`@dnd-kit/react`)** | Reorder task, di chuyển item | Tasks / Timeline |
| API State | **TanStack Query** | Fetch, cache, mutation, invalidation | Khi nối API |
| Client State | **Zustand** | Sidebar, view preferences, UI state | Khi cần |
| Forms | **React Hook Form + Zod** | Form state, schema validation | Core forms |
| Charts | **Recharts + shadcn Charts** | Dashboard / Analytics | Analytics phase |
| Calendar | **FullCalendar v7 + shadcn integration** | Month / week / day, event interactions | Calendar phase |
| Theme | **next-themes** | Light / dark / system | **Core** |
| Toast | **Sonner** | Lỗi, xác nhận, undo có chọn lọc | Core interactions |
| Command Palette | **cmdk** | Điều hướng/tác vụ bằng bàn phím | UX nâng cao |
| URL State | **nuqs** | Filter, tab, search, view đồng bộ URL | Khi có filter |
| Date Utilities | **date-fns** | Định dạng ngày, thời gian | **Core** |
| Fonts | **Geist Sans + Geist Mono** | Typography nhất quán | **Core** |

**Chú ý phiên bản:** Đây là stack mục tiêu tại thời điểm lập tài liệu, không yêu cầu khóa mọi package ở cùng số major. Khi cài phải dùng phiên bản tương thích thực tế và commit `pnpm-lock.yaml`.

**shadcn/ui:** Bắt đầu dự án mới với **Base UI**; không pha trộn tùy tiện Base UI và Radix primitives trong cùng loại component. shadcn đã chọn Base UI làm mặc định cho dự án mới từ 07/2026, nhưng Radix vẫn được hỗ trợ.

**FullCalendar:** Dùng API **v7**. Đừng sao chép hướng dẫn cài v6 (`@fullcalendar/core`, plugin v6 riêng lẻ) vào dự án v7. Ưu tiên registry shadcn chính thức khi triển khai màn hình Calendar. Các view/resource scheduler premium cần kiểm tra license nếu có dùng.

**Motion:** Package là `motion`, import từ `motion/react`. Trong Next.js App Router, chỉ sử dụng client boundary khi cần tương tác.

**dnd-kit:** Ưu tiên `@dnd-kit/react`; `@dnd-kit/helpers` hỗ trợ sortable/move. Không sử dụng nhầm API `@dnd-kit/core` đời trước khi copy ví dụ.

---

## 2. Design Philosophy — phong cách thiết kế

### 2.1. Tên phong cách

**Intelligent Minimalism / Soft Minimalism + Colorful Accents**

Kết hợp cảm giác:

- **Linear:** mật độ thông tin hợp lý, sidebar gọn, thao tác nhanh.
- **Notion Calendar:** lịch dễ đọc, kéo thả trực quan, không thừa decoration.
- **Raycast:** quick actions, keyboard shortcut, command palette.
- **Things / macOS:** nhẹ nhàng, tĩnh, tập trung vào nhiệm vụ.

**Không sao chép giao diện nguyên mẫu của các sản phẩm khác.** Chỉ lấy nguyên tắc thiết kế và UX.

### 2.2. Sáu nguyên tắc không được phá vỡ

1. **Content-first:** Nội dung cần làm quan trọng hơn dashboard đẹp.
2. **Low cognitive load:** Ít lựa chọn và thông tin ở mỗi thời điểm.
3. **Context-aware:** Chỉ hiển thị hành động liên quan đến trạng thái hiện tại.
4. **Instant feedback:** Thao tác phải có phản hồi ngay; tránh cảm giác chậm.
5. **Calm visual hierarchy:** Typography, spacing, màu rất nhẹ tạo phân cấp.
6. **Accessible & consistent:** Đủ tương phản, dùng được bàn phím và touch.

### 2.3. Quy định về icon

- **Không dùng icon chỉ để trang trí.**
- Không thêm icon cho mọi dòng trong sidebar hoặc mọi heading.
- Ưu tiên **text label rõ nghĩa**. Icon-only action phải có `aria-label` và tooltip nếu khó hiểu.
- Chỉ giữ icon tại các hành động thực sự cần: thêm, tìm kiếm, lịch, trạng thái, menu, điều hướng khi không còn chỗ cho chữ.
- Giữ cùng stroke và cỡ icon (thường **16–18px**), không trộn nhiều bộ icon.
- Không dùng emoji làm icon UI chính.

### 2.4. Quy định về thông tin

- Mỗi khu vực chỉ hiển thị **1–3 thông tin có ý nghĩa cao nhất**.
- Ẩn metadata phụ (`created_at`, ID, kỹ thuật) trong panel chi tiết.
- Ưu tiên **inline edit** cho task title, priority, due date khi phù hợp.
- Không mở modal cho việc có thể làm ngay trên danh sách.
- Không đặt nhiều dashboard cards khi một danh sách hoặc tiến độ đơn giản đã đủ.
- Action nguy hiểm phải có xác nhận hợp lý hoặc Undo.

---

## 3. Color System — Soft Blue & Colorful Accents

### 3.1. Nguyên tắc phân phối màu

- Khoảng **75% neutral**: canvas, surface, text, separators.
- Khoảng **15% Soft Blue**: hành động chính, focus, selection, link.
- Khoảng **10% pastel accents**: category, calendar events, heatmap/chart, mục tiêu.
- Đây là **quy tắc cảm nhận**, không phải yêu cầu tính pixel chính xác.
- **Một màn hình không nên có quá 2–3 accent nổi bật** đồng thời.
- Màu category phải ổn định: cùng một category dùng cùng một màu trên Tasks, Calendar, Analytics.

### 3.2. Light theme — base palette

| Token | Hex | Mục đích |
| --- | --- | --- |
| `canvas` | `#F7F9FC` | Nền ứng dụng |
| `surface` | `#FFFFFF` | Panel, popover, main content |
| `surface-subtle` | `#F1F5FA` | Hover, khu vực phụ |
| `primary` | `#5378AC` | CTA, active state, link; chữ trắng đủ tương phản ở cỡ thường |
| `primary-hover` | `#456A9D` | Hover của CTA |
| `primary-soft` | `#E8EFF9` | Selection, badge nhẹ, highlighted area |
| `soft-blue-decorative` | `#5D83BB` | Dải màu, biểu đồ/trang trí — **không dùng mặc định làm nền nút chữ trắng nhỏ** |
| `foreground` | `#27354B` | Chữ chính |
| `foreground-muted` | `#65758B` | Chữ phụ (kiểm tra tương phản theo nền) |
| `border` | `#E6EBF2` | Viền mỏng, divider |
| `focus-ring` | `#5378AC` | Keyboard focus |

**Lý do phân biệt `primary` và `soft-blue-decorative`:** `#5D83BB` kết hợp với chữ trắng chỉ đạt khoảng **3.87:1**, không đủ tiêu chuẩn WCAG AA cho chữ thường; `#5378AC` đạt khoảng **4.52:1** với trắng. Nếu nền mềm màu pastel, dùng chữ tối tương ứng.

### 3.3. Accent palette — pastel có điểm nhấn

| Accent | Base Hex | Soft background (gợi ý) | Strong text (gợi ý) | Ý nghĩa mặc định |
| --- | --- | --- | --- | --- |
| **Lavender** | `#A99ADB` | `#F1EDFA` | `#66558A` | Study / Creative |
| **Sage** | `#8CB9A5` | `#EDF6F0` | `#3E7061` | Habit / Health |
| **Peach** | `#F0B28D` | `#FFF3EA` | `#9A562E` | Personal |
| **Rose** | `#E6A0B0` | `#FCEFF3` | `#93445F` | Goals / reflection |
| **Butter** | `#E6C879` | `#FBF5E2` | `#846A20` | Reminder / attention |
| **Sky** | `#8DBDDB` | `#EDF6FC` | `#3F7196` | Calendar / time blocks |

**Quy tắc sử dụng:**

- `base`: chấm màu, dải nhỏ, line chart, tag không có chữ chồng lên.
- `soft background`: badge/pill/card phụ có diện tích nhỏ.
- `strong text`: label chữ đặt trên nền pastel sáng.
- Không dùng màu pastel base làm nền để đặt chữ trắng nhỏ.
- Không đồng nhất **màu category** với **màu trạng thái** (Done, Overdue, Warning). Category là tổ chức nội dung; status là tình trạng.

### 3.4. Semantic status colors

| Status | Màu gợi ý | Hiển thị |
| --- | --- | --- |
| `success` | Green/Sage đậm `#3E7061` | Đã hoàn thành, lưu thành công |
| `warning` | Warm amber `#846A20` | Gần deadline / chú ý |
| `danger` | Muted red `#B4535F` | Xóa / lỗi / rủi ro |
| `info` | Soft Blue `#5378AC` | Hướng dẫn / thông tin |
| `disabled` | Neutral | Không thao tác được |

Không biểu thị trạng thái chỉ bằng màu; cần text, icon trạng thái nhỏ hoặc nhãn rõ nghĩa khi cần thiết.

### 3.5. Dark theme — Slate Blue, không đen tuyệt đối

| Token | Hex | Mục đích |
| --- | --- | --- |
| `canvas` | `#111925` | Nền ngoài |
| `surface` | `#182332` | Main panel / card |
| `surface-subtle` | `#202D3E` | Hover, selected region |
| `primary` | `#9BBCE6` | Accent sáng trên nền tối |
| `primary-foreground` | `#111925` | Chữ đặt trên primary |
| `foreground` | `#ECF2FA` | Chữ chính |
| `foreground-muted` | `#AFBCD0` | Chữ phụ |
| `border` | `#2D3A4D` | Viền mảnh |

- Accent pastel trong dark mode cần có **dark variant** theo ngữ cảnh, không dùng y nguyên các nền sáng.
- Kiểm tra contrast AA cho mọi cặp màu chữ/nền quan trọng.
- Theme mặc định có thể là `system`, nhưng phải có tùy chọn **Light / Dark / System** trong Settings.

### 3.6. Semantic tokens (đề xuất cho shadcn + Tailwind v4)

Không hardcode hex trong từng component. Dùng `background`, `foreground`, `card`, `muted`, `primary`, `accent`, `border`, `ring`, `destructive`, `chart-*`, `category-*`.

> CSS dưới đây là **định hướng tokens**. Khi khởi tạo shadcn/ui, **merge** vào `globals.css` mà CLI sinh ra, không xóa các token/animation hiện hữu nếu chưa kiểm tra.

```css
/* src/app/globals.css — example token values */
:root {
  --background: #f7f9fc;
  --foreground: #27354b;
  --card: #ffffff;
  --card-foreground: #27354b;
  --popover: #ffffff;
  --popover-foreground: #27354b;
  --primary: #5378ac;
  --primary-foreground: #ffffff;
  --secondary: #f1f5fa;
  --secondary-foreground: #27354b;
  --muted: #f1f5fa;
  --muted-foreground: #65758b;
  --accent: #e8eff9;
  --accent-foreground: #36547e;
  --destructive: #b4535f;
  --border: #e6ebf2;
  --input: #e6ebf2;
  --ring: #5378ac;
  --radius: 0.625rem;

  --category-lavender: #a99adb;
  --category-sage: #8cb9a5;
  --category-peach: #f0b28d;
  --category-rose: #e6a0b0;
  --category-butter: #e6c879;
  --category-sky: #8dbddb;
}

.dark {
  --background: #111925;
  --foreground: #ecf2fa;
  --card: #182332;
  --card-foreground: #ecf2fa;
  --popover: #182332;
  --popover-foreground: #ecf2fa;
  --primary: #9bbce6;
  --primary-foreground: #111925;
  --secondary: #202d3e;
  --secondary-foreground: #ecf2fa;
  --muted: #202d3e;
  --muted-foreground: #afbcd0;
  --accent: #263b54;
  --accent-foreground: #d9e8fb;
  --destructive: #e1919b;
  --border: #2d3a4d;
  --input: #2d3a4d;
  --ring: #9bbce6;
}
```

**Ánh xạ Tailwind v4:** ưu tiên dùng các token do `shadcn/ui init` tạo ra (`@theme inline` và các utility như `bg-background`, `text-foreground`, `bg-primary`). Không cần tự thêm ánh xạ trùng nếu đã có sẵn.

### 3.7. Quy tắc màu cho charts/heatmap

- Biểu đồ tối đa 4–6 series màu dễ phân biệt; phần còn lại chuyển sang filter hoặc group.
- Heatmap có thang **5 mức** từ neutral → soft blue → blue đậm, hoặc thang theo category khi chọn chế độ cụ thể.
- Tooltip bắt buộc có con số + đơn vị: `2h 30m`, `4 tasks`, không chỉ biểu thị bằng độ đậm màu.
- Không dùng màu nóng (danger) để biểu thị category thông thường.
- Không coi lịch dự kiến là thời gian hoạt động thực tế.

---

## 4. Typography, Spacing, Layout

### 4.1. Typography

- **Primary:** Geist Sans; **monospaced data/shortcuts:** Geist Mono.
- Nếu cần dự phòng dấu tiếng Việt, kiểm tra glyph trên Windows/macOS/Linux/iOS; fallback gợi ý `Inter, system-ui, sans-serif`.
- Không quá **3 cấp độ text** trong một card.
- Số liệu thống kê dùng `font-variant-numeric: tabular-nums` để không nhảy layout.

| Thành phần | Cỡ desktop đề xuất | Ghi chú |
| --- | --- | --- |
| Page title | 26–30px / 600 | Ít title lớn, chỉ một H1 |
| Section title | 16–18px / 600 | Gọn, dễ scan |
| Body | 14–15px / 400–500 | Độ đọc cao |
| Secondary | 12–13px / 400 | Metadata quan trọng |
| Button | 13–14px / 500 | Label rõ ràng |
| Numeric KPI | 22–28px / 600 | Chỉ khi số liệu quan trọng |

**Không thu nhỏ chữ tùy tiện để nhét thêm thông tin.** Ưu tiên ẩn bớt metadata hoặc đổi layout.

### 4.2. Spacing, radius, borders

| Thuộc tính | Giá trị khuyến nghị |
| --- | --- |
| Spacing scale | 4, 8, 12, 16, 20, 24, 32px |
| Page padding desktop | 24–32px |
| Page padding tablet | 20–24px |
| Page padding mobile | 16px |
| Gap chính giữa section | 24–32px |
| Control height desktop | 36–40px |
| Touch target mobile | Tối thiểu khoảng 44×44px |
| Border radius control | 8px |
| Border radius card/panel | 10–12px |
| Border | 1px neutral, mềm |
| Shadow | Rất nhẹ, chủ yếu popover/menu/dialog |

### 4.3. Layout desktop

- **App shell:** sidebar trái + main content.
- Sidebar có thể **collapse**; tiêu đề rõ ràng, số nhóm navigation ít.
- Main content có chiều rộng hợp lý (thường tối đa 1200–1400px với Dashboard/Tasks); Calendar/Timeline có thể rộng hơn.
- Header nhỏ; không có nhiều thanh công cụ chồng nhau.
- Ưu tiên bố cục phẳng, không card bên trong card liên tục.

### 4.4. Layout mobile web

- Không ép sidebar desktop xuống mobile.
- Có thể dùng top bar + bottom navigation cho **Today / Tasks / Calendar / More**.
- Primary action dễ chạm; tránh quá nhiều floating buttons.
- Không để bảng ngang tràn viewport; chuyển thành rows/cards phẳng, ẩn cột phụ.
- Dialog phức tạp có thể chuyển thành full-screen sheet trên điện thoại.
- Kiểm thử Safari iOS, thanh địa chỉ co giãn, viewport height và safe area.

---

## 5. Motion, Scrolling & Micro-interactions

### 5.1. Motion principles

- Chuyển động có nhiệm vụ **diễn đạt sự thay đổi trạng thái**, không phải trang trí.
- Giao diện phải cảm giác tức thì: tránh trì hoãn click để đợi animation.
- Ưu tiên animation `transform` và `opacity`, hạn chế animate width/height/layout quá nhiều nếu không cần.
- Tôn trọng `prefers-reduced-motion: reduce`.

| Hiệu ứng | Công nghệ | Cách sử dụng | Thời lượng gợi ý |
| --- | --- | --- | --- |
| Chuyển trang | Motion / CSS | Fade + translate rất nhẹ; có thể không animate ở navigation thường | 120–180ms |
| Mở/đóng sidebar | CSS / Motion | Dịch chuyển/đổi chiều rộng mượt, không giật content | 180–240ms |
| Hover nút / card | Tailwind CSS | Chỉ đổi nền/viền nhẹ | 120–180ms |
| Dialog / Drawer | shadcn/ui + CSS / Motion | Fade, scale nhẹ, focus đúng chỗ | 160–220ms |
| Cuộn trang | **Native scroll** | Mặc định cho toàn app | Native |
| Lenis | Lenis | **Chỉ** nơi có lý do UX thật sự và đã test | Optional |
| Kéo-thả task | dnd-kit | Drag overlay, chỉ báo vị trí drop | Theo tương tác |
| Loading | shadcn Skeleton | Hình dáng gần final layout, tránh layout shift | Không loop quá nhiều |
| Toast | Sonner | Success/error/undo có chọn lọc | Ngắn |
| Command palette | cmdk | `Ctrl + K` / `⌘ + K` | Ngay lập tức |
| Tooltip | shadcn/ui | Với icon-only/khái niệm khó hiểu | Trễ ngắn, không lạm dụng |

### 5.2. Chính sách về Lenis

**Không cài Lenis làm global wrapper cho dashboard.** App có Calendar, Timeline, danh sách dài, drawer và vùng scroll lồng nhau; native scrolling ổn định hơn cho trackpad/touch/iOS và accessibility.

Nếu dùng Lenis, chỉ áp dụng cho landing/public storytelling hoặc một khu vực độc lập sau khi kiểm chứng:

- Không gây scroll lag, conflict với sticky elements.
- Không ảnh hưởng keyboard navigation, focus, anchor links.
- Không xung đột drag-and-drop, FullCalendar và scroll lồng nhau.
- Tắt khi `prefers-reduced-motion` yêu cầu.

### 5.3. Chất lượng tương tác

- Hover có phản hồi mềm; không phóng card mỗi lần trỏ chuột.
- Checkbox hoàn thành task cập nhật ngay và có cơ chế rollback nếu API lỗi.
- Reorder task không đổi các trường khác ngoài thứ tự.
- Toast **không xuất hiện** sau mọi click; chỉ dùng khi có giá trị thông tin.
- Không gây giật layout khi bật filter, load data hoặc chuyển tab.
- Timer hiển thị ổn định, không phụ thuộc số lần React render để tính thời gian.

---

## 6. Navigation & Information Architecture

### 6.1. Hệ thống màn hình

| Màn hình | Mục đích | Nội dung ưu tiên |
| --- | --- | --- |
| **Today / Dashboard** | Nhìn nhanh kế hoạch hôm nay | Việc ưu tiên, giờ tới, tiến độ ngắn |
| **Tasks** | Tạo, tìm, lọc và hoàn thành task | List, status, due date, priority |
| **Timeline** | Lên kế hoạch theo khung giờ | Time blocks, kéo/đổi giờ |
| **Calendar** | Xem lịch theo ngày/tuần/tháng | Occurrences / scheduled items |
| **Habits** | Check-in thói quen | Hôm nay, streak, lịch sử ngắn |
| **Analytics** | Hiểu hành vi làm việc | Active time, planned vs actual, trend |
| **Goals** | Mục tiêu dài hạn | Tiến độ theo đơn vị phù hợp |
| **Settings** | Cá nhân hóa | Theme, timezone, preferences |

**Lưu ý:** Tài liệu gốc cũng có Projects/Categories trong data model. Có thể truy cập chúng qua bộ lọc, selector hoặc một phân hệ khi cần; không nhất thiết phải tạo mục sidebar riêng ngay từ bản đầu.

### 6.2. Sidebar desktop đề xuất

1. **Today**
2. **Tasks**
3. **Calendar** (Timeline có thể là view/tab trong Calendar, tùy UX test)
4. **Analytics**
5. **More** → Habits, Goals, Settings

Không nhất thiết tách mọi module thành một icon và một entry trên sidebar.

### 6.3. Today page — content first

Thứ tự từ trên xuống:

1. Ngày hiện tại + **Today**.
2. Danh sách **Top priorities** (tối đa 3 mục đầu tiên).
3. **Upcoming schedule** (khoảng thời gian tiếp theo).
4. **All tasks today** (lọc/sắp xếp).
5. **Một chỉ số tiến độ nhỏ**, không cần hàng loạt KPI cards.

Không biến Today thành “BI dashboard”. Biểu đồ nhiều chỉ số đặt trong Analytics.

### 6.4. Tasks page

- Chuyển nhanh **Today / Upcoming / All / Completed**.
- Search, filter, sort rõ ràng nhưng ẩn trong controls gọn.
- Quick add một dòng; thêm chi tiết trong secondary panel.
- Inline edit: title, priority, date; notes/recurrence mở detail panel.
- Row height vừa đủ; hover actions chỉ xuất hiện khi cần (trên touch luôn có affordance hợp lý).
- Reorder dùng dnd-kit khi danh sách có ý nghĩa sắp xếp thủ công.

### 6.5. Calendar & Timeline

- Calendar month/week/day dùng FullCalendar.
- Timeline tập trung vào **time blocking**; xem giờ dự kiến và hoạt động thực tế khác nhau.
- Event có màu category mềm; không tô kín màn hình bằng màu đậm.
- Drag/resize event dùng chức năng Calendar phù hợp, **không bọc dnd-kit ngoài FullCalendar tùy tiện**.
- Có current time indicator; click thời gian trống để tạo lịch.
- Xử lý task **all-day** (chỉ có ngày) riêng với task đã có giờ.

### 6.6. Analytics

- Mặc định chỉ các biểu đồ **có câu hỏi rõ ràng**: Completion trend, Active time, Time by category, Planned vs Actual, Heatmap.
- Chart labels và units rõ, tooltip gọn.
- Không tạo “productivity score” tổng hợp thiếu cơ sở.
- Khi thiếu dữ liệu, hiển thị empty state giải thích thay vì vẽ biểu đồ giả.
- Không nhét tất cả chart vào một trang dài vô hạn.

---

## 7. Intelligent UX — thông minh nhưng không rườm rà

### 7.1. Smart defaults

- Mặc định vào **Today** hoặc view gần nhất người dùng chọn.
- Tạo task mới tự điền `scheduled_date = today` nếu người dùng đang ở Today, nhưng người dùng có thể đổi.
- Nhớ lựa chọn theme, tuần bắt đầu từ thứ mấy, sort/view.
- Quick add luôn sẵn trong Tasks/Today, không bắt người dùng tìm nút sâu trong menu.

### 7.2. Contextual actions

- Task chưa bắt đầu: **Start**, **Schedule**, **Complete**.
- Task đang thực hiện: **Pause/Stop**, **Complete**.
- Task đã hoàn thành: **View history**, **Undo completion** (nếu hợp lệ).
- Task lặp lại: sửa **lần này** hay **các lần tương lai** phải phân biệt rõ.
- Khi chưa có activity data: chỉ hiển thị hướng dẫn mở timer/check-in, không gán nhãn “không năng suất”.

### 7.3. Command palette

`Ctrl + K` (Windows/Linux) / `⌘ + K` (macOS):

- Search tasks.
- Go to Today / Tasks / Calendar / Analytics.
- Create task.
- Start focus timer (khi có task hợp lệ).
- Switch theme.

Không làm command palette thành “AI chatbot” nếu tác vụ chưa cần NLP.

### 7.4. Smart task input — tính năng nâng cao, không bắt buộc MVP

Ví dụ nhập: `Học tiếng Anh 20h tối mai, nhắc trước 15 phút`.

- Parser/rules tách title, date, time, reminder.
- Hiển thị các trường đã nhận dạng thành chips nhỏ.
- Người dùng **xác nhận hoặc sửa** trước khi lưu.
- Parser phải có timezone và xử lý tiếng Việt; nếu không chắc chắn, không tự đoán.
- **Không yêu cầu LLM** cho phiên bản đầu tiên.

---

## 8. Data Contract & UI State — nhất quán với backend tương lai

**Đây là yêu cầu quan trọng của dự án:**

- `Task` = **định nghĩa công việc gốc** (ví dụ “Học tiếng Anh”).
- `TaskOccurrence` = **một lần xuất hiện/được lên lịch** (ví dụ học ngày 17/11).
- `TimeEntry` = **phiên hoạt động thực tế** (ví dụ 20:00–20:30).

Frontend không được dùng `task.status = DONE` để đại diện cho một occurrence của task lặp lại.

### 8.1. Frontend types (minh họa)

```ts
type OccurrenceStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DONE"
  | "SKIPPED"
  | "CANCELLED";

type Task = {
  id: string;
  title: string;
  description?: string;
  categoryId?: string | null;
  projectId?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  estimatedMinutes?: number | null;
  isRecurring: boolean;
};

type TaskOccurrence = {
  id: string;
  taskId: string;
  scheduledDate: string; // YYYY-MM-DD theo timezone người dùng
  startAt: string | null; // ISO datetime nếu có
  endAt: string | null;
  status: OccurrenceStatus;
  completedAt: string | null;
};

type TimeEntry = {
  id: string;
  occurrenceId?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  source: "TIMER" | "MANUAL";
};
```

> Types là **draft để làm mock**; tên field, nullability và API response phải đồng bộ với OpenAPI khi backend chính thức được triển khai. Không tự coi draft là schema cuối.

### 8.2. Quy tắc hiển thị dữ liệu

- `scheduledDate`, `startAt`, `endAt` là kế hoạch, **không phải** bằng chứng đã làm.
- `completedAt` phản ánh thời điểm đánh dấu hoàn thành.
- `TimeEntry` phản ánh thời gian thực tế, có thể có nhiều entries trong một occurrence.
- Heatmap Active Hours tính từ dữ liệu hoạt động; không tự lấy giờ dự kiến.
- Ngày không có data phải phân biệt với ngày được xác nhận không hoạt động.
- Tính toán hiển thị theo timezone cá nhân `Asia/Ho_Chi_Minh` mặc định, không chỉ theo UTC date.
- Lịch sử phải được bảo toàn khi user sửa task recurring.

### 8.3. Các trạng thái UI bắt buộc

Mọi màn hình dữ liệu phải xử lý:

1. **Initial loading** — skeleton phù hợp layout.
2. **Empty** — nội dung rõ và một hành động hữu ích.
3. **Error** — thông điệp dễ hiểu + Retry nếu được.
4. **Success** — cập nhật trạng thái ngay.
5. **Offline/network unstable** — không nói “đã lưu” nếu chưa xác nhận.
6. **Permission/session expired** — quay lại đăng nhập mà không mất các thay đổi chưa gửi khi có thể.

---

## 9. State Management & Data Flow

### 9.1. Chọn đúng nơi lưu state

| Loại state | Công cụ | Ví dụ |
| --- | --- | --- |
| **Server state** | TanStack Query | Tasks, occurrences, analytics, mutations |
| **Shareable URL state** | nuqs | Search, filter, selected view, date |
| **Transient local state** | `useState` / component state | Dialog open, input focus |
| **Cross-component UI state** | Zustand | Sidebar collapsed, command palette state |
| **Form state** | React Hook Form + Zod | Create/edit task |
| **User settings** | Backend (khi có) + theme provider | Theme, timezone, preferences |

Không dùng Zustand làm kho lưu toàn bộ tasks lấy từ backend vì sẽ tạo **hai nguồn sự thật** cạnh tranh với TanStack Query.

### 9.2. Data access

- UI chỉ gọi qua `features/*/api` hoặc `lib/api-client`, không fetch bừa bãi trong mỗi component.
- Khi backend có OpenAPI, cân nhắc sinh TypeScript API client.
- Mutations dùng optimistic UI **chỉ khi rollback rõ ràng**.
- Query key nhất quán; tránh stale data giữa Today / Tasks / Calendar.
- Không để access token nhạy cảm trong `localStorage` nếu có thể dùng session/cookie HttpOnly an toàn.

### 9.3. SSR / Client boundary

- Layout, shell, nội dung tĩnh: ưu tiên Server Components.
- Calendar, chart tương tác, drag-drop, command palette, timer: Client Components.
- Không thêm `"use client"` lên toàn bộ `app/layout.tsx` nếu chỉ một phần cần tương tác.
- Lazy-load thành phần nặng như Calendar/Analytics khi phù hợp.

---

## 10. Component System

### 10.1. Core UI components

Cài từ shadcn khi cần:

- Button, Input, Textarea, Select, Checkbox, Switch.
- Dialog, Alert Dialog, Drawer/Sheet, Dropdown Menu, Popover.
- Tabs, Tooltip, Separator, Skeleton, Scroll Area **chỉ dùng nơi hợp lý**.
- Form, Calendar/Date Picker, Badge, Progress.
- Table (cho dữ liệu phù hợp), Sonner/Toast.

**Lưu ý:** `ScrollArea` không thay native scrolling toàn app; card/shadow/badge không phải thành phần mặc định cho mọi khối nội dung.

### 10.2. Application components có thể tái dùng

| Component | Công dụng |
| --- | --- |
| `AppShell` | Sidebar, topbar, main |
| `PageHeader` | Title + 1–2 actions cần thiết |
| `TaskRow` | Dòng task ít thông tin |
| `QuickAddTask` | Tạo nhanh |
| `TaskDetailPanel` | Thông tin mở rộng |
| `PriorityMarker` | Chỉ báo ưu tiên tinh tế |
| `CategoryDot` | Chấm màu pastel của category |
| `EmptyState` | Trạng thái chưa có data |
| `FocusTimer` | Bắt đầu/dừng phiên hoạt động |
| `ActivityHeatmap` | Dữ liệu hoạt động thực tế |
| `CommandMenu` | Search/navigation/actions |
| `ThemeSwitcher` | Light/dark/system |

### 10.3. Quy định component

- Component có một nhiệm vụ rõ, API props dễ đọc.
- Base UI components nằm trong `components/ui`, tùy biến có kiểm soát.
- Domain logic không nằm trực tiếp trong phần JSX trình bày.
- Một design token được định nghĩa một lần, không lặp màu trong nhiều file.
- `disabled`, `loading`, `error`, `focus`, `hover`, `active` phải được thiết kế nhất quán.
- Icon-only action cần accessible name và focus state.

---

## 11. Thư viện bổ sung — cài theo nhu cầu

| Nhóm | Thư viện / Công cụ | Thời điểm dùng |
| --- | --- | --- |
| Danh sách lớn | `@tanstack/react-virtual` | Tasks/history rất dài |
| Data table | `@tanstack/react-table` | Bảng thống kê cần sort/filter |
| Keyboard shortcuts | `react-hotkeys-hook` | Khi shortcut phức tạp hơn cmdk |
| Loading | shadcn `Skeleton` | Core views |
| Date picker | `react-day-picker` | Chọn ngày tùy biến |
| API mocking | `msw` | Frontend-first với mocked API |
| Unit tests | **Vitest** | Utils, hooks, validation |
| Component tests | **Testing Library** | Tương tác task/forms |
| E2E | **Playwright** | Luồng xuyên màn hình |
| Component workshop | **Storybook** | Optional khi component nhiều |
| Code quality | **ESLint + Prettier** | Từ ngày đầu |
| Performance | **Lighthouse + React DevTools** | Kiểm thử định kỳ |

**Nguyên tắc:** Không cài thư viện chỉ vì “đẹp” hoặc “phổ biến”. Mỗi thư viện cần mang lại chức năng cụ thể, có tài liệu tốt, hỗ trợ React/Next hiện tại và không tạo dependency trùng.

---

## 12. Frontend Folder Structure

Định hướng monorepo để sau này có iOS app; giai đoạn đầu chỉ cần tạo `apps/web`.

```text
personal-productivity/
├── apps/
│   ├── web/                          # Next.js (làm trước)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   └── (app)/
│   │   │   │       ├── today/
│   │   │   │       ├── tasks/
│   │   │   │       ├── calendar/
│   │   │   │       ├── timeline/
│   │   │   │       ├── habits/
│   │   │   │       ├── goals/
│   │   │   │       ├── analytics/
│   │   │   │       └── settings/
│   │   │   ├── components/
│   │   │   │   ├── ui/                # shadcn-managed
│   │   │   │   ├── layout/
│   │   │   │   └── shared/
│   │   │   ├── features/
│   │   │   │   ├── tasks/
│   │   │   │   ├── calendar/
│   │   │   │   ├── time-tracking/
│   │   │   │   ├── habits/
│   │   │   │   └── analytics/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   ├── api/
│   │   │   │   ├── dates/
│   │   │   │   └── utils/
│   │   │   ├── mocks/
│   │   │   ├── providers/
│   │   │   ├── stores/
│   │   │   └── types/
│   │   ├── public/
│   │   └── package.json
│   └── mobile/                       # React Native + Expo, LATER
│
├── services/
│   └── api/                          # FastAPI, LATER
├── packages/
│   └── api-client/                   # Shared API types/client, LATER
├── docs/
├── README.md
└── pnpm-workspace.yaml               # Khi thiết lập monorepo hoàn chỉnh
```

**Tránh overengineering:** Không cần tạo tất cả folder/package rỗng từ đầu; thêm khi feature xuất hiện. Không chia quá nhiều layer kiểu enterprise cho ứng dụng một người dùng.

---

## 13. Cài đặt dự án — Ubuntu / pnpm

### 13.1. Yêu cầu môi trường

- Node.js **24 LTS** (phù hợp Next.js 16; bản Next yêu cầu tối thiểu Node 20.9 theo tài liệu).
- pnpm phiên bản ổn định phù hợp Node.
- Git + VS Code + browser developer tools.
- `pnpm-lock.yaml` bắt buộc commit.

### 13.2. Khởi tạo Next.js app

```bash
mkdir -p personal-productivity/apps
cd personal-productivity

pnpm create next-app@latest apps/web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd apps/web

# Khởi tạo shadcn (chọn Base UI)
pnpm dlx shadcn@latest init

# Icons, theme, animation
pnpm add lucide-react next-themes motion

# Forms, validation, date
pnpm add react-hook-form zod @hookform/resolvers date-fns

# Toast / command palette
pnpm add sonner cmdk

# Server state / local state / URL state
pnpm add @tanstack/react-query zustand nuqs

pnpm dev
```

### 13.3. Chỉ cài khi làm feature

```bash
# Drag-and-drop
pnpm add @dnd-kit/react @dnd-kit/helpers

# Data tables / virtualization
pnpm add @tanstack/react-table @tanstack/react-virtual

# Charts (khi làm analytics)
pnpm add recharts

# Smooth scrolling — optional, KHÔNG bật global mặc định
pnpm add lenis

# Testing — tùy cấu hình hiện hành của project
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
pnpm add -D @playwright/test prettier
```

### 13.4. FullCalendar v7 + shadcn

Ở giai đoạn Calendar, ưu tiên hướng dẫn v7 trên trang chính thức. Ví dụ cấu hình registry trong `components.json`:

```json
{
  "registries": {
    "@fullcalendar": "https://shadcn-registry.fullcalendar.io/{name}.json"
  }
}
```

**Lưu ý:** Merge `registries` vào `components.json` hiện có, không ghi đè nguyên file.

```bash
# Chỉ là ví dụ flavor; kiểm tra bản docs v7 hiện tại trước khi dùng
pnpm dlx shadcn@latest add @fullcalendar/monarch-event-calendar
```

Theme của Calendar phải dùng design tokens đã chốt; toolbar có thể tinh giản so với demo.

---

## 14. Performance-first — không đánh đổi độ mượt

### 14.1. Core Web Vitals mục tiêu

| Metric | Mục tiêu đánh giá | Ý nghĩa |
| --- | --- | --- |
| LCP | ≤ 2.5s | Nội dung lớn xuất hiện đủ nhanh |
| INP | ≤ 200ms | Phản hồi thao tác tốt |
| CLS | ≤ 0.1 | Layout ít nhảy |

**Đây là ngưỡng mục tiêu đo trên thiết bị/mạng thực tế, không phải cam kết tự động đạt.**

### 14.2. Danh sách kiểm soát hiệu năng

- [ ] Không đưa toàn bộ Dashboard/Calendar/Charts vào client bundle nếu chưa cần.
- [ ] Sử dụng Server Components đúng chỗ và client boundary nhỏ.
- [ ] Lazy load FullCalendar, chart nặng và các dialog không dùng ngay.
- [ ] Giữ font tối thiểu weight/style cần thiết, dùng `next/font`.
- [ ] Không phát animation kéo dài trên list hàng trăm phần tử.
- [ ] Dùng virtualization khi lịch sử task lớn.
- [ ] Debounce search hợp lý nhưng không khiến nhập liệu chậm.
- [ ] Không refetch quá mức khi đổi tab qua lại.
- [ ] Skeleton khớp layout thật, tránh CLS.
- [ ] Trên iPhone thật kiểm tra scroll, mở bàn phím, focus, bottom sheet.
- [ ] Giảm render lại khi timer chạy (tách timer display và data state).
- [ ] Không để chart hoặc FullCalendar nằm ngoài viewport vẫn chạy hiệu ứng không cần thiết.

---

## 15. Accessibility & Responsive Quality

- [ ] Text contrast đạt tối thiểu WCAG AA cho nội dung chính.
- [ ] Focus visible khi dùng bàn phím.
- [ ] Form có label, error text và mô tả trường dễ hiểu.
- [ ] Icon-only actions có accessible name.
- [ ] Click/touch target đủ lớn, không đặt các nút quá sát nhau.
- [ ] Modal trap focus, đóng bằng Escape, trả focus về điểm mở.
- [ ] Kéo-thả có phương án điều khiển bằng bàn phím hoặc nút thay thế.
- [ ] Không chỉ dùng màu để thể hiện status/priority.
- [ ] Respects Reduced Motion.
- [ ] Hoạt động với bàn phím và screen readers ở các flow chính.
- [ ] Test responsive tại khoảng 360px / 390px / 768px / 1024px / 1440px.
- [ ] Không có horizontal overflow ngoài ý muốn.
- [ ] Date/time hiển thị nhất quán theo timezone người dùng.

---

## 16. Testing & Quality Gates

### 16.1. Unit tests (Vitest)

- Date utilities, timezone conversion, duration formatting.
- Task sorting/filtering.
- Zod schema validation.
- Function map Task → Occurrence display model.
- Analytics calculations (không trùng time entries).

### 16.2. Component tests (Testing Library)

- Tạo task nhanh, sửa inline, save/cancel.
- Đánh dấu Done đúng occurrence, không làm mất task recurring.
- Loading/empty/error states.
- Theme switch.
- Keyboard focus và shortcut căn bản.

### 16.3. E2E (Playwright)

- Mở Today → tạo task → thấy trong Tasks/Calendar.
- Chỉnh giờ task → cập nhật Calendar/Timeline.
- Reorder task → giữ thứ tự sau refresh.
- Start/Pause/Resume/Stop timer.
- Đổi Light/Dark → giữ lựa chọn.
- Mobile navigation, dialog, scroll, viewport.
- Network error: mutation rollback/không báo lưu thành công sai.

### 16.4. Code review checklist

- [ ] Không có icon trang trí dư thừa.
- [ ] Không có màu hex hardcode ngoài tokens (trừ ngoại lệ hợp lý).
- [ ] Không có animation gây chậm thao tác.
- [ ] Không lạm dụng cards và toasts.
- [ ] Không nhầm planned time với actual time.
- [ ] Dùng đúng Task / TaskOccurrence / TimeEntry.
- [ ] Có responsive mobile và dark theme.
- [ ] Thư viện mới có lý do rõ ràng.
- [ ] Loading/error/empty state đầy đủ.
- [ ] Không có ESLint/type errors.

---

## 17. Lộ trình phát triển FE — theo từng giai đoạn

### Phase FE-0 — Foundation

- [ ] Khởi tạo Next.js + TS + Tailwind + shadcn (Base UI).
- [ ] Cấu hình Geist fonts + fallback tiếng Việt.
- [ ] Tạo semantic design tokens Light/Dark.
- [ ] Thiết lập lint/format + project structure.
- [ ] Viết `AppShell`, `PageHeader`, `EmptyState`, `ThemeSwitcher`.
- [ ] Xây mock data và draft types dựa trên data model dự kiến.

**Definition of Done:** Có layout shell đẹp, responsive, light/dark, font/màu/spacing đồng bộ, không có visual noise.

### Phase FE-1 — Today & Tasks

- [ ] Today content-first.
- [ ] Task list, status, priority, category dot, due date.
- [ ] Quick add và inline edit.
- [ ] Filter, sort, empty/loading/error.
- [ ] Mock API bằng MSW (nếu cần).
- [ ] Command palette bản nhỏ.

**Definition of Done:** Có thể quản lý task hằng ngày bằng mock data mà trải nghiệm không rườm rà.

### Phase FE-2 — Calendar & Timeline

- [ ] FullCalendar v7 theo theme.
- [ ] Month/week/day.
- [ ] Time blocking.
- [ ] Drag/resize event; all-day handling.
- [ ] Recurring occurrence UX (lần này/các lần sau).

**Definition of Done:** Kế hoạch và lịch nhìn rõ, kéo-thả tự nhiên, dùng tốt trên mobile.

### Phase FE-3 — Time Tracking, Habits, Goals

- [ ] Focus timer và manual time entry.
- [ ] History theo phiên.
- [ ] Habits check-in (theo mô hình được chốt).
- [ ] Goals progress (đúng đơn vị đo).

**Definition of Done:** Dữ liệu hoạt động thực tế không bị lẫn với lịch dự kiến.

### Phase FE-4 — Analytics

- [ ] Daily/weekly/monthly overview.
- [ ] Activity heatmap dựa trên activity thực tế.
- [ ] Planned vs Actual.
- [ ] Completion trends và Time Allocation.
- [ ] Tooltips, empty state, filter.

**Definition of Done:** Mỗi biểu đồ có định nghĩa metric và không làm Dashboard chính quá tải.

### Phase FE-5 — Backend integration & polish

- [ ] Kết nối OpenAPI client và TanStack Query.
- [ ] Auth/session, protected routes, retry/error handling.
- [ ] Optimistic updates có rollback.
- [ ] Lighthouse + Playwright + kiểm thử Safari iPhone.
- [ ] Accessibility audit.
- [ ] Deploy web.

**Definition of Done:** App chạy ổn định, dữ liệu nhất quán, mượt trên desktop và điện thoại.

### Phase FE-6 — Mobile native (sau này, không triển khai ngay)

- [ ] React Native + Expo UI riêng theo cùng design tokens.
- [ ] Dùng chung API/backend, không nhúng nguyên giao diện web vào native.
- [ ] Build IPA bằng môi trường tương thích và cài qua SideStore.
- [ ] Kiểm thử local notifications; server push/APNs yêu cầu cấu hình riêng.
- [ ] Ghi nhận việc SideStore cần làm mới chữ ký theo giới hạn Apple ID miễn phí (thường 7 ngày), dù có thể tự động hóa.

---

## 18. Quy tắc cho AI coding assistant (Codex / Claude Code)

> Khi yêu cầu AI viết code frontend, dùng các quy tắc này làm acceptance criteria.

1. Tuân thủ **Intelligent Minimalism, Soft Blue + Pastel Accents**.
2. **Ít icon, ít chữ, ít card**; ưu tiên một hành động rõ ràng trên mỗi khu vực.
3. Không thêm các UI component mới nếu shadcn đã có component phù hợp.
4. Không thêm dependency nếu chưa chứng minh được nhu cầu.
5. Không dùng Lenis toàn app; native scrolling mặc định.
6. Chuyển động ngắn, có mục đích, giảm motion khi cần.
7. Không hardcode màu lặp lại; dùng semantic tokens.
8. Giữ data contract Task / Occurrence / TimeEntry; không làm mất lịch sử recurring.
9. TypeScript strict, không dùng `any` tùy tiện.
10. Component có empty/loading/error/success states.
11. Responsive và keyboard accessibility phải được xử lý cùng lúc với UI.
12. Không tạo fake analytics bằng dữ liệu kế hoạch thay cho actual activity.
13. Không tự ý tăng scope, thêm AI chat, 3D, gamification hay đồ trang trí.
14. Khi chưa có backend, dùng typed mocks và adapter rõ ràng; không giả vờ API đã hoạt động.
15. Mỗi feature hoàn thành cần test và screenshot review ở desktop/mobile, light/dark.

### Prompt ngắn dùng khi yêu cầu AI tạo một màn hình

```text
Implement the [SCREEN_NAME] page for a personal productivity web app.
Stack: Next.js 16, React 19, TypeScript strict, Tailwind CSS 4,
shadcn/ui with Base UI, Lucide (minimal icons), Motion (subtle only).

Design language: Intelligent Minimalism; Soft Blue (#5378AC primary,
#F7F9FC canvas), calm neutral surfaces, limited pastel category accents.
Less chrome, fewer icons, no excessive cards, no decorative gradients.
Prioritize content, clear typography, spacing and fast interactions.

UX: desktop-first but responsive and touch-friendly; native scrolling;
inline editing, contextual actions, keyboard accessibility; reduced motion.
Provide loading, empty, error and success states.

Respect the Task -> TaskOccurrence -> TimeEntry domain model.
Use typed mock data if backend APIs are unavailable.
Do not add unrelated features or libraries.
```

---

## 19. Official documentation / tham khảo kỹ thuật

> Tham khảo tài liệu chính thức trước khi cài đặt, đặc biệt với các package thay đổi phiên bản nhanh.

- **Next.js App Router:** https://nextjs.org/docs/app
- **Tailwind CSS:** https://tailwindcss.com/docs
- **shadcn/ui:** https://ui.shadcn.com/docs
- **shadcn Base UI mặc định (07/2026):** https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- **Lucide:** https://lucide.dev/
- **Motion React:** https://motion.dev/docs/react
- **Lenis:** https://lenis.darkroom.engineering/
- **dnd-kit React:** https://dndkit.com/react
- **TanStack Query:** https://tanstack.com/query/latest
- **Zustand:** https://zustand.docs.pmnd.rs/
- **React Hook Form:** https://react-hook-form.com/
- **Zod:** https://zod.dev/
- **FullCalendar React v7:** https://fullcalendar.io/docs/react
- **FullCalendar shadcn v7:** https://fullcalendar.io/docs/shadcn
- **Recharts:** https://recharts.org/
- **next-themes:** https://github.com/pacocoursey/next-themes
- **Sonner:** https://sonner.emilkowal.ski/
- **cmdk:** https://cmdk.paco.me/
- **nuqs:** https://nuqs.47ng.com/
- **date-fns:** https://date-fns.org/
- **Vitest:** https://vitest.dev/
- **Playwright:** https://playwright.dev/
- **Web performance:** https://web.dev/vitals/
- **WCAG 2.2:** https://www.w3.org/TR/WCAG22/

---

## 20. Final checklist — chuẩn trước khi code

- [x] Web-first, mobile native sau.
- [x] Next.js + TypeScript + Tailwind + shadcn + Lucide.
- [x] UX: **ít icon, ít thông tin, thông minh, mượt**.
- [x] Color direction: Soft Blue + Lavender/Sage/Peach/Rose/Butter/Sky.
- [x] Native scroll mặc định, Lenis optional.
- [x] Motion tiết chế, không animation rườm rà.
- [x] Responsive + dark theme từ nền tảng.
- [x] Today content-first, Analytics ở trang riêng.
- [x] Giữ mô hình Task / Occurrence / TimeEntry.
- [ ] Review UI mockup thực tế trước khi code toàn bộ các trang.
- [ ] Chốt API contracts sau khi DB/backend được thiết kế.
- [ ] Triển khai FE-0 → FE-1 theo checklist.

**Một câu định hướng cuối:** *Calm by design. Smart by interaction. Fast by default.*
