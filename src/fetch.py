#!/usr/bin/env python3
import sys
import json
import csv
from collections import Counter
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.notion_client import NotionClient, load_config

def fetch():
    print("=" * 60)
    print("STEP 1: FETCH - ĐỌC VÀ SAO LƯU DỮ LIỆU TỪ NOTION")
    print("=" * 60)

    config = load_config()
    client = NotionClient(config)

    # 1. Kiểm tra kết nối
    print(f"📡 Đang kết nối tới Database: {client.database_id} ...")
    db_meta = client.validate_connection()
    title_items = db_meta.get("title", [])
    title_text = "".join(i.get("plain_text", "") for i in title_items) or "(Không tên)"
    print(f"✅ Kết nối thành công! Database: '{title_text}'")

    # 2. Tải toàn bộ pages
    pages = client.query_all_pages()
    print(f"\n📦 Đã tải về thành công {len(pages)} bản ghi từ Notion.")

    # 3. Lưu raw JSON backup
    backup_path = BASE_DIR / config["paths"]["output"]["backup_json"]
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)
    print(f"💾 Đã lưu sao lưu thô (Raw JSON): {backup_path}")

    # 4. Trích xuất snapshot CSV
    snapshot_path = BASE_DIR / config["paths"]["output"]["snapshot_csv"]
    rows = []
    status_counter = Counter()

    for p in pages:
        props = p.get("properties", {})
        title = client.extract_title(props)
        st = client.extract_status(props)
        dt = client.extract_date(props)

        rows.append({
            "page_id": p.get("id", ""),
            "task": title,
            "status": st,
            "date": dt,
            "archived": p.get("archived", False),
            "url": p.get("url", "")
        })
        status_counter[st or "(Trống)"] += 1

    with open(snapshot_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["page_id", "task", "status", "date", "archived", "url"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"📊 Đã lưu snapshot CSV: {snapshot_path} ({len(rows)} dòng)")

    # 5. Thống kê
    print("\nThống kê trạng thái hiện tại:")
    for st, c in status_counter.most_common():
        print(f"  • {st:20}: {c} trang")

    print("\n✨ Hoàn thành bước Fetch! Tiếp theo: python -m src.reconcile")
    return len(rows)

if __name__ == "__main__":
    fetch()
