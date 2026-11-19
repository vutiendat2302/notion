#!/usr/bin/env bash
set -euo pipefail

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
  GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';

  CREATE USER IF NOT EXISTS '${AI_MYSQL_USER}'@'%'
    IDENTIFIED BY '${AI_MYSQL_PASSWORD}';
  GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
    ON \`${AI_MYSQL_DATABASE}\`.* TO '${AI_MYSQL_USER}'@'%';

  FLUSH PRIVILEGES;
EOSQL
