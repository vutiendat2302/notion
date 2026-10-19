#!/usr/bin/env python3
import sys
import csv
import json
import hashlib
from collections import Counter
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from src.notion_client import load_config

def validate():
    print("=" * 60)
    print("STEP 3: VALIDATE - KIỂM ĐỊNH AN TOÀN FAIL-CLOSED")
    print("=" * 60)

    config = load_config()
    plan_path = BASE_DIR / config["paths"]["output"]["change_plan_csv"]

    if not plan_path.exists():
        print(f"❌ Không tìm thấy file kế hoạch: {plan_path}")
        print("👉 Vui lòng chạy bước reconcile trước: python -m src.reconcile")
        sys.exit(1)

    rows = []
    with open(plan_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    print(f"📋 Đã nạp {len(rows)} dòng từ {plan_path.name}")

    # 1. Kiểm tra tính hợp lệ của page_id
    page_ids = set()
    dup_ids = []
    empty_ids = []

    for r in rows:
        pid = r.get("page_id", "").strip()
        if not pid:
            empty_ids.append(r)
        elif pid in page_ids:
            dup_ids.append(pid)
        else:
            page_ids.add(pid)

    if empty_ids:
        print(f"❌ THẤT BẠI: Có {len(empty_ids)} dòng bị thiếu page_id!")
        sys.exit(1)
    if dup_ids:
        print(f"❌ THẤT BẠI: Có {len(dup_ids)} page_id bị trùng lặp!")
        sys.exit(1)

    print("✅ Kiểm tra page_id: 100% hợp lệ và duy nhất.")

    # 2. Kiểm tra điều kiện Fail-Closed
    protected_status = [s.lower() for s in config.get("safety", {}).get("protected_status", ["done"])]
    expected_done = config.get("safety", {}).get("expected_done_count", 602)

    deleted_protected = [
        r for r in rows
        if r["action"] == "DELETE" and r["status"].lower() in protected_status
    ]
    if deleted_protected:
        print(f"❌ FAIL-CLOSED VIOLATION: Phát hiện {len(deleted_protected)} task Done bị đánh dấu DELETE!")
        sys.exit(1)
    print("✅ ĐIỀU KIỆN 1 (Bảo vệ task Done): ĐẠT - Tuyệt đối không xóa bất kỳ task Done nào.")

    total_done = sum(1 for r in rows if r["status"].lower() in protected_status)
    print(f"   • Số lượng task Done ghi nhận: {total_done} (Kỳ vọng: {expected_done})")
    if total_done != expected_done:
        print(f"   ⚠️ LƯU Ý: Số task Done ({total_done}) khác với số kỳ vọng ({expected_done}).")

    # 3. Thống kê hành động
    actions = Counter(r["action"] for r in rows)
    print(f"\nPhân bố kế hoạch: KEEP={actions['KEEP']}, DELETE={actions['DELETE']}")

    # 4. Sinh khóa xác thực (Token)
    token_path = BASE_DIR / "output" / "validation.token"
    token_path.parent.mkdir(parents=True, exist_ok=True)
    plan_hash = hashlib.sha256(plan_path.read_bytes()).hexdigest()

    token_data = {
        "status": "PASSED",
        "plan_hash": plan_hash,
        "total_delete": actions["DELETE"],
        "total_keep": actions["KEEP"],
        "total_done": total_done
    }
    with open(token_path, "w", encoding="utf-8") as f:
        json.dump(token_data, f, indent=2)

    print(f"🔑 Đã cấp khóa xác thực an toàn: {token_path}")
    print("\n🎉 VALIDATION THÀNH CÔNG! Kế hoạch an toàn để thực thi.")
    print("👉 Tiếp theo: python -m src.apply")
    return True

if __name__ == "__main__":
    validate()
