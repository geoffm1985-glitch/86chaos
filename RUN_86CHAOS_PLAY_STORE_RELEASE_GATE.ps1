$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$RunId = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$env:CHAOS_RELEASE_GATE_RUN_ID = $RunId
$env:CHAOS_RELEASE_GATE_STEP_FAILURES = "0"

Write-Host "86 Chaos Play Store Release Gate" -ForegroundColor Cyan
Write-Host "Run ID: $RunId" -ForegroundColor Cyan

function Run-Step {
  param(
    [string]$Name,
    [string]$Command
  )

  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Yellow
  powershell -NoProfile -ExecutionPolicy Bypass -Command $Command

  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $Name" -ForegroundColor Red
    $count = 0
    [int]::TryParse($env:CHAOS_RELEASE_GATE_STEP_FAILURES, [ref]$count) | Out-Null
    $env:CHAOS_RELEASE_GATE_STEP_FAILURES = [string]($count + 1)
  } else {
    Write-Host "PASSED: $Name" -ForegroundColor Green
  }
}

Run-Step "Node version" "npm run node:check --if-present"
Run-Step "Lockfile integrity" "npm run lock:integrity --if-present"
Run-Step "Source validation" "npm run test:source --if-present"
Run-Step "API syntax" "npm run syntax:api --if-present"
Run-Step "Python syntax" "npm run syntax:py --if-present"
Run-Step "Performance split" "npm run performance:split --if-present"
Run-Step "Client tests" "npm run test:client -- --runInBand"

if (Test-Path ".\scripts\86chaos-release-gate\preflight-env.cjs") {
  Run-Step "Environment preflight" "node scripts/86chaos-release-gate/preflight-env.cjs"
}
if (Test-Path ".\scripts\86chaos-release-gate\source-inventory.cjs") {
  Run-Step "Source inventory" "node scripts/86chaos-release-gate/source-inventory.cjs"
}

Run-Step "Playwright release gate" "npx playwright test --config .\playwright.play-store-release.config.cjs"

if (Test-Path ".\scripts\86chaos-release-gate\collect-release-gate-report.cjs") {
  Run-Step "Collect report" "node scripts/86chaos-release-gate/collect-release-gate-report.cjs"
}

$ResultsDir = Join-Path $Root "test-results\86chaos-play-store-release-gate"
$ZipPath = Join-Path $Root "86chaos-universal-release-gate-UPLOAD-ME-$RunId.zip"

if (Test-Path $ResultsDir) {
  Compress-Archive -Path "$ResultsDir\*" -DestinationPath $ZipPath -Force
  Write-Host ""
  Write-Host "Release gate ZIP created:" -ForegroundColor Cyan
  Write-Host $ZipPath -ForegroundColor Cyan
}

if ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0) {
  Write-Host ""
  Write-Host "Release gate finished with failures. Upload the ZIP it created, or create a slim report if the ZIP is too large." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Release gate passed." -ForegroundColor Green
exit 0
