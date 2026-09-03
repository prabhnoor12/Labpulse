# LabPulse

LabPulse is a diagnostic laboratory reporting workspace with an independent Express/TypeScript API, PostgreSQL persistence, secure report workflow, and installable offline-capable frontend.

## Clinic installation on Windows

Clinic staff should receive `LabPulse-Setup.exe`, produced by the release process described in [installer/README.md](installer/README.md). The installer requires administrator approval, asks for the laboratory owner details, installs the local runtime and PostgreSQL, registers the LabPulse startup task, and creates a desktop shortcut.

After installation, the clinic opens LabPulse at `http://localhost:3710`. The local service is bound to this computer only; it is not exposed to the clinic network. No Docker, Node, PostgreSQL command line, or terminal access is required.

The installer also creates a daily verified backup task. Use the Start Menu shortcuts to create a backup immediately or restore a selected backup; backups remain in `C:\ProgramData\LabPulse\backups` after uninstall.

## Developer/local Docker installation

Requirements: Docker Desktop with Linux containers enabled.

For developers or technical operators, run from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

The setup wizard will:

1. Check Docker Desktop and Docker Compose.
2. Create a local `.env` with a generated database password.
3. Build and start PostgreSQL, the API, and the web gateway.
4. Wait for the database and API readiness checks.
5. Create the first laboratory owner without writing their password to `.env`.
6. Open LabPulse at `http://localhost:8080`.

The Compose deployment refuses to start when `POSTGRES_PASSWORD` is missing; it never falls back to a known database password. Keep the generated `.env`, backup directory, and Caddy data volumes private.

For an existing installation, skip owner creation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1 -SkipBootstrap
```

The API runs migrations automatically when it starts. Do not delete the `labpulse-postgres` Docker volume unless the database has been backed up.

## Hosted HTTPS deployment

Set these values in `.env` before starting the stack:

```dotenv
APP_DOMAIN=reports.example.com
NODE_ENV=production
WEB_HTTP_PORT=80
WEB_HTTPS_PORT=443
FRONTEND_ORIGINS=https://reports.example.com
COOKIE_SECURE=true
```

Caddy obtains and renews HTTPS certificates automatically when DNS points the domain to the server and ports 80/443 are reachable. Use a managed PostgreSQL service for a hosted deployment by replacing the internal `DATABASE_URL` configuration and enabling database TLS.

## Development

For direct local development, create a `.env` first and set a private `POSTGRES_PASSWORD`; Compose intentionally refuses to use a built-in database password:

```powershell
Copy-Item .env.example .env
# Edit .env and replace POSTGRES_PASSWORD with a long random value.
```

```powershell
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:bootstrap
npm run dev:backend
npm run dev:frontend
```

The development frontend is available at `http://localhost:5173` and proxies API requests to port `3001`.

## Verification and maintenance

```powershell
npm run lint
npm test
npm run build
npm run db:backup
```

Keep `.env` and `backups/` private. Schedule `npm run db:backup` with Windows Task Scheduler for local installations and perform restore drills on a disposable database.
