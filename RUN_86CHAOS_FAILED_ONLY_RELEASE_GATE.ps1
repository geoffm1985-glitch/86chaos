$ErrorActionPreference = 'Continue'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path ".\package.json")) {
  throw "package.json was not found. Run this from the real 86chaos app folder."
}
if (-not (Test-Path ".\package-lock.json")) {
  throw "package-lock.json was not found. The release gate requires the committed lockfile."
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
$RunnerStatePath = Join-Path $RunDir "runner-state.json"
New-Item -ItemType Directory -Force $RunDir | Out-Null
New-Item -ItemType Directory -Force $RunnerLogDir | Out-Null

Get-ChildItem $ResultsRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '.last-run.json' } | Remove-Item -Force -ErrorAction SilentlyContinue
@{ runId = $RunId; runDir = $RunDir; mode = 'failed-only'; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content (Join-Path $ResultsRoot '.last-run.json')

$StepResults = @()
$RunnerState = [ordered]@{
  runId = $RunId
  generatedAt = (Get-Date -Format o)
  updatedAt = (Get-Date -Format o)
  currentPhase = 'created'
  dependencyInstallAttempted = $false
  dependencyInstallPassed = $false
  dependencyPreflightPassed = $false
  sourceInventoryPassed = $false
  browserInstallPassed = $false
  testAccountProvisionAttempted = $false
  testAccountProvisionPassed = $false
  rolePreflightStarted = $false
  rolePreflightPassed = $false
  playwrightStarted = $false
  globalSetupStarted = $false
  qaSeedProcessStarted = $false
  qaDataWritesStarted = $false
  qaRestaurantCreated = $false
  qaSeedAttempted = $false
  qaSeedVerified = $false
  cleanupAttempted = $false
  cleanupCompleted = $false
  blockingReason = ''
  steps = @()
}

function Save-RunnerState {
  $script:RunnerState.updatedAt = (Get-Date -Format o)
  $script:RunnerState | ConvertTo-Json -Depth 12 | Set-Content $RunnerStatePath
}
function Set-RunnerPhase {
  param([string]$Phase)
  $script:RunnerState.currentPhase = $Phase
  Save-RunnerState
}
function Set-BlockingReason {
  param([string]$Reason)
  if (-not $script:RunnerState.blockingReason) {
    $script:RunnerState.blockingReason = $Reason
  }
  Save-RunnerState
}
Save-RunnerState

Write-Host "86 Chaos failed-only release gate" -ForegroundColor Cyan
Write-Host "This only reruns the current failed/fixed harness areas. It does NOT replace the full release gate." -ForegroundColor Yellow
Write-Host "Run ID: $RunId" -ForegroundColor Cyan
Write-Host "Current-run directory: $RunDir" -ForegroundColor Cyan

function Add-StepResult {
  param([string]$Name, [int]$ExitCode, [string]$LogPath, [bool]$CountsAsFailure = $true)
  $step = [pscustomobject]@{ name = $Name; exitCode = $ExitCode; passed = ($ExitCode -eq 0); logPath = $LogPath; countsAsFailure = $CountsAsFailure; finishedAt = (Get-Date -Format o) }
  $script:StepResults += $step
  $script:RunnerState.steps += $step
  Save-RunnerState
  if ($ExitCode -ne 0 -and $CountsAsFailure) {
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
  Write-Host "Live Playwright list output enabled. The slim JSON/log report is still written quietly for upload." -ForegroundColor Cyan
  $safeName = ($Name -replace '[^A-Za-z0-9_-]', '_').Trim('_')
  if ([string]::IsNullOrWhiteSpace($safeName)) { $safeName = "step" }
  $LogPath = Join-Path $RunnerLogDir ("{0}-{1}.log" -f $RunId, $safeName)
  "=== $Name ===`nCommand: $Command`nStarted: $(Get-Date -Format o)`nLive console output is printed to the terminal while the step exit code remains scalar for the runner.`n" | Set-Content $LogPath
  powershell -NoProfile -ExecutionPolicy Bypass -Command $Command 2>&1 | ForEach-Object { Add-Content -Path $LogPath -Value $_; Write-Host $_ }
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  "`nFinished: $(Get-Date -Format o)`nExitCode: $exitCode" | Add-Content $LogPath
  Add-StepResult -Name $Name -ExitCode $exitCode -LogPath $LogPath
  if ($exitCode -eq 0) { Write-Host "PASSED: $Name" -ForegroundColor Green } else { Write-Host "FAILED: $Name" -ForegroundColor Red }
  return $exitCode
}

function Run-CollectorStep {
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
  $existingFailures = 0
  [int]::TryParse($env:CHAOS_RELEASE_GATE_STEP_FAILURES, [ref]$existingFailures) | Out-Null
  $countCollectorAsFailure = ($exitCode -ne 0 -and $existingFailures -eq 0)
  Add-StepResult -Name $Name -ExitCode $exitCode -LogPath $LogPath -CountsAsFailure:$countCollectorAsFailure
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
  Write-Host ""
  Write-Host "Slim release-gate upload ZIP created:" -ForegroundColor Cyan
  Write-Host $ZipPath -ForegroundColor Cyan
}

function Write-RunnerSummary {
  $summaryPath = Join-Path $RunDir ("86chaos-release-gate-runner-summary-$RunId.txt")
  $jsonPath = Join-Path $RunDir ("86chaos-release-gate-runner-summary-$RunId.json")
  $failed = @($StepResults | Where-Object { -not $_.passed })
  $countedFailures = @($StepResults | Where-Object { -not $_.passed -and $_.countsAsFailure })
  $lines = @(
    "86 CHAOS RELEASE GATE RUNNER SUMMARY",
    "Generated: $(Get-Date -Format o)",
    "Run ID: $RunId",
    "Root: $Root",
    "Run directory: $RunDir",
    "APP_URL: $env:APP_URL",
    "CHAOS_BASE_URL: $env:CHAOS_BASE_URL",
    "CHAOS_EXPECTED_VERSION: $env:CHAOS_EXPECTED_VERSION",
    "Primary blocking reason: $($RunnerState.blockingReason)",
    "Original blocking failures: $($countedFailures.Count)",
    "All failed steps including collector: $($failed.Count)",
    "",
    "STEPS"
  )
  foreach ($step in $StepResults) { $lines += "- $($step.name): $(if ($step.passed) { 'PASS' } else { 'FAIL' }) exit=$($step.exitCode) counted=$($step.countsAsFailure) log=$($step.logPath)" }
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
  @{ runId = $RunId; runDir = $RunDir; mode = 'failed-only'; blockingReason = $RunnerState.blockingReason; steps = $StepResults; generatedAt = (Get-Date -Format o) } | ConvertTo-Json -Depth 12 | Set-Content $jsonPath
}

function Stop-BeforePlaywright {
  param([string]$Reason)
  Set-BlockingReason $Reason
  Write-Host $Reason -ForegroundColor Red
}

Set-RunnerPhase 'environment-preflight'
$PreflightExit = Run-Step "Environment preflight" "node scripts/86chaos-release-gate/preflight-env.cjs"
if ($PreflightExit -ne 0) {
  Stop-BeforePlaywright "Release gate blocked before dependency installation because environment/deployment preflight failed."
} else {
  Set-RunnerPhase 'node-version'
  $NodeExit = Run-Step "Node version" "npm run node:check --if-present"
  if ($NodeExit -ne 0) {
    Stop-BeforePlaywright "Release gate blocked before Playwright because Node 24.x validation failed."
  } else {
    Set-RunnerPhase 'lockfile-integrity'
    $LockExit = Run-Step "Lockfile integrity" "npm run lock:integrity --if-present"
    if ($LockExit -ne 0) {
      Stop-BeforePlaywright "Release gate blocked before Playwright because lockfile integrity failed."
    } else {
      Set-RunnerPhase 'install-locked-test-dependencies'
      $RunnerState.dependencyInstallAttempted = $true
      Save-RunnerState
      $InstallExit = Run-Step "Install locked test dependencies" "npm ci --include=dev --no-audit --no-fund"
      $RunnerState.dependencyInstallPassed = ($InstallExit -eq 0)
      Save-RunnerState
      if ($InstallExit -ne 0) {
        Stop-BeforePlaywright "Release gate blocked before Playwright because locked development dependencies were not installed."
      } else {
        Set-RunnerPhase 'dependency-preflight'
        $DependencyExit = Run-Step "Dependency preflight" "node scripts/86chaos-release-gate/dependency-preflight.cjs"
        $RunnerState.dependencyPreflightPassed = ($DependencyExit -eq 0)
        Save-RunnerState
        if ($DependencyExit -ne 0) {
          Stop-BeforePlaywright "Release gate blocked before Playwright because required local test modules or the local Playwright executable were missing."
        } else {
          Set-RunnerPhase 'source-inventory'
          $InventoryExit = Run-Step "Source inventory" "node scripts/86chaos-release-gate/source-inventory.cjs"
          $RunnerState.sourceInventoryPassed = ($InventoryExit -eq 0)
          Save-RunnerState
          if ($InventoryExit -ne 0) {
            Stop-BeforePlaywright "Release gate blocked before Playwright because source inventory failed."
          } else {
            $PlaywrightExe = Join-Path $Root "node_modules\.bin\playwright.cmd"
            Set-RunnerPhase 'install-chromium'
            $BrowserExit = Run-Step "Install Chromium browser" "& '$PlaywrightExe' install chromium"
            $RunnerState.browserInstallPassed = ($BrowserExit -eq 0)
            Save-RunnerState
            if ($BrowserExit -ne 0) {
              Stop-BeforePlaywright "Release gate blocked before Playwright because Chromium browser installation failed."
            } else {
              Set-RunnerPhase 'test-account-provisioning'
              $RunnerState.testAccountProvisionAttempted = $true
              Save-RunnerState
              $ProvisionExit = Run-Step "Provision temporary release-gate test accounts" "node scripts/86chaos-release-gate/provision-test-accounts.cjs"
              $RunnerState.testAccountProvisionPassed = ($ProvisionExit -eq 0)
              Save-RunnerState
              if ($ProvisionExit -ne 0) {
                Stop-BeforePlaywright "Release gate blocked before tests because temporary release-gate test accounts could not be provisioned. Check test-account-provisioning.json in the current run directory."
              } else {
                Set-RunnerPhase 'role-preflight'
                $RunnerState.rolePreflightStarted = $true
                Save-RunnerState
                $RoleExit = Run-Step "Verify release-gate role accounts" "node scripts/86chaos-release-gate/verify-role-accounts.cjs"
                $RunnerState.rolePreflightPassed = ($RoleExit -eq 0)
                Save-RunnerState
                if ($RoleExit -ne 0) {
                  $RoleReason = "Release gate blocked before tests because role-account preflight failed. Configure a dedicated non-System-Administrator manager test account in .env.test.local."
                  $RoleReportPath = Join-Path $RunDir 'role-identity-verification.json'
                  if (Test-Path $RoleReportPath) {
                    try {
                      $RoleReport = Get-Content $RoleReportPath -Raw | ConvertFrom-Json
                      if ($RoleReport.errors -and $RoleReport.errors.Count -gt 0) { $RoleReason = "Release gate blocked before tests because $($RoleReport.errors[0])" }
                    } catch {}
                  }
                  Stop-BeforePlaywright $RoleReason
                } else {
                  Set-RunnerPhase 'playwright'
                  $PlaywrightConfig = ".\playwright.failed-release.config.cjs"
                  $RunnerState.playwrightStarted = $true
                  Save-RunnerState
                  Run-LiveStep "Failed-only Playwright gate" "& '$PlaywrightExe' test --config '$PlaywrightConfig'"
                }
              }
            }
          }
        }
      }
    }
  }
}

$SetupStatePath = Join-Path $RunDir 'qa-setup-state.json'
$CleanupPath = Join-Path $RunDir '86chaos-full-audit-cleanup-report.json'
if ((Test-Path $SetupStatePath) -and -not (Test-Path $CleanupPath)) {
  $setup = Get-Content $SetupStatePath -Raw | ConvertFrom-Json
  $RunnerState.globalSetupStarted = [bool]($setup.globalSetupStarted -or $setup.attempted)
  $RunnerState.qaSeedProcessStarted = [bool]$setup.qaSeedProcessStarted
  $RunnerState.qaDataWritesStarted = [bool]$setup.qaDataWritesStarted
  $RunnerState.qaRestaurantCreated = [bool]$setup.createdRestaurant
  $RunnerState.qaSeedAttempted = [bool]$setup.seeded
  $RunnerState.qaSeedVerified = [bool]$setup.verified
  Save-RunnerState
  if ($setup.attempted -and $setup.seeded -and $setup.verified -and $setup.runId -eq $RunId) {
    Set-RunnerPhase 'cleanup'
    $RunnerState.cleanupAttempted = $true
    Save-RunnerState
    $CleanupExit = Run-Step "Cleanup current-run QA restaurant" "node scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs"
    $RunnerState.cleanupCompleted = ($CleanupExit -eq 0)
    Save-RunnerState
  }
}

Set-RunnerPhase 'report-collection'
Run-CollectorStep "Collect failed-only report" "node scripts/86chaos-release-gate/collect-release-gate-report.cjs"
Write-RunnerSummary
New-Slim-ReleaseGateReport -SourceDir $RunDir -DestinationDir $SlimDir -ZipPath $SlimZipPath

Save-RunnerState

if ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0) {
  Write-Host ""
  Write-Host "Release gate finished with failures. Upload 86chaos-release-gate-SLIM-UPLOAD-ME.zip." -ForegroundColor Red
  exit 1
}
Write-Host ""
Write-Host "Release gate passed." -ForegroundColor Green
exit 0
