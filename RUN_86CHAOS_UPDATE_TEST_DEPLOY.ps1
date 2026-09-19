[CmdletBinding()]
param(
  [string]$ReleaseZip,
  [string]$ExpectedVersion = '17.0.11',
  [string]$Repository = 'C:\Users\geoff\Documents\GitHub\86chaos'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:GIT_PAGER = 'cat'
$env:PAGER = 'cat'
$script:Stage = 'startup'
$script:Completed = [System.Collections.Generic.List[string]]::new()
$script:Pushed = $false
$script:DeploymentStarted = $false
$script:PlayStoreStarted = $false
$script:TempDirectory = $null
$script:ReleaseZipPath = $null
$script:HeadSha = $null
$script:SourceManifestHash = $null
$script:ImmutableDeploymentUrl = $null
$StableTestingAlias = 'https://86chaos-git-testing-cheers-portal-s-projects.vercel.app'
$CanonicalVercelProjectId = 'prj_ObkHZiwik2abld9OkwUMbmJ9wN54'
$CanonicalFirebaseTestProject = 'chaos-test-d1601'

function Invoke-Stage([string]$Name, [scriptblock]$Action) {
  $script:Stage = $Name
  Write-Host "`n[$Name]" -ForegroundColor Cyan
  & $Action
  $script:Completed.Add($Name)
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments) {
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
}

function Invoke-Git([string[]]$Arguments) {
  Invoke-Checked 'git' (@('--no-pager') + $Arguments)
}

function Get-ApplicationRoot([string]$ExtractedRoot) {
  if (Test-Path (Join-Path $ExtractedRoot 'package.json')) { return $ExtractedRoot }
  $directories = @(Get-ChildItem -LiteralPath $ExtractedRoot -Directory)
  if ($directories.Count -eq 1 -and (Test-Path (Join-Path $directories[0].FullName 'package.json'))) { return $directories[0].FullName }
  throw 'The release ZIP does not contain package.json at its root or inside one top-level application directory.'
}

function Get-SourceManifestHash([string]$Root) {
  $manifest = Get-Content -Raw -LiteralPath (Join-Path $Root 'release-source-manifest.json') | ConvertFrom-Json
  if (-not ($manifest.sourceHash -match '^[a-f0-9]{64}$')) { throw 'release-source-manifest.json does not contain a valid sourceHash.' }
  return [string]$manifest.sourceHash
}

try {
  Invoke-Stage 'locate release ZIP' {
    if (-not $ReleaseZip) {
      $pattern = "86chaos_$($ExpectedVersion.Replace('.', '_'))*_app_only*.zip"
      $matches = @(Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'Downloads') -File -Filter $pattern | Sort-Object LastWriteTimeUtc -Descending)
      if ($matches.Count -eq 0) { throw "No matching $ExpectedVersion app-only ZIP was found in Downloads." }
      $ReleaseZip = $matches[0].FullName
    }
    $script:ReleaseZipPath = (Resolve-Path -LiteralPath $ReleaseZip).Path
    if ([IO.Path]::GetFileName($script:ReleaseZipPath) -notmatch "^86chaos_$([regex]::Escape($ExpectedVersion.Replace('.', '_'))).*_app_only(?:\([^)]*\))?\.zip$") {
      throw "Refusing unrelated ZIP: $script:ReleaseZipPath"
    }
    Write-Host "Release ZIP: $script:ReleaseZipPath"
  }

  Invoke-Stage 'identify expected next release' {
    $currentPackagePath = Join-Path $Repository 'package.json'
    if (-not (Test-Path -LiteralPath $currentPackagePath)) { throw "Repository package.json is missing: $currentPackagePath" }
    $currentVersion = [string](Get-Content -Raw -LiteralPath $currentPackagePath | ConvertFrom-Json).version
    if ($currentVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') { throw "Repository version is not a three-part semantic version: $currentVersion" }
    $nextVersion = '{0}.{1}.{2}' -f [int]$Matches[1], [int]$Matches[2], ([int]$Matches[3] + 1)
    if ($ExpectedVersion -ne $nextVersion) { throw "Expected next release from repository version $currentVersion is $nextVersion, but the requested ZIP version is $ExpectedVersion." }
    Write-Host "Current: $currentVersion  Next: $nextVersion"
  }

  Invoke-Stage 'extract and validate application' {
    $script:TempDirectory = Join-Path ([IO.Path]::GetTempPath()) ("86chaos-update-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $script:TempDirectory | Out-Null
    Expand-Archive -LiteralPath $script:ReleaseZipPath -DestinationPath $script:TempDirectory
    $SourceRoot = Get-ApplicationRoot $script:TempDirectory
    $sourcePackage = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot 'package.json') | ConvertFrom-Json
    if ([string]$sourcePackage.version -ne $ExpectedVersion) { throw "Extracted package version is $($sourcePackage.version); expected $ExpectedVersion." }
    Invoke-Checked 'node' @((Join-Path $SourceRoot 'scripts\86chaos-release-workflow\install-app-only.cjs'), '--source', $SourceRoot, '--repository', $Repository, '--expected-version', $ExpectedVersion)
  }

  Set-Location -LiteralPath $Repository
  Invoke-Stage 'repository safety before dependencies' { Invoke-Checked 'npm' @('run', 'git:safety') }
  Invoke-Stage 'install locked dependencies' { Invoke-Checked 'npm' @('ci') }
  Invoke-Stage 'version and source validation' { Invoke-Checked 'npm' @('run', 'validate:17.0.11') }
  Invoke-Stage '17.0.11 regression tests' { Invoke-Checked 'npm' @('run', 'test:repair:17.0.11'); Invoke-Checked 'npm' @('run', 'test:schedule-runtime:17.0.11') }
  Invoke-Stage 'production build' { Invoke-Checked 'npm' @('run', 'build') }
  Invoke-Stage 'repository safety after build' { Invoke-Checked 'npm' @('run', 'git:safety') }

  Invoke-Stage 'stage release' {
    Invoke-Git @('add', '--all')
    Invoke-Checked 'node' @('scripts/verify-repository-safety.cjs', '--staged')
    Invoke-Git @('diff', '--cached', '--stat')
    Invoke-Git @('diff', '--cached', '--name-only')
    $staged = (& git --no-pager diff --cached --name-only)
    if ($LASTEXITCODE -ne 0 -or -not $staged) { throw 'No staged release changes were found.' }
  }

  Invoke-Stage 'commit and push testing' {
    Invoke-Git @('commit', '-m', "Release ${ExpectedVersion}: Schedule Builder runtime, Firebase gate referrer, and automated workflow repair")
    $script:HeadSha = (& git --no-pager rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the release commit SHA.' }
    $script:DeploymentStarted = $true
    Invoke-Git @('push', 'origin', 'HEAD:testing')
    $script:Pushed = $true
    Invoke-Git @('fetch', 'origin', 'testing')
    $RemoteSha = (& git --no-pager rev-parse origin/testing).Trim()
    if ($LASTEXITCODE -ne 0 -or $script:HeadSha -ne $RemoteSha) { throw "Local HEAD $script:HeadSha does not match origin/testing $RemoteSha." }
  }

  Invoke-Stage 'wait for exact Vercel deployment' {
    $Version = [string](Get-Content -Raw package.json | ConvertFrom-Json).version
    $script:SourceManifestHash = Get-SourceManifestHash $Repository
    $deadline = (Get-Date).AddMinutes(20)
    $identity = $null
    do {
      try { $identity = Invoke-RestMethod -Method Get -Uri "$StableTestingAlias/api/build-identity?workflow=$([uri]::EscapeDataString($script:HeadSha))" -TimeoutSec 30 }
      catch { $identity = $null }
      $ready = $identity -and $identity.ok -and $identity.version -eq $Version -and $identity.gitCommit -eq $script:HeadSha -and $identity.gitBranch -eq 'testing' -and $identity.sourceManifestHash -eq $script:SourceManifestHash -and $identity.vercelProjectId -eq $CanonicalVercelProjectId -and $identity.firebaseTestingProject -eq $CanonicalFirebaseTestProject -and $identity.vercelDeploymentUrl
      if (-not $ready) { Start-Sleep -Seconds 15 }
    } while (-not $ready -and (Get-Date) -lt $deadline)
    if (-not $ready) { throw 'Timed out waiting for the stable testing alias to identify the exact committed Vercel deployment.' }
    $script:ImmutableDeploymentUrl = [string]$identity.vercelDeploymentUrl
    if ($script:ImmutableDeploymentUrl -notmatch '^https://[^/]+\.vercel\.app$' -or $script:ImmutableDeploymentUrl -eq $StableTestingAlias) { throw "Deployment identity did not provide an immutable Vercel URL: $script:ImmutableDeploymentUrl" }
    Write-Host "Exact deployment: $script:ImmutableDeploymentUrl" -ForegroundColor Green
  }

  Invoke-Stage 'configure full release gate' {
    $env:APP_URL = $StableTestingAlias
    $env:CHAOS_BASE_URL = $StableTestingAlias
    $env:CHAOS_FIREBASE_AUTH_REFERRER_URL = $StableTestingAlias
    $env:CHAOS_EXPECTED_VERSION = $ExpectedVersion
    $env:CHAOS_EXPECTED_BRANCH = 'testing'
    $env:CHAOS_EXPECTED_GIT_COMMIT = $script:HeadSha
    $env:CHAOS_EXPECTED_VERCEL_PROJECT_SLUG = '86chaos'
    $env:CHAOS_EXPECTED_VERCEL_PROJECT_ID = $CanonicalVercelProjectId
    $env:CHAOS_EXPECTED_TEST_FIREBASE_PROJECT_ID = $CanonicalFirebaseTestProject
    $env:CHAOS_SOURCE_MANIFEST_HASH = $script:SourceManifestHash
    $env:CHAOS_AUTOMATED_RELEASE_WORKFLOW = 'true'
  }

  Invoke-Stage 'full Play Store release gate' {
    $script:PlayStoreStarted = $true
    Invoke-Checked 'npm' @('run', 'test:play-store')
  }

  Write-Host "`n86 Chaos $ExpectedVersion workflow completed. The full gate evidence must still be reviewed before certification." -ForegroundColor Green
}
catch {
  Write-Host "`nAUTOMATION STOPPED SAFELY" -ForegroundColor Red
  Write-Host "Failed stage: $script:Stage" -ForegroundColor Red
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Completed stages: $(if ($script:Completed.Count) { $script:Completed -join ', ' } else { 'none' })"
  Write-Host "Not completed: all stages after '$script:Stage'"
  Write-Host "Pushed: $script:Pushed"
  Write-Host "Vercel deployment started: $script:DeploymentStarted"
  Write-Host "Play Store testing started: $script:PlayStoreStarted"
  exit 1
}
finally {
  if ($script:TempDirectory -and (Test-Path -LiteralPath $script:TempDirectory)) { Remove-Item -LiteralPath $script:TempDirectory -Recurse -Force }
}
