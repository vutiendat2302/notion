# Initial MySQL database runbook

## Scope and isolation

This app uses the existing MySQL 8.4 instance on host port `127.0.0.1:3306`. It joins that instance's Docker network through the external `MYSQL_DOCKER_NETWORK` setting. The app owns separate schemas and accounts; it does not alter tables in existing project schemas. Runtime secrets are in the ignored `.env` file with mode `0600`.

The shared instance contains `notion_productivity_db` for the backend and `notion_ai_metadata_db` for the future AI service. Runtime accounts `notion_productivity_app` and `notion_ai_metadata_app` have only SELECT, INSERT, UPDATE, DELETE on their own schema. Separate migration accounts handle DDL. There are no cross-database foreign keys.

## First setup

1. Copy `.env.example` to `.env`; set `MYSQL_DOCKER_NETWORK` and `EXTERNAL_MYSQL_CONTAINER` to the existing instance, and replace every `CHANGE_ME` secret. Use URL-safe random values or URL-encode passwords in connection URLs.
2. Check `docker compose --env-file .env -f infra/compose.yaml config --quiet`.
3. Check the existing MySQL container with `make db-up`. Run `make db-provision` once. It aborts if any target schema or account already exists; it creates only the two application schemas and four scoped accounts.
4. Build the backend image with `docker compose --env-file .env -f infra/compose.yaml build backend`.
5. Run `make migrate`. Alembic reads `DATABASE_MIGRATION_URL` only in the migration container and applies the reviewed migrations to `notion_productivity_db` only. Run `make ai-db-migrate` for the separate AI metadata history.
6. Run `make db-check`, then query both `alembic_version` tables, `information_schema.tables`, and account grants to verify the result.

The `standalone-db` Compose profile is optional and is not used by this installation. Changing account names or passwords later requires an explicit administration step. Never run `docker compose down -v` against data you wish to keep.

## Backup and recovery

Run `make db-backup` before schema changes. Store the generated SQL outside the host after encrypting it, and periodically verify restoration into a separate disposable MySQL instance. Do not restore into the live database during verification. A backup includes business data; protect it like application secrets.

## Current schema

The backend migration chain creates 36 product tables: revision `0001` contains the 16 Core MVP tables, `0002` contains M8 tags and dependency edges, and `818a88551072` contains the 17 remaining M9–M13 tables. The independent AI Alembic chain creates five metadata tables in `notion_ai_metadata_db`.

The database layer is ahead of the application layer by explicit request. New tables have mapped models and database constraints, but later-phase APIs, services, JSON validation, cycle checks, file lifecycle jobs, and AI confirmation behavior still need implementation. The `target_key` discriminators in polymorphic links require service-side validation against their target UUID. The shared MySQL server's global timezone/collation are owned by the existing installation; the new schemas use `utf8mb4_0900_ai_ci`, while application instant fields are stored as UTC `DATETIME(6)`.

The backend tests use the Transactional Proxy and rollback every write. AI metadata tests also use an outer transaction with rollback. Restore testing should use a separate disposable MySQL instance, never the live shared server.
