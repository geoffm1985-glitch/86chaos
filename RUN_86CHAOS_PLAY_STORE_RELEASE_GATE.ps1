$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$RunId = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$env:CHAOS_RELEASE_GATE_RUN_ID = $RunId
$env:CHAOS_FULL_AUDIT_RUN_ID = $RunId
$env:CHAOS_RELEASE_GATE_STEP_FAILURES = "0"

$ResultsRoot = Join-Path $Root "test-results\86chaos-play-store-release-gate"
$RunDir = Join-Path $ResultsRoot $RunId
$env:CHAOS_RELEASE_GATE_RUN_DIR = $RunDir
$SlimDir = Join-Path $Root "test-results\86chaos-release-gate-SLIM-UPLOAD-ME"
$SlimZipPath = Join-Path $Root "86chaos-release-gate-SLIM-UPLOAD-ME.zip"
$FullZipPath = Join-Path $Root "86chaos-universal-release-gate-UPLOAD-ME-$RunId.zip"
$RunnerLogDir = Join-Path $RunDir "runner-logs"
New-Item -ItemType Directory -Force $RunDir | Out-Null
New-Item -ItemType Directory -Force $RunnerLogDir | Out-Null

# Remove stale root-level artifacts so the slim ZIP cannot accidentally include old runs.
Get-ChildItem $ResultsRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '.last-run.json' } | Remove-Item -Force -ErrorAction SilentlyContinue
@{ runId = $RunId; runDir = $RunDir; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content (Join-Path $ResultsRoot '.last-run.json')

$StepResults = @()

Write-Host "86 Chaos Play Store Release Gate" -ForegroundColor Cyan
Write-Host "Run ID: $RunId" -ForegroundColor Cyan
Write-Host "Current-run directory: $RunDir" -ForegroundColor Cyan
Write-Host "Slim upload report only by default." -ForegroundColor Cyan

function Add-StepResult {
  param([string]$Name, [int]$ExitCode, [string]$LogPath)
  $script:StepResults += [pscustomobject]@{ name = $Name; exitCode = $ExitCode; passed = ($ExitCode -eq 0); logPath = $LogPath }
}

function Note-StepFailure {
  param([string]$Name, [int]$ExitCode, [string]$LogPath)
  Add-StepResult -Name $Name -ExitCode $ExitCode -LogPath $LogPath
  if ($ExitCode -ne 0) {
    Write-Host "FAILED: $Name" -ForegroundColor Red
    $count = 0
    [int]::TryParse($env:CHAOS_RELEASE_GATE_STEP_FAILURES, [ref]$count) | Out-Null
    $env:CHAOS_RELEASE_GATE_STEP_FAILURES = [string]($count + 1)
  } else {
    Write-Host "PASSED: $Name" -ForegroundColor Green
  }
}

function Run-Step {
  param([string]$Name, [string]$Command)
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Yellow
  $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_').Trim('_')
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "step" }
  $LogPath = Join-Path $RunnerLogDir ("{0}-{1}.log" -f $RunId, $safeName)
  "=== $Name ===`nCommand: $Command`nStarted: $(Get-Date -Format o)`n" | Set-Content $LogPath
  powershell -NoProfile -ExecutionPolicy Bypass -Command $Command 2>&1 | Tee-Object -FilePath $LogPath -Append | Out-Host
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  "`nFinished: $(Get-Date -Format o)`nExitCode: $exitCode" | Add-Content $LogPath
  Note-StepFailure -Name $Name -ExitCode $exitCode -LogPath $LogPath
  return $exitCode
}

function Run-LiveStep {
  param([string]$Name, [string]$Command)
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Yellow
  Write-Host "Live Playwright list output enabled. The slim JSON/log report is still written quietly for upload." -ForegroundColor Cyan
  $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_').Trim('_')
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "step" }
  $LogPath = Join-Path $RunnerLogDir ("{0}-{1}.log" -f $RunId, $safeName)
  "=== $Name ===`nCommand: $Command`nStarted: $(Get-Date -Format o)`nLive console output is printed to the terminal while the step exit code remains scalar for the runner.`n" | Set-Content $LogPath
  powershell -NoProfile -ExecutionPolicy Bypass -Command $Command 2>&1 | ForEach-Object { Add-Content -Path $LogPath -Value $_; Write-Host $_ }
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  "`nFinished: $(Get-Date -Format o)`nExitCode: $exitCode" | Add-Content $LogPath
  Note-StepFailure -Name $Name -ExitCode $exitCode -LogPath $LogPath
  return $exitCode
}

