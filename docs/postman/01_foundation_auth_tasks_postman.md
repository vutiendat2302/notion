# Hướng Dẫn Kiểm Thử Postman — Giai Đoạn Foundation, Auth, Taxonomy, Projects & Tasks Core

> **Phạm vi API:** Health, System Info, Auth (Bootstrap / Login / Refresh Rotation / Logout), User Settings, Categories, Projects, Tasks & Task Occurrences.  
> **Quy chuẩn:** Tài liệu này phục vụ kiểm thử trực tiếp trên **Postman Desktop / Web** (không sử dụng câu lệnh terminal/shell).  
> **Cơ sở xác thực:** JWT `Bearer Token` (hoặc Cookie tự động của Postman).

---

## 1. Thiết lập Postman Environment

Mở Postman → **Environments** → nhấn **Create Environment** (đặt tên: `Productivity - Local`) và thêm các biến sau:

| Variable | Type | Initial Value | Ghi chú |
|---|---|---|---|
| `origin_url` | `default` | `http://localhost:8000` | Dùng cho `/health/*` |
| `base_url` | `default` | `http://localhost:8000/api/v1` | Prefix chung cho mọi REST endpoint |
| `access_token` | `secret` | *(để trống)* | Tự động điền bởi Post-response script sau khi Bootstrap/Login |
| `refresh_token` | `secret` | *(để trống)* | Tự động điền bởi Post-response script |
| `refresh_token_old` | `secret` | *(để trống)* | Dùng để kiểm thử lỗi token reuse detection |
| `category_id` | `default` | *(để trống)* | Tự động lưu sau khi lấy/tạo category |
| `project_id` | `default` | *(để trống)* | Tự động lưu sau khi tạo project |
| `task_id` | `default` | *(để trống)* | Tự động lưu sau khi tạo task |
| `task_version` | `default` | `1` | Lưu `version` để test optimistic locking |
| `occurrence_id` | `default` | *(để trống)* | Tự động lưu từ default occurrence của task |

> Chọn Environment **`Productivity - Local`** ở góc trên bên phải Postman trước khi chạy bất kỳ request nào.

---

## 2. Thứ tự chạy kiểm thử (Test Flow)

1. `01. Health Live & Ready` → xác minh Backend + MySQL 8.4 sẵn sàng.
2. `02. System Info` → kiểm tra cấu hình timezone mặc định.
3. `03. Bootstrap Owner Account` → khởi tạo user duy nhất lần đầu (hoặc chuyển sang bước `04` nếu DB đã bootstrap trước đó).
4. `04. Login` → đăng nhập lại và nhận cặp token mới.
5. `05. Get Profile & Partial PATCH User Settings` → kiểm tra đổi `theme` mà không mất `timezone`.
6. `06. Refresh Token Rotation & Reuse Check` → kiểm tra xoay vòng token và thu hồi session khi replay token cũ.
7. `07. List & Create Category` → kiểm tra 5 categories mặc định và tạo category mới.
8. `08. Create & Patch Project` → tạo project gắn category.
9. `09. Quick Create Task (Inbox Unscheduled)` → tạo task chỉ với `title`, tự sinh 1 default `task_occurrence` (`recurrence_key = "ONCE"`).
10. `10. Create Scheduled Task` → tạo task có `scheduled_date`, `project_id`, `category_id`, `estimated_minutes`.
11. `11. Partial PATCH Task & Optimistic Lock 409` → test sửa 1 trường, clear trường bằng `null`, và test xung đột `expected_version`.
12. `12. List Occurrences by Scope` → lọc theo `scope=today`, `scope=inbox`, `scope=completed`.
13. `13. Complete & Reopen Occurrence` → đánh dấu `DONE` và mở lại `NOT_STARTED`.
14. `14. Logout` → thu hồi phiên hiện tại.

---

## 3. Chi Tiết Từng Request Postman

### Request 01 — Kiểm tra Health Live & Ready

- **Method:** `GET`
- **URL:** `{{origin_url}}/health/ready`
- **Authorization:** `No Auth`
- **Headers:** không bắt buộc
- **Expected Response (`200 OK`):**
```json
{
  "status": "ready",
  "database": "ok"
}
```
*(Thử thêm `GET {{origin_url}}/health/live` sẽ trả `200 OK` với `{"status": "alive"}` và response header `X-Request-ID`).*

---

### Request 02 — System Info

- **Method:** `GET`
- **URL:** `{{base_url}}/system/info`
- **Authorization:** `No Auth`
- **Expected Response (`200 OK`):**
```json
{
  "app_name": "Personal Productivity API",
  "environment": "development",
  "default_timezone": "Asia/Ho_Chi_Minh",
  "ai_enabled": false
}
```

---

### Request 03 — Bootstrap Owner Account (Lần đầu)

