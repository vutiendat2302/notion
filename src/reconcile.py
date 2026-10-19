#!/usr/bin/env python3
import sys
import csv
from collections import Counter
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.notion_client import load_config, normalize_datetime_str

def reconcile():
    print("=" * 60)
    print("STEP 2: RECONCILE - ĐỐI CHIẾU NOTION SNAPSHOT VỚI CSV ĐÃ SỬA")
    print("=" * 60)

    config = load_config()
    snapshot_path = BASE_DIR / config["paths"]["output"]["snapshot_csv"]
    revised_csv_path = BASE_DIR / config["paths"]["input"]["revised_csv"]
    plan_path = BASE_DIR / config["paths"]["output"]["change_plan_csv"]

    if not snapshot_path.exists():
        print(f"❌ Không tìm thấy file snapshot: {snapshot_path}")
        print("👉 Vui lòng chạy bước fetch trước: python -m src.fetch")
        sys.exit(1)

    if not revised_csv_path.exists():
        print(f"❌ Không tìm thấy file CSV đã sửa: {revised_csv_path}")
        sys.exit(1)

    # 1. Đọc snapshot Notion
    notion_records = []
    with open(snapshot_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            notion_records.append(r)
    print(f"📖 Đã đọc {len(notion_records)} bản ghi từ Notion Snapshot.")

    # 2. Đọc file CSV đã sửa
    with open(revised_csv_path, "r", encoding="utf-8-sig") as f:
        revised_rows = list(csv.DictReader(f))

    revised_keys = set(
        (r.get("Task", "").strip(), normalize_datetime_str(r.get("Time", "")))
        for r in revised_rows
    )
    print(f"📖 Đã nạp {len(revised_rows)} bản ghi mục tiêu từ {revised_csv_path.name}.")

    protected_status = [s.lower() for s in config.get("safety", {}).get("protected_status", ["done"])]
    deletable_status = [s.lower() for s in config.get("safety", {}).get("deletable_status", ["not started"])]

    # 3. Phân loại
    plan_rows = []
    action_counter = Counter()
    delete_by_task = Counter()

    for r in notion_records:
        page_id = r.get("page_id", "").strip()
        task = r.get("task", "").strip()
        st = r.get("status", "").strip()
        dt_str = r.get("date", "").strip()
        archived = str(r.get("archived", "")).lower() == "true"

        norm_st = st.lower()
        norm_key = (task, normalize_datetime_str(dt_str))

        if archived:
            plan_rows.append({
                "page_id": page_id, "task": task, "status": st, "date": dt_str,
                "action": "KEEP", "reason": "Đã nằm trong Trash từ trước"
            })
            action_counter["KEEP"] += 1
            continue

        # NGUYÊN TẮC BẢO VỆ TUYỆT ĐỐI TASK DONE
        if norm_st in protected_status:
            plan_rows.append({
                "page_id": page_id, "task": task, "status": st, "date": dt_str,
                "action": "KEEP", "reason": "Bảo toàn lịch sử (Done)"
            })
            action_counter["KEEP"] += 1
            continue

        # So khớp với revised.csv
        if norm_key in revised_keys:
            plan_rows.append({
                "page_id": page_id, "task": task, "status": st, "date": dt_str,
                "action": "KEEP", "reason": "Có mặt trong file đã sửa"
            })
            action_counter["KEEP"] += 1
        else:
            # Thiếu trong revised.csv -> Kiểm tra trạng thái cho phép xóa
            if norm_st in deletable_status:
                plan_rows.append({
                    "page_id": page_id, "task": task, "status": st, "date": dt_str,
                    "action": "DELETE", "reason": f"Đã bị xóa khỏi {revised_csv_path.name}"
                })
                action_counter["DELETE"] += 1
                delete_by_task[task] += 1
            else:
                plan_rows.append({
                    "page_id": page_id, "task": task, "status": st, "date": dt_str,
                    "action": "KEEP", "reason": f"Ngoài phạm vi xóa (Trạng thái: {st})"
                })
                action_counter["KEEP"] += 1

    # 4. Xuất change_plan.csv
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    with open(plan_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["page_id", "task", "status", "date", "action", "reason"])
        writer.writeheader()
        writer.writerows(plan_rows)

    print(f"\n📝 Đã xuất kế hoạch: {plan_path} ({len(plan_rows)} dòng)")
    print("\nTổng hợp hành động:")
    for act, c in action_counter.items():
        print(f"  • {act:8}: {c} trang")

    if delete_by_task:
        print("\nChi tiết các task thuộc diện DELETE:")
        for t, c in delete_by_task.most_common():
            print(f"  - {t:35}: {c} trang")

    print("\n✨ Hoàn thành bước Reconcile! Tiếp theo: python -m src.validate")
    return plan_rows

if __name__ == "__main__":
    reconcile()
