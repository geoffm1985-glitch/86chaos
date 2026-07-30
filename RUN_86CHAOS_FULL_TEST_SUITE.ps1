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

$ErrorActionPreference = "Stop"

function Find-AppRoot {
  $dir = (Get-Location).Path
  while ($true) {
    $pkg = Join-Path $dir "package.json"
    if (Test-Path $pkg) {
      try {
        $raw = Get-Content $pkg -Raw
        if ($raw -match '"name"\s*:\s*"86chaos"' -or $raw -match '86\s*Chaos' -or (Test-Path (Join-Path $dir "src"))) {
          return $dir
        }
      } catch {}
    }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  throw "Could not find the 86chaos app root. Run this from the folder that contains package.json."
}

function New-RunId {
  return "local-suite-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Write-RunnerState {
  param([string]$Phase, [string]$BlockingReason = "")
  $state = [ordered]@{
    runId = $script:RunId
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    appRoot = $script:AppRoot
    currentPhase = $Phase
    blockingReason = $BlockingReason
    steps = $script:Steps
  }
  $state | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $script:RunDir "local-suite-state.json") -Encoding UTF8
}

function Show-LogTail {
  param([string]$LogPath)
  if (-not (Test-Path $LogPath)) { return }
  Write-Host "`nLast log lines:" -ForegroundColor Yellow
  try { Get-Content $LogPath -Tail 80 | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray } } catch {}
}

function Run-Step {
  param(
    [string]$Name,
    [string]$Command,
    [switch]$Required
  )

  Write-Host "`n============================================================" -ForegroundColor DarkGray
  Write-Host $Name -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host $Command -ForegroundColor Gray

  $safe = ($Name -replace '[^A-Za-z0-9_.-]+','_').Trim('_')
  $log = Join-Path $script:RunDir ("{0:00}-{1}.log" -f ($script:Steps.Count + 1), $safe)
  $started = Get-Date
  $exitCode = 0
  $status = "passed"
  $message = ""

  try {
    Push-Location $script:AppRoot
    cmd.exe /d /s /c $Command 2>&1 | Tee-Object -FilePath $log
    $exitCode = $LASTEXITCODE
    Pop-Location
  } catch {
    try { Pop-Location } catch {}
    $exitCode = 1
    $message = $_.Exception.Message
    $message | Add-Content -Path $log
  }

  if ($exitCode -ne 0) { $status = "failed" }
  $ended = Get-Date
  $step = [ordered]@{
    name = $Name
    command = $Command
    required = [bool]$Required
    status = $status
    exitCode = $exitCode
    startedAt = $started.ToUniversalTime().ToString("o")
    endedAt = $ended.ToUniversalTime().ToString("o")
    durationSeconds = [math]::Round(($ended - $started).TotalSeconds, 2)
    log = $log
    message = $message
  }
  $script:Steps.Add($step) | Out-Null
  Write-RunnerState -Phase $Name

  if ($exitCode -ne 0) {
    Show-LogTail -LogPath $log
    if ($Name -match 'Node version project check|Install locked dependencies') {
      Write-Host "`nCommon fix: 86 Chaos requires Node 24.x. Install/use Node 24, then rerun this same command." -ForegroundColor Yellow
      Write-Host "Check with: node --version" -ForegroundColor Yellow
    }
    if ($Required) {
      Write-Host "FAILED REQUIRED STEP: $Name" -ForegroundColor Red
      return $false
    }
    Write-Host "FAILED OPTIONAL STEP: $Name" -ForegroundColor Yellow
    return $false
  }

  Write-Host "PASSED: $Name" -ForegroundColor Green
  return $true
}

function Test-FileExists {
  param([string]$Path)
  return Test-Path (Join-Path $script:AppRoot $Path)
}

function Get-AppVersion {
  $version = "unknown"
  $versionJson = Join-Path $script:AppRoot "public/version.json"
  if (Test-Path $versionJson) {
    try {
      $obj = Get-Content $versionJson -Raw | ConvertFrom-Json
      if ($obj.version) { $version = [string]$obj.version }
    } catch {}
  }
  if ($version -eq "unknown") {
    try {
      $pkg = Get-Content (Join-Path $script:AppRoot "package.json") -Raw | ConvertFrom-Json
      if ($pkg.version) { $version = [string]$pkg.version }
    } catch {}
  }
  return $version
}

$script:AppRoot = Find-AppRoot
Set-Location $script:AppRoot
$script:RunId = New-RunId
$script:RunDir = Join-Path $script:AppRoot ("test-results/86chaos-full-local-suite/{0}" -f $script:RunId)
New-Item -ItemType Directory -Force $script:RunDir | Out-Null
$script:Steps = New-Object System.Collections.ArrayList
$script:StartedAt = Get-Date
$script:AppVersion = Get-AppVersion

Write-Host "86 Chaos full local test suite" -ForegroundColor Cyan
Write-Host "App root: $script:AppRoot"
Write-Host "Run ID: $script:RunId"
Write-Host "Run dir: $script:RunDir"
Write-Host "App version: $script:AppVersion"
Write-RunnerState -Phase "started"

if (-not (Test-Path (Join-Path $script:AppRoot "package.json"))) {
  throw "package.json was not found in $script:AppRoot"
}
if (-not (Test-Path (Join-Path $script:AppRoot "package-lock.json"))) {
  throw "package-lock.json was not found. This runner requires the committed lockfile."
}

