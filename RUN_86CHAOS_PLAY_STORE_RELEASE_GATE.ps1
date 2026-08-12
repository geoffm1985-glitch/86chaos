$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$env:PYTHONUTF8 = '1'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

if (-not (Test-Path ".\package.json")) {
  throw "package.json was not found. Run this from the real 86chaos app folder."
}
if (-not (Test-Path ".\package-lock.json")) {
  throw "package-lock.json was not found. The release gate requires the committed lockfile."
}

$ReleaseTargetKeys = @('APP_URL', 'CHAOS_BASE_URL', 'CHAOS_EXPECTED_VERSION', 'CHAOS_EXPECTED_VERCEL_PROJECT_SLUG')
$CanonicalVercelProjectSlug = '86chaos'

function Read-EnvFileMap {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line -notmatch '=') { return }
    $parts = $line -split '=', 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$') { $map[$name] = $value }
  }
  return $map
}

function Normalize-ReleaseTargetValue {
  param([string]$Name, [string]$Value)
  if (-not $Value) { return '' }
  if ($Name -match 'URL$|BASE_URL$') { return $Value.Trim().TrimEnd('/') }
  return $Value.Trim()
}

function Assert-NoReleaseTargetConflicts {
  param([hashtable]$TestEnv, [hashtable]$LocalEnv)
  foreach ($key in $ReleaseTargetKeys) {
    $values = @()
    $processValue = [Environment]::GetEnvironmentVariable($key, 'Process')
    if ($processValue) { $values += [pscustomobject]@{ Source = 'process environment'; Value = $processValue } }
    if ($TestEnv.ContainsKey($key) -and $TestEnv[$key]) { $values += [pscustomobject]@{ Source = '.env.test.local'; Value = $TestEnv[$key] } }
    if ($LocalEnv.ContainsKey($key) -and $LocalEnv[$key]) { $values += [pscustomobject]@{ Source = '.env.local'; Value = $LocalEnv[$key] } }
    for ($i = 0; $i -lt $values.Count; $i++) {
      for ($j = $i + 1; $j -lt $values.Count; $j++) {
        $left = Normalize-ReleaseTargetValue $key $values[$i].Value
        $right = Normalize-ReleaseTargetValue $key $values[$j].Value
        if ($left -and $right -and $left -ne $right) {
          throw "Conflicting $key values detected. $($values[$i].Source) points to $($values[$i].Value) while $($values[$j].Source) points to $($values[$j].Value). Clear the stale process variable or explicitly choose the intended target."
        }
      }
    }
  }
}

