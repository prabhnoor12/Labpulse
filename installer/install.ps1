param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$DataDir
)

$ErrorActionPreference = 'Stop'
$null = Add-Type -AssemblyName System.Windows.Forms
$null = Add-Type -AssemblyName System.Drawing
$taskName = 'LabPulse Local Stack'
$backupTaskName = 'LabPulse Daily Backup'
$node = Join-Path $InstallDir 'runtime\node.exe'
$initdb = Join-Path $InstallDir 'postgresql\bin\initdb.exe'
$createdb = Join-Path $InstallDir 'postgresql\bin\createdb.exe'
$pgCtl = Join-Path $InstallDir 'postgresql\bin\pg_ctl.exe'
$dataPath = Join-Path $DataDir 'data\postgres'
$configDir = Join-Path $DataDir 'config'
$logDir = Join-Path $DataDir 'logs'
$configPath = Join-Path $configDir 'local.json'
$server = Join-Path $InstallDir 'server\bootstrap.cjs'

function Fail([string]$Message) {
  Write-Host "`nINSTALLATION FAILED: $Message" -ForegroundColor Red
  try { [System.Windows.Forms.MessageBox]::Show($Message, 'LabPulse setup failed', 'OK', 'Error') | Out-Null } catch { }
  exit 1
}

function Read-SetupDetails {
  $form = New-Object System.Windows.Forms.Form
  $form.Text = 'LabPulse first-time setup'
  $form.StartPosition = 'CenterScreen'
  $form.Size = New-Object System.Drawing.Size(520, 430)
  $form.MinimumSize = New-Object System.Drawing.Size(520, 430)
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $form.FormBorderStyle = 'FixedDialog'

  $title = New-Object System.Windows.Forms.Label
  $title.Text = 'Set up your laboratory'
  $title.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
  $title.Location = New-Object System.Drawing.Point(28, 20)
  $title.AutoSize = $true
  [void]$form.Controls.Add($title)

  $subtitle = New-Object System.Windows.Forms.Label
  $subtitle.Text = 'Create the first laboratory owner account. You can add staff after signing in.'
  $subtitle.ForeColor = [System.Drawing.Color]::DimGray
  $subtitle.Location = New-Object System.Drawing.Point(30, 55)
  $subtitle.Size = New-Object System.Drawing.Size(450, 35)
  [void]$form.Controls.Add($subtitle)

  $fields = @(
    @{ Label = 'Laboratory name'; Top = 100; Password = $false },
    @{ Label = 'Owner name'; Top = 145; Password = $false },
    @{ Label = 'Owner email'; Top = 190; Password = $false },
    @{ Label = 'Owner password (minimum 12 characters)'; Top = 235; Password = $true },
    @{ Label = 'Repeat owner password'; Top = 280; Password = $true }
  )
  $inputs = @{}
  foreach ($field in $fields) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $field.Label
    $label.Location = New-Object System.Drawing.Point(30, $field.Top)
    $label.Size = New-Object System.Drawing.Size(250, 20)
    [void]$form.Controls.Add($label)

    $input = New-Object System.Windows.Forms.TextBox
    $input.Location = New-Object System.Drawing.Point(285, ($field.Top - 3))
    $input.Size = New-Object System.Drawing.Size(195, 24)
    $input.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    if ($field.Password) { $input.UseSystemPasswordChar = $true }
    [void]$form.Controls.Add($input)
    $inputs[$field.Label] = $input
  }

  $status = New-Object System.Windows.Forms.Label
  $status.ForeColor = [System.Drawing.Color]::Firebrick
  $status.Location = New-Object System.Drawing.Point(30, 315)
  $status.Size = New-Object System.Drawing.Size(450, 30)
  [void]$form.Controls.Add($status)

  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = 'Cancel'
  $cancel.Location = New-Object System.Drawing.Point(300, 355)
  $cancel.Size = New-Object System.Drawing.Size(85, 30)
  $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
  [void]$form.Controls.Add($cancel)

  $continue = New-Object System.Windows.Forms.Button
  $continue.Text = 'Continue'
  $continue.Location = New-Object System.Drawing.Point(390, 355)
  $continue.Size = New-Object System.Drawing.Size(90, 30)
  $continue.DialogResult = [System.Windows.Forms.DialogResult]::None
  $continue.Add_Click({
    $labName = $inputs['Laboratory name'].Text.Trim()
    $ownerName = $inputs['Owner name'].Text.Trim()
    $ownerEmail = $inputs['Owner email'].Text.Trim()
    $ownerPassword = $inputs['Owner password (minimum 12 characters)'].Text
    $repeatPassword = $inputs['Repeat owner password'].Text

    if ([string]::IsNullOrWhiteSpace($labName) -or [string]::IsNullOrWhiteSpace($ownerName) -or [string]::IsNullOrWhiteSpace($ownerEmail)) {
      $status.Text = 'Complete all laboratory and owner fields.'
      return
    }
    try { $mailAddress = New-Object System.Net.Mail.MailAddress($ownerEmail) } catch { $status.Text = 'Enter a valid owner email address.'; return }
    if ($mailAddress.Address -ne $ownerEmail) { $status.Text = 'Enter a valid owner email address.'; return }
    if ($ownerPassword.Length -lt 12) { $status.Text = 'The owner password must contain at least 12 characters.'; return }
    if ($ownerPassword -cne $repeatPassword) { $status.Text = 'The owner passwords do not match.'; return }

    $form.Tag = [pscustomobject]@{ LabName = $labName; OwnerName = $ownerName; OwnerEmail = $ownerEmail; OwnerPassword = $ownerPassword }
    $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Close()
  })
  [void]$form.Controls.Add($continue)
  $form.AcceptButton = $continue
  $form.CancelButton = $cancel
  $form.Add_Shown({ $inputs['Laboratory name'].Focus() })

  $result = $form.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK -or -not $form.Tag) { Fail 'Setup was cancelled.' }
  return $form.Tag
}

