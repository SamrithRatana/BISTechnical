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
    Skip any component if needed:
        .\run-dev.ps1 -SkipApi
        .\run-dev.ps1 -SkipUserApi
        .\run-dev.ps1 -SkipUi
#>
param(
    [switch]$SkipApi,
    [switch]$SkipUserApi,
    [switch]$SkipUi
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$apiProject = Join-Path $root "src\APIs\TechnicalService.API\TechnicalService.API.csproj"
$userApiProject = Join-Path $root "src\APIs\UserManagementAPI\UserManagementAPI.csproj"
$uiDir = Join-Path $root "TestingReact"

if (-not $SkipApi) {
    if (-not (Test-Path $apiProject)) {
        throw "API project not found at $apiProject"
    }
    if (-not (Test-Path (Join-Path $root "src\APIs\TechnicalService.API\appsettings.json"))) {
        throw "appsettings.json missing for TechnicalService.API - copy appsettings.json.example and fill in real values first (see CLAUDE.md)."
    }
    Write-Host "Starting TechnicalService.API (http://localhost:8000) ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoExit", "-Command",
        "$host.UI.RawUI.WindowTitle = 'TechnicalService.API (8000)'; cd `"$root`"; dotnet run --project `"$apiProject`" --launch-profile http"
    )
}

if (-not $SkipUserApi) {
    if (Test-Path $userApiProject) {
        Write-Host "Starting UserManagementAPI (http://localhost:8087) ..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList @(
            "-ExecutionPolicy", "Bypass",
            "-NoExit", "-Command",
            "$host.UI.RawUI.WindowTitle = 'UserManagementAPI (8087)'; cd `"$root`"; dotnet run --project `"$userApiProject`" --launch-profile http"
        )
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
    Write-Host "Starting TestingReact (http://localhost:3000) ..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-ExecutionPolicy", "Bypass",
        "-NoExit", "-Command",
        "$host.UI.RawUI.WindowTitle = 'TestingReact Frontend (3000)'; cd `"$uiDir`"; npm.cmd run dev"
    )
}

Write-Host "`nAll processes launched in separate windows. Close a window (or Ctrl+C inside it) to stop it." -ForegroundColor Green
