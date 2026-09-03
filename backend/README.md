# LabPulse API

This is the independent Express/TypeScript backend. It does not import React or frontend code.

## Local PostgreSQL

For local development, start the included PostgreSQL container and copy `.env.example` to `.env`.

```powershell
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:bootstrap
npm run dev:backend
```

The API listens on `http://localhost:3001`. The Vite frontend proxies `/api` to this port during development.

`/live` only checks that the Node process is running. `/ready` and `/health` verify that PostgreSQL is reachable and return HTTP `503` while the API is not ready. For remote PostgreSQL, set `DATABASE_SSL=true`; certificate validation remains enabled by default and can use `DATABASE_SSL_CA_FILE` for a private CA.

## Monitoring

Set `METRICS_TOKEN` to a random value of at least 32 characters to enable the PHI-free `/metrics` endpoint. Monitoring clients must send `Authorization: Bearer <METRICS_TOKEN>`. The Compose web gateway does not proxy this endpoint, so expose it only through a private monitoring network. Without the token, `/metrics` returns `404`.

The API emits JSON events for requests, API errors, database pool/rollback failures, and fatal process failures. An unhandled rejection or uncaught exception exits the process after graceful shutdown so the container supervisor can restart it.

`db:migrate` uses a PostgreSQL advisory lock and records a checksum for every applied SQL file. Keep applied migration files unchanged; make schema changes by adding a new numbered migration.

`db:bootstrap` creates the first lab and owner from the `BOOTSTRAP_*` environment variables. Do not keep the bootstrap password in source control.

## Backup and restore

Create a compressed custom-format backup with a SHA-256 sidecar file:

```powershell
npm run db:backup
```

The default retention is 30 days and can be changed with `BACKUP_RETENTION_DAYS`. Store the backup directory on a different disk or NAS from the database host, and schedule the command with Windows Task Scheduler for a local deployment.

Backups are written to a temporary file and renamed only after `pg_dump` succeeds. Retention cleanup only removes files named `labpulse-*.dump`; incomplete or unrelated dump files are not touched.

Restore only after checking the target `DATABASE_URL`:

```powershell
npm run db:restore -- -BackupFile .\backups\labpulse-20260903-120000.dump -ConfirmRestore
```

Restore requires a matching `.sha256` sidecar and performs a custom-format archive preflight before replacing objects. Missing checksums require an explicit `-AllowUnverified`; production targets additionally require `-AllowProductionRestore`. Perform a restore drill on a disposable database at least once before relying on the backups. Never commit the `backups/` directory or database credentials.

## API boundary

The backend owns authentication, authorization, persistence, report status transitions, and audit events. The frontend should communicate through HTTP only.

The frontend is installable as a PWA and stores encrypted workspace snapshots and queued report changes in IndexedDB, never `localStorage`. The service worker deliberately does not cache `/api` responses. Offline unlock requires one successful online login on the device; verification and sharing remain online-only.