function Write-RunnerSummary {
  $summaryPath = Join-Path $RunDir ("86chaos-release-gate-runner-summary-$RunId.txt")
  $jsonPath = Join-Path $RunDir ("86chaos-release-gate-runner-summary-$RunId.json")
  $failed = @($StepResults | Where-Object { -not $_.passed })
  $lines = @(
    "86 CHAOS RELEASE GATE RUNNER SUMMARY",
    "Generated: $(Get-Date -Format o)",
    "Run ID: $RunId",
    "Root: $Root",
    "Run directory: $RunDir",
    "APP_URL: $env:APP_URL",
    "CHAOS_BASE_URL: $env:CHAOS_BASE_URL",
    "CHAOS_EXPECTED_VERSION: $env:CHAOS_EXPECTED_VERSION",
    "Step failures: $($failed.Count)",
    "",
    "STEPS"
  )
  foreach ($step in $StepResults) { $lines += "- $($step.name): $(if ($step.passed) { 'PASS' } else { 'FAIL' }) exit=$($step.exitCode) log=$($step.logPath)" }
  if ($failed.Count -gt 0) {
    $lines += ""
    $lines += "FAILED STEP LOG EXCERPTS"
    foreach ($step in $failed) {
      $lines += ""
      $lines += "=============================="
      $lines += "FAILED STEP: $($step.name)"
      $lines += "LOG: $($step.logPath)"
      $lines += "=============================="
      if (Test-Path $step.logPath) { $lines += Get-Content $step.logPath -Tail 220 } else { $lines += "Log file missing." }
    }
  }
  $lines | Set-Content $summaryPath
  ($StepResults | ConvertTo-Json -Depth 6) | Set-Content $jsonPath
}

function New-Slim-ReleaseGateReport {
  param([string]$SourceDir, [string]$DestinationDir, [string]$ZipPath)
  Remove-Item $DestinationDir -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $DestinationDir | Out-Null
  $allowed = @('.txt', '.log', '.json', '.md', '.html', '.xml', '.csv')
  if (Test-Path $SourceDir) {
    $sourceRoot = (Resolve-Path $SourceDir).Path
    Get-ChildItem $SourceDir -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $ext = $_.Extension.ToLowerInvariant()
        $allowed -contains $ext -and
        $_.FullName -notmatch 'node_modules|\.png$|\.jpg$|\.jpeg$|\.webm$|\.mp4$|trace\.zip|\.zip$|\\coverage\\|\\build\\|\\.git\\|playwright-artifacts|html-report\\trace|html\\trace|\\86chaos-release-gate-SLIM-UPLOAD-ME\\' -and
        $_.Length -lt 5MB
      } |
      ForEach-Object {
        $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart('\')
        $target = Join-Path $DestinationDir (Join-Path (Split-Path $SourceDir -Leaf) $relative)
        New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
        Copy-Item $_.FullName $target -Force
      }
  }
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue }
  $copiedCount = (Get-ChildItem $DestinationDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  if ($copiedCount -eq 0) { Set-Content (Join-Path $DestinationDir 'release-gate-empty-report.txt') "No current-run report files were copied." }
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

$PreflightExit = 0
if (Test-Path ".\scripts\86chaos-release-gate\preflight-env.cjs") { $PreflightExit = Run-Step "Environment preflight" "node scripts/86chaos-release-gate/preflight-env.cjs" }
if ($PreflightExit -ne 0) {
  Write-Host "Environment preflight failed. Stopping before Playwright/global setup can create QA data against a stale or misconfigured deployment." -ForegroundColor Red
} else {
  if (Test-Path ".\scripts\86chaos-release-gate\source-inventory.cjs") { Run-Step "Source inventory" "node scripts/86chaos-release-gate/source-inventory.cjs" }
  $PlaywrightConfig = ".\playwright.play-store-release.config.cjs"
  if (!(Test-Path $PlaywrightConfig)) { $PlaywrightConfig = ".\playwright.config.js" }
  Run-LiveStep "Playwright release gate" "npx playwright test --config $PlaywrightConfig"
}

if (Test-Path ".\scripts\86chaos-release-gate\collect-release-gate-report.cjs") { Run-Step "Collect report" "node scripts/86chaos-release-gate/collect-release-gate-report.cjs" }

Write-RunnerSummary
New-Slim-ReleaseGateReport -SourceDir $RunDir -DestinationDir $SlimDir -ZipPath $SlimZipPath

if ($env:CHAOS_RELEASE_GATE_FULL_ZIP -eq 'true' -and (Test-Path $RunDir)) {
  Compress-Archive -Path "$RunDir\*" -DestinationPath $FullZipPath -Force
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
