<#
86 Chaos full local test-suite runner.
Copy this file and RUN_86CHAOS_FULL_TEST_SUITE.cmd into the 86chaos app root.
Run: .\RUN_86CHAOS_FULL_TEST_SUITE.cmd

Optional:
  .\RUN_86CHAOS_FULL_TEST_SUITE.cmd -SkipInstall
  .\RUN_86CHAOS_FULL_TEST_SUITE.cmd -FailedOnlyReleaseGate
  .\RUN_86CHAOS_FULL_TEST_SUITE.cmd -IncludeReleaseGate
#>

param(
  [switch]$SkipInstall,
  [switch]$NoBuild,
  [switch]$FailedOnlyReleaseGate,
  [switch]$IncludeReleaseGate
)

$ErrorActionPreference = 'Stop'

function Find-AppRoot {
  $dir = (Get-Location).Path
  while ($true) {
    $pkg = Join-Path $dir 'package.json'
    if (Test-Path $pkg) {
      try {
        $raw = Get-Content $pkg -Raw
        if ($raw -match '"name"\s*:\s*"86chaos"' -or $raw -match '86\s*Chaos' -or (Test-Path (Join-Path $dir 'src'))) {
          return $dir
        }
      } catch {}
    }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  throw 'Could not find the 86chaos app root. Run this from the folder that contains package.json.'
}

function New-RunId {
  return ('local-suite-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

function Convert-ToSafeName {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return 'step' }
  return (($Value -replace '[^A-Za-z0-9_.-]+','_').Trim('_'))
}

function Write-RunnerState {
  param([string]$Phase, [string]$BlockingReason = '')
  try {
    $state = [ordered]@{
      runId = $script:RunId
      generatedAt = (Get-Date).ToUniversalTime().ToString('o')
      appRoot = $script:AppRoot
      currentPhase = $Phase
      blockingReason = $BlockingReason
      resultZip = $script:ResultZip
      steps = $script:Steps
    }
    $statePath = Join-Path $script:RunDir 'local-suite-state.json'
    $state | ConvertTo-Json -Depth 12 | Set-Content -Path $statePath -Encoding UTF8
  } catch {}
}

function Show-LogTail {
  param([string]$LogPath, [int]$Lines = 160)
  if (-not (Test-Path $LogPath)) { return }
  Write-Host ''
  Write-Host "Last log lines from ${LogPath}:" -ForegroundColor Yellow
  try {
    Get-Content $LogPath -Tail $Lines | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
  } catch {}
}

function Copy-NpmDebugLogs {
  param([string]$StepName)
  $dest = Join-Path $script:RunDir 'npm-debug-logs'
  New-Item -ItemType Directory -Force $dest | Out-Null
  $safe = Convert-ToSafeName $StepName
  $candidates = @()
  try {
    $cache = (& npm config get cache 2>$null)
    if ($cache) { $candidates += (Join-Path ([string]$cache).Trim() '_logs') }
  } catch {}
  if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'npm-cache\_logs') }
  if ($env:APPDATA) { $candidates += (Join-Path $env:APPDATA 'npm-cache\_logs') }
  $copied = @()
  foreach ($dir in ($candidates | Select-Object -Unique)) {
    if (-not (Test-Path $dir)) { continue }
    try {
      Get-ChildItem $dir -Filter '*.log' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 5 |
        ForEach-Object {
          $target = Join-Path $dest (('{0}-{1}' -f $safe, $_.Name))
          Copy-Item $_.FullName $target -Force
          $copied += $target
        }
    } catch {}
  }
  return $copied
}

function Create-ResultZip {
  try {
    $zipName = ('86chaos-full-local-suite-UPLOAD-ME-{0}.zip' -f $script:RunId)
    $zipPath = Join-Path $script:AppRoot $zipName
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $script:RunDir '*') -DestinationPath $zipPath -Force
    $script:ResultZip = $zipPath
    return $zipPath
  } catch {
    $message = 'Could not create result ZIP: ' + $_.Exception.Message
    $message | Add-Content -Path (Join-Path $script:RunDir 'zip-error.log')
    return ''
  }
}

