[CmdletBinding()]
param(
  [string]$OutputDirectory = '',
  [int]$RetentionDays = 0,
  [string]$PgDumpPath = ''
)

$ErrorActionPreference = 'Stop'
$temporaryDump = $null
$temporaryHash = $null
$previousPgPassword = $env:PGPASSWORD

try {
  if (-not $env:DATABASE_URL) {
    throw 'DATABASE_URL is required.'
  }

  if (-not $OutputDirectory) {
    $OutputDirectory = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path (Get-Location) 'backups' }
  }

  if ($RetentionDays -le 0) {
    $RetentionDays = if ($env:BACKUP_RETENTION_DAYS) { [int]$env:BACKUP_RETENTION_DAYS } else { 30 }
  }
  if ($RetentionDays -lt 1 -or $RetentionDays -gt 3650) {
    throw 'RetentionDays must be between 1 and 3650.'
  }

  if (-not (Test-Path -LiteralPath $OutputDirectory)) {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  }
  $directoryItem = Get-Item -LiteralPath $OutputDirectory -ErrorAction Stop
  if (-not $directoryItem.PSIsContainer) {
    throw 'OutputDirectory must be a directory.'
  }
  $resolvedDirectory = $directoryItem.FullName
  if ([IO.Path]::GetPathRoot($resolvedDirectory) -eq $resolvedDirectory) {
    throw 'Refusing to use a filesystem root as the backup directory.'
  }

  $commandName = if ($PgDumpPath) { $PgDumpPath } elseif ($env:PG_DUMP_PATH) { $env:PG_DUMP_PATH } else { 'pg_dump' }
  $pgDump = Get-Command -Name $commandName -ErrorAction Stop
  $timestamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff')
  $dumpFile = Join-Path $resolvedDirectory "labpulse-$timestamp.dump"
  $temporaryDump = "$dumpFile.partial"
  $hashFile = "$dumpFile.sha256"
  $temporaryHash = "$hashFile.partial"

  if (Test-Path -LiteralPath $dumpFile) {
    throw "A backup already exists at $dumpFile. Refusing to overwrite it."
  }

  . (Join-Path $PSScriptRoot 'postgres-connection.ps1')
  $databaseArgument = Get-PostgresConnectionArgument -DatabaseUrl $env:DATABASE_URL
  Write-Host "Creating PostgreSQL backup: $dumpFile"
  & $pgDump.Source '--format=custom' '--no-owner' '--no-privileges' "--file=$temporaryDump" $databaseArgument
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE."
  }

  Move-Item -LiteralPath $temporaryDump -Destination $dumpFile
  $hash = (Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256).Hash.ToUpperInvariant()
  Set-Content -LiteralPath $temporaryHash -Value "$hash *$([IO.Path]::GetFileName($dumpFile))" -NoNewline -Encoding ascii
  Move-Item -LiteralPath $temporaryHash -Destination $hashFile

  $cutoff = [DateTime]::UtcNow.AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $resolvedDirectory -Filter 'labpulse-*.dump' -File |
    Where-Object { $_.LastWriteTimeUtc -lt $cutoff } |
    ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force
      $oldHashFile = "$($_.FullName).sha256"
      if (Test-Path -LiteralPath $oldHashFile) { Remove-Item -LiteralPath $oldHashFile -Force }
    }

  Write-Host "Backup complete. SHA-256: $hash"
} finally {
  if ($temporaryDump -and (Test-Path -LiteralPath $temporaryDump)) { Remove-Item -LiteralPath $temporaryDump -Force -ErrorAction SilentlyContinue }
  if ($temporaryHash -and (Test-Path -LiteralPath $temporaryHash)) { Remove-Item -LiteralPath $temporaryHash -Force -ErrorAction SilentlyContinue }
  if ($null -eq $previousPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previousPgPassword }
}
