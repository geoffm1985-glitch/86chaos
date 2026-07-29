$ErrorActionPreference = 'Continue'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path ".\package.json")) {
  throw "package.json was not found. Run this from the real 86chaos app folder."
}

function Import-EnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line -notmatch '=') { return }
    $parts = $line -split '=', 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$' -and -not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

Import-EnvFile (Join-Path $Root '.env.test.local')
Import-EnvFile (Join-Path $Root '.env.local')

$RunId = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$env:CHAOS_RELEASE_GATE_RUN_ID = $RunId
$env:CHAOS_FULL_AUDIT_RUN_ID = $RunId
$env:CHAOS_RELEASE_GATE_STEP_FAILURES = "0"
$env:CHAOS_FAILED_ONLY_RELEASE_GATE = "true"
$env:CHAOS_QA_WORKSPACE_NAME = "86 Chaos Full Audit QA Restaurant"
$env:CHAOS_QA_WORKSPACE = "86 Chaos Full Audit QA Restaurant"

$ResultsRoot = Join-Path $Root "test-results\86chaos-play-store-release-gate"
$RunDir = Join-Path $ResultsRoot $RunId
$env:CHAOS_RELEASE_GATE_RUN_DIR = $RunDir
$RunnerLogDir = Join-Path $RunDir "runner-logs"
$SlimDir = Join-Path $Root "test-results\86chaos-release-gate-SLIM-UPLOAD-ME"
$SlimZipPath = Join-Path $Root "86chaos-release-gate-SLIM-UPLOAD-ME.zip"
New-Item -ItemType Directory -Force $RunDir | Out-Null
New-Item -ItemType Directory -Force $RunnerLogDir | Out-Null

Get-ChildItem $ResultsRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '.last-run.json' } | Remove-Item -Force -ErrorAction SilentlyContinue
@{ runId = $RunId; runDir = $RunDir; mode = 'failed-only'; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content (Join-Path $ResultsRoot '.last-run.json')

$StepResults = @()

Write-Host "86 Chaos failed-only release gate" -ForegroundColor Cyan
Write-Host "This only reruns the current failed/fixed harness areas. It does NOT replace the full release gate." -ForegroundColor Yellow
Write-Host "Run ID: $RunId" -ForegroundColor Cyan
Write-Host "Current-run directory: $RunDir" -ForegroundColor Cyan

function Add-StepResult {
  param([string]$Name, [int]$ExitCode, [string]$LogPath)
  $script:StepResults += [pscustomobject]@{ name = $Name; exitCode = $ExitCode; passed = ($ExitCode -eq 0); logPath = $LogPath }
  if ($ExitCode -ne 0) {
    $count = 0
    [int]::TryParse($env:CHAOS_RELEASE_GATE_STEP_FAILURES, [ref]$count) | Out-Null
    $env:CHAOS_RELEASE_GATE_STEP_FAILURES = [string]($count + 1)
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
  Add-StepResult -Name $Name -ExitCode $exitCode -LogPath $LogPath
  if ($exitCode -eq 0) { Write-Host "PASSED: $Name" -ForegroundColor Green } else { Write-Host "FAILED: $Name" -ForegroundColor Red }
  return $exitCode
}

function Run-LiveStep {
  param([string]$Name, [string]$Command)
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Yellow
  $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_').Trim('_')
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "step" }
  $LogPath = Join-Path $RunnerLogDir ("{0}-{1}.log" -f $RunId, $safeName)
  "=== $Name ===`nCommand: $Command`nStarted: $(Get-Date -Format o)`nLive Playwright output printed to the terminal.`n" | Set-Content $LogPath
  powershell -NoProfile -ExecutionPolicy Bypass -Command $Command 2>&1 | ForEach-Object { Add-Content -Path $LogPath -Value $_; Write-Host $_ }
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  "`nFinished: $(Get-Date -Format o)`nExitCode: $exitCode" | Add-Content $LogPath
  Add-StepResult -Name $Name -ExitCode $exitCode -LogPath $LogPath
  if ($exitCode -eq 0) { Write-Host "PASSED: $Name" -ForegroundColor Green } else { Write-Host "FAILED: $Name" -ForegroundColor Red }
  return $exitCode
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
        $relative = $_.FullName.Substring($sourceRoot.Length).TrimStart('\\')
        $target = Join-Path $DestinationDir (Join-Path (Split-Path $SourceDir -Leaf) $relative)
        New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
        Copy-Item $_.FullName $target -Force
      }
  }
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force -ErrorAction SilentlyContinue }
  $copiedCount = (Get-ChildItem $DestinationDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
  if ($copiedCount -eq 0) { Set-Content (Join-Path $DestinationDir 'release-gate-empty-report.txt') "No current-run report files were copied." }
  Compress-Archive -Path "$DestinationDir\*" -DestinationPath $ZipPath -Force
  Write-Host "Slim failed-only upload ZIP created: $ZipPath" -ForegroundColor Cyan
}

function Write-RunnerSummary {
  $summaryPath = Join-Path $RunDir ("86chaos-failed-only-runner-summary-$RunId.json")
  @{ runId = $RunId; runDir = $RunDir; mode = 'failed-only'; steps = $StepResults; generatedAt = (Get-Date -Format o) } | ConvertTo-Json -Depth 8 | Set-Content $summaryPath
}

$PreflightExit = Run-Step "Environment preflight" "node scripts/86chaos-release-gate/preflight-env.cjs"
if ($PreflightExit -eq 0) {
  Run-Step "Source inventory" "node scripts/86chaos-release-gate/source-inventory.cjs"
  Run-LiveStep "Failed-only Playwright gate" "npx playwright test --config .\playwright.failed-release.config.cjs"
} else {
  Write-Host "Preflight failed. Stopping before Playwright/global setup can create QA data." -ForegroundColor Red
}

$SetupStatePath = Join-Path $RunDir 'qa-setup-state.json'
$CleanupPath = Join-Path $RunDir '86chaos-full-audit-cleanup-report.json'
if ((Test-Path $SetupStatePath) -and -not (Test-Path $CleanupPath)) {
  $setup = Get-Content $SetupStatePath -Raw | ConvertFrom-Json
  if ($setup.attempted -and $setup.seeded -and $setup.verified -and $setup.runId -eq $RunId) {
    Run-Step "Cleanup current-run QA restaurant" "node scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs"
  }
}

Run-Step "Collect failed-only report" "node scripts/86chaos-release-gate/collect-release-gate-report.cjs"
Write-RunnerSummary
New-Slim-ReleaseGateReport -SourceDir $RunDir -DestinationDir $SlimDir -ZipPath $SlimZipPath

if ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0) {
  Write-Host "Failed-only release gate finished with failures. Upload 86chaos-release-gate-SLIM-UPLOAD-ME.zip." -ForegroundColor Red
  exit 1
}
Write-Host "Failed-only release gate passed. Run the full release gate before release." -ForegroundColor Green
exit 0
