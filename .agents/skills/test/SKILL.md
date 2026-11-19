---
name: test
description: "Quy chuẩn viết tài liệu test Postman (.md, tuyệt đối không dùng curl) sau mỗi tính năng và quy chuẩn test Python (.py) qua Transactional Proxy / Savepoint Rollback không lưu dữ liệu vào database thật."
---

# Feature Testing Skill — Postman Docs & Zero-Persistence Python Proxy Tests

## Khi nào dùng

Bắt buộc áp dụng **sau khi code xong bất kỳ chức năng, endpoint hoặc module nào** trước khi bàn giao.

---

## Quy tắc 1 — Hướng dẫn test Postman định dạng `.md` (KHÔNG DÙNG `curl`)

Sau khi hoàn thành một tính năng/nhóm API mới, bắt buộc tạo hoặc cập nhật tài liệu hướng dẫn kiểm thử Postman tại:
`docs/postman/<số_thứ_tự>_<tên_chức_năng>_postman.md`

### Quy định bắt buộc
1. **Tuyệt đối không viết lệnh `curl`** trong tài liệu test Postman (kể cả trong ví dụ phụ).
2. Mỗi tài liệu phải hướng dẫn thao tác trực quan trên **Postman UI** với đầy đủ cấu trúc sau:
   - **Mục 1 — Thiết lập Postman Environment:** danh sách biến (`base_url`, `access_token`, `refresh_token`, `task_id`, `occurrence_id`, ...).
   - **Mục 2 — Thứ tự thực hiện (Test Flow):** liệt kê từng request theo trình tự phụ thuộc.
   - **Mục 3 — Chi tiết từng Request:**
     - **Tên Request & Mục đích**
     - **Method & URL:** ví dụ `POST {{base_url}}/tasks`
     - **Authorization:** hướng dẫn chọn tab `Authorization` (`Bearer Token` → `{{access_token}}` hoặc `No Auth` / `Cookies`)
     - **Headers:** bảng key/value (`Content-Type: application/json`, `Idempotency-Key`, ...)
     - **Query Params / Path Variables** (nếu có)
     - **Body (`raw` → `JSON`):** JSON hoàn chỉnh có thể copy-paste thẳng vào Postman
     - **Postman Script (Tab `Scripts` → `Post-response`):** đoạn JavaScript Postman (`pm.test(...)`, `pm.environment.set(...)`) để tự động lưu token/ID giữa các bước
     - **Expected Response:** Status Code + JSON mẫu cho cả **Happy Path (`200/201`)** và **Error Cases (`400/401/403/404/409/422`)**
   - **Mục 4 — Checklist kiểm tra nhanh trên Postman**

---

## Quy tắc 2 — Test Python (`.py`) qua Transactional Proxy, KHÔNG lưu kết quả vào DB

Khi viết test tự động bằng file `.py` (`pytest` hoặc script test API/Service), **tuyệt đối không để dữ liệu test bị `COMMIT` và lưu lại trong database thật (`productivity_db`)**.

### Cơ chế bắt buộc: `TransactionalProxySession` (Outer Transaction + Savepoint Rollback)

Mọi test chạm vào FastAPI + SQLAlchemy + MySQL phải chạy thông qua lớp **Proxy Session** như sau:

1. Mở một `connection` duy nhất tới MySQL và bắt đầu **outer transaction** (`conn.begin()`).
2. Khởi tạo `AsyncSession` gắn vào `connection` đó và mở một **nested transaction (`SAVEPOINT`)** bằng `join_transaction_mode="create_savepoint"`.
3. Tạo **`TransactionalProxySession`** bọc `AsyncSession` sao cho:
   - Khi Service gọi `await session.commit()`, Proxy **chuyển thành `await session.flush()`** (vẫn thực thi SQL `INSERT/UPDATE/DELETE`, kiểm tra `UNIQUE`, `FK`, `CHECK`, sinh ID và đọc lại được trong cùng phiên test, **nhưng không commit thật ra MySQL**).
   - Khi Service gọi `await session.rollback()`, Proxy xử lý rollback savepoint an toàn.
4. Override FastAPI dependency `get_db_session` để trả về `TransactionalProxySession`.
5. Kết thúc mỗi test case (`teardown`), **luôn gọi `await outer_tx.rollback()`** để MySQL tự động hủy sạch 100% dữ liệu test, kể cả khi test fail giữa chừng.

### Cấm tuyệt đối trong test `.py`
- Không gọi endpoint thật qua HTTP server bên ngoài mà ghi trực tiếp dữ liệu test vĩnh viễn vào `productivity_db` mà không dọn sạch qua transaction rollback.
- Không tắt Foreign Keys hoặc thay MySQL bằng SQLite in-memory cho integration tests (vì làm sai lệch `BINARY(16)`, `CHECK`, `GENERATED ALWAYS AS`, collation `utf8mb4_0900_ai_ci`).
- Sau khi chạy test suite xong, kiểm tra số dòng các bảng thật không bị rác dữ liệu test phát sinh.

---

## Definition of Done

- [ ] Có file `docs/postman/<feature>_postman.md` đầy đủ Method, URL, Headers, Body JSON, Scripts, Expected Response.
- [ ] File `.md` hướng dẫn Postman **0 lần xuất hiện `curl`**.
- [ ] Toàn bộ test `.py` chạy qua `TransactionalProxySession` (hoặc unit mock boundary) và PASS 100%.
- [ ] Database thật `productivity_db` không tồn tại dữ liệu test dư thừa sau khi chạy `pytest`.
