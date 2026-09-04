[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$DataDir,
  [string]$BackupFile = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$taskName = 'LabPulse Local Stack'
$configPath = Join-Path $DataDir 'config\local.json'
$postgresDir = Join-Path $DataDir 'data\postgres'
$logDir = Join-Path $DataDir 'logs'
$pgCtl = Join-Path $InstallDir 'postgresql\bin\pg_ctl.exe'
$pgRestore = Join-Path $InstallDir 'postgresql\bin\pg_restore.exe'
$restoreScript = Join-Path $InstallDir 'installer\restore.ps1'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Show-Result([string]$Message, [string]$Title, [string]$Icon) {
  [System.Windows.Forms.MessageBox]::Show($Message, $Title, 'OK', $Icon) | Out-Null
}

function Ensure-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { return }

  $arguments = "-NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File `"$PSCommandPath`" -InstallDir `"$InstallDir`" -DataDir `"$DataDir`""
  if ($BackupFile) { $arguments += " -BackupFile `"$BackupFile`"" }
  Start-Process -FilePath $powershell -Verb RunAs -ArgumentList $arguments | Out-Null
  exit 0
}

try {
  Ensure-Administrator
  if (-not $BackupFile) {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Select a LabPulse backup'
    $dialog.Filter = 'LabPulse backups (*.dump)|*.dump|All files (*.*)|*.*'
    $dialog.InitialDirectory = Join-Path $DataDir 'backups'
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
    $BackupFile = $dialog.FileName
  }

  $resolvedBackup = (Resolve-Path -LiteralPath $BackupFile -ErrorAction Stop).Path
  $confirmation = [System.Windows.Forms.MessageBox]::Show(
    "Restore this backup?`n`n$resolvedBackup`n`nCurrent reports and settings will be replaced by the selected backup.",
    'Confirm LabPulse restore',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  )
  if ($confirmation -ne [System.Windows.Forms.DialogResult]::Yes) { exit 0 }

  foreach ($requiredFile in @($configPath, $pgCtl, $pgRestore, $restoreScript)) {
    if (-not (Test-Path -LiteralPath $requiredFile)) { throw "Required restore file is missing: $requiredFile" }
  }
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $shouldRestart = $false
  try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $shouldRestart = $task.State -ne 'Disabled'
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  } catch { }

  & $pgCtl status -D $postgresDir *> $null
  if ($LASTEXITCODE -eq 0) { & $pgCtl -D $postgresDir -m fast -w stop *> $null }

  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $env:NODE_ENV = 'development'
  $env:DATABASE_URL = "postgresql://$($config.databaseUser):$($config.databasePassword)@127.0.0.1:$($config.databasePort)/$($config.databaseName)"
  & $pgCtl -D $postgresDir -l (Join-Path $logDir 'postgres.log') -o "-p $($config.databasePort)" -w start
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL could not start for the restore.' }
  try {
    & $powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $restoreScript -BackupFile $resolvedBackup -ConfirmRestore -PgRestorePath $pgRestore
    if ($LASTEXITCODE -ne 0) { throw "The restore command failed with exit code $LASTEXITCODE." }
  } finally {
    & $pgCtl -D $postgresDir -m fast -w stop *> $null
  }

  Show-Result 'Restore completed. LabPulse will now restart and reload the restored data.' 'LabPulse restore complete' 'Information'
} catch {
  Show-Result "Restore failed.`n`n$($_.Exception.Message)`n`nReview logs in $logDir." 'LabPulse restore failed' 'Error'
  exit 1
} finally {
  if ($shouldRestart) {
    try { Start-ScheduledTask -TaskName $taskName } catch { }
  }
}