function Protect-DataDirectory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }

  # The local database, configuration, logs, and backups contain credentials
  # and patient data. Keep access limited to Windows administrators and SYSTEM
  # (the scheduled task runs as SYSTEM).
  & icacls.exe $Path /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /remove:g '*S-1-5-11' '*S-1-5-32-545' /T /C *> $null
  if ($LASTEXITCODE -gt 1) { Fail "Unable to protect the LabPulse data directory: $Path" }
}

foreach ($requiredFile in @($node, $initdb, $createdb, $pgCtl, $server)) {
  if (-not (Test-Path -LiteralPath $requiredFile)) { Fail "Required installation file is missing: $requiredFile" }
}

New-Item -ItemType Directory -Force -Path $configDir, $logDir, (Join-Path $DataDir 'backups') | Out-Null
Protect-DataDirectory $DataDir

$existingConfig = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } else { $null }
if ($existingConfig) {
  $config = $existingConfig
  $isNewDatabase = -not (Test-Path -LiteralPath (Join-Path (Join-Path $DataDir 'data') 'postgres\PG_VERSION'))
} else {
  $isNewDatabase = $true
  $config = [pscustomobject]@{
    databaseName = 'labpulse'
    databaseUser = 'labpulse'
    databasePassword = "lp-$([Guid]::NewGuid().ToString('N'))"
    databasePort = 5433
    appPort = 3710
  }
}

try { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue } catch { }
try { Stop-ScheduledTask -TaskName $backupTaskName -ErrorAction SilentlyContinue } catch { }

if ($isNewDatabase) {
  $setup = Read-SetupDetails
  $labName = $setup.LabName
  $ownerName = $setup.OwnerName
  $ownerEmail = $setup.OwnerEmail
  $ownerPassword = $setup.OwnerPassword

  New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
  $passwordFile = Join-Path $configDir 'initdb-password.tmp'
  try {
    [System.IO.File]::WriteAllText($passwordFile, $config.databasePassword, (New-Object System.Text.UTF8Encoding($false)))
    & $initdb -D $dataPath -U $config.databaseUser --pwfile=$passwordFile --auth-host=scram-sha-256 --auth-local=scram-sha-256
    if ($LASTEXITCODE -ne 0) { Fail 'PostgreSQL database initialization failed.' }
  } finally {
    Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
  }

  $env:NODE_ENV = 'development'
  $env:HOST = '127.0.0.1'
  $env:DATABASE_URL = "postgresql://$($config.databaseUser):$($config.databasePassword)@127.0.0.1:$($config.databasePort)/$($config.databaseName)"
  $env:DATABASE_SSL = 'false'
  $env:COOKIE_SECURE = 'false'
  $env:FRONTEND_ORIGINS = "http://127.0.0.1:$($config.appPort),http://localhost:$($config.appPort)"
  $env:MIGRATIONS_DIR = Join-Path $InstallDir 'server\migrations'

  & $pgCtl -D $dataPath -l (Join-Path $logDir 'postgres.log') -o "-p $($config.databasePort)" -w start
  if ($LASTEXITCODE -ne 0) { Fail 'PostgreSQL could not start for first-time setup.' }
  try {
    $env:PGPASSWORD = $config.databasePassword
    & $createdb -h 127.0.0.1 -p $config.databasePort -U $config.databaseUser $config.databaseName
    if ($LASTEXITCODE -ne 0) { Fail 'The LabPulse PostgreSQL database could not be created.' }
    $env:BOOTSTRAP_LAB_NAME = $labName
    $env:BOOTSTRAP_ADMIN_NAME = $ownerName
    $env:BOOTSTRAP_ADMIN_EMAIL = $ownerEmail
    $env:BOOTSTRAP_ADMIN_PASSWORD = $ownerPassword
    & $node $server
    if ($LASTEXITCODE -ne 0) { Fail 'The first laboratory owner could not be created.' }
  } finally {
    Remove-Item Env:PGPASSWORD, Env:BOOTSTRAP_LAB_NAME, Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    & $pgCtl -D $dataPath -m fast -w stop *> $null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json), $utf8NoBom)
}

$runner = Join-Path $InstallDir 'installer\run-local-stack.ps1'
$backupRunner = Join-Path $InstallDir 'installer\backup-local.ps1'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$runner`" -InstallDir `"$InstallDir`" -DataDir `"$DataDir`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description 'Starts the local LabPulse PostgreSQL database and API.' -Force | Out-Null
$backupAction = New-ScheduledTaskAction -Execute $powershell -Argument "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$backupRunner`" -InstallDir `"$InstallDir`" -DataDir `"$DataDir`""
$backupTrigger = New-ScheduledTaskTrigger -Daily -At '02:00'
$backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $backupTaskName -Action $backupAction -Trigger $backupTrigger -Principal $principal -Settings $backupSettings -Description 'Creates a verified daily LabPulse PostgreSQL backup.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

$appUrl = "http://localhost:$($config.appPort)"
$ready = $false
for ($attempt = 1; $attempt -le 45; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri "$appUrl/ready" -TimeoutSec 2
    if ($health.status -eq 'ready') { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ready) {
  Get-ScheduledTaskInfo -TaskName $taskName | Format-List | Out-Host
  Fail "LabPulse did not become ready at $appUrl. Review logs in $logDir."
}

Write-Host "`nLabPulse is ready: $appUrl" -ForegroundColor Green
try { Start-ScheduledTask -TaskName $backupTaskName } catch { Write-Host 'The initial backup could not be started; the daily backup task remains configured.' -ForegroundColor Yellow }
Start-Process $appUrl
