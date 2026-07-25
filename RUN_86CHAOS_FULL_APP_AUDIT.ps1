param(
  [switch]$Headed,
  [switch]$Mutation,
  [switch]$Fast,
  [switch]$ScheduleOnly,
  [switch]$NoBuild,
  [switch]$SkipSeed,
  [switch]$NoCleanup,
  [switch]$Video
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
New-Item -ItemType Directory -Force -Path "test-results" | Out-Null

$RunId = (Get-Date).ToString("yyyy-MM-ddTHH-mm-ss")
$env:CHAOS_FULL_AUDIT_RUN_ID = $RunId
$env:CHAOS_FULL_AUDIT_JSON = Join-Path $Root "test-results\86chaos-full-audit-report.json"
$env:CHAOS_FULL_AUDIT_HTML = Join-Path $Root "test-results\86chaos-full-audit-html"
if ($Headed) { $env:CHAOS_HEADED = "true" }
if ($Video) { $env:CHAOS_VIDEO = "on" }
if ($Mutation) { $env:CHAOS_ALLOW_MUTATION = "true" }

if (-not $env:CHAOS_EXPECTED_VERSION -and (Test-Path "public\version.json")) {
  try { $env:CHAOS_EXPECTED_VERSION = (Get-Content "public\version.json" -Raw | ConvertFrom-Json).version } catch {}
}

$ConsoleLog = Join-Path $Root "test-results\86chaos-full-audit-console.log"
"86 Chaos Full App Audit Run: $RunId" | Out-File $ConsoleLog -Encoding UTF8
"Repo: $Root" | Tee-Object -FilePath $ConsoleLog -Append
"APP_URL: $env:APP_URL" | Tee-Object -FilePath $ConsoleLog -Append
"CHAOS_EXPECTED_VERSION: $env:CHAOS_EXPECTED_VERSION" | Tee-Object -FilePath $ConsoleLog -Append
"CHAOS_ALLOW_MUTATION: $env:CHAOS_ALLOW_MUTATION" | Tee-Object -FilePath $ConsoleLog -Append

function Invoke-Step($Name, $ScriptBlock, [switch]$ContinueOnFailure) {
  Write-Host "`n===== $Name =====" -ForegroundColor Cyan
  "`n===== $Name =====" | Out-File $ConsoleLog -Append -Encoding UTF8
  & $ScriptBlock 2>&1 | Tee-Object -FilePath $ConsoleLog -Append
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  if ($code -ne 0) {
    Write-Host "Step failed: $Name (exit $code)" -ForegroundColor Red
    if (-not $ContinueOnFailure) { return $code }
  }
  return $code
}

$OverallExit = 0

if (-not (Test-Path "package.json")) {
  Write-Host "package.json not found. Extract this test pack into the 86 Chaos repo root, then run the command again." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "node_modules")) {
  $code = Invoke-Step "npm ci / install dependencies" { npm ci --omit=optional --no-audit --no-fund --progress=false } -ContinueOnFailure
  if ($code -ne 0) { $OverallExit = $code }
}


if (-not (Test-Path "node_modules\@playwright\test")) {
  $code = Invoke-Step "install Playwright test runner" { npm install --no-save @playwright/test --no-audit --no-fund --progress=false } -ContinueOnFailure
  if ($code -ne 0) { $OverallExit = $code }
}
$code = Invoke-Step "install Chromium browser for Playwright" { npx playwright install chromium } -ContinueOnFailure
if ($code -ne 0) { $OverallExit = $code }

$code = Invoke-Step "source/package guard" { node scripts/86chaos-full-audit/validate-full-audit-source.cjs } -ContinueOnFailure
if ($code -ne 0) { $OverallExit = $code }

if (-not $NoBuild) {
  $code = Invoke-Step "npm test" { npm test -- --watchAll=false } -ContinueOnFailure
  if ($code -ne 0) { $OverallExit = $code }
  $code = Invoke-Step "production build" { $env:NODE_OPTIONS="--max-old-space-size=4096"; $env:GENERATE_SOURCEMAP="false"; $env:DISABLE_ESLINT_PLUGIN="true"; npm run build } -ContinueOnFailure
  if ($code -ne 0) { $OverallExit = $code }
}

if ($Mutation -and -not $SkipSeed) {
  $code = Invoke-Step "seed full fake restaurant profile" { node scripts/86chaos-full-audit/seed-fake-restaurant.cjs } -ContinueOnFailure
  if ($code -ne 0) { $OverallExit = $code }
}

$PlaywrightArgs = @("playwright", "test", "--config=playwright.full-audit.config.cjs")
if ($Headed) { $PlaywrightArgs += "--headed" }
if ($Fast) { $PlaywrightArgs += @("tests/86chaos-full-audit/00-source-build-package-guard.spec.cjs", "tests/86chaos-full-audit/01-auth-route-health.spec.cjs", "tests/86chaos-full-audit/14-export-import-regression-graveyard.spec.cjs") }
elseif ($ScheduleOnly) { $PlaywrightArgs += @("tests/86chaos-full-audit/04-schedule-math-oracle.spec.cjs", "tests/86chaos-full-audit/05-schedule-builder-mutation.spec.cjs", "tests/86chaos-full-audit/06-request-off-events-integration.spec.cjs") }

$code = Invoke-Step "Playwright full app audit" { npx @PlaywrightArgs } -ContinueOnFailure
if ($code -ne 0) { $OverallExit = $code }

if ($Mutation -and -not $NoCleanup) {
  Invoke-Step "cleanup fake restaurant QA data" { node scripts/86chaos-full-audit/cleanup-fake-restaurant.cjs } -ContinueOnFailure | Out-Null
}

Invoke-Step "collect one upload report" { node scripts/86chaos-full-audit/collect-full-audit-report.cjs } -ContinueOnFailure | Out-Null

$UploadTxt = Get-ChildItem "test-results" -Filter "86chaos-full-audit-UPLOAD-ME-$RunId.txt" | Select-Object -First 1
if ($UploadTxt) {
  $ZipPath = Join-Path $Root "test-results\86chaos-full-audit-UPLOAD-ME-$RunId.zip"
  $FilesToZip = @($UploadTxt.FullName)
  foreach ($extra in @("86chaos-full-audit-report.json", "86chaos-full-audit-source-check.json", "86chaos-full-audit-seed-report.json", "86chaos-full-audit-cleanup-report.json", "86chaos-full-audit-console.log")) {
    $p = Join-Path $Root "test-results\$extra"
    if (Test-Path $p) { $FilesToZip += $p }
  }
  $ArtifactDirs = Get-ChildItem "test-results" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "86chaos|playwright|artifacts|html" }
  foreach ($dir in $ArtifactDirs) { $FilesToZip += $dir.FullName }
  Compress-Archive -Path $FilesToZip -DestinationPath $ZipPath -Force
  Write-Host "`nUPLOAD THIS FILE TO CHATGPT:" -ForegroundColor Green
  Write-Host $ZipPath -ForegroundColor Green
  Write-Host "Also available as text:" -ForegroundColor Green
  Write-Host $UploadTxt.FullName -ForegroundColor Green
}

exit $OverallExit
