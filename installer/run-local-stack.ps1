param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$DataDir
)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $DataDir 'config\local.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$postgresDir = Join-Path $DataDir 'data\postgres'
$logDir = Join-Path $DataDir 'logs'
$pgCtl = Join-Path $InstallDir 'postgresql\bin\pg_ctl.exe'
$node = Join-Path $InstallDir 'runtime\node.exe'
$server = Join-Path $InstallDir 'server\backend.cjs'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$env:NODE_ENV = 'development'
$env:HOST = '127.0.0.1'
$env:PORT = [string]$config.appPort
$env:DATABASE_URL = "postgresql://$($config.databaseUser):$($config.databasePassword)@127.0.0.1:$($config.databasePort)/$($config.databaseName)"
$env:DATABASE_SSL = 'false'
$env:COOKIE_SECURE = 'false'
$env:FRONTEND_ORIGINS = "http://127.0.0.1:$($config.appPort),http://localhost:$($config.appPort)"
$env:FRONTEND_DIST_DIR = Join-Path $InstallDir 'web'
$env:MIGRATIONS_DIR = Join-Path $InstallDir 'server\migrations'
$env:BACKUP_DIR = Join-Path $DataDir 'backups'

& $pgCtl -D $postgresDir -l (Join-Path $logDir 'postgres.log') -o "-p $($config.databasePort)" -w start
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start. Check the PostgreSQL log in the LabPulse data folder.' }

try {
  while ($true) {
    & $node $server
    if ($LASTEXITCODE -eq 0) { break }
    Add-Content -LiteralPath (Join-Path $logDir 'labpulse.log') -Value "$(Get-Date -Format o) API exited with code $LASTEXITCODE; restarting in 5 seconds."
    Start-Sleep -Seconds 5
  }
} finally {
  & $pgCtl -D $postgresDir -m fast -w stop *> $null
}
