param(
  [switch]$Headed,
  [switch]$KeepTestRestaurant,
  [switch]$NoMutation,
  [switch]$Video,
  [switch]$KeepNodeModules
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$Root = $PSScriptRoot
Set-Location $Root
$RunId = (Get-Date).ToString('yyyy-MM-ddTHH-mm-ss')
$ResultsRoot = Join-Path $Root 'test-results\86chaos-play-store-release-gate'
$ToolsRoot = Join-Path $Root 'release-gate-tools'
$ToolsNodeModules = Join-Path $ToolsRoot 'node_modules'
New-Item -ItemType Directory -Force -Path $ResultsRoot | Out-Null
$ConsoleLog = Join-Path $ResultsRoot "release-gate-console-$RunId.log"
$script:StepFailures = 0

function Write-Log([string]$Text, [string]$Color = 'White') {
  Write-Host $Text -ForegroundColor $Color
  Add-Content -Path $ConsoleLog -Value $Text -Encoding UTF8
}

function Load-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
      $parts = $line.Split('=', 2)
      $name = $parts[0].Trim()
      $value = $parts[1].Trim().Trim('"').Trim("'")
      if ($name -and -not [Environment]::GetEnvironmentVariable($name, 'Process')) {
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
      }
    }
  }
}

foreach ($file in @('.env.test.local', '.env.test', '.env.local', '.env')) {
  Load-DotEnv (Join-Path $Root $file)
}

$env:CHAOS_RELEASE_GATE = 'true'
$env:CHAOS_RELEASE_GATE_RUN_ID = $RunId
$env:CHAOS_FULL_AUDIT_RUN_ID = $RunId
$env:CHAOS_QA_WORKSPACE_NAME = '86 Chaos Full Audit QA Restaurant'
$env:CHAOS_QA_WORKSPACE = '86 Chaos Full Audit QA Restaurant'
$env:CHAOS_QA_CREATE_RESTAURANT = $(if ($NoMutation) { 'false' } else { 'true' })
$env:CHAOS_ALLOW_MUTATION = $(if ($NoMutation) { 'false' } else { 'true' })
$env:CHAOS_KEEP_QA_RESTAURANT = $(if ($KeepTestRestaurant) { 'true' } else { 'false' })
$env:CHAOS_E2E_SKIP_WEBSERVER = 'true'
if ($Headed) { $env:CHAOS_HEADED = 'true' }
if ($Video) { $env:CHAOS_VIDEO = 'on' }
if (-not $env:CHAOS_EXPECTED_VERSION -and (Test-Path 'public\version.json')) {
  try { $env:CHAOS_EXPECTED_VERSION = (Get-Content 'public\version.json' -Raw | ConvertFrom-Json).version } catch {}
}

function Resolve-Command([string]$WindowsName, [string]$OtherName) {
  $cmd = Get-Command $WindowsName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command $OtherName -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { return $cmd.Source }
  return $OtherName
}

$Node = Resolve-Command 'node.exe' 'node'
$Npm = Resolve-Command 'npm.cmd' 'npm'

function Run-Step {
  param(
    [string]$Name,
    [string]$File,
    [string[]]$CommandArgs,
    [switch]$RetryNetwork
  )
  Write-Log "`n===== $Name =====" 'Cyan'
  $safe = ($Name -replace '[^A-Za-z0-9_-]+', '-').Trim('-')
  $stepLog = Join-Path $ResultsRoot "$RunId-$safe.log"
  $attempts = $(if ($RetryNetwork) { 3 } else { 1 })
  $exitCode = 1
  for ($attempt = 1; $attempt -le $attempts; $attempt++) {
    Write-Log "COMMAND: $File $($CommandArgs -join ' ')"
    if ($attempts -gt 1) { Write-Log "Attempt $attempt of $attempts" 'Yellow' }
    try {
      & $File @CommandArgs 2>&1 | ForEach-Object {
        $line = [string]$_
        Write-Host $line
        Add-Content -Path $ConsoleLog -Value $line -Encoding UTF8
        Add-Content -Path $stepLog -Value $line -Encoding UTF8
      }
      $exitCode = $(if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 })
    } catch {
      $exitCode = 1
      Write-Log "FAILED TO START: $($_.Exception.Message)" 'Red'
    }
    if ($exitCode -eq 0) { break }
    if ($RetryNetwork -and $attempt -lt $attempts) {
      Write-Log 'Network/package step failed. Waiting 20 seconds before retry.' 'Yellow'
      Start-Sleep -Seconds 20
    }
  }
  if ($exitCode -ne 0) {
    $script:StepFailures += 1
    Write-Log "FAILED: $Name (exit $exitCode)" 'Red'
  } else {
    Write-Log "PASSED: $Name" 'Green'
  }
  return $exitCode
}

