# Kiểm thử Postman — BE Phase 2: Tasks và lịch lặp

## 1. Thiết lập Postman Environment

Trong **Postman → Environments**, tạo `Productivity BE-2` và chọn Environment này.

| Biến | Giá trị ban đầu | Mục đích |
|---|---|---|
| `base_url` | `http://127.0.0.1:8000/api/v1` | API v1 |
| `email` | Email owner đã bootstrap | Đăng nhập |
| `password` | Mật khẩu owner | Đăng nhập |
| `access_token` | Trống, loại Secret | Bearer token |
| `task_id` | Trống | Task lặp |
| `occurrence_id` | Trống | Lần thực hiện đầu tiên |
| `future_occurrence_id` | Trống | Lần thực hiện tiếp theo |
| `checklist_item_id` | Trống | Checklist template |
| `blocking_task_id` | Trống | Task chặn |
| `dependency_id` | Trống | Dependency |
| `rule_version` | `1` | Chống cập nhật rule cũ |
| `today` | Ngày hiện tại theo Asia/Ho_Chi_Minh, dạng `YYYY-MM-DD` | Test lịch |
| `through` | Ngày sau `today` khoảng 70 ngày | Test generation |

Mọi request có body dùng **Body → raw → JSON**, header `Content-Type: application/json`.
Ngoại trừ Login, chọn **Authorization → Bearer Token → `{{access_token}}`**. Không gửi `user_id` trong body.
Với GET, POST không có body và DELETE, để Body trống. Tất cả response lỗi chuẩn có `error.code`, `error.message`, `error.details`, `request_id`.

Ví dụ lỗi dùng cho mọi request bên dưới (thay `code` và HTTP status theo từng trường hợp):

```json
{"error":{"code":"TASK_NOT_FOUND","message":"Task not found.","details":null},"request_id":"..."}
```

Ví dụ response thành công rút gọn (response thực tế có thêm ID và timestamps):

```json
{"id":"<uuid>","title":"Daily review","is_recurring":true,"occurrences":[{"id":"<uuid>","recurrence_key":"2026-11-19","status":"NOT_STARTED"}]}
```

```json
{"id":"<uuid>","task_id":"<uuid>","frequency":"DAILY","rule_version":1,"is_paused":false}
```

```json
{"id":"<uuid>","task_id":"<uuid>","status":"DONE","completed_at":"2026-11-19T10:00:00Z"}
```

```json
{"occurrence_id":"<uuid>","checklist_item_id":"<uuid>","is_checked":true,"checked_at":"2026-11-19T10:00:00Z"}
```

```json
{"task_id":"<uuid>","metric_type":"OCCURRENCE_COMPLETION","unit":"percent","eligible_count":2,"completed_count":1,"completion_rate":50.0}
```

Đặt script mặc định trong **Collection → Scripts → Post-response**:

```javascript
pm.test("Request ID is returned", () => {
  pm.expect(pm.response.headers.get("X-Request-ID")).to.be.a("string");
});
```

## 2. Thứ tự thực hiện

1. Login → tạo task lặp → xem recurrence/preview → xem occurrences → generate hai lần.
2. Sửa riêng một occurrence → complete occurrence khác → sửa future rule → kiểm tra lịch sử.
3. Pause → generate bị từ chối → resume → checklist template → tick theo occurrence.
4. Tạo task chặn → dependency → kiểm tra cycle → xóa dependency.
5. Xem progress → duplicate → archive/restore → thử các lỗi validation và ownership.
6. Lấy chi tiết và archive Category/Project theo nhu cầu trên môi trường thử nghiệm.

## 3. Chi tiết từng Request

### 01. Login

- **Method & URL:** `POST {{base_url}}/auth/login`.
- **Authorization:** No Auth. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"email":"{{email}}","password":"{{password}}"}
```

- **Scripts → Post-response:**

```javascript
pm.test("Login 200", () => pm.response.to.have.status(200));
if (pm.response.code === 200) pm.environment.set("access_token", pm.response.json().access_token);
```

- **Expected:** `200` với `access_token`, `refresh_token`, `user`. Sai mật khẩu: `401` với `error.code` xác thực; thiếu trường: `422`.

### 02. Tạo task lặp hàng ngày

- **Method & URL:** `POST {{base_url}}/tasks`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"title":"Daily review","recurrence":{"frequency":"DAILY","starts_on":"{{today}}","timezone":"Asia/Ho_Chi_Minh","default_start_time":"09:00:00","default_duration_minutes":30}}
```