function Run-Step {
  param(
    [string]$Name,
    [string]$Command,
    [switch]$Required
  )

  Write-Host ''
  Write-Host '============================================================' -ForegroundColor DarkGray
  Write-Host $Name -ForegroundColor Cyan
  Write-Host '============================================================' -ForegroundColor DarkGray
  Write-Host $Command -ForegroundColor Gray

  $safe = Convert-ToSafeName $Name
  $log = Join-Path $script:RunDir (('{0:00}-{1}.log' -f ($script:Steps.Count + 1), $safe))
  $started = Get-Date
  $exitCode = 0
  $status = 'passed'
  $message = ''
  $npmDebugLogs = @()

  try {
    Push-Location $script:AppRoot
    & cmd.exe /d /s /c $Command 2>&1 | Tee-Object -FilePath $log
    $exitCode = $LASTEXITCODE
    Pop-Location
  } catch {
    try { Pop-Location } catch {}
    $exitCode = 1
    $message = $_.Exception.Message
    $message | Add-Content -Path $log
  }

  if ($Name -match 'Install locked dependencies|npm') {
    $npmDebugLogs = Copy-NpmDebugLogs -StepName $Name
  }

  if ($exitCode -ne 0) { $status = 'failed' }
  $ended = Get-Date
  $step = [ordered]@{
    name = $Name
    command = $Command
    required = [bool]$Required
    status = $status
    exitCode = $exitCode
    startedAt = $started.ToUniversalTime().ToString('o')
    endedAt = $ended.ToUniversalTime().ToString('o')
    durationSeconds = [math]::Round(($ended - $started).TotalSeconds, 2)
    log = $log
    npmDebugLogs = $npmDebugLogs
    message = $message
  }
  $script:Steps.Add($step) | Out-Null
  Write-RunnerState -Phase $Name

  if ($exitCode -ne 0) {
    Show-LogTail -LogPath $log
    if ($npmDebugLogs.Count -gt 0) {
      Write-Host ''
      Write-Host 'Copied npm debug logs:' -ForegroundColor Yellow
      $npmDebugLogs | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
      Show-LogTail -LogPath $npmDebugLogs[0] -Lines 120
    }
    if ($Name -match 'Node version project check') {
      Write-Host ''
      Write-Host 'Common fix: 86 Chaos requires Node 24.x. Install/use Node 24, then rerun this same command.' -ForegroundColor Yellow
      Write-Host 'Check with: node --version' -ForegroundColor Yellow
    }
    if ($Name -match 'Install locked dependencies') {
      Write-Host ''
      Write-Host 'Dependency install failed. The result ZIP and install logs will still be created.' -ForegroundColor Yellow
      Write-Host 'Open the npm debug log listed above for the exact npm error.' -ForegroundColor Yellow
    }
    if ($Required) {
      Write-Host ('FAILED REQUIRED STEP: ' + $Name) -ForegroundColor Red
      return $false
    }
    Write-Host ('FAILED OPTIONAL STEP: ' + $Name) -ForegroundColor Yellow
    return $false
  }

  Write-Host ('PASSED: ' + $Name) -ForegroundColor Green
  return $true
}

function Test-FileExists {
  param([string]$Path)
  return (Test-Path (Join-Path $script:AppRoot $Path))
}

function Get-AppVersion {
  $version = 'unknown'
  $versionJson = Join-Path $script:AppRoot 'public/version.json'
  if (Test-Path $versionJson) {
    try {
      $obj = Get-Content $versionJson -Raw | ConvertFrom-Json
      if ($obj.version) { $version = [string]$obj.version }
    } catch {}
  }
  if ($version -eq 'unknown') {
    try {
      $pkg = Get-Content (Join-Path $script:AppRoot 'package.json') -Raw | ConvertFrom-Json
      if ($pkg.version) { $version = [string]$pkg.version }
    } catch {}
  }
  return $version
}

function Add-PlannedStep {
  param([string]$Name, [string]$Command, [bool]$Required = $true)
  $script:PlannedSteps.Add([ordered]@{ name = $Name; command = $Command; required = $Required }) | Out-Null
}