$ok = $true
$installOk = $true

Run-Step -Name "Node and npm versions" -Command "node --version && npm --version" | Out-Null

# Run the project Node gate before npm ci so unsupported Node versions fail clearly
# instead of showing a confusing dependency-install failure.
$nodeOk = Run-Step -Name "Node version project check" -Command "npm run node:check --if-present" -Required
if (-not $nodeOk) { $ok = $false; $installOk = $false }

if ($installOk -and -not $SkipInstall) {
  $installOk = Run-Step -Name "Install locked dependencies" -Command "npm ci --include=dev --no-audit --no-fund" -Required
  if (-not $installOk) { $ok = $false }
} elseif ($SkipInstall) {
  Write-Host "Skipping npm ci because -SkipInstall was supplied." -ForegroundColor Yellow
}

if ($installOk) {
  Run-Step -Name "Lockfile integrity" -Command "npm run lock:integrity --if-present" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  Run-Step -Name "Source validators" -Command "npm run test:source" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  Run-Step -Name "API syntax" -Command "npm run syntax:api" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  Run-Step -Name "Python syntax" -Command "npm run syntax:py" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  Run-Step -Name "Performance split" -Command "npm run performance:split" -Required | ForEach-Object { if (-not $_) { $ok = $false } }

  if (Test-FileExists "tests/86chaos-release-gate/test-harness-lifecycle.test.cjs") {
    Run-Step -Name "Release-gate harness unit tests" -Command "node --test tests/86chaos-release-gate/test-harness-lifecycle.test.cjs" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  }

  if (Test-FileExists "tests/86chaos-release-gate/test-account-provisioning.test.cjs") {
    Run-Step -Name "Release-gate test-account provisioning tests" -Command "node --test tests/86chaos-release-gate/test-account-provisioning.test.cjs" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  }

  $versionDashed = $script:AppVersion -replace '\.','-'
  $targetedScript = "scripts/test-$versionDashed-targeted.cjs"
  if (Test-FileExists $targetedScript) {
    Run-Step -Name "Current-version targeted tests" -Command "node $targetedScript" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  } else {
    Write-Host "No current-version targeted test found at $targetedScript" -ForegroundColor Yellow
  }

  Run-Step -Name "Client tests" -Command "npm run test:client -- --runInBand" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  Run-Step -Name "Server tests" -Command "npm run test:server --if-present" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  Run-Step -Name "Rules tests" -Command "npm run test:rules --if-present" | Out-Null
  Run-Step -Name "Lint" -Command "npm run lint --if-present -- --quiet" | Out-Null

  if (-not $NoBuild) {
    Run-Step -Name "Production build" -Command "npm run build" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
  }

  if ($FailedOnlyReleaseGate) {
    if (Test-FileExists "RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1") {
      Run-Step -Name "Failed-only Playwright release gate" -Command "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_FAILED_ONLY_RELEASE_GATE.ps1" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
    } else {
      Write-Host "Failed-only release gate runner not found." -ForegroundColor Yellow
      $ok = $false
    }
  }

  if ($IncludeReleaseGate) {
    if (Test-FileExists "RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1") {
      Run-Step -Name "Full Playwright release gate" -Command "powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1" -Required | ForEach-Object { if (-not $_) { $ok = $false } }
    } else {
      Write-Host "Full release gate runner not found." -ForegroundColor Yellow
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
  startedAt = $script:StartedAt.ToUniversalTime().ToString("o")
  finishedAt = $finished.ToUniversalTime().ToString("o")
  durationSeconds = [math]::Round(($finished - $script:StartedAt).TotalSeconds, 2)
  ok = [bool]$ok
  steps = $script:Steps
}
$summaryJson = Join-Path $script:RunDir "local-suite-summary.json"
$summaryMd = Join-Path $script:RunDir "local-suite-summary.md"
$summary | ConvertTo-Json -Depth 10 | Set-Content -Path $summaryJson -Encoding UTF8

$passed = @($script:Steps | Where-Object { $_.status -eq "passed" }).Count
$failed = @($script:Steps | Where-Object { $_.status -ne "passed" }).Count
$md = @()
$md += "# 86 Chaos Full Local Test Suite"
$md += ""
$md += "- Run ID: $script:RunId"
$md += "- App version: $script:AppVersion"
$md += "- Result: " + ($(if ($ok) { "PASS" } else { "FAIL" }))
$md += "- Passed steps: $passed"
$md += "- Failed steps: $failed"
$md += "- Run directory: $script:RunDir"
$md += ""
$md += "## Steps"
foreach ($s in $script:Steps) {
  $mark = if ($s.status -eq "passed") { "PASS" } else { "FAIL" }
  $md += "- [$mark] $($s.name) - exit $($s.exitCode)"
}
$md -join "`n" | Set-Content -Path $summaryMd -Encoding UTF8

Write-Host "`n============================================================" -ForegroundColor DarkGray
Write-Host "LOCAL TEST SUITE SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkGray
Write-Host "Passed steps: $passed"
Write-Host "Failed steps: $failed"
Write-Host "Summary: $summaryMd"
Write-Host "Logs: $script:RunDir"

Write-RunnerState -Phase "finished" -BlockingReason ($(if ($ok) { "" } else { "One or more required steps failed." }))

if ($ok) { exit 0 }
exit 1