- **Scripts → Post-response:**

```javascript
pm.test("Recurring task 201", () => pm.response.to.have.status(201));
if (pm.response.code === 201) {
  const data = pm.response.json();
  pm.environment.set("task_id", data.id);
  pm.environment.set("occurrence_id", data.occurrences[0].id);
  pm.environment.set("future_occurrence_id", data.occurrences[1].id);
  pm.expect(data.is_recurring).to.eql(true);
}
```

- **Expected:** `201`, `is_recurring=true`, occurrences trong 60 ngày tới, `status=NOT_STARTED`. `title` chỉ khoảng trắng hoặc timezone không hợp lệ: `422`; thiếu token: `401`.

### 03. Xem và preview recurrence

- **Method & URL:** `GET {{base_url}}/tasks/{{task_id}}/recurrence`, sau đó `GET {{base_url}}/tasks/{{task_id}}/recurrence/preview?count=5`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Rule/preview 200", () => pm.response.to.have.status(200));
if (pm.response.code === 200 && pm.response.json().rule_version) {
  pm.environment.set("rule_version", pm.response.json().rule_version);
}
```

- **Expected:** rule `frequency=DAILY`, `rule_version=1`; preview có 5 ngày. `count=0` trả `422`; ID task không tồn tại trả `404`.

### 04. Sinh lịch idempotent

- **Method & URL:** `POST {{base_url}}/tasks/{{task_id}}/recurrence/generate`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Params:** `through={{through}}`. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Generation 200", () => pm.response.to.have.status(200));
pm.test("Count is nonnegative", () => pm.expect(pm.response.json().generated_count).to.be.at.least(0));
```

- **Expected:** `200`, `{ "task_id": "...", "generated_count": 10, "through": "YYYY-MM-DD" }` (số thực tế phụ thuộc ngày). Gửi lại cùng tham số: `generated_count=0`. `through` ngoài 365 ngày tới: `422`; rule tạm dừng: `409 RECURRENCE_PAUSED`.

Sau khi archive task, generate trả `409 TASK_ARCHIVED`; worker cũng bỏ qua task đã archive.

### 05. Danh sách occurrence của task

- **Method & URL:** `GET {{base_url}}/tasks/{{task_id}}/occurrences`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Params:** không có. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Occurrences 200", () => pm.response.to.have.status(200));
pm.test("No recurrence key duplicated", () => {
  const keys = pm.response.json().map(x => x.recurrence_key);
  pm.expect(new Set(keys).size).to.eql(keys.length);
});
```

- **Expected:** `200` với mảng occurrence, `recurrence_key` duy nhất theo task. Task người khác/không tồn tại: `404`.

### 06. Dời một occurrence

- **Method & URL:** `PATCH {{base_url}}/occurrences/{{future_occurrence_id}}`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"scheduled_date":"{{through}}","expected_version":1}
```

- **Scripts → Post-response:**

```javascript
pm.test("Occurrence override 200", () => pm.response.to.have.status(200));
if (pm.response.code === 200) pm.expect(pm.response.json().is_override).to.eql(true);
```

- **Expected:** `200`, `is_override=true`, các occurrence khác giữ lịch cũ. Gửi lại `expected_version=1`: `409 OCCURRENCE_CONFLICT`; `end_at <= start_at`: `422`.

### 07. Complete, reopen, skip, cancel

- **Method & URL:** lần lượt `POST {{base_url}}/occurrences/{{occurrence_id}}/complete`, `/reopen`, `/start`, `/skip`; sau `/reopen` có thể gọi `/cancel`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Params:** không có. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("State transition 200", () => pm.response.to.have.status(200));
pm.test("Status returned", () => pm.expect(pm.response.json().status).to.be.a("string"));
```

- **Expected:** `200` theo state machine; complete trả `DONE` và `completed_at`; reopen trả `NOT_STARTED`. `SKIPPED → CANCELLED` trực tiếp: `409 INVALID_OCCURRENCE_TRANSITION`. Occurrence của người khác: `404`.

### 08. Sửa future rule, giữ occurrence đã DONE

- **Method & URL:** `PUT {{base_url}}/tasks/{{task_id}}/recurrence/future`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"frequency":"WEEKLY","weekdays_mask":1,"starts_on":"{{today}}","effective_date":"{{today}}","timezone":"Asia/Ho_Chi_Minh","expected_rule_version":1}
```

