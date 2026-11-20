# Self-hosted web deployment

This installation runs in the dedicated Compose project `notion-productivity-isolated`. The existing MySQL server is shared, but the application uses its own database and database user. Backend and frontend ports bind only to loopback (`127.0.0.1:18000` and `127.0.0.1:3100`). The optional Cloudflare tunnel has separate credentials and a separate Compose service; the existing Zalo Bot tunnel and its DNS routes are outside this project.

## Configuration

The repository-root `.env` is ignored by Git. Set `COMPOSE_PROJECT_NAME`, dedicated MySQL credentials/URLs, random application secrets, `BACKEND_PORT=18000`, `FRONTEND_PORT=3100`, `NEXT_PUBLIC_API_BASE_URL=/api/v1`, `APP_PUBLIC_HOSTNAME`, and paths to the dedicated tunnel config and credential JSON. Keep the credential files outside the repository and readable only by their owner. The production override sets `APP_ENV=production`, secure cookies and CORS for `https://${APP_PUBLIC_HOSTNAME}`.

The frontend serves `/api/v1/*` on the same HTTPS origin and forwards those requests internally to `backend:8000`. The browser does not need direct access to port 18000.

## Start and inspect

Run from the repository root:

```bash
docker compose -p notion-productivity-isolated --env-file .env -f infra/compose.yaml -f infra/compose.prod.yaml config --quiet
docker compose -p notion-productivity-isolated --env-file .env -f infra/compose.yaml -f infra/compose.prod.yaml up -d --build backend backend-recurrence-worker frontend
docker compose -p notion-productivity-isolated --env-file .env -f infra/compose.yaml -f infra/compose.prod.yaml ps
```

Initialize the first owner account through the private loopback origin before enabling public DNS. On this installation, the generated owner password is stored in `~/.config/notion-productivity/initial-owner-password` with mode `0600`; do not copy it into the repository or deployment logs. A password-change screen is not implemented yet, so retain this file securely until that feature exists.

After the hostname and tunnel ingress are verified, start **only** this project's tunnel:

```bash
docker compose -p notion-productivity-isolated --env-file .env -f infra/compose.yaml -f infra/compose.prod.yaml --profile public up -d cloudflare-tunnel
```

The public DNS CNAME must target this project's tunnel ID, not the existing Zalo Bot tunnel. Confirm the target in Cloudflare DNS before sharing the URL. The tunnel ingress forwards the chosen hostname to `http://frontend:3000` and returns 404 for every other hostname.

## Verification and maintenance

- Open `/`, `/planning`, and `/calendar` through the chosen HTTPS hostname on another device. An unauthenticated request to `/api/v1/users/me` should return 401.
- Check that the Compose backend and recurrence worker are healthy. The worker healthcheck only reads `SELECT 1` from the dedicated database.
- Check that the existing `vsico-zalo-*` containers and `vsico-cloudflared.service` remain active, and that `oa.vtdat.com`, `bot.vtdat.com`, and `api.vtdat.com` retain their original routes.
- Back up the dedicated MySQL database with `make db-backup`; follow `docs/database/INITIAL_DATABASE_RUNBOOK.md` for backup handling and restore testing.
- To stop this application, target this project explicitly with `docker compose -p notion-productivity-isolated ... stop`. Never use volume removal when stopping it.

The Playwright authenticated workflow is tested with a rollback-only backend; see `docs/testing/FE_PHASE2_TEST.md`. Backend and frontend static, unit and build gates must pass before rebuilding the production images.
