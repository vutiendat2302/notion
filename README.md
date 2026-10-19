# Notion Task Cleaner & Migration Toolkit (Professional Architecture)

Hệ thống quản lý, đồng bộ và dọn dẹp database Notion chuyên nghiệp tuân thủ nghiêm ngặt nguyên tắc **Fail-Closed**:
- **Bảo toàn 100% lịch sử**: Tuyệt đối không xóa bất kỳ task `Done` nào (602 task Done).
- **So khớp toán học chuẩn xác**: Đối chiếu trực tiếp giữa `input/exported.csv` và `input/revised.csv` thông qua khóa duy nhất `(Task, Time)`.
- **An toàn 2 pha**: Bắt buộc kiểm định an toàn (`validate`) sinh Token trước khi thực thi (`apply`).
- **Audit & Rollback**: Toàn bộ thao tác được ghi log chi tiết vào `output/audit_log.csv` và hỗ trợ khôi phục tức thì với `rollback`.

---

## 📁 Cấu trúc dự án

```text
notion/
├── .env                  # Token bí mật (không commit git)
├── .env.example          # Mẫu khai báo biến môi trường
├── config.yaml           # Cấu hình Database ID, tên cột và ngưỡng an toàn
├── input/
│   ├── exported.csv      # CSV gốc xuất từ Notion (2.425 dòng)
│   └── revised.csv       # CSV sau khi đã sửa/lọc (1.990 dòng)
├── output/
│   ├── change_plan.csv   # Kế hoạch chi tiết (KEEP / DELETE)
│   ├── audit_log.csv     # Nhật ký thao tác từng bản ghi đã thực hiện
│   ├── report.json       # Báo cáo đối soát JSON nghiệm thu cuối cùng
│   ├── snapshot.csv      # Snapshot thực tế từ Notion API
│   ├── backup.json       # Bản sao lưu thô bảo hiểm 100% dữ liệu gốc
│   └── deleted_ids.json  # Danh sách page_id phục vụ hoàn tác (Rollback)
├── src/
│   ├── __init__.py
│   ├── notion_client.py  # Module kết nối Notion API & chuẩn hóa dữ liệu
│   ├── fetch.py          # Tải và sao lưu toàn bộ dữ liệu từ Notion
│   ├── reconcile.py      # Đối chiếu Snapshot với file CSV đã sửa
│   ├── validate.py       # Kiểm tra các điều kiện an toàn Fail-Closed
│   ├── apply.py          # Thực thi thay đổi lên Notion (chuyển vào Trash)
│   ├── verify.py         # Xác minh hậu cập nhật và xuất report.json
│   └── rollback.py       # Khôi phục các trang từ Trash về lại database
└── main.py               # CLI điều phối toàn bộ workflow
```

---

## 🚀 Hướng dẫn sử dụng CLI qua `main.py`

### 1. Chuẩn bị môi trường & Cấu hình
Điền Token vào file `.env`:
```env
NOTION_TOKEN=ntn_your_secret_token_here
```
Cấu hình thuộc tính trong `config.yaml` (nếu cần đổi database hoặc tên cột).

### 2. Chạy quy trình từng bước

#### Bước 1: Tải dữ liệu từ Notion
```bash
python3 main.py fetch
```
* Tải toàn bộ pages từ Notion, lưu `output/backup_raw_pages.json` và `output/database_snapshot.csv`.

#### Bước 2: Đối chiếu với file CSV đã sửa
```bash
python3 main.py reconcile
```
* So khớp Snapshot với `input/revised.csv` để lập kế hoạch `output/change_plan.csv`.

#### Bước 3: Kiểm định an toàn (Fail-Closed)
```bash
python3 main.py validate
```
* Kiểm tra 0 task `Done` bị xóa, số lượng đúng kỳ vọng và cấp khóa xác thực an toàn `output/validation.token`.

#### Bước 4: Thực thi xóa trên Notion
```bash
python3 main.py apply
```
* Gõ `XAC_NHAN_XOA` để bắt đầu gửi lệnh tới Notion API.
* Ghi lại nhật ký vào `output/audit_log.csv`.

#### Bước 5: Xác minh hậu cập nhật
```bash
python3 main.py verify
```
* Đối soát trực tiếp Database trên Notion với `input/revised.csv` và lưu kết quả vào `output/report.json`.

---

### 🔄 Khôi phục khẩn cấp (Rollback)
Nếu cần hoàn tác lại các trang đã xóa:
```bash
python3 main.py rollback
```
Script sẽ đọc `output/deleted_ids.json` và khôi phục 100% các trang từ Trash về lại database ban đầu.
