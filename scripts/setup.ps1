param(
  [switch]$SkipOpen,
  [switch]$SkipBootstrap
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "`nSETUP FAILED: $Message" -ForegroundColor Red
  exit 1
}

function New-Secret {
  return "lp-$([Guid]::NewGuid().ToString('N'))-$([Guid]::NewGuid().ToString('N'))"
}

function Read-Required([string]$Prompt) {
  do { $value = Read-Host $Prompt } while ([string]::IsNullOrWhiteSpace($value))
  return $value.Trim()
}

function Read-PasswordConfirmed {
  $first = Read-Host 'Owner password (minimum 12 characters)' -AsSecureString
  $second = Read-Host 'Repeat owner password' -AsSecureString
  $firstBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
  $secondBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
  try {
    $firstText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstBstr)
    $secondText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondBstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstBstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondBstr)
  }
  if ($firstText.Length -lt 12) { Fail 'The owner password must contain at least 12 characters.' }
  if ($firstText -cne $secondText) { Fail 'The owner passwords do not match.' }
  return $firstText
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail 'Docker Desktop is not installed or is not available on PATH. Install Docker Desktop, start it, and run this setup again.'
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Fail 'Docker Desktop is installed but is not running. Start Docker Desktop and run this setup again.'
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
  Fail 'The Docker Compose plugin is unavailable. Update Docker Desktop and run this setup again.'
}

$envFile = Join-Path $projectRoot '.env'
$webPort = 8080
$appDomain = 'localhost'

if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Host 'LabPulse first-time setup' -ForegroundColor Cyan
  Write-Host 'This creates a local production deployment at http://localhost:8080.'
  $labName = Read-Required 'Laboratory name'
  $ownerName = Read-Required 'Owner name'
  $ownerEmail = Read-Required 'Owner email'
  $ownerPassword = Read-PasswordConfirmed
  $databasePassword = New-Secret

  $envContent = @"
POSTGRES_DB=labpulse
POSTGRES_USER=labpulse
POSTGRES_PASSWORD=$databasePassword
NODE_ENV=development
APP_DOMAIN=localhost
WEB_HTTP_PORT=8080
WEB_HTTPS_PORT=8443
FRONTEND_ORIGINS=http://localhost:8080
COOKIE_SECURE=false
DATABASE_SSL=false
SESSION_TTL_DAYS=7
PUBLIC_REPORT_TTL_DAYS=30
"@
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($envFile, $envContent, $utf8NoBom)
} else {
  Write-Host 'Using the existing .env configuration.' -ForegroundColor Yellow
  $portLine = Select-String -LiteralPath $envFile -Pattern '^WEB_HTTP_PORT=' | Select-Object -First 1
  if ($portLine) { $webPort = [int]($portLine.Line -replace '^WEB_HTTP_PORT=', '') }
  $domainLine = Select-String -LiteralPath $envFile -Pattern '^APP_DOMAIN=' | Select-Object -First 1
  if ($domainLine) { $appDomain = $domainLine.Line -replace '^APP_DOMAIN=', '' }
  if (-not $SkipBootstrap) {
    $ownerEmail = Read-Required 'Owner email'
    $ownerPassword = Read-PasswordConfirmed
    $labName = Read-Required 'Laboratory name'
    $ownerName = Read-Required 'Owner name'
  }
}

Write-Host "`nBuilding and starting PostgreSQL, API, and web gateway..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  docker compose logs --tail 80 postgres backend web
  Fail 'Docker services could not start. Review the logs above.'
}

$appUrl = if ($appDomain -eq 'localhost' -or $appDomain -eq '127.0.0.1') { "http://$appDomain`:$webPort" } else { "https://$appDomain" }
$ready = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri "$appUrl/ready" -TimeoutSec 3
    if ($health.status -eq 'ready') { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ready) {
  docker compose ps
  docker compose logs --tail 80 postgres backend web
  Fail "The application did not become ready at $appUrl."
}

if (-not $SkipBootstrap) {
  Write-Host 'Creating the first lab owner...' -ForegroundColor Cyan
  docker compose run --rm -T `
    -e "BOOTSTRAP_LAB_NAME=$labName" `
    -e "BOOTSTRAP_ADMIN_NAME=$ownerName" `
    -e "BOOTSTRAP_ADMIN_EMAIL=$ownerEmail" `
    -e "BOOTSTRAP_ADMIN_PASSWORD=$ownerPassword" `
    backend node dist/bootstrap.cjs
  if ($LASTEXITCODE -ne 0) {
    Fail 'The owner could not be created. The database may already contain an owner, or the email may already be registered. Use -SkipBootstrap for an existing installation.'
  }
}

Write-Host "`nLabPulse is ready: $appUrl" -ForegroundColor Green
if (-not $SkipOpen) { Start-Process $appUrl }