function Write-UploadZip {
  $env:CHAOS_RELEASE_GATE_STEP_FAILURES = [string]$script:StepFailures
  if (Test-Path (Join-Path $Root 'scripts\86chaos-release-gate\collect-release-gate-report.cjs')) {
    Run-Step -Name 'collect release gate report' -File $Node -CommandArgs @('scripts/86chaos-release-gate/collect-release-gate-report.cjs') | Out-Null
  }
  $zip = Join-Path $Root "test-results\86chaos-play-store-release-gate-UPLOAD-ME-$RunId.zip"
  $items = @()
  if (Test-Path $ResultsRoot) { $items += $ResultsRoot }
  foreach ($p in @('playwright.play-store-release.config.cjs', 'RUN_86CHAOS_PLAY_STORE_RELEASE_GATE.ps1', '.env.test.local.example', 'README_PLAY_STORE_RELEASE_GATE.md')) {
    if (Test-Path $p) { $items += (Resolve-Path $p).Path }
  }
  try {
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path $items -DestinationPath $zip -Force
    Write-Log "`nUPLOAD THIS ZIP FOR REVIEW:" 'Green'
    Write-Log $zip 'Green'
  } catch {
    Write-Log "Could not create upload ZIP: $($_.Exception.Message)" 'Red'
  }
}

function Stop-Critical([string]$Message) {
  Write-Log $Message 'Red'
  Write-UploadZip
  exit 1
}

Write-Log '============================================================' 'Cyan'
Write-Log '86 CHAOS APP STORE / PLAY STORE RELEASE GATE' 'Cyan'
Write-Log '============================================================' 'Cyan'
Write-Log "Repository: $Root"
Write-Log "Target: $env:APP_URL"
Write-Log "Expected version: $env:CHAOS_EXPECTED_VERSION"
Write-Log 'Disposable QA restaurant: 86 Chaos Full Audit QA Restaurant'
Write-Log "Keep QA restaurant after run: $env:CHAOS_KEEP_QA_RESTAURANT"

if (-not (Test-Path 'package.json')) { Stop-Critical 'package.json was not found.' }
if (-not (Test-Path 'release-gate-tools\package.json')) { Stop-Critical 'release-gate-tools/package.json was not found.' }
if (-not (Test-Path '.env.test.local')) { Stop-Critical 'Missing .env.test.local. Copy .env.test.local.example and fill the TESTING values.' }

$nodeVersion = & $Node --version
Write-Log "Node: $nodeVersion"
$nodeMajor = [int](($nodeVersion -replace '^v', '').Split('.')[0])
if ($nodeMajor -ne 24) { Stop-Critical 'Node 24.x is required. Switch to Node 24 and rerun the same command.' }

$preflight = Run-Step -Name 'environment and production-safety preflight' -File $Node -CommandArgs @('scripts/86chaos-release-gate/preflight-env.cjs')
if ($preflight -ne 0) { Stop-Critical 'Release preflight failed. No QA restaurant was created.' }

if (-not $KeepNodeModules -and (Test-Path 'node_modules')) {
  Write-Log "`nRemoving root node_modules for a clean production-dependency install..." 'Yellow'
  try { Remove-Item 'node_modules' -Recurse -Force -ErrorAction Stop } catch { Stop-Critical "Could not remove node_modules: $($_.Exception.Message)" }
}

$rootInstall = Run-Step -Name 'clean production dependency install' -File $Npm -CommandArgs @('install', '--omit=dev', '--omit=optional', '--no-audit', '--no-fund', '--progress=false', '--fetch-retries=5', '--fetch-retry-factor=2', '--fetch-retry-mintimeout=20000', '--fetch-retry-maxtimeout=120000') -RetryNetwork
if ($rootInstall -ne 0) { Stop-Critical 'The app dependencies could not be installed. The release gate cannot continue honestly.' }

