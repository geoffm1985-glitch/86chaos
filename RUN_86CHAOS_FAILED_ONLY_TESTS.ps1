param(
  [switch]$Headed
)

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path "test-results" | Out-Null

if (-not $env:CHAOS_EXPECTED_VERSION) { $env:CHAOS_EXPECTED_VERSION = "16.0.3" }

$jsonReport = Join-Path (Get-Location) "test-results\86chaos-failed-only-report.json"
$consoleLog = Join-Path (Get-Location) "test-results\86chaos-failed-only-console.log"
Remove-Item -LiteralPath $jsonReport -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $consoleLog -Force -ErrorAction SilentlyContinue

# Correct way to make Playwright's JSON reporter write a file from the CLI.
# The old runner used --reporter=list,json=path, which does not reliably create JSON output.
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = $jsonReport

$headedArg = @()
if ($Headed) { $headedArg += "--headed" }

Write-Host "Running only the tests that failed in the last production/deep run..." -ForegroundColor Cyan
Write-Host "Version expected: $env:CHAOS_EXPECTED_VERSION" -ForegroundColor Cyan
Write-Host "JSON report: $jsonReport" -ForegroundColor DarkCyan
Write-Host "Console log:  $consoleLog" -ForegroundColor DarkCyan

$cmdOutput = & npx.cmd playwright test tests/86chaos-failed-only @headedArg --reporter=list,json 2>&1
$playwrightExit = $LASTEXITCODE
$cmdOutput | Tee-Object -FilePath $consoleLog

$uploadPath = & node .\scripts\collect-failed-only-errors.js
Write-Host ""
Write-Host "Upload file generated:" -ForegroundColor Yellow
Write-Host $uploadPath
Write-Host ""

exit $playwrightExit
