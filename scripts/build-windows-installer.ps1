param(
  [string]$NodeRuntime = 'installer\vendor\node',
  [string]$PostgreSQLRuntime = 'installer\vendor\postgresql'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

$nodeRuntime = (Resolve-Path $NodeRuntime -ErrorAction SilentlyContinue).Path
$postgresRuntime = (Resolve-Path $PostgreSQLRuntime -ErrorAction SilentlyContinue).Path
if (-not $nodeRuntime -or -not (Test-Path (Join-Path $nodeRuntime 'node.exe'))) {
  Fail "Node runtime missing. Place node.exe and its runtime files in $NodeRuntime."
}
foreach ($requiredBinary in @('bin\initdb.exe', 'bin\createdb.exe', 'bin\pg_ctl.exe', 'bin\postgres.exe')) {
  if (-not $postgresRuntime -or -not (Test-Path (Join-Path $postgresRuntime $requiredBinary))) {
    Fail "PostgreSQL runtime is incomplete. Missing $requiredBinary under $PostgreSQLRuntime."
  }
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) { Fail 'The application build failed.' }

$releaseDir = Join-Path $projectRoot 'installer\release'
if (Test-Path -LiteralPath $releaseDir) { Remove-Item -LiteralPath $releaseDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$releaseDir\runtime", "$releaseDir\postgresql", "$releaseDir\server\migrations", "$releaseDir\web", "$releaseDir\installer" | Out-Null

Copy-Item -Path (Join-Path $nodeRuntime '*') -Destination "$releaseDir\runtime" -Recurse -Force
Copy-Item -Path (Join-Path $postgresRuntime '*') -Destination "$releaseDir\postgresql" -Recurse -Force
Copy-Item -Path 'dist\backend.cjs', 'dist\backend.cjs.map', 'dist\bootstrap.cjs', 'dist\bootstrap.cjs.map' -Destination "$releaseDir\server" -Force
Copy-Item -Path 'backend\src\db\migrations\*' -Destination "$releaseDir\server\migrations" -Recurse -Force
Get-ChildItem -LiteralPath 'dist' -File | Where-Object { $_.Name -notmatch '\.cjs(\.map)?$' } | Copy-Item -Destination "$releaseDir\web" -Force
Copy-Item -Path 'installer\install.ps1', 'installer\run-local-stack.ps1', 'installer\backup-local.ps1', 'installer\restore-local.ps1', 'installer\uninstall.ps1', 'backend\scripts\backup.ps1', 'backend\scripts\postgres-connection.ps1', 'backend\scripts\restore.ps1' -Destination "$releaseDir\installer" -Force

$isccCommand = Get-Command iscc -ErrorAction SilentlyContinue
$isccPath = if ($isccCommand) { $isccCommand.Source } else { $null }
if (-not $isccPath) {
  $knownIscc = @(
    "$env:ProgramFiles\Inno Setup 7\ISCC.exe",
    "$env:ProgramFiles(x86)\Inno Setup 7\ISCC.exe",
    "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($knownIscc) { $isccPath = $knownIscc }
}
if (-not $isccPath) {
  Write-Host "Release files prepared at $releaseDir, but Inno Setup 6 (ISCC.exe) is not installed." -ForegroundColor Yellow
  Write-Host 'Install Inno Setup 6, then rerun this script to create the installer executable.' -ForegroundColor Yellow
  exit 0
}

$env:LABPULSE_INSTALLER_SOURCE = $releaseDir
& $isccPath (Join-Path $projectRoot 'installer\LabPulse.iss')
if ($LASTEXITCODE -ne 0) { Fail 'Inno Setup failed to compile the installer.' }
Write-Host "Installer created in $projectRoot\installer\output" -ForegroundColor Green
