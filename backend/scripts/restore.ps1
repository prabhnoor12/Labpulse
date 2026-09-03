[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$ConfirmRestore,
  [switch]$AllowUnverified,
  [switch]$AllowProductionRestore,
  [string]$PgRestorePath = ''
)

$ErrorActionPreference = 'Stop'
$previousPgPassword = $env:PGPASSWORD

try {
  if (-not $ConfirmRestore) {
    throw 'Restore is destructive. Re-run with -ConfirmRestore after checking the target DATABASE_URL and backup file.'
  }
  if ($env:NODE_ENV -eq 'production' -and -not $AllowProductionRestore) {
    throw 'Production restore is blocked by default. Re-run with -AllowProductionRestore only after completing the incident/change review.'
  }
  if (-not $env:DATABASE_URL) {
    throw 'DATABASE_URL is required.'
  }

  $resolvedBackup = (Resolve-Path -LiteralPath $BackupFile -ErrorAction Stop).Path
  $backupItem = Get-Item -LiteralPath $resolvedBackup -ErrorAction Stop
  if (-not ($backupItem -is [IO.FileInfo]) -or $backupItem.Length -le 0 -or $backupItem.Extension -ne '.dump') {
    throw 'BackupFile must be a non-empty PostgreSQL custom-format .dump file.'
  }

  $commandName = if ($PgRestorePath) { $PgRestorePath } elseif ($env:PG_RESTORE_PATH) { $env:PG_RESTORE_PATH } else { 'pg_restore' }
  $pgRestore = Get-Command -Name $commandName -ErrorAction Stop

  $hashFile = "$resolvedBackup.sha256"
  if (-not (Test-Path -LiteralPath $hashFile)) {
    if (-not $AllowUnverified) {
      throw 'No checksum sidecar found. Restore a verified backup or explicitly use -AllowUnverified.'
    }
    Write-Warning 'No checksum sidecar found; restoring without checksum verification.'
  } else {
    $checksumLine = (Get-Content -LiteralPath $hashFile -Raw).Trim()
    if ($checksumLine -notmatch '^([A-Fa-f0-9]{64})\s+') {
      throw "Invalid checksum sidecar: $hashFile"
    }
    $expectedHash = $Matches[1].ToUpperInvariant()
    $actualHash = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($expectedHash -ne $actualHash) {
      throw "Backup checksum mismatch. Expected $expectedHash but found $actualHash."
    }
    Write-Host "Backup checksum verified: $actualHash"
  }

  $null = & $pgRestore.Source '--list' $resolvedBackup 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw 'Backup preflight failed. The file is not a readable PostgreSQL custom-format archive.'
  }

  . (Join-Path $PSScriptRoot 'postgres-connection.ps1')
  $databaseArgument = Get-PostgresConnectionArgument -DatabaseUrl $env:DATABASE_URL
  Write-Warning "Restoring $resolvedBackup into the configured DATABASE_URL target. Existing database objects may be replaced."
  & $pgRestore.Source '--clean' '--if-exists' '--exit-on-error' '--single-transaction' '--no-owner' '--no-privileges' $databaseArgument $resolvedBackup
  if ($LASTEXITCODE -ne 0) {
    throw "pg_restore failed with exit code $LASTEXITCODE."
  }

  Write-Host 'Restore complete.'
} finally {
  if ($null -eq $previousPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previousPgPassword }
}
