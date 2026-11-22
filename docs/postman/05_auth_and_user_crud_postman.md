# Hướng dẫn kiểm thử Postman — Auth, Default Admin, Username/Email/Phone & User CRUD

> **Áp dụng cho:** Collection **`notion`** và Environment **`notion`** trong Postman Workspace (`My Workspace`).  
> **Lưu ý:** Toàn bộ requests, folders, biến môi trường và Post-response test scripts đã được đồng bộ sẵn lên Postman. Tài liệu này chỉ mô tả thao tác trực quan trên Postman UI để chạy và kiểm tra kết quả.

---

## Mục 1 — Thiết lập Postman Environment (`notion`)

1. Ở góc trên bên phải Postman UI, chọn Environment **`notion`** (đã được ghim làm mặc định).
2. Kiểm tra danh sách biến đã được nạp sẵn:

| Biến | Giá trị mặc định (Dev) | Ghi chú |
|---|---|---|
| `host_url` | `http://127.0.0.1:8010` | Đổi sang `https://notion.vtdat.com` nếu muốn test bản Prod |
| `base_url` | `{{host_url}}/api/v1` | URL gốc cho toàn bộ API v1 |
| `admin_username` | `admin` | Tên tài khoản Admin mặc định |
| `admin_email` | `admin@dat.local` | Email Admin mặc định khởi tạo khi Backend chạy |
| `admin_password` | `dat123456` | Mật khẩu mặc định Admin |
| `test_user_username` | `member_postman` | Tên tài khoản mẫu cho kịch bản đăng ký |
| `test_user_email` | `member.postman@example.com` | Email mẫu cho kịch bản đăng ký |
| `test_user_phone` | `0912345678` | SĐT mẫu cho kịch bản đăng ký |
| `test_user_password` | `TestPass123!` | Mật khẩu mẫu |
| `access_token` | *(tự động điền)* | Được script Post-response tự lưu khi Login / Register / Refresh |
| `refresh_token` | *(tự động điền)* | Được script Post-response tự lưu |
| `csrf_token` | *(tự động điền)* | CSRF token của phiên cookie |
| `created_user_id` | *(tự động điền)* | ID user do Admin tạo để test GET/PATCH/DELETE |
| `session_id` | *(tự động điền)* | ID phiên đăng nhập hiện tại |
| `category_id` / `task_id` / `occurrence_id` | *(tự động điền)* | Dùng cho folder Core Productivity Smoke |

---

## Mục 2 — Thứ tự thực hiện (Test Flow)

1. **`00. Health & System`:** `Health Live` → `Health Ready` → `System Info`
2. **`01. Auth & Session`:** `Login Admin (Username)` → `Login Admin (Email)` → `Register Invalid Email (Expect 422)` → `Register (Email Only)` → `Register (Phone Only)` → `Register Duplicate Phone (+84 Expect 409)` → `Login (Phone)` → `Refresh Session`
3. **`02. User Self-Service (/users/me)`:** `Get Me` → `Update Profile` → `Update Settings (Dark Theme)` → `List My Sessions`
4. **`03. Admin Users CRUD (/admin/users)`:** Chạy lại `Login Admin (Username)` để lấy quyền `ADMIN` → `List Users (Admin)` → `Create User (Admin)` → `Get User Detail (Admin)` → `Update User (Admin)` → `Disable User (Admin)`
5. **`04. Core Productivity Smoke`:** `List Categories` → `Create Task` → `List Tasks` → `Complete Occurrence (DONE)` → `Get Planning Period`

---

## Mục 3 — Chi tiết các Request chính & Test Scripts

### Folder `01. Auth & Session`