function Import-EnvFile {
  param([hashtable]$Map)
  foreach ($name in $Map.Keys) {
    $value = $Map[$name]
    if ($name -match '^[A-Za-z_][A-Za-z0-9_]*$' -and -not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

$EnvTestLocal = Read-EnvFileMap (Join-Path $Root '.env.test.local')
$EnvLocal = Read-EnvFileMap (Join-Path $Root '.env.local')
Assert-NoReleaseTargetConflicts $EnvTestLocal $EnvLocal
Import-EnvFile $EnvTestLocal
Import-EnvFile $EnvLocal
if (-not $env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG) { $env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG = $CanonicalVercelProjectSlug }
Write-Host "Release-gate target:" -ForegroundColor Cyan
Write-Host "  APP_URL=$env:APP_URL" -ForegroundColor Cyan
Write-Host "  CHAOS_BASE_URL=$env:CHAOS_BASE_URL" -ForegroundColor Cyan
Write-Host "  CHAOS_EXPECTED_VERSION=$env:CHAOS_EXPECTED_VERSION" -ForegroundColor Cyan
Write-Host "  CHAOS_EXPECTED_VERCEL_PROJECT_SLUG=$env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG" -ForegroundColor Cyan

$RunId = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$env:CHAOS_RELEASE_GATE_RUN_ID = $RunId
$env:CHAOS_FULL_AUDIT_RUN_ID = $RunId
$env:CHAOS_RELEASE_GATE_STEP_FAILURES = "0"
[Environment]::SetEnvironmentVariable('CHAOS_FAILED_ONLY_RELEASE_GATE', $null, 'Process')
if (-not $env:CHAOS_QA_DISABLE_AUTO_PROVISION_TEST_USERS) { $env:CHAOS_QA_AUTO_PROVISION_TEST_USERS = "true" }
if (-not $env:CHAOS_RELEASE_GATE_NO_MUTATION) {
  $env:CHAOS_ALLOW_MUTATION = "true"
  $env:CHAOS_QA_CREATE_RESTAURANT = "true"
}
$env:CHAOS_QA_WORKSPACE_NAME = "86 Chaos Release Gate QA $RunId"
$env:CHAOS_QA_WORKSPACE = $env:CHAOS_QA_WORKSPACE_NAME

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
@{ runId = $RunId; runDir = $RunDir; mode = 'full'; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content (Join-Path $ResultsRoot '.last-run.json')

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
  serverIdentityPreflightStarted = $false
  serverIdentityPreflightPassed = $false
  serverIdentityPreflightFailureCategory = ''
  serverIdentityPreflightPrimaryBlocker = ''
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
  cleanupRefusalReason = ''
  blockingReason = ''
  status = 'running'
  startedAt = (Get-Date -Format o)
  finishedAt = ''
  lastCompletedStep = ''
  anyTestsRan = $false
  blockedBeforeTestExecution = $false
  finalExitCode = $null
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

Write-Host "86 Chaos Play Store Release Gate" -ForegroundColor Cyan
Write-Host "Slim upload report only by default." -ForegroundColor Cyan
Write-Host "Run ID: $RunId" -ForegroundColor Cyan
Write-Host "Current-run directory: $RunDir" -ForegroundColor Cyan

function Add-StepResult {
  param([string]$Name, [int]$ExitCode, [string]$LogPath, [bool]$CountsAsFailure = $true)
  $step = [pscustomobject]@{ name = $Name; exitCode = $ExitCode; passed = ($ExitCode -eq 0); logPath = $LogPath; countsAsFailure = $CountsAsFailure; finishedAt = (Get-Date -Format o) }
  $script:StepResults += $step
  $script:RunnerState.steps += $step
  $script:RunnerState.lastCompletedStep = $Name
  if ($Name -match 'Playwright') { $script:RunnerState.anyTestsRan = ($ExitCode -ne 124) }
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
  Write-Host "Live ASCII release-gate output enabled. The slim JSON/log report is still written quietly for upload." -ForegroundColor Cyan
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
  foreach ($summaryName in @('TEST-SUMMARY.txt', 'FAILED-TESTS.txt')) {
    $summaryPath = Join-Path $SourceDir $summaryName
    if (Test-Path $summaryPath) {
      Copy-Item $summaryPath (Join-Path $DestinationDir $summaryName) -Force
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
  @{ runId = $RunId; runDir = $RunDir; mode = 'full'; blockingReason = $RunnerState.blockingReason; steps = $StepResults; generatedAt = (Get-Date -Format o) } | ConvertTo-Json -Depth 12 | Set-Content $jsonPath
}

function Stop-BeforePlaywright {
  param([string]$Reason)
  Set-BlockingReason $Reason
  Write-Host $Reason -ForegroundColor Red
}

$RunLockPath = Join-Path $ResultsRoot '.current-run.lock'
$AnotherReleaseGateRunActive = $false
if (Test-Path $RunLockPath) {
  try {
    $ExistingRun = Get-Content $RunLockPath -Raw | ConvertFrom-Json
    if ($ExistingRun.pid -and (Get-Process -Id ([int]$ExistingRun.pid) -ErrorAction SilentlyContinue)) {
      $AnotherReleaseGateRunActive = $true
      Set-RunnerPhase 'blocked-overlapping-run'
      $RunnerState.blockedBeforeTestExecution = $true
      Stop-BeforePlaywright "Release gate BLOCKED BEFORE TEST EXECUTION because another release-gate run is already active. Existing runId=$($ExistingRun.runId) pid=$($ExistingRun.pid)."
    }
  } catch {}
}
if (-not $AnotherReleaseGateRunActive) {
  @{ runId = $RunId; pid = $PID; startedAt = (Get-Date -Format o); runDir = $RunDir } | ConvertTo-Json | Set-Content $RunLockPath
}

if (-not $AnotherReleaseGateRunActive) {
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
      Set-RunnerPhase 'verify-windows-npm-wrapper'
      $NpmWrapperExit = Run-Step "Verify npm wrapper" "node scripts/86chaos-release-gate/run-observable-command.cjs --label 'Verify npm wrapper' --heartbeat 20 --timeout 60 -- npm --version"
      if ($NpmWrapperExit -ne 0) {
        $RunnerState.blockedBeforeTestExecution = $true
        Stop-BeforePlaywright "Release gate BLOCKED BEFORE TEST EXECUTION because the observable npm wrapper could not launch npm --version."
      } else {
      Set-RunnerPhase 'install-locked-test-dependencies'
      $RunnerState.dependencyInstallAttempted = $true
      Save-RunnerState
      $InstallExit = Run-Step "Install locked test dependencies" "node scripts/86chaos-release-gate/run-observable-command.cjs --label 'Install locked test dependencies' --heartbeat 20 --timeout 1800 -- npm ci --include=dev --no-audit --no-fund"
      $RunnerState.dependencyInstallPassed = ($InstallExit -eq 0)
      Save-RunnerState
      if ($InstallExit -ne 0) {
        if ($InstallExit -eq 124) {
          $RunnerState.blockedBeforeTestExecution = $true
          Stop-BeforePlaywright "Release gate BLOCKED BEFORE TEST EXECUTION because locked dependency installation timed out after 30 minutes. Upload the slim report; this is a runner/install blocker, not an app-test result."
        } else {
          $RunnerState.blockedBeforeTestExecution = $true
          Stop-BeforePlaywright "Release gate blocked before Playwright because locked development dependencies were not installed."
        }
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
            $BrowserExit = Run-Step "Install Playwright browsers" "& '$PlaywrightExe' install chromium firefox webkit"
            $RunnerState.browserInstallPassed = ($BrowserExit -eq 0)
            Save-RunnerState
            if ($BrowserExit -ne 0) {
              Stop-BeforePlaywright "Release gate blocked before Playwright because Chromium browser installation failed."
            } else {
              Set-RunnerPhase 'server-firebase-boundary-preflight'
              $RunnerState.serverIdentityPreflightStarted = $true
              Save-RunnerState
              $ServerIdentityExit = Run-Step "Verify deployed server Firebase boundary" "node scripts/86chaos-release-gate/server-firebase-boundary-preflight.cjs"
              $RunnerState.serverIdentityPreflightPassed = ($ServerIdentityExit -eq 0)
              $ServerIdentityReportPath = Join-Path $RunDir 'server-firebase-boundary-preflight.json'
              if (Test-Path $ServerIdentityReportPath) {
                try {
                  $ServerIdentityReport = Get-Content $ServerIdentityReportPath -Raw | ConvertFrom-Json
                  $RunnerState.serverIdentityPreflightFailureCategory = [string]$ServerIdentityReport.failureCategory
                  $RunnerState.serverIdentityPreflightPrimaryBlocker = [string]$ServerIdentityReport.primaryBlockingFailure
                } catch {}
              }
              Save-RunnerState
              if ($ServerIdentityExit -ne 0) {
                $ServerIdentityReason = "Release gate blocked before mutation because deployed server Firebase identity preflight failed."
                if (Test-Path $ServerIdentityReportPath) {
                  try {
                    $ServerIdentityReport = Get-Content $ServerIdentityReportPath -Raw | ConvertFrom-Json
                    if ($ServerIdentityReport.primaryBlockingFailure) { $ServerIdentityReason = [string]$ServerIdentityReport.primaryBlockingFailure }
                    elseif ($ServerIdentityReport.errors -and $ServerIdentityReport.errors.Count -gt 0) { $ServerIdentityReason = [string]$ServerIdentityReport.errors[0] }
                  } catch {}
                }
                Stop-BeforePlaywright $ServerIdentityReason
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
                  Set-RunnerPhase 'java-prerequisite'
                  $JavaExit = Run-Step "Java prerequisite" "node scripts/86chaos-release-gate/check-java-prerequisite.cjs"
                  if ($JavaExit -ne 0) {
                    Stop-BeforePlaywright "Release gate BLOCKED BEFORE PLAYWRIGHT because Java is required for emulator rules validation. See java-prerequisite.json."
                  } else {
                    Set-RunnerPhase 'local-release-checks'
                    $LocalChecksExit = Run-Step "Local release readiness checks" "node scripts/86chaos-release-gate/run-node-release-checks.cjs"
                    if ($LocalChecksExit -ne 0) {
                      Stop-BeforePlaywright "Release gate BLOCKED BEFORE PLAYWRIGHT because required local source/unit/build/rules checks failed or were blocked. See node-test-live-summary.json."
                    } else {
                      Set-RunnerPhase 'playwright'
                      $PlaywrightConfig = ".\playwright.play-store-release.config.cjs"
                      $RunnerState.playwrightStarted = $true
                      Save-RunnerState
                      Run-LiveStep "Playwright release gate" "& '$PlaywrightExe' test --config '$PlaywrightConfig'"
                    }
                  }
                }
              }
            }
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
$setup = $null
if (Test-Path $SetupStatePath) {
  try {
    $setup = Get-Content $SetupStatePath -Raw | ConvertFrom-Json
    $RunnerState.globalSetupStarted = [bool]($setup.globalSetupStarted -or $setup.attempted)
    $RunnerState.qaSeedProcessStarted = [bool]$setup.qaSeedProcessStarted
    $RunnerState.qaDataWritesStarted = [bool]($setup.qaDataWritesStarted -or $setup.writesStarted)
    $RunnerState.qaRestaurantCreated = [bool]($setup.createdRestaurant -or $setup.restaurantCreated)
    $RunnerState.qaSeedAttempted = [bool]($setup.seeded -or $setup.qaSeedAttempted -or $setup.fixtureSeedStarted)
    $RunnerState.qaSeedVerified = [bool]($setup.verified -or $setup.verificationOk)
    Save-RunnerState
  } catch {}
}

if (Test-Path $CleanupPath) {
  try {
    $cleanup = Get-Content $CleanupPath -Raw | ConvertFrom-Json
    $RunnerState.cleanupAttempted = $true
    $RunnerState.cleanupCompleted = [bool]$cleanup.ok
    $CleanupError = [string]$cleanup.error
    if ([string]::IsNullOrWhiteSpace($CleanupError)) { $CleanupError = [string]$cleanup.firstError }
    if ([string]::IsNullOrWhiteSpace($CleanupError)) { $CleanupError = 'cleanup report existed but did not report ok:true' }
    $RunnerState.cleanupRefusalReason = if ($cleanup.ok) { '' } else { $CleanupError }
    Save-RunnerState
  } catch {
    $RunnerState.cleanupAttempted = $true
    $RunnerState.cleanupCompleted = $false
    $RunnerState.cleanupRefusalReason = 'cleanup report could not be parsed'
    Save-RunnerState
  }
} elseif ($setup) {
  $SetupRunId = [string]$setup.runId
  $SetupProjectId = [string]$setup.testingProjectId
  if ([string]::IsNullOrWhiteSpace($SetupProjectId)) { $SetupProjectId = [string]$setup.firebaseProjectId }
  if ([string]::IsNullOrWhiteSpace($SetupProjectId)) { $SetupProjectId = [string]$setup.projectId }
  if ([string]::IsNullOrWhiteSpace($SetupProjectId)) { $SetupProjectId = [string]$env:REACT_APP_FIREBASE_PROJECT_ID }
  $SetupRestaurantId = [string]$setup.restaurantId
  if ([string]::IsNullOrWhiteSpace($SetupRestaurantId)) { $SetupRestaurantId = [string]$setup.temporaryRestaurantId }
  $WritesStarted = [bool]($setup.writesStarted -or $setup.qaDataWritesStarted -or $setup.createdRestaurant -or $setup.restaurantCreated -or $setup.membershipsCreated -or $setup.seeded -or $setup.fixtureSeedStarted)
  $CleanupEligible = $WritesStarted -and ($SetupRunId -eq $RunId) -and ($SetupProjectId -eq 'chaos-test-d1601')
  if ($setup.createdRestaurant -or $setup.restaurantCreated) { $CleanupEligible = $CleanupEligible -and -not [string]::IsNullOrWhiteSpace($SetupRestaurantId) }
  if ($CleanupEligible) {
    Set-RunnerPhase 'cleanup'
    $RunnerState.cleanupAttempted = $true
    $RunnerState.cleanupRefusalReason = ''
    Save-RunnerState
    $CleanupExit = Run-Step "Cleanup current-run QA restaurant" "node scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs"
    $RunnerState.cleanupCompleted = ($CleanupExit -eq 0)
    Save-RunnerState
  } elseif ($WritesStarted) {
    $RunnerState.cleanupAttempted = $false
    $RunnerState.cleanupCompleted = $false
    if ($SetupRunId -ne $RunId) { $RunnerState.cleanupRefusalReason = 'current-run ID did not match setup state' }
    elseif ($SetupProjectId -ne 'chaos-test-d1601') { $RunnerState.cleanupRefusalReason = 'testing Firebase project identity was missing or unsafe' }
    elseif (($setup.createdRestaurant -or $setup.restaurantCreated) -and [string]::IsNullOrWhiteSpace($SetupRestaurantId)) { $RunnerState.cleanupRefusalReason = 'temporary restaurant ID was missing after current-run writes' }
    else { $RunnerState.cleanupRefusalReason = 'cleanup ownership evidence was incomplete' }
    Save-RunnerState
  } else {
    $RunnerState.cleanupAttempted = $false
    $RunnerState.cleanupCompleted = $false
    $RunnerState.cleanupRefusalReason = 'cleanup unnecessary because no current-run Firebase writes began'
    Save-RunnerState
  }
}

Set-RunnerPhase 'report-collection'
if ($RunnerState.blockingReason -and $RunnerState.playwrightStarted -ne $true) { $RunnerState.blockedBeforeTestExecution = $true }
$RunnerState.finishedAt = (Get-Date -Format o)
if ($RunnerState.blockingReason) { $RunnerState.status = 'blocked' } elseif ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0) { $RunnerState.status = 'failed' } else { $RunnerState.status = 'passed' }
if ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0 -or $RunnerState.blockingReason) { $RunnerState.finalExitCode = 1 } else { $RunnerState.finalExitCode = 0 }
Save-RunnerState
Run-CollectorStep "Collect report" "node scripts/86chaos-release-gate/collect-release-gate-report.cjs"
$RunnerState.updatedAt = (Get-Date -Format o)
Save-RunnerState
Write-RunnerSummary
New-Slim-ReleaseGateReport -SourceDir $RunDir -DestinationDir $SlimDir -ZipPath $SlimZipPath

if ($env:CHAOS_RELEASE_GATE_FULL_ZIP -eq 'true' -and (Test-Path $RunDir)) {
  $FullZipPath = Join-Path $Root ("86chaos-universal-release-gate-UPLOAD-ME-$RunId.zip")
  Compress-Archive -Path "$RunDir\*" -DestinationPath $FullZipPath -Force
  Write-Host ""
  Write-Host "Full release-gate ZIP created because CHAOS_RELEASE_GATE_FULL_ZIP=true:" -ForegroundColor Yellow
  Write-Host $FullZipPath -ForegroundColor Yellow
}

try {
  if ((Test-Path $RunLockPath) -and -not $AnotherReleaseGateRunActive) {
    $OwnedRun = Get-Content $RunLockPath -Raw | ConvertFrom-Json
    if ($OwnedRun.runId -eq $RunId) { Remove-Item $RunLockPath -Force -ErrorAction SilentlyContinue }
  }
} catch {}
Save-RunnerState

if ([int]$env:CHAOS_RELEASE_GATE_STEP_FAILURES -gt 0 -or $RunnerState.blockingReason) {
  Write-Host ""
  Write-Host "Release gate finished with failures. Upload 86chaos-release-gate-SLIM-UPLOAD-ME.zip." -ForegroundColor Red
  exit 1
}
Write-Host ""
Write-Host "Release gate passed." -ForegroundColor Green
exit 0
