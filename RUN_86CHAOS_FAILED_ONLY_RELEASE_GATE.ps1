# Runs only the release-gate tests that failed in the last slim report.
# Use this after deploying the updated app, then run the full release gate before release.

$ErrorActionPreference = 'Stop'

Write-Host "86 Chaos failed-only release gate" -ForegroundColor Cyan
Write-Host "This does NOT replace the full npm run test:play-store release gate." -ForegroundColor Yellow

if (-not (Test-Path ".\package.json")) {
  throw "package.json was not found. Run this from the real 86chaos app folder."
}

npx playwright test --config .\playwright.failed-release.config.cjs
