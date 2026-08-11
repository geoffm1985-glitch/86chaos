<#
86 Chaos exhaustive full test-suite runner.
Primary command:
  npm run test:full-suite
Local-only command:
  npm run test:full-suite:local
#>
param(
  [switch]$Exhaustive,
  [switch]$LocalOnly,
  [switch]$SkipInstall,
  [switch]$NoBuild,
  [switch]$FailedOnlyReleaseGate,
  [switch]$IncludeReleaseGate
)
$ErrorActionPreference = 'Stop'
$script:AppVersion = '16.0.192'
$script:Steps = New-Object System.Collections.ArrayList
$script:Plan = New-Object System.Collections.ArrayList
$script:GroupStatus = @{}
$script:ResultZip = ''
function Find-AppRoot {
  $dir = (Get-Location).Path
  while ($true) {
    if ((Test-Path (Join-Path $dir 'package.json')) -and (Test-Path (Join-Path $dir 'src'))) { return $dir }
    $parent = Split-Path $dir -Parent
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  throw 'Could not find the 86chaos app root. Run this from the folder that contains package.json.'
}
function Safe-Name([string]$Value) { if ([string]::IsNullOrWhiteSpace($Value)) { return 'step' }; return (($Value -replace '[^A-Za-z0-9_.-]+','_').Trim('_')) }
function Status-Color([string]$Status) { if ($Status -eq 'pass') { return 'Green' }; if ($Status -eq 'fail') { return 'Red' }; if ($Status -eq 'blocked') { return 'Yellow' }; if ($Status -eq 'running') { return 'Cyan' }; return 'DarkGray' }
function Add-PlannedStep {
  param([string]$Group,[string]$Name,[string]$Command,[bool]$Required = $true,[string]$Capability = '',[bool]$Mutates = $false,[string]$SafeProject = '')
  $script:Plan.Add([ordered]@{ group=$Group; name=$Name; command=$Command; required=$Required; capability=$Capability; mutates=$Mutates; safeProject=$SafeProject }) | Out-Null
}
function Add-BlockedStep {
  param([string]$Group,[string]$Name,[string]$Command,[string]$Reason,[bool]$Required = $true,[string]$Capability = '')
  $now = (Get-Date).ToUniversalTime().ToString('o')
  $step = [ordered]@{ group=$Group; name=$Name; command=$Command; required=$Required; status='blocked'; exitCode=$null; reason=$Reason; startedAt=$now; endedAt=$now; durationSeconds=0; log='' }
  $script:Steps.Add($step) | Out-Null
  Write-Host ('[BLOCKED] ' + $Name + ' - ' + $Reason) -ForegroundColor Yellow
}
function Invoke-LoggedNativeCommand {
  param([string]$Command,[string]$Log)
  $cmdLine = $Command + ' 2>&1'
  & $env:ComSpec /d /s /c $cmdLine | Tee-Object -FilePath $Log
  $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
  return [ordered]@{ exitCode=$exitCode; log=$Log }
}
function Get-SafeNativeFirstLine {
  param([string]$Command,[string]$Fallback = 'unavailable')
  try {
    $cmdLine = $Command + ' 2>&1'
    $lines = & $env:ComSpec /d /s /c $cmdLine
    $first = @($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1)
    if ($first.Count -gt 0) { return [string]$first[0] }
    return $Fallback
  } catch {
    return $Fallback
  }
}
function Get-LocalPackageVersion {
  param([string]$RelativePackageJson)
  try {
    $packagePath = Join-Path $script:AppRoot $RelativePackageJson
    if (-not (Test-Path $packagePath)) { return 'not installed' }
    $package = Get-Content -Raw -Path $packagePath | ConvertFrom-Json
    if ($package.version) { return [string]$package.version }
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}
function Save-NpmAuditJson {
  $target = Join-Path $script:RunDir 'npm-audit.json'
  try {
    $cmdLine = 'npm audit --json > "' + $target + '" 2>&1'
    & $env:ComSpec /d /s /c $cmdLine | Out-Null
    if (-not (Test-Path $target)) { '{"error":"npm audit json was not produced"}' | Set-Content -Path $target -Encoding UTF8 }
  } catch {
    ('{"error":"npm audit json capture failed","message":"' + ($_.Exception.Message -replace '"','\"') + '"}') | Set-Content -Path $target -Encoding UTF8
  }
}
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
function Import-TestEnvFileForMutatingSuite {
  param([hashtable]$Map)
  $allowedPrefixes = @('CHAOS_', 'REACT_APP_', 'APP_URL', 'OWNER_', 'MANAGER_', 'STAFF_', 'SYSTEM_ADMIN_')
  foreach ($name in $Map.Keys) {
    $allowed = $false
    foreach ($prefix in $allowedPrefixes) { if ($name.StartsWith($prefix)) { $allowed = $true } }
    if (-not $allowed) { continue }
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $Map[$name], 'Process')
    }
  }
}
function Resolve-TargetFirebaseProjectId {
  $projectKeys = @(
    'CHAOS_TEST_FIREBASE_PROJECT_ID',
    'CHAOS_QA_FIREBASE_PROJECT_ID',
    'CHAOS_FIREBASE_PROJECT_ID',
    'CHAOS_TARGET_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_PROJECT_ID'
  )
  $values = @()
  foreach ($key in $projectKeys) {
    $value = [Environment]::GetEnvironmentVariable($key, 'Process')
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $values += [pscustomobject]@{ key=$key; value=$value.Trim(); source='process/.env.test.local' }
    }
  }
  $unique = @($values | ForEach-Object { $_.value } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
  $script:ResolvedFirebaseProjectSources = $values
  if ($unique -contains 'cheers-34b8d') { $script:ResolvedFirebaseProjectError = 'Production Firebase project cheers-34b8d is selected or conflicting.'; return 'cheers-34b8d' }
  if ($unique.Count -gt 1) { $script:ResolvedFirebaseProjectError = 'Conflicting Firebase project identities: ' + ($unique -join ', '); return '__conflict__' }
  if ($unique.Count -eq 1) { $script:ResolvedFirebaseProjectError = ''; return [string]$unique[0] }
  $script:ResolvedFirebaseProjectError = 'Firebase project identity is missing.'
  return ''
}
function Initialize-FullSuiteQaEnvironment {
  $script:ResolvedFirebaseProjectSources = @()
  $script:ResolvedFirebaseProjectError = ''
  $script:EnvTestLocalPath = Join-Path $script:AppRoot '.env.test.local'
  $script:EnvTestLocal = Read-EnvFileMap $script:EnvTestLocalPath
  Import-TestEnvFileForMutatingSuite $script:EnvTestLocal
  if (-not $env:CHAOS_EXPECTED_VERSION) { $env:CHAOS_EXPECTED_VERSION = $script:AppVersion }
  if (-not $env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG) { $env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG = '86chaos' }
  $resolved = Resolve-TargetFirebaseProjectId
  Write-Host 'Full-suite QA target resolution:' -ForegroundColor Cyan
  Write-Host ('  .env.test.local: ' + $script:EnvTestLocalPath) -ForegroundColor Cyan
  Write-Host ('  resolved Firebase project: ' + $resolved) -ForegroundColor Cyan
  if ($script:ResolvedFirebaseProjectError) { Write-Host ('  project guard: ' + $script:ResolvedFirebaseProjectError) -ForegroundColor Yellow }
}
function SafeProjectBlockReason([string]$Expected = 'chaos-test-d1601') {
  $targetProject = Resolve-TargetFirebaseProjectId
  if ($targetProject -eq $Expected) { return '' }
  if ($targetProject -eq 'cheers-34b8d') { return 'Production Firebase project cheers-34b8d is forbidden for automated mutating QA work.' }
  if ($targetProject -eq '__conflict__') { return $script:ResolvedFirebaseProjectError }
  if ([string]::IsNullOrWhiteSpace($targetProject)) { return 'Firebase project identity is missing or unknown.' }
  return 'Safe Firebase dry-run target is not exactly chaos-test-d1601.'
}
function Get-CurrentStepStatus {
  param([string]$Group,[string]$Name)
  $matches = @($script:Steps | Where-Object { $_.group -eq $Group -and $_.name -eq $Name })
  if ($matches.Count -eq 0) { return '' }
  return [string]$matches[$matches.Count - 1].status
}
function Prepare-CostReportValidationEnv {
  $lastRunPath = Join-Path $script:AppRoot 'test-results/86chaos-play-store-release-gate/.last-run.json'
  if (-not (Test-Path $lastRunPath)) { return 'Cost regression current-run handoff is missing: .last-run.json was not produced by the browser gate.' }
  try { $last = Get-Content -Raw -Path $lastRunPath | ConvertFrom-Json } catch { return 'Cost regression current-run handoff is unreadable.' }
  if ([string]$last.mode -ne 'full') { return 'Cost regression requires a current full release-gate run, not failed-only or repair mode.' }
  if ([string]::IsNullOrWhiteSpace([string]$last.runId) -or [string]::IsNullOrWhiteSpace([string]$last.runDir)) { return 'Cost regression current-run handoff is missing runId or runDir.' }
  if (-not (Test-Path ([string]$last.runDir))) { return 'Cost regression current run directory does not exist.' }
  $scenarioDir = Join-Path ([string]$last.runDir) 'cost-scenarios'
  if (-not (Test-Path $scenarioDir)) { return 'Cost regression current-run cost-scenarios directory does not exist.' }
  $env:CHAOS_COST_SCENARIO_REPORT_DIR = $scenarioDir
  $env:CHAOS_COST_EXPECTED_RUN_ID = [string]$last.runId
  $env:CHAOS_COST_EXPECTED_FIREBASE_PROJECT_ID = 'chaos-test-d1601'
  $env:CHAOS_COST_EXPECTED_VERSION = $script:AppVersion
  return ''
}
function Run-Step {
  param([string]$Group,[string]$Name,[string]$Command,[bool]$Required = $true)
  Write-Host ''
  Write-Host ('>>> ' + $Group + ' / ' + $Name) -ForegroundColor Cyan
  Write-Host $Command -ForegroundColor DarkGray
  $safe = Safe-Name ($Group + '-' + $Name)
  $log = Join-Path $script:LogDir (('{0:00}-{1}.log' -f ($script:Steps.Count + 1), $safe))
  $started = Get-Date
  $exitCode = 1
  try {
    Push-Location $script:AppRoot
    $nativeResult = Invoke-LoggedNativeCommand -Command $Command -Log $log
    $exitCode = [int]$nativeResult.exitCode
  } catch {
    $_.Exception.Message | Add-Content -Path $log
    $exitCode = 1
  } finally {
    try { Pop-Location } catch {}
  }
  if ($Command -eq 'npm audit --audit-level=high') { Save-NpmAuditJson }
  $ended = Get-Date
  $status = if ($exitCode -eq 0) { 'pass' } else { 'fail' }
  $step = [ordered]@{ group=$Group; name=$Name; command=$Command; required=$Required; status=$status; exitCode=$exitCode; reason=''; startedAt=$started.ToUniversalTime().ToString('o'); endedAt=$ended.ToUniversalTime().ToString('o'); durationSeconds=[math]::Round(($ended - $started).TotalSeconds,2); log=$log }
  $script:Steps.Add($step) | Out-Null
  $label = if ($status -eq 'pass') { '[PASS]   ' } else { '[FAIL]   ' }
  Write-Host ($label + ' ' + $Name + ' (' + $step.durationSeconds + 's)') -ForegroundColor (Status-Color $status)
  return ($exitCode -eq 0)
}
function Test-CommandAvailable([string]$Command) { try { return [bool](Get-Command $Command -ErrorAction SilentlyContinue) } catch { return $false } }
function Write-PlanFiles {
  $jsonPath = Join-Path $script:RunDir 'FULL-TEST-PLAN.json'
  $mdPath = Join-Path $script:RunDir 'FULL-TEST-PLAN.md'
  $script:Plan | ConvertTo-Json -Depth 8 | Set-Content -Path $jsonPath -Encoding UTF8
  $md = @('# 86 Chaos Full Test Plan','','App version: ' + $script:AppVersion,'Run ID: ' + $script:RunId,'')
  foreach ($p in $script:Plan) { $md += ('- **' + $p.group + ' / ' + $p.name + '**'); $md += ('  - Command: `' + $p.command + '`'); $md += ('  - Required capability: ' + $p.capability); $md += ('  - Mutates external test infrastructure: ' + $p.mutates); $md += ('  - Expected safe project: ' + $p.safeProject) }
  ($md -join "`n") | Set-Content -Path $mdPath -Encoding UTF8
  Write-Host 'FULL TEST PLAN' -ForegroundColor Cyan
  foreach ($p in $script:Plan) { Write-Host ('- ' + $p.group + ' / ' + $p.name + ' :: ' + $p.command) -ForegroundColor Gray }
}
function Last-ErrorExcerpt([string]$Log) { if (-not $Log -or -not (Test-Path $Log)) { return '' }; return ((Get-Content $Log -Tail 40 -ErrorAction SilentlyContinue) -join "`n") }
function Write-Reports {
  $passed = @($script:Steps | Where-Object { $_.status -eq 'pass' }).Count
  $failed = @($script:Steps | Where-Object { $_.status -eq 'fail' }).Count
  $blocked = @($script:Steps | Where-Object { $_.status -eq 'blocked' }).Count
  $overall = if ($failed -gt 0) { 'FAIL' } elseif ($blocked -gt 0) { 'INCOMPLETE / BLOCKED' } else { 'PASS' }
  $summary = [ordered]@{ runId=$script:RunId; appVersion=$script:AppVersion; startedAt=$script:StartedAt.ToUniversalTime().ToString('o'); endedAt=(Get-Date).ToUniversalTime().ToString('o'); overall=$overall; pass=$passed; fail=$failed; blocked=$blocked; steps=$script:Steps }
  $summary | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $script:RunDir 'full-suite-summary.json') -Encoding UTF8
  $summary | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $script:RunDir 'local-suite-summary.json') -Encoding UTF8
  $state = [ordered]@{ runId=$script:RunId; appVersion=$script:AppVersion; resultZip=$script:ResultZip; steps=$script:Steps }
  $state | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $script:RunDir 'local-suite-state.json') -Encoding UTF8
  $txt = @('86 CHAOS FULL SUITE TEST SUMMARY','Run ID: ' + $script:RunId,'App version: ' + $script:AppVersion,'Overall: ' + $overall,'PASS: ' + $passed,'FAIL: ' + $failed,'BLOCKED: ' + $blocked,'','GROUP RESULTS')
  foreach ($g in ($script:Steps | Group-Object group)) { $gs = if (@($g.Group | Where-Object status -eq 'fail').Count -gt 0) { 'FAIL' } elseif (@($g.Group | Where-Object status -eq 'blocked').Count -gt 0) { 'BLOCKED' } else { 'PASS' }; $txt += ($g.Name + ': ' + $gs) }
  $txt += ''; $txt += 'FAILED TESTS'; foreach ($s in $script:Steps | Where-Object status -eq 'fail') { $txt += ('- ' + $s.group + ' / ' + $s.name) }
  $txt += ''; $txt += 'BLOCKED TESTS'; foreach ($s in $script:Steps | Where-Object status -eq 'blocked') { $txt += ('- ' + $s.group + ' / ' + $s.name + ' - ' + $s.reason) }
  ($txt -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'TEST-SUMMARY.txt') -Encoding UTF8
  $failedLines = @(); foreach ($s in $script:Steps | Where-Object status -eq 'fail') { $failedLines += ('STEP: ' + $s.group + ' / ' + $s.name); $failedLines += ('COMMAND: ' + $s.command); $failedLines += ('EXIT: ' + $s.exitCode); $failedLines += ('SECONDS: ' + $s.durationSeconds); $failedLines += ('LOG: ' + $s.log); $failedLines += (Last-ErrorExcerpt $s.log); $failedLines += '' }
  if ($failedLines.Count -eq 0) { $failedLines = @('No failed tests.') }
  ($failedLines -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'FAILED-TESTS.txt') -Encoding UTF8
  $blockedLines = @(); foreach ($s in $script:Steps | Where-Object status -eq 'blocked') { $blockedLines += ('STEP: ' + $s.group + ' / ' + $s.name); $blockedLines += ('MISSING PREREQUISITE: ' + $s.reason); $blockedLines += ('COMMAND: ' + $s.command); $blockedLines += 'HOW TO UNBLOCK: install/configure the prerequisite or use chaos-test-d1601 safe QA infrastructure as required.'; $blockedLines += '' }
  if ($blockedLines.Count -eq 0) { $blockedLines = @('No blocked tests.') }
  ($blockedLines -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'BLOCKED-TESTS.txt') -Encoding UTF8
  $md = @('# 86 Chaos Full Suite Summary','','VERSION: ' + $script:AppVersion,'','OVERALL: ' + $overall,'','| Status | Group | Step | Exit | Seconds | Log |','|---|---|---|---:|---:|---|')
  foreach ($s in $script:Steps) { $icon = if ($s.status -eq 'pass') { '✅ PASS' } elseif ($s.status -eq 'fail') { '❌ FAIL' } else { '⚠ BLOCKED' }; $md += ('| ' + $icon + ' | ' + $s.group + ' | ' + $s.name + ' | ' + $s.exitCode + ' | ' + $s.durationSeconds + ' | ' + $s.log + ' |') }
  ($md -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'FULL-SUITE-SUMMARY.md') -Encoding UTF8
  $envLines = @(
    'OS: ' + [System.Environment]::OSVersion.VersionString,
    'Node version: ' + (Get-SafeNativeFirstLine 'node --version' 'not installed'),
    'npm version: ' + (Get-SafeNativeFirstLine 'npm --version' 'not installed'),
    'PowerShell version: ' + $PSVersionTable.PSVersion.ToString(),
    'Java version: ' + (Get-SafeNativeFirstLine 'java -version' 'not installed'),
    'Git version: ' + (Get-SafeNativeFirstLine 'git --version' 'not installed'),
    'Firebase CLI version: ' + (Get-LocalPackageVersion 'node_modules/firebase-tools/package.json'),
    'Playwright version: ' + (Get-LocalPackageVersion 'node_modules/@playwright/test/package.json'),
    'App version: ' + $script:AppVersion
  )
  ($envLines -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'ENVIRONMENT.txt') -Encoding UTF8
  $hashFiles = @('package.json','package-lock.json','firestore.rules','storage.rules','database.rules.json','firestore.indexes.json','firebase.json','vercel.json','public/version.json')
  $hashes = @{}
  foreach ($f in $hashFiles) { $p = Join-Path $script:AppRoot $f; if (Test-Path $p) { $hashes[$f] = (Get-FileHash -Algorithm SHA256 $p).Hash.ToLowerInvariant() } }
  $hashes | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $script:RunDir 'SOURCE-INTEGRITY.json') -Encoding UTF8
  $dependencyBlockers = Join-Path $script:AppRoot 'DEPENDENCY-SECURITY-BLOCKERS.txt'
  if (Test-Path $dependencyBlockers) { Copy-Item -Path $dependencyBlockers -Destination (Join-Path $script:RunDir 'DEPENDENCY-SECURITY-BLOCKERS.txt') -Force }
}
function Write-EmergencyReports {
  param([string]$Message)
  $safeMessage = if ([string]::IsNullOrWhiteSpace($Message)) { 'Unknown reporting failure.' } else { ($Message -replace '(?i)(token|secret|password|key)=\S+', '$1=[redacted]') }
  $summary = @('REPORT GENERATION ERROR', 'App version: ' + $script:AppVersion, 'Run ID: ' + $script:RunId, 'Error: ' + $safeMessage)
  ($summary -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'TEST-SUMMARY.txt') -Encoding UTF8
  ('REPORT GENERATION ERROR' + "`n" + $safeMessage) | Set-Content -Path (Join-Path $script:RunDir 'FAILED-TESTS.txt') -Encoding UTF8
  'Report generation failed before blocked-test details could be written.' | Set-Content -Path (Join-Path $script:RunDir 'BLOCKED-TESTS.txt') -Encoding UTF8
  $envLines = @(
    'REPORT GENERATION ERROR',
    'OS: ' + [System.Environment]::OSVersion.VersionString,
    'Node version: ' + (Get-SafeNativeFirstLine 'node --version' 'not installed'),
    'npm version: ' + (Get-SafeNativeFirstLine 'npm --version' 'not installed'),
    'Java version: ' + (Get-SafeNativeFirstLine 'java -version' 'not installed'),
    'Error: ' + $safeMessage
  )
  ($envLines -join "`n") | Set-Content -Path (Join-Path $script:RunDir 'ENVIRONMENT.txt') -Encoding UTF8
}
function Update-ResultZipMetadata {
  param([string]$ZipPath)
  foreach ($name in @('local-suite-state.json','full-suite-summary.json','local-suite-summary.json')) {
    $path = Join-Path $script:RunDir $name
    if (Test-Path $path) {
      try {
        $json = Get-Content -Raw -Path $path | ConvertFrom-Json
        $json | Add-Member -NotePropertyName resultZip -NotePropertyValue $ZipPath -Force
        $json | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding UTF8
      } catch {}
    }
  }
}
function Create-UploadZip {
  $zip = Join-Path $script:AppRoot ('86chaos-FULL-SUITE-UPLOAD-ME-16.0.192-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path $script:RunDir '*') -DestinationPath $zip -Force
  if (-not (Test-Path $zip)) { throw 'Upload ZIP was not created.' }
  if ((Get-Item $zip).Length -le 0) { throw 'Upload ZIP is empty.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z=[System.IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $names=@($z.Entries | ForEach-Object FullName)
    foreach ($requiredEntry in @('TEST-SUMMARY.txt','FAILED-TESTS.txt','BLOCKED-TESTS.txt')) {
      if ($names -notcontains $requiredEntry) { throw ('missing ' + $requiredEntry) }
    }
    if ((Test-Path (Join-Path $script:RunDir 'full-suite-summary.json')) -and ($names -notcontains 'full-suite-summary.json')) { throw 'missing full-suite-summary.json' }
  } finally {
    $z.Dispose()
  }
  $script:ResultZip = $zip
  Update-ResultZipMetadata $zip
  return $zip
}
$script:AppRoot = Find-AppRoot
Set-Location $script:AppRoot
$script:RunId = 'full-suite-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$script:RunDir = Join-Path $script:AppRoot (Join-Path 'test-results/86chaos-full-local-suite' $script:RunId)
$script:LogDir = Join-Path $script:RunDir 'logs'
New-Item -ItemType Directory -Force $script:LogDir | Out-Null
Initialize-FullSuiteQaEnvironment
$script:StartedAt = Get-Date
try {
  Add-PlannedStep 'Environment / Dependencies' 'Node version' 'node --version' $true 'Node runtime' $false ''
  Add-PlannedStep 'Environment / Dependencies' 'npm version' 'npm --version' $true 'npm runtime' $false ''
  Add-PlannedStep 'Environment / Dependencies' 'Node project check' 'npm run node:check' $true 'Node 24.x' $false ''
  Add-PlannedStep 'Environment / Dependencies' 'Install locked dependencies' 'npm ci --include=dev --no-audit --no-fund' $true 'npm registry' $false ''
  Add-PlannedStep 'Environment / Dependencies' 'Lockfile integrity' 'npm run lock:integrity' $true 'installed deps' $false ''
  Add-PlannedStep 'Environment / Dependencies' 'Dependency security audit' 'npm audit --audit-level=high' $true 'npm registry' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Source validator' 'npm run test:source' $true 'source' $false ''
  Add-PlannedStep 'Source / Static Validation' 'API syntax' 'npm run syntax:api' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Python syntax' 'npm run syntax:py' $true 'python' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Syntax aggregate' 'npm run syntax' $true 'node/python' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Performance split' 'npm run performance:split' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Python auth fallback validator' 'node scripts/validate-python-auth-fallback.js' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Python ops restore validator' 'node scripts/validate-python-ops-restore.js' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Full audit source validator' 'node scripts/86chaos-full-audit/validate-full-audit-source.cjs' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Release source inventory' 'node scripts/86chaos-release-gate/source-inventory.cjs' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Icon source validator' 'node scripts/86chaos-release-gate/icon-source-validator.cjs' $true 'node' $false ''
  Add-PlannedStep 'Source / Static Validation' 'Current targeted validator' 'node scripts/test-16-0-192-targeted.cjs' $true 'node' $false ''
  Add-PlannedStep 'Node / Server Unit Tests' 'Server API tests' 'node --test --test-reporter=spec api/*.test.cjs' $true 'node' $false ''
  Add-PlannedStep 'Node / Server Unit Tests' 'Server API tests serial' 'node --test --test-concurrency=1 --test-reporter=spec api/*.test.cjs' $true 'node' $false ''
  Add-PlannedStep 'Node / Server Unit Tests' 'Release harness tests' 'node --test --test-reporter=spec tests/86chaos-release-gate/*.test.cjs' $true 'node' $false ''
  Add-PlannedStep 'Node / Server Unit Tests' 'Release harness tests serial' 'node --test --test-concurrency=1 --test-reporter=spec tests/86chaos-release-gate/*.test.cjs' $true 'node' $false ''
  Add-PlannedStep 'Client / React Tests' 'Client tests' 'npm run test:client -- --runInBand --verbose' $true 'installed deps' $false ''
  Add-PlannedStep 'Security / Firebase Rules' 'Firebase rules tests' 'npm run test:rules' $true 'Java and Firebase emulator' $true 'chaos-test-d1601'
  Add-PlannedStep 'Repair Regression Pack' 'Repair current local' 'npm run test:repair-current:local' $true 'node' $false ''
  Add-PlannedStep 'Build / Lint' 'Lint' 'npm run lint' $true 'installed deps' $false ''
  if (-not $NoBuild) { Add-PlannedStep 'Build / Lint' 'Production build' 'npm run build' $true 'installed deps' $false '' }
  Add-PlannedStep 'Safe Migration / Backup Dry Runs' 'Backup setup dry run' 'node scripts/setup-native-firestore-backup.js --dry-run --project=chaos-test-d1601' $true 'safe Firebase config' $true 'chaos-test-d1601'
  Add-PlannedStep 'Safe Migration / Backup Dry Runs' 'Workspace memberships dry run' 'node scripts/migrate-workspace-memberships.js --project=chaos-test-d1601' $true 'safe Firebase config' $true 'chaos-test-d1601'
  Add-PlannedStep 'Safe Migration / Backup Dry Runs' 'Reminder migration dry run' 'node scripts/migrate-reminder-dispatch-queue.js --dry-run --project=chaos-test-d1601' $true 'safe Firebase config' $true 'chaos-test-d1601'
  Add-PlannedStep 'Safe Migration / Backup Dry Runs' 'Schedule migration dry run' 'node scripts/migrate-schedule-query-fields.js --dry-run --project=chaos-test-d1601' $true 'safe Firebase config' $true 'chaos-test-d1601'
  Add-PlannedStep 'Safe Migration / Backup Dry Runs' 'Participant migration dry run' 'node scripts/migrate-reminder-participants.js --dry-run --project=chaos-test-d1601' $true 'safe Firebase config' $true 'chaos-test-d1601'
  if (-not $LocalOnly) { Add-PlannedStep 'Full Browser Release Gate' 'Full Playwright release gate' 'npm run test:play-store' $true 'safe QA deployment' $true 'chaos-test-d1601' }
  Add-PlannedStep 'Cost / Firestore Regression' 'Cost regression' 'npm run test:cost' $true 'current browser run cost reports' $true 'chaos-test-d1601'
  Write-PlanFiles
  $depsOk = $true
  foreach ($p in $script:Plan) {
    if ($p.group -eq 'Safe Migration / Backup Dry Runs') {
      $blockReason = SafeProjectBlockReason 'chaos-test-d1601'
      if ($blockReason) { Add-BlockedStep $p.group $p.name $p.command $blockReason $p.required $p.capability; continue }
    }
    if ($p.group -eq 'Full Browser Release Gate') {
      $blockReason = SafeProjectBlockReason 'chaos-test-d1601'
      $url = $env:CHAOS_BASE_URL; if (-not $url) { $url = $env:APP_URL }
      if ($blockReason) { Add-BlockedStep $p.group $p.name $p.command $blockReason $p.required $p.capability; continue }
      if (-not $url -or $url -match 'app\.86chaos\.com|cheers-34b8d|production') { Add-BlockedStep $p.group $p.name $p.command 'Target app URL is missing or production-like.' $p.required $p.capability; continue }
    }
    if ($p.group -eq 'Cost / Firestore Regression') {
      $browserStatus = Get-CurrentStepStatus 'Full Browser Release Gate' 'Full Playwright release gate'
      if ($browserStatus -ne 'pass') { Add-BlockedStep $p.group $p.name $p.command 'Cost regression depends on a successful current Full Playwright release gate.' $p.required $p.capability; continue }
      $blockReason = SafeProjectBlockReason 'chaos-test-d1601'
      if ($blockReason) { Add-BlockedStep $p.group $p.name $p.command $blockReason $p.required $p.capability; continue }
      $costBlock = Prepare-CostReportValidationEnv
      if ($costBlock) { Add-BlockedStep $p.group $p.name $p.command $costBlock $p.required $p.capability; continue }
    }
    if ($p.name -match 'Firebase rules' -and -not (Test-CommandAvailable 'java')) { Add-BlockedStep $p.group $p.name $p.command 'Java is not installed.' $p.required $p.capability; continue }
    if (-not $depsOk -and ($p.group -match 'Client|Build|Lint|Security|Cost' -or $p.command -match 'vite|jest|eslint|test:client|build|lint|test:rules|test:cost')) { Add-BlockedStep $p.group $p.name $p.command 'Locked dependency installation failed earlier.' $p.required $p.capability; continue }
    $ok = Run-Step $p.group $p.name $p.command $p.required
    if ($p.name -eq 'Install locked dependencies' -and -not $ok) { $depsOk = $false }
  }
} catch {
  Add-BlockedStep 'Report / Artifact Integrity' 'Runner exception' '(runner)' $_.Exception.Message $true 'PowerShell'
} finally {
  $zip = ''
  try {
    Write-Reports
  } catch {
    $script:ReportingException = $_.Exception.Message
    Write-EmergencyReports $script:ReportingException
  }
  try {
    $zip = Create-UploadZip
  } catch {
    Write-Host ('UPLOAD ZIP creation failed: ' + $_.Exception.Message) -ForegroundColor Red
    $zip = ''
  }
  Write-Host ''
  Write-Host '============================================================' -ForegroundColor DarkGray
  Write-Host ('86 CHAOS FULL SUITE - ' + $script:AppVersion) -ForegroundColor Cyan
  Write-Host '============================================================' -ForegroundColor DarkGray
  foreach ($g in ($script:Steps | Group-Object group)) { $gs = if (@($g.Group | Where-Object status -eq 'fail').Count -gt 0) { 'FAIL' } elseif (@($g.Group | Where-Object status -eq 'blocked').Count -gt 0) { 'BLOCKED' } else { 'PASS' }; Write-Host ($g.Name.PadRight(34) + $gs) -ForegroundColor (Status-Color ($gs.ToLower())) }
  $pass = @($script:Steps | Where-Object status -eq 'pass').Count; $fail=@($script:Steps|Where-Object status -eq 'fail').Count; $blocked=@($script:Steps|Where-Object status -eq 'blocked').Count
  Write-Host '------------------------------------------------------------'
  Write-Host ('TOTAL PLANNED: ' + $script:Plan.Count)
  Write-Host ('PASS:          ' + $pass) -ForegroundColor Green
  Write-Host ('FAIL:          ' + $fail) -ForegroundColor Red
  Write-Host ('BLOCKED:       ' + $blocked) -ForegroundColor Yellow
  $overall = if ($fail -gt 0) { 'FAIL' } elseif ($blocked -gt 0) { 'INCOMPLETE / BLOCKED' } else { 'PASS' }
  $overallColor = if ($overall -eq 'PASS') { 'Green' } elseif ($overall -eq 'FAIL') { 'Red' } else { 'Yellow' }
  Write-Host ('OVERALL: ' + $overall) -ForegroundColor $overallColor
  Write-Host ''
  Write-Host 'STATUS | GROUP | STEP | EXIT | SECONDS | LOG' -ForegroundColor Cyan
  foreach ($s in $script:Steps) { Write-Host (($s.status.ToUpper()).PadRight(8) + ' | ' + $s.group + ' | ' + $s.name + ' | ' + $s.exitCode + ' | ' + $s.durationSeconds + ' | ' + $s.log) -ForegroundColor (Status-Color $s.status) }
  Write-Host ''
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host 'UPLOAD THIS ZIP TO CHATGPT FOR ANALYSIS' -ForegroundColor Green
  Write-Host '============================================================' -ForegroundColor Green
  if ($zip) { Write-Host $zip -ForegroundColor Green } else { Write-Host 'UPLOAD ZIP NOT CREATED' -ForegroundColor Red }
  Write-Host '============================================================' -ForegroundColor Green
  if ($fail -gt 0 -or ($blocked -gt 0 -and $Exhaustive)) { exit 1 } else { exit 0 }
}
