<#
Installs this tests-only package into an 86 Chaos app folder, or into a clean
working copy extracted from an app ZIP, then starts the full one-command suite.
#>

param(
  [Parameter(Position=0)]
  [string]$AppPath = '',
  [string]$EnvFile = '',
  [switch]$SkipInstall,
  [switch]$SkipRules,
  [switch]$SkipBuild,
  [switch]$SkipBrowserInstall
)

$ErrorActionPreference = 'Stop'

function Test-86ChaosRoot {
  param([string]$Path)
  if (-not $Path -or -not (Test-Path $Path -PathType Container)) { return $false }
  $packagePath = Join-Path $Path 'package.json'
  if (-not (Test-Path $packagePath)) { return $false }
  if (-not (Test-Path (Join-Path $Path 'src\App.js'))) { return $false }
  try {
    $package = Get-Content $packagePath -Raw | ConvertFrom-Json
    return $package.name -eq '86chaos'
  } catch {
    return $false
  }
}

function Find-86ChaosRootBelow {
  param([string]$StartPath)
  if (Test-86ChaosRoot $StartPath) { return (Resolve-Path $StartPath).Path }
  $packages = Get-ChildItem -Path $StartPath -Filter package.json -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 100
  foreach ($package in $packages) {
    if (Test-86ChaosRoot $package.Directory.FullName) { return $package.Directory.FullName }
  }
  return ''
}

function Find-DefaultAppPath {
  $candidates = New-Object System.Collections.Generic.List[string]
  $candidates.Add((Get-Location).Path)
  $candidates.Add($PSScriptRoot)
  if ($env:USERPROFILE) {
    $candidates.Add((Join-Path $env:USERPROFILE 'Documents\GitHub\86chaos'))
  }
  foreach ($candidate in $candidates) {
    if (Test-86ChaosRoot $candidate) { return $candidate }
  }

  if ($env:USERPROFILE) {
    $downloads = Join-Path $env:USERPROFILE 'Downloads'
    if (Test-Path $downloads) {
      $zips = Get-ChildItem $downloads -File -Filter '86chaos*.zip' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch 'release-gate|test-suite|tests-UPLOAD|SLIM-UPLOAD' } |
        Sort-Object LastWriteTime -Descending
      if (@($zips).Count -eq 1) { return $zips[0].FullName }
      if (@($zips).Count -gt 1) {
        Write-Host 'More than one 86 Chaos app ZIP was found in Downloads. Pass the exact app folder or ZIP path as the first argument.' -ForegroundColor Yellow
      }
    }
  }
  return ''
}

function Copy-TestPayload {
  param([string]$DestinationRoot)
  $sourceRoot = (Resolve-Path $PSScriptRoot).Path
  $destination = (Resolve-Path $DestinationRoot).Path
  if ($sourceRoot -eq $destination) { return }

  foreach ($directory in @('tests', 'scripts', 'test-tools')) {
    $source = Join-Path $sourceRoot $directory
    if (-not (Test-Path $source)) { throw "Tests-only package is missing $directory." }
    $target = Join-Path $destination $directory
    New-Item -ItemType Directory -Force $target | Out-Null
    Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
  }

  foreach ($file in @(
    'RUN_86CHAOS_ULTIMATE_APP_STORE_TESTS.ps1',
    'RUN_86CHAOS_ULTIMATE_APP_STORE_TESTS.cmd',
    'playwright.ultimate-app-store.config.cjs',
    'README_FIRST_86CHAOS_ULTIMATE_TESTS.txt',
    'ENV_TEST_LOCAL_TEMPLATE_NAMES_ONLY.txt',
    'TEST_COVERAGE_MAP.md',
    'ultimate-app-analysis.json',
    'ultimate-app-analysis.md'
  )) {
    $source = Join-Path $sourceRoot $file
    if (Test-Path $source) { Copy-Item $source (Join-Path $destination $file) -Force }
  }
}

$resolvedInput = $AppPath
if ([string]::IsNullOrWhiteSpace($resolvedInput)) { $resolvedInput = Find-DefaultAppPath }
if ([string]::IsNullOrWhiteSpace($resolvedInput)) {
  throw 'No 86 Chaos app was found. Run this command again with the app folder or app ZIP path as the first argument.'
}

$resolvedInput = [Environment]::ExpandEnvironmentVariables($resolvedInput.Trim('"'))
$workingRoot = ''
if (Test-Path $resolvedInput -PathType Leaf) {
  if ([IO.Path]::GetExtension($resolvedInput) -ne '.zip') { throw 'The app file must be a ZIP.' }
  $workParent = Join-Path ([IO.Path]::GetTempPath()) ('86chaos-ultimate-test-work-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Force $workParent | Out-Null
  Write-Host "Extracting a clean app test copy to $workParent" -ForegroundColor Cyan
  Expand-Archive -Path $resolvedInput -DestinationPath $workParent -Force
  $workingRoot = Find-86ChaosRootBelow $workParent
  if (-not $workingRoot) { throw 'The ZIP did not contain a valid 86 Chaos app root.' }
} elseif (Test-Path $resolvedInput -PathType Container) {
  $workingRoot = Find-86ChaosRootBelow $resolvedInput
  if (-not $workingRoot) { throw 'The selected folder does not contain a valid 86 Chaos app.' }
} else {
  throw "App path was not found: $resolvedInput"
}

Copy-TestPayload $workingRoot

$envCandidate = $EnvFile
if ([string]::IsNullOrWhiteSpace($envCandidate)) {
  $nextToSuite = Join-Path $PSScriptRoot '.env.test.local'
  if (Test-Path $nextToSuite) { $envCandidate = $nextToSuite }
}
if (-not [string]::IsNullOrWhiteSpace($envCandidate)) {
  $envCandidate = [Environment]::ExpandEnvironmentVariables($envCandidate.Trim('"'))
  if (-not (Test-Path $envCandidate -PathType Leaf)) { throw "Environment file was not found: $envCandidate" }
  Copy-Item $envCandidate (Join-Path $workingRoot '.env.test.local') -Force
  Write-Host 'Copied the supplied test environment file without displaying its values.' -ForegroundColor DarkGray
}

$runner = Join-Path $workingRoot 'RUN_86CHAOS_ULTIMATE_APP_STORE_TESTS.ps1'
if (-not (Test-Path $runner)) { throw 'The installed test runner is missing.' }

$runnerArgs = @{}
if ($SkipInstall) { $runnerArgs.SkipInstall = $true }
if ($SkipRules) { $runnerArgs.SkipRules = $true }
if ($SkipBuild) { $runnerArgs.SkipBuild = $true }
if ($SkipBrowserInstall) { $runnerArgs.SkipBrowserInstall = $true }

Write-Host ''
Write-Host '86 CHAOS ULTIMATE TEST PACKAGE INSTALLED' -ForegroundColor Green
Write-Host "App test root: $workingRoot" -ForegroundColor White
Write-Host 'Starting the live-timer suite now...' -ForegroundColor Cyan
Write-Host ''

Push-Location $workingRoot
try {
  & $runner @runnerArgs
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($null -eq $code) { $code = 1 }
exit $code