- **Method:** `POST`
- **URL:** `{{base_url}}/auth/bootstrap`
- **Authorization:** `No Auth`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "email": "owner@example.com",
  "password": "StrongPassword123!",
  "display_name": "Productivity Owner"
}
```
- **Tab `Scripts` → `Post-response`:**
```javascript
if (pm.response.code === 201) {
    const res = pm.response.json();
    pm.environment.set("access_token", res.access_token);
    pm.environment.set("refresh_token", res.refresh_token);
}
pm.test("Bootstrap returns 201 or 409 if already bootstrapped", function () {
    pm.expect([201, 409]).to.include(pm.response.code);
});
```
- **Expected Response (`201 Created`):** trả `access_token`, `refresh_token`, `expires_in`, `user` kèm `settings.timezone = "Asia/Ho_Chi_Minh"`.
- **Expected Error khi gọi lại lần 2 (`409 Conflict`):**
```json
{
  "error": {
    "code": "BOOTSTRAP_ALREADY_COMPLETED",
    "message": "Owner account already bootstrapped. Use /auth/login.",
    "details": null
  },
  "request_id": "req_..."
}
```

---

### Request 04 — Login

- **Method:** `POST`
- **URL:** `{{base_url}}/auth/login`
- **Authorization:** `No Auth`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "email": "owner@example.com",
  "password": "StrongPassword123!",
  "device_label": "Postman Desktop"
}
```
- **Tab `Scripts` → `Post-response`:**
```javascript
pm.test("Login succeeded", function () {
    pm.response.to.have.status(200);
    const res = pm.response.json();
    pm.environment.set("access_token", res.access_token);
    pm.environment.set("refresh_token", res.refresh_token);
});
```
- **Expected Error sai mật khẩu (`401 Unauthorized`):**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password.",
    "details": null
  },
  "request_id": "req_..."
}
```

---

### Request 05 — Lấy Profile & Partial PATCH User Settings

#### 5A. Lấy thông tin user hiện tại
- **Method:** `GET`
- **URL:** `{{base_url}}/users/me`
- **Authorization:** Tab `Authorization` → Type **`Bearer Token`** → Token: `{{access_token}}`
- **Expected Response (`200 OK`):** trả object `user` kèm `settings`.

#### 5B. Partial PATCH Settings (chỉ đổi `theme`, các trường khác giữ nguyên)
- **Method:** `PATCH`
- **URL:** `{{base_url}}/users/me/settings`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "theme": "DARK"
}
```
- **Expected Response (`200 OK`):** `theme` đổi thành `"DARK"`, `timezone` vẫn giữ `"Asia/Ho_Chi_Minh"`.

---

### Request 06 — Refresh Token Rotation & Kiểm thử Token Reuse

#### 6A. Rotate Refresh Token hợp lệ
- **Method:** `POST`
- **URL:** `{{base_url}}/auth/refresh`
- **Authorization:** `No Auth`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "refresh_token": "{{refresh_token}}"
}
```
- **Tab `Scripts` → `Post-response`:**
```javascript
pm.test("Refresh rotated successfully", function () {
    pm.response.to.have.status(200);
    const oldToken = pm.environment.get("refresh_token");
    pm.environment.set("refresh_token_old", oldToken);
    const res = pm.response.json();
    pm.environment.set("access_token", res.access_token);
    pm.environment.set("refresh_token", res.refresh_token);
});
```

#### 6B. Thử Replay Token Cũ (Reuse Detection)
- Gửi lại `POST {{base_url}}/auth/refresh` với body:
```json
{
  "refresh_token": "{{refresh_token_old}}"
}
```
- **Expected Error (`401 Unauthorized`):**
```json
{
  "error": {
    "code": "REFRESH_TOKEN_REUSED",
    "message": "Refresh token reuse detected. Session family revoked.",
    "details": null
  },
  "request_id": "req_..."
}
```
*(Sau bước 6B, toàn bộ family bị thu hồi; hãy chạy lại Request `04. Login` để lấy session mới cho các bước sau).*

---

### Request 07 — Categories (Danh sách & Tạo mới)

#### 7A. Lấy danh sách Categories
- **Method:** `GET`
- **URL:** `{{base_url}}/categories`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Tab `Scripts` → `Post-response`:**
```javascript
pm.test("Has default Soft Blue pastel categories", function () {
    pm.response.to.have.status(200);
    const items = pm.response.json();
    pm.expect(items.length).to.be.at.least(5);
    pm.environment.set("category_id", items[0].id);
});
```

#### 7B. Tạo Category mới
- **Method:** `POST`
- **URL:** `{{base_url}}/categories`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "name": "Deep Work",
  "accent_token": "LAVENDER",
  "sort_order": 10
}
```
- **Expected Response (`201 Created`):** trả object category vừa tạo.

---

### Request 08 — Projects (Tạo mới & Partial PATCH)

