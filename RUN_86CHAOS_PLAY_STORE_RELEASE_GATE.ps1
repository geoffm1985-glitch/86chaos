$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$RunId = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$env:CHAOS_RELEASE_GATE_RUN_ID = $RunId
$env:CHAOS_FULL_AUDIT_RUN_ID = $RunId
$env:CHAOS_RELEASE_GATE_STEP_FAILURES = "0"

$ResultsDir = Join-Path $Root "test-results\86chaos-play-store-release-gate"
$SlimDir = Join-Path $Root "test-results\86chaos-release-gate-SLIM-UPLOAD-ME"
$SlimZipPath = Join-Path $Root "86chaos-release-gate-SLIM-UPLOAD-ME.zip"
$FullZipPath = Join-Path $Root "86chaos-universal-release-gate-UPLOAD-ME-$RunId.zip"
$RunnerLogDir = Join-Path $ResultsDir "runner-logs"
New-Item -ItemType Directory -Force $ResultsDir | Out-Null
New-Item -ItemType Directory -Force $RunnerLogDir | Out-Null

$StepResults = @()

Write-Host "86 Chaos Play Store Release Gate" -ForegroundColor Cyan
Write-Host "Run ID: $RunId" -ForegroundColor Cyan
Write-Host "Slim upload report only by default." -ForegroundColor Cyan

function Add-StepResult {
  param(
    [string]$Name,
    [int]$ExitCode,
    [string]$LogPath
  )
  $script:StepResults += [pscustomobject]@{
    name = $Name
    exitCode = $ExitCode
    passed = ($ExitCode -eq 0)
    logPath = $LogPath
  }
}

function Run-Step {
  param(
    [string]$Name,
    [string]$Command
  )

  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Yellow
  $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_').Trim('_')
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "step" }
  $LogPath = Join-Path $RunnerLogDir ("{0}-{1}.log" -f $RunId, $safeName)
  "=== $Name ===`nCommand: $Command`nStarted: $(Get-Date -Format o)`n" | Set-Content $LogPath

  powershell -NoProfile -ExecutionPolicy Bypass -Command $Command 2>&1 | Tee-Object -FilePath $LogPath -Append
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  "`nFinished: $(Get-Date -Format o)`nExitCode: $exitCode" | Add-Content $LogPath

  Add-StepResult -Name $Name -ExitCode $exitCode -LogPath $LogPath
  if ($exitCode -ne 0) {
    Write-Host "FAILED: $Name" -ForegroundColor Red
    $count = 0
    [int]::TryParse($env:CHAOS_RELEASE_GATE_STEP_FAILURES, [ref]$count) | Out-Null
    $env:CHAOS_RELEASE_GATE_STEP_FAILURES = [string]($count + 1)
  } else {
    Write-Host "PASSED: $Name" -ForegroundColor Green
  }
}

function Write-RunnerSummary {
  $summaryPath = Join-Path $ResultsDir ("86chaos-release-gate-runner-summary-$RunId.txt")
  $jsonPath = Join-Path $ResultsDir ("86chaos-release-gate-runner-summary-$RunId.json")
  $failed = @($StepResults | Where-Object { -not $_.passed })
  $lines = @(
    "86 CHAOS RELEASE GATE RUNNER SUMMARY",
    "Generated: $(Get-Date -Format o)",
    "Run ID: $RunId",
    "Root: $Root",
    "APP_URL: $env:APP_URL",
    "CHAOS_BASE_URL: $env:CHAOS_BASE_URL",
    "CHAOS_EXPECTED_VERSION: $env:CHAOS_EXPECTED_VERSION",
    "Step failures: $($failed.Count)",
    "",
    "STEPS"
  )
  foreach ($step in $StepResults) {
    $lines += "- $($step.name): $(if ($step.passed) { 'PASS' } else { 'FAIL' }) exit=$($step.exitCode) log=$($step.logPath)"
  }
  if ($failed.Count -gt 0) {
    $lines += ""
    $lines += "FAILED STEP LOG EXCERPTS"
    foreach ($step in $failed) {
      $lines += ""
      $lines += "=============================="
      $lines += "FAILED STEP: $($step.name)"
      $lines += "LOG: $($step.logPath)"
      $lines += "=============================="
      if (Test-Path $step.logPath) {
        $lines += Get-Content $step.logPath -Tail 220
      } else {
        $lines += "Log file missing."
      }
    }
  }
  $lines | Set-Content $summaryPath
  ($StepResults | ConvertTo-Json -Depth 6) | Set-Content $jsonPath
}

function New-Slim-ReleaseGateReport {
  param(
    [string]$SourceDir,
    [string]$DestinationDir,
    [string]$ZipPath
  )

  Remove-Item $DestinationDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $DestinationDir | Out-Null
  $allowed = @('.txt', '.log', '.json', '.md', '.html', '.xml', '.csv')
  $sourceRoots = @(
    $SourceDir,
    (Join-Path $Root 'playwright-report'),
    (Join-Path $Root 'test-results')
  ) | Where-Object { Test-Path $_ } | Select-Object -Unique

  foreach ($sourceRootItem in $sourceRoots) {
    $sourceRoot = (Resolve-Path $sourceRootItem).Path
    Get-ChildItem $sourceRootItem -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $ext = $_.Extension.ToLowerInvariant()
        $allowed -contains $ext -and
        $_.FullName -notmatch 'node_modules|\.png$|\.jpg$|\.jpeg$|\.webm$|\.mp4$|trace\.zip|\.zip$|\\coverage\\|\\build\\|\\.git\\|playwright-artifacts' -and
        $_.Length -lt 5MB
      } |
      ForEach-Object {
        $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart('\')
        $rootLabel = Split-Path $sourceRoot -Leaf
        $target = Join-Path $DestinationDir (Join-Path $rootLabel $relative)
        New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
        Copy-Item $_.FullName $target -Force
      }
  }

  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue }
  $copiedCount = (Get-ChildItem $DestinationDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  if ($copiedCount -eq 0) {
    Set-Content (Join-Path $DestinationDir 'release-gate-empty-report.txt') "No report files were copied. This should be rare. Check whether the release-gate command started, whether test-results exists, and whether antivirus/file locks blocked report writes."
  }
  Compress-Archive -Path "$DestinationDir\*" -DestinationPath $ZipPath -Force
  Write-Host ""
  Write-Host "Slim release-gate upload ZIP created:" -ForegroundColor Cyan
  Write-Host $ZipPath -ForegroundColor Cyan
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

$PlaywrightConfig = ".\playwright.play-store-release.config.cjs"
if (!(Test-Path $PlaywrightConfig)) { $PlaywrightConfig = ".\playwright.config.js" }
Run-Step "Playwright release gate" "npx playwright test --config $PlaywrightConfig"

if (Test-Path ".\scripts\86chaos-release-gate\collect-release-gate-report.cjs") {
  Run-Step "Collect report" "node scripts/86chaos-release-gate/collect-release-gate-report.cjs"
}

Write-RunnerSummary
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
