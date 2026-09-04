[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$DataDir,
  [switch]$Interactive
)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $DataDir 'config\local.json'
$postgresDir = Join-Path $DataDir 'data\postgres'
$logDir = Join-Path $DataDir 'logs'
$backupDir = Join-Path $DataDir 'backups'
$pgCtl = Join-Path $InstallDir 'postgresql\bin\pg_ctl.exe'
$pgDump = Join-Path $InstallDir 'postgresql\bin\pg_dump.exe'
$backupScript = Join-Path $InstallDir 'installer\backup.ps1'

function Ensure-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { return }

  $arguments = "-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" -InstallDir `"$InstallDir`" -DataDir `"$DataDir`" -Interactive"
  Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Verb RunAs -ArgumentList $arguments | Out-Null
  exit 0
}

function Show-Result([string]$Message, [string]$Title, [string]$Icon) {
  if ($Interactive) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($Message, $Title, 'OK', $Icon) | Out-Null
  }
}

$startedByBackup = $false
try {
  Ensure-Administrator
  foreach ($requiredFile in @($configPath, $pgCtl, $pgDump, $backupScript)) {
    if (-not (Test-Path -LiteralPath $requiredFile)) { throw "Required backup file is missing: $requiredFile" }
  }

  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  New-Item -ItemType Directory -Force -Path $logDir, $backupDir | Out-Null
  $env:NODE_ENV = 'development'
  $env:DATABASE_URL = "postgresql://$($config.databaseUser):$($config.databasePassword)@127.0.0.1:$($config.databasePort)/$($config.databaseName)"
  $env:BACKUP_DIR = $backupDir

  & $pgCtl status -D $postgresDir *> $null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $postgresDir -l (Join-Path $logDir 'postgres.log') -o "-p $($config.databasePort)" -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start for the backup.' }
    $startedByBackup = $true
  }

  & (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoLogo -NoProfile -ExecutionPolicy Bypass -File $backupScript -OutputDirectory $backupDir -RetentionDays 30 -PgDumpPath $pgDump
  if ($LASTEXITCODE -ne 0) { throw "The backup command failed with exit code $LASTEXITCODE." }
  Show-Result "Backup completed successfully.`n`nBackups are stored in:`n$backupDir" 'LabPulse backup complete' 'Information'
} catch {
  $message = $_.Exception.Message
  Show-Result "Backup failed.`n`n$message`n`nReview logs in $logDir." 'LabPulse backup failed' 'Error'
  exit 1
} finally {
  if ($startedByBackup) { & $pgCtl -D $postgresDir -m fast -w stop *> $null }
}