- **Method:** `POST`
- **URL:** `{{base_url}}/projects`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "title": "IELTS 7.5",
  "description": "Lộ trình ôn luyện 4 kỹ năng",
  "category_id": "{{category_id}}",
  "status": "ACTIVE",
  "start_date": "2026-11-19",
  "target_date": "2027-03-31"
}
```
- **Tab `Scripts` → `Post-response`:**
```javascript
pm.test("Project created", function () {
    pm.response.to.have.status(201);
    pm.environment.set("project_id", pm.response.json().id);
});
```

---

### Request 09 — Quick Create Task (Inbox Unscheduled)

- **Method:** `POST`
- **URL:** `{{base_url}}/tasks`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "title": "Đọc tài liệu FastAPI Hybrid"
}
```
- **Expected Response (`201 Created`):** trả task kèm mảng `occurrences` có 1 phần tử mặc định (`recurrence_key: "ONCE"`, `scheduled_date: null`, `status: "NOT_STARTED"`).
- **Expected Error khi title toàn khoảng trắng (`422 Unprocessable Content`):**
```json
{
  "title": "   "
}
```
Trả envelope lỗi `VALIDATION_ERROR`.

---

### Request 10 — Create Scheduled Task (Có lịch & Project/Category)

- **Method:** `POST`
- **URL:** `{{base_url}}/tasks`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "title": "Luyện IELTS Listening Section 3-4",
  "description": "Nghe và chép chính tả",
  "project_id": "{{project_id}}",
  "category_id": "{{category_id}}",
  "priority": "HIGH",
  "estimated_minutes": 60,
  "scheduled_date": "2026-11-19"
}
```
- **Tab `Scripts` → `Post-response`:**
```javascript
pm.test("Scheduled task created with default occurrence", function () {
    pm.response.to.have.status(201);
    const data = pm.response.json();
    pm.environment.set("task_id", data.id);
    pm.environment.set("task_version", String(data.version));
    pm.environment.set("occurrence_id", data.occurrences[0].id);
});
```

---

### Request 11 — Partial PATCH Task & Optimistic Locking `409`

#### 11A. Sửa riêng `title` (kèm `expected_version`)
- **Method:** `PATCH`
- **URL:** `{{base_url}}/tasks/{{task_id}}`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "title": "Luyện IELTS Listening + Speaking",
  "expected_version": 1
}
```
- **Expected Response (`200 OK`):** `version` tăng lên `2`, `project_id` và `category_id` vẫn giữ nguyên.

#### 11B. Kiểm tra `409 Conflict` khi gửi version cũ
- Gửi lại `PATCH {{base_url}}/tasks/{{task_id}}` với body giữ nguyên `"expected_version": 1`:
- **Expected Error (`409 Conflict`):**
```json
{
  "error": {
    "code": "TASK_CONFLICT",
    "message": "Task was modified concurrently.",
    "details": {
      "expected_version": 1,
      "actual_version": 2
    }
  },
  "request_id": "req_..."
}
```

#### 11C. Kiểm tra Explicit `null` PATCH (Gỡ Project khỏi Task)
- **Body (`raw` → `JSON`):**
```json
{
  "project_id": null
}
```
- **Expected Response (`200 OK`):** `project_id` chuyển thành `null`, `category_id` không bị mất.

---

### Request 12 — List Occurrences theo Scope

- **Method:** `GET`
- **URL:** `{{base_url}}/occurrences`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Tab `Params` (Query Params):**
  - `scope`: thử lần lượt `inbox`, `today`, `upcoming`, `all`, `completed`
  - `limit`: `50`
  - `offset`: `0`
- **Expected Response (`200 OK`):** trả object `{ "items": [...], "pagination": { "total": ..., "limit": 50, "offset": 0 } }`.

---

### Request 13 — Complete & Reopen Occurrence

#### 13A. Đánh dấu hoàn thành (`DONE`)
- **Method:** `POST`
- **URL:** `{{base_url}}/occurrences/{{occurrence_id}}/complete`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Expected Response (`200 OK`):** `status` = `"DONE"`, `completed_at` có timestamp UTC.

#### 13B. Mở lại (`NOT_STARTED`)
- **Method:** `POST`
- **URL:** `{{base_url}}/occurrences/{{occurrence_id}}/reopen`
- **Authorization:** `Bearer Token` → `{{access_token}}`
- **Expected Response (`200 OK`):** `status` = `"NOT_STARTED"`, `completed_at` = `null`.

---

### Request 14 — Logout

- **Method:** `POST`
- **URL:** `{{base_url}}/auth/logout`
- **Authorization:** `No Auth`
- **Headers:**
  - `Content-Type`: `application/json`
- **Body (`raw` → `JSON`):**
```json
{
  "refresh_token": "{{refresh_token}}"
}
```
- **Expected Response (`200 OK`):**
```json
{
  "revoked": true
}
```

---

## 4. Checklist Xác Minh Nhanh Trên Postman

- [ ] Request chưa đăng nhập vào `/api/v1/tasks` trả `401 MISSING_ACCESS_TOKEN`.
- [ ] Request có lỗi validation trả envelope `{ "error": { "code", "message", "details" }, "request_id" }`.
- [ ] `PATCH /api/v1/tasks/{id}` không làm mất các field không gửi và xử lý đúng explicit `null`.
- [ ] Reuse refresh token cũ tự động revoke cả session family (`401 REFRESH_TOKEN_REUSED`).
- [ ] Hoàn thành/mở lại diễn ra trên `task_occurrences`, không làm mất cấu trúc của `tasks`.
