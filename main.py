#!/usr/bin/env python3
import sys
import argparse
from src.fetch import fetch
from src.reconcile import reconcile
from src.validate import validate
from src.apply import apply
from src.verify import verify
from src.rollback import rollback

def main():
    parser = argparse.ArgumentParser(description="Notion Task Cleaner & Reconciliation CLI")
    subparsers = parser.add_subparsers(dest="command", help="Lệnh cần thực hiện")

    subparsers.add_parser("fetch", help="1. Tải và sao lưu dữ liệu thô từ Notion")
    subparsers.add_parser("reconcile", help="2. Đối chiếu Snapshot với file CSV đã sửa")
    subparsers.add_parser("validate", help="3. Kiểm định an toàn Fail-Closed trước khi chạy")
    
    apply_parser = subparsers.add_parser("apply", help="4. Thực thi xóa các trang đã duyệt trên Notion")
    apply_parser.add_argument("--yes", action="store_true", help="Bỏ qua nhắc xác nhận")

    subparsers.add_parser("verify", help="5. Xác minh hậu cập nhật và xuất report.json")
    subparsers.add_parser("rollback", help="6. Khôi phục các trang đã xóa từ Trash")

    args = parser.parse_args()

    if args.command == "fetch":
        fetch()
    elif args.command == "reconcile":
        reconcile()
    elif args.command == "validate":
        validate()
    elif args.command == "apply":
        apply(skip_prompt=args.yes)
    elif args.command == "verify":
        verify()
    elif args.command == "rollback":
        rollback()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