- **Scripts → Post-response:**

```javascript
pm.test("Future rule 200", () => pm.response.to.have.status(200));
if (pm.response.code === 200) pm.environment.set("rule_version", pm.response.json().rule_version);
```

- **Expected:** `200`, `rule_version=2`. `DONE` và occurrence được dời riêng vẫn giữ `id`, trạng thái và ngày; các occurrence chưa bắt đầu theo rule cũ có thể được thay. Version cũ: `409 RECURRENCE_CONFLICT`; effective date quá khứ: `422`.

### 09. Pause/resume rule

- **Method & URL:** `POST {{base_url}}/tasks/{{task_id}}/recurrence/pause?expected_rule_version={{rule_version}}`, rồi `/resume?expected_rule_version={{rule_version}}`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Pause or resume 200", () => pm.response.to.have.status(200));
```

- **Expected:** `200`, `is_paused=true` rồi `false`. Trong lúc pause, Request 04 trả `409`. Version cũ trả `409 RECURRENCE_CONFLICT`.

### 10. Tạo checklist template

- **Method & URL:** `POST {{base_url}}/tasks/{{task_id}}/checklist`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"title":"Review notes","sort_order":0}
```

- **Scripts → Post-response:**

```javascript
pm.test("Checklist item 201", () => pm.response.to.have.status(201));
if (pm.response.code === 201) pm.environment.set("checklist_item_id", pm.response.json().id);
```

- **Expected:** `201`, `archived_at=null`. Tiêu đề trống: `422`. `GET {{base_url}}/tasks/{{task_id}}/checklist` trả mảng template; task người khác: `404`.

### 11. Tick checklist theo occurrence

- **Method & URL:** `PUT {{base_url}}/occurrences/{{occurrence_id}}/checklist/{{checklist_item_id}}`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"is_checked":true}
```

- **Scripts → Post-response:**

```javascript
pm.test("Checklist checked 200", () => pm.response.to.have.status(200));
if (pm.response.code === 200) pm.expect(pm.response.json().is_checked).to.eql(true);
```

- **Expected:** `200`, `is_checked=true`, `checked_at` có giá trị. `GET {{base_url}}/occurrences/{{future_occurrence_id}}/checklist` vẫn cho item này `is_checked=false`; item đã archive hoặc thuộc task khác: `404`. Gửi `false` để bỏ tick.

### 12. Archive checklist item

- **Method & URL:** `PATCH {{base_url}}/tasks/{{task_id}}/checklist/{{checklist_item_id}}`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body:**

```json
{"archived":true}
```

- **Scripts → Post-response:**

```javascript
pm.test("Checklist archived 200", () => pm.response.to.have.status(200));
```

- **Expected:** `200`, `archived_at` có giá trị; state lịch sử còn trong DB. `archived:null` trả `422`.

### 13. Tạo task chặn và dependency

- **Method & URL:** trước hết `POST {{base_url}}/tasks`, sau đó `POST {{base_url}}/tasks/{{task_id}}/dependencies`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json`. **Params:** không có.
- **Body tạo task:**

```json
{"title":"Prepare material"}
```

- **Script sau khi tạo task:**

```javascript
pm.test("Blocking task 201", () => pm.response.to.have.status(201));
if (pm.response.code === 201) pm.environment.set("blocking_task_id", pm.response.json().id);
```

- **Body tạo dependency:**

```json
{"blocking_task_id":"{{blocking_task_id}}"}
```

- **Script sau khi tạo dependency:**

```javascript
pm.test("Dependency 201", () => pm.response.to.have.status(201));
if (pm.response.code === 201) pm.environment.set("dependency_id", pm.response.json().id);
```

- **Expected:** mỗi POST `201`; `GET {{base_url}}/tasks/{{task_id}}/dependencies` trả edge. Tạo cùng edge lần nữa: `409 DEPENDENCY_EXISTS`; tự chặn hoặc tạo vòng: `409 DEPENDENCY_CYCLE`; task người khác: `404`.

### 14. Xóa dependency

- **Method & URL:** `DELETE {{base_url}}/tasks/{{task_id}}/dependencies/{{dependency_id}}`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Params:** không có. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Dependency removed 204", () => pm.response.to.have.status(204));
```

- **Expected:** `204` không có body. Xóa lại: `404 DEPENDENCY_NOT_FOUND`.

### 15. Progress theo cửa sổ thời gian

- **Method & URL:** `GET {{base_url}}/tasks/{{task_id}}/progress?start={{today}}`.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Progress 200", () => pm.response.to.have.status(200));
pm.test("Metric defined", () => pm.expect(pm.response.json().metric_type).to.eql("OCCURRENCE_COMPLETION"));
```

