# Windows installer build

The clinic installer is an Inno Setup package. It installs the frontend, Express API, Node runtime, and PostgreSQL runtime into one local application directory. A Windows startup task launches PostgreSQL and the LabPulse API automatically; the clinic opens `http://localhost:3710` from the desktop shortcut.

The installed API binds only to `127.0.0.1`; it is intentionally not available to other computers on the clinic network. Local database, configuration, logs, and backups are restricted to Windows administrators and the SYSTEM account.

## Build requirements

- Windows x64
- Node/npm for the build step
- Inno Setup 7 or 6 for producing `LabPulse-Setup.exe`
- A redistributable Node runtime under `installer/vendor/node`
- A PostgreSQL runtime under `installer/vendor/postgresql`, including `bin/initdb.exe`, `bin/createdb.exe`, `bin/pg_ctl.exe`, and `bin/postgres.exe` plus their dependent files

Runtime binaries are intentionally not committed to the repository. Obtain and redistribute them according to their respective licenses. Keep the vendor folders out of source control if they are maintained in a separate release-assets store.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-installer.ps1
```

If Inno Setup is not installed, the script still prepares `installer/release` and prints the missing prerequisite. After installing Inno Setup, rerun the command.

## Clinic installation

Run `LabPulse-Setup.exe` as an administrator. The graphical first-time setup window asks for the laboratory name, owner details, and password, initializes the local PostgreSQL database, creates the owner, registers the startup and daily backup tasks, checks `/ready`, and opens LabPulse. The password is kept in memory during setup and is not passed as a command-line argument.

The installer creates a verified PostgreSQL backup immediately and then runs the backup task every day at 02:00, retaining 30 days of backups in `C:\ProgramData\LabPulse\backups`. Start Menu shortcuts are available for `LabPulse - Backup now` and `LabPulse - Restore backup`; restore requires administrator approval and asks for confirmation before replacing the database.

The installer does not remove `C:\ProgramData\LabPulse` during uninstall. This preserves the database for recovery. Back up the database before removing that directory manually.