1. **`Login Admin (Username)`**
   - **Method & URL:** `POST {{base_url}}/auth/login`
   - **Authorization:** `No Auth`
   - **Headers:** `Content-Type: application/json`
   - **Body (`raw` → `JSON`):**
     ```json
     {
       "identifier": "{{admin_username}}",
       "password": "{{admin_password}}",
       "device_label": "postman-admin-username"
     }
     ```
   - **Tab `Scripts` → `Post-response`:**
     ```javascript
     pm.test("Status 200 OK & Admin role via username", function () {
       pm.response.to.have.status(200);
       const data = pm.response.json();
       pm.expect(data.user.role).to.eql("ADMIN");
       pm.expect(data.user.username).to.eql("admin");
       pm.environment.set("access_token", data.access_token);
       pm.environment.set("refresh_token", data.refresh_token);
       if (data.csrf_token) pm.environment.set("csrf_token", data.csrf_token);
     });
     ```

2. **`Register (Email Only)`**
   - **Method & URL:** `POST {{base_url}}/auth/register`
   - **Body (`raw` → `JSON`):**
     ```json
     {
       "username": "{{test_user_username}}",
       "display_name": "Postman Email Member",
       "email": "{{test_user_email}}",
       "password": "{{test_user_password}}",
       "confirm_password": "{{test_user_password}}",
       "accepted_policy": true,
       "device_label": "postman-register-email"
     }
     ```
   - **Expected Response:** `201 Created` (chạy lại với cùng `username` sẽ trả `409 Conflict` mã `USERNAME_ALREADY_EXISTS`; sai định dạng Email/SĐT trả `422` mã `INVALID_EMAIL` / `INVALID_PHONE`).

3. **`Register (Phone Only)`**
   - **Method & URL:** `POST {{base_url}}/auth/register`
   - **Body (`raw` → `JSON`):**
     ```json
     {
       "display_name": "Postman Phone Member",
       "phone": "{{test_user_phone}}",
       "password": "{{test_user_password}}",
       "confirm_password": "{{test_user_password}}",
       "accepted_policy": true,
       "device_label": "postman-register-phone"
     }
     ```
   - **Expected Response:** `201 Created` (chạy lại lần 2 hoặc truyền `+84912345678` trả `409 Conflict` mã `PHONE_ALREADY_EXISTS`).

### Folder `03. Admin Users CRUD (/admin/users)`

1. **`Create User (Admin)`**
   - **Method & URL:** `POST {{base_url}}/admin/users`
   - **Authorization:** `Bearer Token` → `{{access_token}}` (của Admin)
   - **Body (`raw` → `JSON`):**
     ```json
     {
       "username": "managed_user",
       "display_name": "Managed User",
       "email": "managed.user@example.com",
       "phone": "0987654321",
       "password": "{{test_user_password}}",
       "role": "USER",
       "status": "ACTIVE"
     }
     ```
   - **Tab `Scripts` → `Post-response`:** Tự động lưu `created_user_id` từ `pm.response.json().id`.

2. **`Update User (Admin)`**
   - **Method & URL:** `PATCH {{base_url}}/admin/users/{{created_user_id}}`
   - **Body (`raw` → `JSON`):**
     ```json
     {
       "display_name": "Managed User Updated",
       "role": "USER",
       "status": "ACTIVE"
     }
     ```

3. **`Disable User (Admin)`**
   - **Method & URL:** `DELETE {{base_url}}/admin/users/{{created_user_id}}`
   - **Expected Response:** `200 OK` với `status: "DISABLED"`. Thử đăng nhập lại bằng user này sẽ trả `403 ACCOUNT_DISABLED`.

---

## Mục 4 — Kiểm tra Bảo mật Cookie & CSRF

- Khi đăng nhập thành công trên Postman hoặc Trình duyệt, Backend trả kèm 3 cookie:
  - `access_token` (`HttpOnly`, `SameSite=Lax`)
  - `refresh_token` (`HttpOnly`, `SameSite=Lax`, path `/api/v1/auth`)
  - `csrf_token` (`SameSite=Lax`)
- Khi gửi request ghi (`POST`/`PATCH`/`DELETE`) bằng cookie trên trình duyệt hoặc với header `Origin`, nếu `Origin` không nằm trong `CORS_ALLOWED_ORIGINS` hoặc thiếu `X-CSRF-Token`, Backend sẽ chặn với mã `403 Forbidden` (`CSRF_ORIGIN_MISMATCH` / `CSRF_TOKEN_MISMATCH`).