$toolInstall = Run-Step -Name 'isolated release-gate tool install' -File $Npm -CommandArgs @('install', '--prefix', 'release-gate-tools', '--omit=optional', '--no-audit', '--no-fund', '--progress=false', '--fetch-retries=5', '--fetch-retry-factor=2', '--fetch-retry-mintimeout=20000', '--fetch-retry-maxtimeout=120000') -RetryNetwork
if ($toolInstall -ne 0) { Stop-Critical 'The isolated Playwright/Firebase release tools could not be installed.' }

$env:NODE_PATH = $(if ($env:NODE_PATH) { "$ToolsNodeModules;$env:NODE_PATH" } else { $ToolsNodeModules })
$PlaywrightCli = Join-Path $ToolsNodeModules '@playwright\test\cli.js'
$PlaywrightBrowserCli = Join-Path $ToolsNodeModules 'playwright\cli.js'
$FirebaseCli = Join-Path $ToolsNodeModules 'firebase-tools\lib\bin\firebase.js'
$EslintCli = Join-Path $ToolsNodeModules 'eslint\bin\eslint.js'
$ReactScriptsCli = Join-Path $Root 'node_modules\react-scripts\bin\react-scripts.js'
foreach ($required in @($PlaywrightCli, $PlaywrightBrowserCli, $FirebaseCli, $EslintCli, $ReactScriptsCli)) {
  if (-not (Test-Path $required)) { Stop-Critical "Required installed executable is missing: $required" }
}

$browserInstall = Run-Step -Name 'install Playwright Chromium Firefox and WebKit' -File $Node -CommandArgs @($PlaywrightBrowserCli, 'install', 'chromium', 'firefox', 'webkit') -RetryNetwork
if ($browserInstall -ne 0) { Stop-Critical 'Playwright browser installation failed.' }

Run-Step -Name 'source inventory and testability audit' -File $Node -CommandArgs @('scripts/86chaos-release-gate/source-inventory.cjs') | Out-Null
Run-Step -Name 'full-audit source guard' -File $Node -CommandArgs @('scripts/86chaos-full-audit/validate-full-audit-source.cjs') | Out-Null
Run-Step -Name 'current app source validator' -File $Npm -CommandArgs @('run', 'test:source') | Out-Null
Run-Step -Name 'performance split validator' -File $Npm -CommandArgs @('run', 'performance:split') | Out-Null
Run-Step -Name 'API and Python syntax' -File $Npm -CommandArgs @('run', 'syntax') | Out-Null
Run-Step -Name 'ESLint' -File $Node -CommandArgs @($EslintCli, 'src/**/*.{js,jsx}', 'api/**/*.js') | Out-Null

$clientArgs = @($ReactScriptsCli, 'test', '--watchAll=false', '--coverage', '--runInBand')
Run-Step -Name 'client unit tests with coverage' -File $Node -CommandArgs $clientArgs | Out-Null
$serverFiles = @(Get-ChildItem (Join-Path $Root 'api') -Filter '*.test.cjs' -File | ForEach-Object { $_.FullName })
if ($serverFiles.Count -eq 0) {
  $script:StepFailures += 1
  Write-Log 'FAILED: no server API tests were discovered.' 'Red'
} else {
  Run-Step -Name 'server API behavior tests' -File $Node -CommandArgs (@('--test') + $serverFiles) | Out-Null
}
Run-Step -Name 'enforce Jest coverage' -File $Node -CommandArgs @('scripts/86chaos-release-gate/enforce-jest-coverage.cjs') | Out-Null

$env:NODE_OPTIONS = '--max-old-space-size=4096'
$env:GENERATE_SOURCEMAP = 'false'
$env:DISABLE_ESLINT_PLUGIN = 'false'
Run-Step -Name 'production build' -File $Npm -CommandArgs @('run', 'build') | Out-Null

$rulesCommand = 'node scripts/86chaos-release-gate/run-rules-release-gate.cjs'
Run-Step -Name 'Firestore and Storage emulator rules gate' -File $Node -CommandArgs @($FirebaseCli, 'emulators:exec', '--only', 'firestore,storage', $rulesCommand) | Out-Null
Run-Step -Name 'Playwright full release gate across desktop mobile Chromium Firefox and WebKit' -File $Node -CommandArgs @($PlaywrightCli, 'test', '--config=playwright.play-store-release.config.cjs') | Out-Null

Write-UploadZip
if ($script:StepFailures -gt 0) { exit 1 }
exit 0
