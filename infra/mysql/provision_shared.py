"""Provision only this application's schemas and accounts on an existing MySQL container.

The operation is intentionally create-only. Any pre-existing target name aborts the
whole operation so credentials or privileges of another installation are untouched.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env"
IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\Z")
SECRET = re.compile(r"[A-Za-z0-9_]+\Z")


def read_config() -> dict[str, str]:
    if not ENV_FILE.is_file():
        raise ValueError("Create .env from .env.example first")
    values = dict(
        line.split("=", 1)
        for line in ENV_FILE.read_text().splitlines()
        if "=" in line and not line.startswith("#")
    )
    for key in (
        "MYSQL_DATABASE",
        "AI_MYSQL_DATABASE",
        "MYSQL_USER",
        "MYSQL_MIGRATION_USER",
        "AI_MYSQL_USER",
        "AI_MYSQL_MIGRATION_USER",
    ):
        if not IDENTIFIER.fullmatch(values.get(key, "")):
            raise ValueError(f"Invalid or missing identifier: {key}")
    for key in (
        "MYSQL_PASSWORD", "MYSQL_MIGRATION_PASSWORD", "AI_MYSQL_PASSWORD",
        "AI_MYSQL_MIGRATION_PASSWORD",
    ):
        if not SECRET.fullmatch(values.get(key, "")) or "CHANGE_ME" in values[key]:
            raise ValueError(f"Invalid or placeholder password: {key}")
    if any("CHANGE_ME" in values.get(key, "") for key in ("EXTERNAL_MYSQL_CONTAINER",)):
        raise ValueError("EXTERNAL_MYSQL_CONTAINER is not configured")
    if len({values[k] for k in ("MYSQL_DATABASE", "AI_MYSQL_DATABASE")}) != 2:
        raise ValueError("Business and AI schemas must be distinct")
    if len({values[k] for k in ("MYSQL_USER", "MYSQL_MIGRATION_USER", "AI_MYSQL_USER", "AI_MYSQL_MIGRATION_USER")}) != 4:
        raise ValueError("MySQL accounts must be distinct")
    return values


def mysql_admin(container: str, statement: str) -> str:
    result = subprocess.run(
        [
            "docker", "exec", "-i", container, "sh", "-c",
            'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --batch --skip-column-names',
        ],
        input=statement,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"MySQL administrator command failed (exit {result.returncode})")
    return result.stdout.strip()


def main() -> int:
    cfg = read_config()
    container = cfg["EXTERNAL_MYSQL_CONTAINER"]
    # Names are validated above and used only inside SQL string literals here.
    db_names = (cfg["MYSQL_DATABASE"], cfg["AI_MYSQL_DATABASE"])
    users = (
        cfg["MYSQL_USER"], cfg["MYSQL_MIGRATION_USER"],
        cfg["AI_MYSQL_USER"], cfg["AI_MYSQL_MIGRATION_USER"],
    )
    existing = mysql_admin(
        container,
        "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA "
        f"WHERE SCHEMA_NAME IN ('{db_names[0]}','{db_names[1]}'); "
        "SELECT user FROM mysql.user "
        f"WHERE user IN ('{users[0]}','{users[1]}','{users[2]}','{users[3]}');",
    )
    if existing:
        raise ValueError("Target schema or account already exists; no changes made")

    sql = f"""
CREATE DATABASE `{db_names[0]}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE `{db_names[1]}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER '{users[0]}'@'%' IDENTIFIED BY '{cfg['MYSQL_PASSWORD']}';
CREATE USER '{users[1]}'@'%' IDENTIFIED BY '{cfg['MYSQL_MIGRATION_PASSWORD']}';
CREATE USER '{users[2]}'@'%' IDENTIFIED BY '{cfg['AI_MYSQL_PASSWORD']}';
CREATE USER '{users[3]}'@'%' IDENTIFIED BY '{cfg['AI_MYSQL_MIGRATION_PASSWORD']}';
GRANT SELECT, INSERT, UPDATE, DELETE ON `{db_names[0]}`.* TO '{users[0]}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON `{db_names[0]}`.* TO '{users[1]}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON `{db_names[1]}`.* TO '{users[2]}'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON `{db_names[1]}`.* TO '{users[3]}'@'%';
"""
    mysql_admin(container, sql)
    print("Created application schemas and scoped accounts on the existing MySQL instance")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError) as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)
