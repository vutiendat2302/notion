import os
import re
import time
import yaml
import requests
from pathlib import Path
from dateutil import parser

# Đường dẫn gốc dự án
BASE_DIR = Path(__file__).resolve().parent.parent

def load_env(env_path=None):
    if env_path is None:
        env_path = BASE_DIR / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v

load_env()

def load_config(config_path=None):
    if config_path is None:
        config_path = BASE_DIR / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file cấu hình: {config_path}")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def normalize_datetime_str(time_str):
    if not time_str:
        return ""
    parts = str(time_str).split("→")
    if len(parts) == 1:
        parts = str(time_str).split("->")
    start_str = parts[0].strip()
    start_clean = re.sub(r"\(GMT[+-]\d+\)", "", start_str).strip()
    try:
        dt = parser.parse(start_clean)
        if ":" in start_clean:
            return dt.strftime("%Y-%m-%dT%H:%M")
        else:
            return dt.strftime("%Y-%m-%d")
    except Exception:
        return start_clean

class NotionClient:
    def __init__(self, config=None):
        self.config = config or load_config()
        self.token = os.getenv("NOTION_TOKEN", "").strip()
        
        # Database ID ưu tiên từ .env, nếu không có thì lấy từ config.yaml
        db_id = os.getenv("NOTION_DATABASE_ID", "").strip() or self.config.get("notion", {}).get("database_id", "").strip()
        self.database_id = db_id.replace("-", "").strip()
        
        self.api_version = self.config.get("notion", {}).get("api_version", "2022-06-28")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": self.api_version,
            "Content-Type": "application/json",
        }
        self.prop_title = self.config.get("notion", {}).get("properties", {}).get("title", "Task")
        self.prop_status = self.config.get("notion", {}).get("properties", {}).get("status", "Status")
        self.prop_date = self.config.get("notion", {}).get("properties", {}).get("date", "Time")

    def validate_connection(self):
        if not self.token:
            raise ValueError("Chưa cấu hình NOTION_TOKEN trong file .env!")
        if not self.database_id:
            raise ValueError("Chưa cấu hình database_id trong file .env hoặc config.yaml!")

        url = f"https://api.notion.com/v1/databases/{self.database_id}"
        resp = self._request_with_retry("GET", url)
        if resp.status_code != 200:
            raise ConnectionError(f"Không thể kết nối Database ({resp.status_code}): {resp.text}")
        return resp.json()

    def _request_with_retry(self, method, url, **kwargs):
        max_retries = 5
        delay = 1.0
        for attempt in range(max_retries):
            try:
                resp = requests.request(method, url, headers=self.headers, **kwargs)
                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", delay))
                    time.sleep(retry_after)
                    delay *= 2
                    continue
                return resp
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise e
                time.sleep(delay)
                delay *= 2
        return None

    def query_all_pages(self):
        self.validate_connection()
        url = f"https://api.notion.com/v1/databases/{self.database_id}/query"
        pages = []
        has_more = True
        next_cursor = None
        page_num = 1

        while has_more:
            payload = {"page_size": 100}
            if next_cursor:
                payload["start_cursor"] = next_cursor

            resp = self._request_with_retry("POST", url, json=payload, timeout=30)
            if resp is None or resp.status_code != 200:
                err = resp.text if resp else "No response"
                raise RuntimeError(f"Lỗi truy vấn Notion API ({resp.status_code if resp else 'None'}): {err}")

            data = resp.json()
            results = data.get("results", [])
            pages.extend(results)
            print(f"   + Lô {page_num}: Đã nạp {len(results)} trang (Tổng: {len(pages)})")

            has_more = data.get("has_more", False)
            next_cursor = data.get("next_cursor")
            page_num += 1
            time.sleep(0.3)

        return pages

    def archive_page(self, page_id):
        url = f"https://api.notion.com/v1/pages/{page_id}"
        payload = {"archived": True}
        return self._request_with_retry("PATCH", url, json=payload, timeout=20)

    def restore_page(self, page_id):
        url = f"https://api.notion.com/v1/pages/{page_id}"
        payload = {"archived": False}
        return self._request_with_retry("PATCH", url, json=payload, timeout=20)

    def extract_title(self, properties):
        if self.prop_title in properties:
            p = properties[self.prop_title]
            if p.get("type") == "title":
                return self._extract_plain_text(p.get("title", []))
        for p in properties.values():
            if p.get("type") == "title":
                return self._extract_plain_text(p.get("title", []))
        return ""

    def extract_status(self, properties):
        if self.prop_status in properties:
            p = properties[self.prop_status]
            ptype = p.get("type")
            if ptype == "status":
                st = p.get("status")
                return st.get("name", "") if st else ""
            elif ptype == "select":
                sl = p.get("select")
                return sl.get("name", "") if sl else ""
        for name, p in properties.items():
            if p.get("type") == "status":
                st = p.get("status")
                return st.get("name", "") if st else ""
        for name, p in properties.items():
            if p.get("type") == "select" and any(k in name.lower() for k in ["status", "trạng thái", "tiến độ"]):
                sl = p.get("select")
                return sl.get("name", "") if sl else ""
        return ""

    def extract_date(self, properties):
        if self.prop_date in properties:
            p = properties[self.prop_date]
            if p.get("type") == "date":
                dt = p.get("date")
                if dt:
                    return dt.get("start", "") + (f" -> {dt.get('end')}" if dt.get("end") else "")
        for p in properties.values():
            if p.get("type") == "date":
                dt = p.get("date")
                if dt:
                    return dt.get("start", "") + (f" -> {dt.get('end')}" if dt.get("end") else "")
        return ""

    @staticmethod
    def _extract_plain_text(rich_text_list):
        if not rich_text_list or not isinstance(rich_text_list, list):
            return ""
        return "".join(item.get("plain_text", "") for item in rich_text_list).strip()
