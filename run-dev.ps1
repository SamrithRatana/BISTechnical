<#
.SYNOPSIS
    Starts the TechnicalService.API, UserManagementAPI backend, and TestingReact Next.js UI
    together for local testing, each in its own window.

.DESCRIPTION
    - TechnicalService.API runs on http://localhost:8000
    - UserManagementAPI runs on http://localhost:8087
    - TestingReact runs npm run dev on http://localhost:3000
    - Close any spawned window (or Ctrl+C inside it) to stop that process.

.USAGE
    From the repo root:
        .\run-dev.ps1
    With HTTPS (required for mobile phone camera / Face Scan pairing):
        .\run-dev.ps1 -Https
    Skip any component if needed:
        .\run-dev.ps1 -SkipApi
        .\run-dev.ps1 -SkipUserApi
        .\run-dev.ps1 -SkipUi
#>
param(
    [switch]$SkipApi,
    [switch]$SkipUserApi,
    [switch]$SkipUi,
    [switch]$Https,
    [switch]$Mobile,
    [switch]$Wait
)

$ErrorActionPreference = "Stop"
$processes = @()
$root = $PSScriptRoot
$apiProject = Join-Path $root "src\APIs\TechnicalService.API\TechnicalService.API.csproj"
$userApiProject = Join-Path $root "src\APIs\UserManagementAPI\UserManagementAPI.csproj"
$uiDir = Join-Path $root "TestingReact"
$mobileDir = Join-Path $root "CamIdMobile"
if (-not (Test-Path (Join-Path $mobileDir "package.json"))) {
    $altMobile = Join-Path $root "..\..\CamIdMobile\CamIdMobile"
    if (Test-Path (Join-Path $altMobile "package.json")) {
        $mobileDir = (Resolve-Path $altMobile).Path
    }
}

if (-not $SkipApi) {
    if (-not (Test-Path $apiProject)) {
        throw "API project not found at $apiProject"
    }
    if (-not (Test-Path (Join-Path $root "src\APIs\TechnicalService.API\appsettings.json"))) {
        throw "appsettings.json missing for TechnicalService.API - copy appsettings.json.example and fill in real values first (see CLAUDE.md)."
    }
    Write-Host "Starting TechnicalService.API (http://localhost:8000) ..." -ForegroundColor Cyan
    $processes += Start-Process powershell -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoExit", "-Command",
        "[Console]::Title = 'TechnicalService.API (8000)'; cd '$root'; dotnet run --project '$apiProject' --launch-profile http"
    ) -PassThru
}

if (-not $SkipUserApi) {
    if (Test-Path $userApiProject) {
        Write-Host "Starting UserManagementAPI (http://localhost:8087) ..." -ForegroundColor Cyan
        $processes += Start-Process powershell -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-NoExit", "-Command",
            "[Console]::Title = 'UserManagementAPI (8087)'; cd '$root'; dotnet run --project '$userApiProject' --launch-profile http"
        ) -PassThru
    }
}

if (-not $SkipUi) {
    if (-not (Test-Path (Join-Path $uiDir "package.json"))) {
        throw "TestingReact/package.json not found at $uiDir"
    }
    if (-not (Test-Path (Join-Path $uiDir ".env.local"))) {
        throw "TestingReact/.env.local missing - copy .env.local.example and fill in real values first (see CLAUDE.md)."
    }
    if (-not (Test-Path (Join-Path $uiDir "node_modules"))) {
        Write-Host "node_modules missing - running npm install first ..." -ForegroundColor Yellow
        Push-Location $uiDir
        npm.cmd install
        Pop-Location
    }
    $devCmd = if ($Https) { "npm.cmd run dev:https" } else { "npm.cmd run dev" }
    $protocol = if ($Https) { "https" } else { "http" }
    Write-Host "Starting TestingReact (${protocol}://localhost:3000) ..." -ForegroundColor Cyan
    $processes += Start-Process powershell -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoExit", "-Command",
        "[Console]::Title = 'TestingReact Frontend (3000)'; cd '$uiDir'; $devCmd"
    ) -PassThru
}

if ($Mobile) {
    if (Test-Path (Join-Path $mobileDir "package.json")) {
        if (-not (Test-Path (Join-Path $mobileDir "node_modules"))) {
            Write-Host "CamIdMobile node_modules missing - running npm install first ..." -ForegroundColor Yellow
            Push-Location $mobileDir
            npm.cmd install
            Pop-Location
        }
        Write-Host "Starting CAM ID Mobile (Expo Metro Bundler) ..." -ForegroundColor Cyan
        $processes += Start-Process powershell -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-NoExit", "-Command",
            "[Console]::Title = 'CAM ID Mobile (Expo)'; cd '$mobileDir'; npm.cmd start"
        ) -PassThru
    }
}

Write-Host "`nAll processes launched in separate windows. Close a window (or Ctrl+C inside it) to stop it." -ForegroundColor Green

if ($Wait -and $processes.Count -gt 0) {
    Write-Host "Keeping runner active while processes run..." -ForegroundColor DarkGray
    $processes | Wait-Process
}