function Write-TestPlan {
  $planPath = Join-Path $script:RunDir 'local-suite-test-plan.md'
  $md = @()
  $md += '# 86 Chaos Full Local Test Suite Plan'
  $md += ''
  $md += ('- Run ID: ' + $script:RunId)
  $md += ('- App version: ' + $script:AppVersion)
  $md += ('- App root: ' + $script:AppRoot)
  $md += ''
  $md += '## Steps this runner will attempt'
  $index = 1
  foreach ($p in $script:PlannedSteps) {
    $req = if ($p.required) { 'required' } else { 'optional' }
    $md += (('{0}. **{1}** ({2})' -f $index, $p.name, $req))
    $md += ('   - `' + $p.command + '`')
    $index++
  }
  ($md -join "`n") | Set-Content -Path $planPath -Encoding UTF8

  Write-Host ''
  Write-Host 'Tests/steps this runner will run:' -ForegroundColor Cyan
  foreach ($p in $script:PlannedSteps) {
    $req = if ($p.required) { 'required' } else { 'optional' }
    Write-Host ('- ' + $p.name + ' [' + $req + ']') -ForegroundColor Gray
  }
  Write-Host ('Test plan: ' + $planPath) -ForegroundColor Cyan
}

$script:AppRoot = Find-AppRoot
Set-Location $script:AppRoot
$script:RunId = New-RunId
$script:RunDir = Join-Path $script:AppRoot (Join-Path 'test-results\86chaos-full-local-suite' $script:RunId)
New-Item -ItemType Directory -Force $script:RunDir | Out-Null
$script:ResultZip = ''
$script:Steps = New-Object System.Collections.ArrayList
$script:PlannedSteps = New-Object System.Collections.ArrayList
$script:StartedAt = Get-Date
$script:AppVersion = Get-AppVersion

Write-Host '86 Chaos full local test suite' -ForegroundColor Cyan
Write-Host ('App root: ' + $script:AppRoot)
Write-Host ('Run ID: ' + $script:RunId)
Write-Host ('Run dir: ' + $script:RunDir)
Write-Host ('App version: ' + $script:AppVersion)

$targetedScript = 'scripts/test-' + ($script:AppVersion -replace '\.','-') + '-targeted.cjs'

