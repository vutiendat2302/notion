#!/usr/bin/env bash
set -euo pipefail

# These values are interpolated into SQL identifiers and literals below.
for identifier in MYSQL_DATABASE AI_MYSQL_DATABASE MYSQL_USER AI_MYSQL_USER MYSQL_MIGRATION_USER AI_MYSQL_MIGRATION_USER; do
  [[ "${!identifier}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || { echo "Invalid MySQL identifier: ${identifier}" >&2; exit 1; }
done
for secret in MYSQL_PASSWORD AI_MYSQL_PASSWORD MYSQL_MIGRATION_PASSWORD AI_MYSQL_MIGRATION_PASSWORD; do
  [[ "${!secret}" =~ ^[a-zA-Z0-9_]+$ ]] || { echo "Invalid MySQL password format: ${secret}" >&2; exit 1; }
done

# Tạo database tách biệt và tài khoản least-privilege:
# - productivity_app chỉ có quyền trên productivity_db (Backend owned)
# - ai_metadata_app chỉ có quyền trên ai_metadata_db (AI Service owned)

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
  CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

  CREATE DATABASE IF NOT EXISTS \`${AI_MYSQL_DATABASE}\`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

  CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%'
    IDENTIFIED BY '${MYSQL_PASSWORD}';
  REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${MYSQL_USER}'@'%';
  GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';

  CREATE USER IF NOT EXISTS '${MYSQL_MIGRATION_USER}'@'%'
    IDENTIFIED BY '${MYSQL_MIGRATION_PASSWORD}';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
    ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_MIGRATION_USER}'@'%';

  CREATE USER IF NOT EXISTS '${AI_MYSQL_USER}'@'%'
    IDENTIFIED BY '${AI_MYSQL_PASSWORD}';
  GRANT SELECT, INSERT, UPDATE, DELETE
    ON \`${AI_MYSQL_DATABASE}\`.* TO '${AI_MYSQL_USER}'@'%';

  CREATE USER IF NOT EXISTS '${AI_MYSQL_MIGRATION_USER}'@'%'
    IDENTIFIED BY '${AI_MYSQL_MIGRATION_PASSWORD}';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
    ON \`${AI_MYSQL_DATABASE}\`.* TO '${AI_MYSQL_MIGRATION_USER}'@'%';

  FLUSH PRIVILEGES;
EOSQL
