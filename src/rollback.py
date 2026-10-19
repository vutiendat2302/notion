#!/usr/bin/env python3
import sys
import json
import time
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.notion_client import NotionClient, load_config

def rollback():
    print("=" * 60)
    print("ROLLBACK - KHÔI PHỤC TOÀN BỘ CÁC TRANG TỪ TRASH")
    print("=" * 60)

    config = load_config()
    client = NotionClient(config)

    deleted_ids_path = BASE_DIR / config["paths"]["output"]["deleted_ids_json"]
    if not deleted_ids_path.exists():
        print(f"❌ Không tìm thấy file {deleted_ids_path}")
        sys.exit(1)

    with open(deleted_ids_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    deleted_ids = data.get("deleted_page_ids", [])
    if not deleted_ids:
        print("ℹ️ Không có ID nào cần khôi phục.")
        sys.exit(0)

    print(f"⚠️ Phát hiện {len(deleted_ids)} trang đã bị xóa vào {data.get('timestamp')}.")
    confirm = input("👉 Gõ 'RESTORE' để xác nhận khôi phục: ").strip()
    if confirm != "RESTORE":
        print("🛑 Đã hủy rollback.")
        sys.exit(0)

    restored = 0
    failed = 0
    for idx, pid in enumerate(deleted_ids, 1):
        resp = client.restore_page(pid)
        if resp and resp.status_code == 200:
            restored += 1
            print(f"[{idx}/{len(deleted_ids)}] ✅ Đã khôi phục: {pid}")
        else:
            failed += 1
            print(f"[{idx}/{len(deleted_ids)}] ❌ Thất bại: {pid}")
        time.sleep(0.35)

    print(f"\n🏁 Kết quả: Đã khôi phục {restored}/{len(deleted_ids)} trang.")

if __name__ == "__main__":
    rollback()