Add-PlannedStep -Name 'Node and npm versions' -Command 'node --version & npm --version' -Required $false
Add-PlannedStep -Name 'Node version project check' -Command 'npm run node:check --if-present' -Required $true
if (-not $SkipInstall) { Add-PlannedStep -Name 'Install locked dependencies' -Command 'npm ci --include=dev --no-audit --no-fund' -Required $true }
Add-PlannedStep -Name 'Lockfile integrity' -Command 'npm run lock:integrity --if-present' -Required $true
Add-PlannedStep -Name 'Source validators' -Command 'npm run test:source' -Required $true
Add-PlannedStep -Name 'API syntax' -Command 'npm run syntax:api' -Required $true
Add-PlannedStep -Name 'Python syntax' -Command 'npm run syntax:py' -Required $true
Add-PlannedStep -Name 'Performance split' -Command 'npm run performance:split' -Required $true
if (Test-FileExists 'tests/86chaos-release-gate/test-harness-lifecycle.test.cjs') { Add-PlannedStep -Name 'Release-gate harness unit tests' -Command 'node --test --test-reporter=spec tests/86chaos-release-gate/test-harness-lifecycle.test.cjs' -Required $true }
if (Test-FileExists 'tests/86chaos-release-gate/test-account-provisioning.test.cjs') { Add-PlannedStep -Name 'Release-gate test-account provisioning tests' -Command 'node --test --test-reporter=spec tests/86chaos-release-gate/test-account-provisioning.test.cjs' -Required $true }
if (Test-FileExists $targetedScript) { Add-PlannedStep -Name 'Current-version targeted tests' -Command ('node ' + $targetedScript) -Required $true }
Add-PlannedStep -Name 'Client tests' -Command 'npm run test:client -- --runInBand --verbose' -Required $true
Add-PlannedStep -Name 'Server tests' -Command 'node --test --test-reporter=spec api/*.test.cjs' -Required $true
Add-PlannedStep -Name 'Rules tests' -Command 'npm run test:rules --if-present' -Required $false
Add-PlannedStep -Name 'Lint' -Command 'npm run lint --if-present -- --quiet' -Required $false
if (-not $NoBuild) { Add-PlannedStep -Name 'Production build' -Command 'npm run build' -Required $true }
if ($FailedOnlyReleaseGate) { Add-PlannedStep -Name 'Failed-only Playwright release gate' -Command 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1' -Required $true }
if ($IncludeReleaseGate) { Add-PlannedStep -Name 'Full Playwright release gate' -Command 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1' -Required $true }
Write-TestPlan

$ok = $true
$installOk = $true

Run-Step -Name 'Node and npm versions' -Command 'node --version & npm --version' | Out-Null

$nodeOk = Run-Step -Name 'Node version project check' -Command 'npm run node:check --if-present' -Required
if (-not $nodeOk) { $ok = $false; $installOk = $false }

if ($installOk -and -not $SkipInstall) {
  $installOk = Run-Step -Name 'Install locked dependencies' -Command 'npm ci --include=dev --no-audit --no-fund' -Required
  if (-not $installOk) { $ok = $false }
} elseif ($SkipInstall) {
  Write-Host 'Skipping npm ci because -SkipInstall was supplied.' -ForegroundColor Yellow
}

if ($installOk) {
  $stepOk = Run-Step -Name 'Lockfile integrity' -Command 'npm run lock:integrity --if-present' -Required
  if (-not $stepOk) { $ok = $false }

  $stepOk = Run-Step -Name 'Source validators' -Command 'npm run test:source' -Required
  if (-not $stepOk) { $ok = $false }

  $stepOk = Run-Step -Name 'API syntax' -Command 'npm run syntax:api' -Required
  if (-not $stepOk) { $ok = $false }

  $stepOk = Run-Step -Name 'Python syntax' -Command 'npm run syntax:py' -Required
  if (-not $stepOk) { $ok = $false }

  $stepOk = Run-Step -Name 'Performance split' -Command 'npm run performance:split' -Required
  if (-not $stepOk) { $ok = $false }

  if (Test-FileExists 'tests/86chaos-release-gate/test-harness-lifecycle.test.cjs') {
    $stepOk = Run-Step -Name 'Release-gate harness unit tests' -Command 'node --test --test-reporter=spec tests/86chaos-release-gate/test-harness-lifecycle.test.cjs' -Required
    if (-not $stepOk) { $ok = $false }
  }

  if (Test-FileExists 'tests/86chaos-release-gate/test-account-provisioning.test.cjs') {
    $stepOk = Run-Step -Name 'Release-gate test-account provisioning tests' -Command 'node --test --test-reporter=spec tests/86chaos-release-gate/test-account-provisioning.test.cjs' -Required
    if (-not $stepOk) { $ok = $false }
  }

  if (Test-FileExists $targetedScript) {
    $stepOk = Run-Step -Name 'Current-version targeted tests' -Command ('node ' + $targetedScript) -Required
    if (-not $stepOk) { $ok = $false }
  } else {
    Write-Host ('No current-version targeted test found at ' + $targetedScript) -ForegroundColor Yellow
  }

  $stepOk = Run-Step -Name 'Client tests' -Command 'npm run test:client -- --runInBand --verbose' -Required
  if (-not $stepOk) { $ok = $false }

  $stepOk = Run-Step -Name 'Server tests' -Command 'node --test --test-reporter=spec api/*.test.cjs' -Required
  if (-not $stepOk) { $ok = $false }

  Run-Step -Name 'Rules tests' -Command 'npm run test:rules --if-present' | Out-Null
  Run-Step -Name 'Lint' -Command 'npm run lint --if-present -- --quiet' | Out-Null

  if (-not $NoBuild) {
    $stepOk = Run-Step -Name 'Production build' -Command 'npm run build' -Required
    if (-not $stepOk) { $ok = $false }
  }

  if ($FailedOnlyReleaseGate) {
    if (Test-FileExists 'RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1') {
      $stepOk = Run-Step -Name 'Failed-only Playwright release gate' -Command 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1' -Required
      if (-not $stepOk) { $ok = $false }
    } else {
      Write-Host 'Failed-only release gate runner not found.' -ForegroundColor Yellow
      $ok = $false
    }
  }

  if ($IncludeReleaseGate) {
    if (Test-FileExists 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1') {
      $stepOk = Run-Step -Name 'Full Playwright release gate' -Command 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1' -Required
      if (-not $stepOk) { $ok = $false }
    } else {
      Write-Host 'Full release gate runner not found.' -ForegroundColor Yellow
      $ok = $false
    }
  }
}

$finished = Get-Date
$summary = [ordered]@{
  runId = $script:RunId
  appVersion = $script:AppVersion
  appRoot = $script:AppRoot
  runDir = $script:RunDir
  resultZip = $script:ResultZip
  startedAt = $script:StartedAt.ToUniversalTime().ToString('o')
  finishedAt = $finished.ToUniversalTime().ToString('o')
  durationSeconds = [math]::Round(($finished - $script:StartedAt).TotalSeconds, 2)
  ok = [bool]$ok
  steps = $script:Steps
}
$summaryJson = Join-Path $script:RunDir 'local-suite-summary.json'
$summaryMd = Join-Path $script:RunDir 'local-suite-summary.md'
$summary | ConvertTo-Json -Depth 12 | Set-Content -Path $summaryJson -Encoding UTF8

$passed = @($script:Steps | Where-Object { $_.status -eq 'passed' }).Count
$failed = @($script:Steps | Where-Object { $_.status -ne 'passed' }).Count
$md = @()
$md += '# 86 Chaos Full Local Test Suite'
$md += ''
$md += ('- Run ID: ' + $script:RunId)
$md += ('- App version: ' + $script:AppVersion)
if ($ok) { $md += '- Result: PASS' } else { $md += '- Result: FAIL' }
$md += ('- Passed steps: ' + $passed)
$md += ('- Failed steps: ' + $failed)
$md += ('- Run directory: ' + $script:RunDir)
$md += '- Result ZIP: PENDING'
$md += ''
$md += '## Steps'
foreach ($s in $script:Steps) {
  $mark = if ($s.status -eq 'passed') { 'PASS' } else { 'FAIL' }
  $md += ('- [' + $mark + '] ' + $s.name + ' - exit ' + $s.exitCode)
  $md += ('  - Log: ' + $s.log)
  if ($s.npmDebugLogs -and $s.npmDebugLogs.Count -gt 0) {
    foreach ($npmLog in $s.npmDebugLogs) { $md += ('  - npm debug log: ' + $npmLog) }
  }
}
($md -join "`n") | Set-Content -Path $summaryMd -Encoding UTF8

$resultZip = Create-ResultZip
if ($resultZip) {
  $summary.resultZip = $resultZip
  $summary | ConvertTo-Json -Depth 12 | Set-Content -Path $summaryJson -Encoding UTF8
  ((Get-Content $summaryMd -Raw).Replace('- Result ZIP: PENDING', ('- Result ZIP: ' + $resultZip))) | Set-Content -Path $summaryMd -Encoding UTF8
  try {
    Remove-Item $resultZip -Force -ErrorAction SilentlyContinue
    Compress-Archive -Path (Join-Path $script:RunDir '*') -DestinationPath $resultZip -Force
  } catch {}
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor DarkGray
Write-Host 'LOCAL TEST SUITE SUMMARY' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor DarkGray
Write-Host ('Passed steps: ' + $passed)
Write-Host ('Failed steps: ' + $failed)
Write-Host ('Summary: ' + $summaryMd)
Write-Host ('Logs: ' + $script:RunDir)
if ($resultZip) {
  Write-Host 'UPLOAD THIS RESULTS ZIP FOR REVIEW:' -ForegroundColor Green
  Write-Host $resultZip -ForegroundColor Green
} else {
  Write-Host 'Result ZIP could not be created. Use the Logs folder above.' -ForegroundColor Yellow
}

if ($ok) {
  Write-RunnerState -Phase 'finished' -BlockingReason ''
  exit 0
}
Write-RunnerState -Phase 'finished' -BlockingReason 'One or more required steps failed.'
exit 1
