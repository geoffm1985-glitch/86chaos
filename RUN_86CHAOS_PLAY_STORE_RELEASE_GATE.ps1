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
$SlimDir = Join-Path $Root "test-results\86chaos-release-gate-SLIM-UPLOAD-ME"
$SlimZipPath = Join-Path $Root "86chaos-release-gate-SLIM-UPLOAD-ME.zip"
$FullZipPath = Join-Path $Root "86chaos-universal-release-gate-UPLOAD-ME-$RunId.zip"

function New-Slim-ReleaseGateReport {
  param(
    [string]$SourceDir,
    [string]$DestinationDir,
    [string]$ZipPath
  )

  if (!(Test-Path $SourceDir)) {
    Write-Host "Release-gate results folder was not found, so no upload ZIP was created." -ForegroundColor Yellow
    return
  }

  Remove-Item $DestinationDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $DestinationDir | Out-Null

  $allowed = @('.txt', '.log', '.json', '.md', '.html', '.xml', '.csv')
  $sourceRoot = (Resolve-Path $SourceDir).Path
  Get-ChildItem $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      $allowed -contains $_.Extension.ToLowerInvariant() -and
      $_.FullName -notmatch 'node_modules|\.png$|\.jpg$|\.jpeg$|\.webm$|\.mp4$|trace\.zip|\.zip$|\coverage\|\build\|\.git\' -and
      $_.Length -lt 5MB
    } |
    ForEach-Object {
      $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart('\')
      $target = Join-Path $DestinationDir $relative
      New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
      Copy-Item $_.FullName $target -Force
    }

  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue }
  if ((Get-ChildItem $DestinationDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0) {
    Set-Content (Join-Path $DestinationDir 'release-gate-empty-report.txt') "No text/log/json/html/xml/csv report files were available to copy from $SourceDir."
  }
  Compress-Archive -Path "$DestinationDir\*" -DestinationPath $ZipPath -Force
  Write-Host ""
  Write-Host "Slim release-gate upload ZIP created:" -ForegroundColor Cyan
  Write-Host $ZipPath -ForegroundColor Cyan
}

New-Slim-ReleaseGateReport -SourceDir $ResultsDir -DestinationDir $SlimDir -ZipPath $SlimZipPath

if ($env:CHAOS_RELEASE_GATE_FULL_ZIP -eq 'true' -and (Test-Path $ResultsDir)) {
  Compress-Archive -Path "$ResultsDir\*" -DestinationPath $FullZipPath -Force
  Write-Host ""
  Write-Host "Full release-gate ZIP created because CHAOS_RELEASE_GATE_FULL_ZIP=true:" -ForegroundColor Yellow
  Write-Host $FullZipPath -ForegroundColor Yellow
}

if ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0) {
  Write-Host ""
  Write-Host "Release gate finished with failures. Upload 86chaos-release-gate-SLIM-UPLOAD-ME.zip." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Release gate passed." -ForegroundColor Green
exit 0
