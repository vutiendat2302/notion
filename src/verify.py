#!/usr/bin/env python3
import sys
import csv
import json
import time
from collections import Counter
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.notion_client import NotionClient, load_config, normalize_datetime_str

def verify():
    print("=" * 60)
    print("STEP 5: VERIFY - XÁC MINH VÀ XUẤT BÁO CÁO REPORT.JSON")
    print("=" * 60)

    config = load_config()
    client = NotionClient(config)

    revised_csv_path = BASE_DIR / config["paths"]["input"]["revised_csv"]
    report_json_path = BASE_DIR / config["paths"]["output"]["report_json"]

    # 1. Tải trạng thái hiện thời từ Notion
    print("📡 Đang tải trạng thái thực tế mới nhất từ Notion...")
    pages = client.query_all_pages()
    print(f"📦 Nhận được {len(pages)} bản ghi hiện có trong database.")

    # 2. Đọc file revised.csv làm chuẩn
    revised_keys = Counter()
    revised_expected_count = 0
    if revised_csv_path.exists():
        with open(revised_csv_path, "r", encoding="utf-8-sig") as f:
            v2_rows = list(csv.DictReader(f))
            revised_expected_count = len(v2_rows)
            revised_keys = Counter((r["Task"].strip(), normalize_datetime_str(r["Time"])) for r in v2_rows)

    # 3. Phân tích dữ liệu Notion
    current_keys = Counter()
    status_counter = Counter()
    protected_status = [s.lower() for s in config.get("safety", {}).get("protected_status", ["done"])]
    expected_done = config.get("safety", {}).get("expected_done_count", 602)
    done_count = 0

    for p in pages:
        props = p.get("properties", {})
        title = client.extract_title(props)
        st = client.extract_status(props)
        dt = client.extract_date(props)

        status_counter[st or "(Trống)"] += 1
        if st.lower() in protected_status:
            done_count += 1

        norm_key = (title.strip(), normalize_datetime_str(dt))
        current_keys[norm_key] += 1

    # 4. Đối soát
    diff_unexpected = current_keys - revised_keys
    diff_missing = revised_keys - current_keys
    cond_done = (done_count == expected_done)
    cond_match = (len(diff_unexpected) == 0 and len(diff_missing) == 0 and len(pages) == revised_expected_count)
    verification_passed = cond_done and cond_match

    print("\n" + "=" * 60)
    print("📊 KẾT QUẢ ĐỐI SOÁT CUỐI CÙNG:")
    print("=" * 60)
    print(f" • Tổng số bản ghi thực tế: {len(pages)} (Kỳ vọng: {revised_expected_count})")
    print(f" • Task Done: {done_count}/{expected_done} -> {'✅ ĐẠT' if cond_done else '❌ KHÔNG ĐẠT'}")
    print(f" • Trùng khớp với {revised_csv_path.name}: {'✅ 100% TUYỆT ĐỐI' if cond_match else '❌ SAI LỆCH'}")

    if not cond_match:
        if diff_unexpected:
            print(f"   ⚠️ Thừa {len(diff_unexpected)} task chưa xóa:")
            for k, c in list(diff_unexpected.items())[:3]:
                print(f"      - {k[0]} ({k[1]}): {c}")
        if diff_missing:
            print(f"   ⚠️ Thiếu {len(diff_missing)} task:")
            for k, c in list(diff_missing.items())[:3]:
                print(f"      - {k[0]} ({k[1]}): {c}")

    print("\nPhân bố trạng thái Database:")
    for st, c in status_counter.most_common():
        print(f"  • {st:20}: {c} bản ghi")

    # 5. Xuất output/report.json
    report_data = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "database_id": client.database_id,
        "total_notion_pages": len(pages),
        "expected_pages": revised_expected_count,
        "total_done_pages": done_count,
        "expected_done_pages": expected_done,
        "status_distribution": dict(status_counter),
        "verification_passed": verification_passed,
        "diff_unexpected_count": len(diff_unexpected),
        "diff_missing_count": len(diff_missing)
    }

    report_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
    print(f"\n📄 Đã xuất báo cáo đối soát: {report_json_path}")

    if verification_passed:
        print("\n🏆 XÁC NHẬN: QUÁ TRÌNH ĐỒNG BỘ NOTION ĐÃ HOÀN TẤT THÀNH CÔNG RỰC RỠ 100%!")
    return verification_passed

if __name__ == "__main__":
    verify()