- **Expected:** `200`, có `timezone`, `as_of`, `eligible_count`, `completed_count`, `skipped_count`, `cancelled_count`, `future_excluded_count`, `completion_rate`. Mẫu số bằng 0 trả `completion_rate:null`; cancelled không vào mẫu số, skipped có vào mẫu số, future chưa đến hạn bị loại. `end <= start`: `422`.

### 16. Duplicate và archive/restore task

- **Method & URL:** `POST {{base_url}}/tasks/{{task_id}}/duplicate`, sau đó `/archive` và `/restore` trên task gốc.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Task action succeeded", () => pm.expect([200, 201]).to.include(pm.response.code));
```

- **Expected:** duplicate `201`, task mới có một occurrence `ONCE/NOT_STARTED`, không sao chép lịch sử DONE. Archive và restore `200`, lịch sử occurrence của task gốc không bị xóa. ID người khác: `404`.

### 17. Subtask và PATCH chống cycle

- **Method & URL:** `POST {{base_url}}/tasks/{{task_id}}/subtasks`, sau đó `GET` cùng URL; thử `PATCH {{base_url}}/tasks/{{task_id}}`.
- **Authorization:** Bearer Token. **Headers:** `Content-Type: application/json` cho POST/PATCH. **Params:** không có.
- **Body tạo subtask:**

```json
{"title":"Small step"}
```

- **Body thử cycle:**

```json
{"parent_task_id":"{{task_id}}"}
```

- **Scripts → Post-response:**

```javascript
pm.test("Subtask request has expected status", () => pm.expect([200, 201, 409]).to.include(pm.response.code));
```

- **Expected:** POST `201`, GET `200` chứa child có `parent_task_id`; PATCH self-link `409 TASK_CYCLE`. Khi tạo A→B rồi đổi A.parent=B, `409 TASK_CYCLE`. Parent không thuộc owner: `404`.

Chính sách project của subtask: khi tạo child mà không gửi `project_id`, child kế thừa project của parent; gửi `null` để child không thuộc project. Sau đó mỗi child giữ `project_id` riêng; chuyển child sang project khác cùng owner không tự đổi parent hoặc sibling. Project khác owner trả `404`.

### 18. Chi tiết và soft delete Category/Project

- **Method & URL:** `GET {{base_url}}/categories/{{category_id}}`, `GET {{base_url}}/projects/{{project_id}}`; khi cần archive, dùng `DELETE` trên cùng URL.
- **Authorization:** Bearer Token. **Headers:** không cần thêm. **Params:** không có. **Body:** trống.
- **Scripts → Post-response:**

```javascript
pm.test("Read or archive resource", () => pm.expect([200, 204]).to.include(pm.response.code));
```

- **Expected:** GET `200` với `id`, tên, `archived_at`; DELETE `204` không có body, bản ghi vẫn tồn tại cho lịch sử và biến mất khỏi list mặc định. ID của người khác/không tồn tại: `404`. Có thể dùng PATCH `{"archived":false}` để phục hồi.

## 4. Checklist kiểm tra nhanh trên Postman

- [ ] Login lưu token, các request có Bearer Token; thiếu token trả `401`.
- [ ] Tạo task title-only cho một occurrence `ONCE`; title rỗng/unknown field trả `422`.
- [ ] `PATCH` trường duy nhất giữ các trường khác; `null` xóa trường nullable; version cũ trả `409`.
- [ ] Daily, weekly, monthly và yearly preview đúng ngày; ngày 31 theo `SKIP`/`CLAMP_TO_LAST_DAY`.
- [ ] Generate lặp lại trả `generated_count=0`; rule pause chặn generate.
- [ ] Sửa future rule giữ `DONE` và occurrence override; checklist tick không lan sang ngày khác.
- [ ] Dependency/subtask cycle bị từ chối; không nhìn thấy dữ liệu user khác.
- [ ] Progress công bố cửa sổ, timezone, exclusion policy; không có eligible trả `null`.
- [ ] Dữ liệu thử thủ công trên môi trường thật được xử lý theo quy trình dọn dữ liệu của môi trường đó; không dùng Postman để test trực tiếp với dữ liệu quan trọng.
