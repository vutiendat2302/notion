#!/usr/bin/env python3
import sys
import csv
import json
import time
import hashlib
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.notion_client import NotionClient, load_config

def apply(skip_prompt=False):
    print("=" * 60)
    print("STEP 4: APPLY - THỰC THI THAY ĐỔI LÊN NOTION")
    print("=" * 60)

    config = load_config()
    client = NotionClient(config)

    plan_path = BASE_DIR / config["paths"]["output"]["change_plan_csv"]
    token_path = BASE_DIR / "output" / "validation.token"
    audit_path = BASE_DIR / config["paths"]["output"]["audit_log_csv"]
    deleted_ids_path = BASE_DIR / config["paths"]["output"]["deleted_ids_json"]

    if not token_path.exists() or not plan_path.exists():
        print("❌ LỖI AN TOÀN: Chưa chạy bước kiểm định (Validate)!")
        print("👉 Vui lòng chạy trước: python -m src.validate")
        sys.exit(1)

    # 1. Kiểm tra tính toàn vẹn của kế hoạch
    with open(token_path, "r", encoding="utf-8") as f:
        token_data = json.load(f)

    current_hash = hashlib.sha256(plan_path.read_bytes()).hexdigest()
    if token_data.get("plan_hash") != current_hash:
        print("❌ LỖI TOÀN VẸN: File change_plan.csv đã bị sửa đổi sau bước validate!")
        sys.exit(1)

    # 2. Lấy danh sách cần xóa
    delete_items = []
    with open(plan_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            if r.get("action") == "DELETE":
                delete_items.append(r)

    total_delete = len(delete_items)
    print(f"🎯 Kế hoạch: XÓA (Archive) {total_delete} trang trên Notion.")

    if total_delete == 0:
        print("ℹ️ Không có trang nào cần xóa. Hoàn tất!")
        sys.exit(0)

    # 3. Xác nhận
    if not skip_prompt and "--yes" not in sys.argv:
        print("\n" + "!" * 60)
        print(f"⚠️ CẢNH BÁO: Bạn sắp chuyển {total_delete} trang vào Thùng rác (Trash) của Notion.")
        print("Mọi thao tác sẽ được ghi vào audit_log.csv và có thể khôi phục bằng rollback.")
        print("!" * 60)
        confirm = input("👉 Gõ đúng cụm từ 'XAC_NHAN_XOA' để bắt đầu: ").strip()
        if confirm != "XAC_NHAN_XOA":
            print("🛑 Đã hủy thao tác.")
            sys.exit(0)

    # 4. Thực thi
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_rows = []
    success_ids = []
    failed_items = []

    print("\n🚀 Bắt đầu thực thi...")
    for idx, item in enumerate(delete_items, 1):
        pid = item["page_id"]
        task = item["task"]
        now_str = time.strftime("%Y-%m-%d %H:%M:%S")

        try:
            resp = client.archive_page(pid)
            if resp and resp.status_code == 200:
                success_ids.append(pid)
                print(f"[{idx}/{total_delete}] ✅ Đã xóa: {pid} | {task}")
                audit_rows.append({
                    "timestamp": now_str, "page_id": pid, "task": task,
                    "status": item["status"], "date": item["date"],
                    "action": "DELETE", "status_code": 200, "result": "SUCCESS", "error": ""
                })
            else:
                err_text = resp.text if resp else "No response"
                failed_items.append({"page_id": pid, "error": err_text})
                print(f"[{idx}/{total_delete}] ❌ Thất bại: {pid} | {err_text}")
                audit_rows.append({
                    "timestamp": now_str, "page_id": pid, "task": task,
                    "status": item["status"], "date": item["date"],
                    "action": "DELETE", "status_code": resp.status_code if resp else 0,
                    "result": "FAILED", "error": err_text
                })
        except Exception as e:
            failed_items.append({"page_id": pid, "error": str(e)})
            print(f"[{idx}/{total_delete}] ❌ Lỗi ngoại lệ: {pid} | {e}")
            audit_rows.append({
                "timestamp": now_str, "page_id": pid, "task": task,
                "status": item["status"], "date": item["date"],
                "action": "DELETE", "status_code": 0, "result": "ERROR", "error": str(e)
            })

        time.sleep(0.35)

    # 5. Ghi audit_log.csv
    file_exists = audit_path.exists()
    with open(audit_path, "a", encoding="utf-8", newline="") as f:
        fieldnames = ["timestamp", "page_id", "task", "status", "date", "action", "status_code", "result", "error"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerows(audit_rows)
    print(f"\n📝 Đã lưu nhật ký thao tác: {audit_path}")

    # 6. Ghi deleted_ids.json
    deleted_ids_path.parent.mkdir(parents=True, exist_ok=True)
    with open(deleted_ids_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_requested": total_delete,
            "total_archived": len(success_ids),
            "deleted_page_ids": success_ids
        }, f, indent=2)
    print(f"💾 Đã lưu danh sách phục hồi (Rollback): {deleted_ids_path}")

    # Xóa token cũ
    if token_path.exists():
        token_path.unlink()

    print("\n🏁 Hoàn thành bước Apply! Tiếp theo: python -m src.verify")
    return len(success_ids)

if __name__ == "__main__":
    apply()
