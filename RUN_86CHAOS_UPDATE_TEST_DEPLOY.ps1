[CmdletBinding()]
param(
  [string]$ReleaseZip,
  [string]$ExpectedVersion = '17.0.17',
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
$script:SourceRoot = $null
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

  Invoke-Stage 'extract and validate release ZIP' {
    $script:TempDirectory = Join-Path ([IO.Path]::GetTempPath()) ("86chaos-update-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $script:TempDirectory | Out-Null
    Expand-Archive -LiteralPath $script:ReleaseZipPath -DestinationPath $script:TempDirectory
    $script:SourceRoot = Get-ApplicationRoot $script:TempDirectory
    $sourcePackage = Get-Content -Raw -LiteralPath (Join-Path $script:SourceRoot 'package.json') | ConvertFrom-Json
    if ([string]$sourcePackage.version -ne $ExpectedVersion) { throw "Extracted package version is $($sourcePackage.version); expected $ExpectedVersion." }
    $sourceManifest = Get-SourceManifestHash $script:SourceRoot
    Write-Host "Validated incoming ZIP: version=$ExpectedVersion source=$sourceManifest" -ForegroundColor Green
  }

  Invoke-Stage 'verify repository and testing branch' {
    if (-not (Test-Path -LiteralPath (Join-Path $Repository '.git'))) { throw "Repository is not a Git checkout: $Repository" }
    Set-Location -LiteralPath $Repository
    Invoke-Git @('switch', 'testing')
    $branch = (& git --no-pager branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'testing') { throw "Expected local branch testing, found $branch." }
  }

  Invoke-Stage 'identify release transition or safe resume' {
    $currentPackagePath = Join-Path $Repository 'package.json'
    $versionSource = 'working tree'
    if (Test-Path -LiteralPath $currentPackagePath) {
      $currentVersion = [string](Get-Content -Raw -LiteralPath $currentPackagePath | ConvertFrom-Json).version
    }
    else {
      $headPackageText = ((& git --no-pager show 'HEAD:package.json') -join "`n")
      if ($LASTEXITCODE -ne 0 -or -not $headPackageText) { throw "Repository package.json is missing and Git HEAD cannot provide a recovery baseline." }
      $currentVersion = [string]($headPackageText | ConvertFrom-Json).version
      $versionSource = 'Git HEAD recovery baseline'
      Write-Host "Working-tree package.json is missing. Recovery baseline from Git HEAD: $currentVersion" -ForegroundColor Yellow
    }
    if ($currentVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') { throw "Repository version is not a three-part semantic version: $currentVersion" }
    $currentParts = @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
    if ($ExpectedVersion -notmatch '^(\d+)\.(\d+)\.(\d+)$') { throw "Requested release version is not a three-part semantic version: $ExpectedVersion" }
    $expectedParts = @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
    if ($currentParts[0] -ne $expectedParts[0] -or $currentParts[1] -ne $expectedParts[1]) {
      throw "Repository version $currentVersion is outside the $($expectedParts[0]).$($expectedParts[1]).x release line; refusing automatic overlay."
    }
    if ($currentParts[2] -gt $expectedParts[2]) { throw "Repository version $currentVersion is newer than requested release $ExpectedVersion; refusing downgrade." }
    if ($currentVersion -eq $ExpectedVersion) {
      Write-Host "Resume mode: repository baseline already reports $ExpectedVersion ($versionSource). The installer will verify/rebuild the working tree from the release ZIP." -ForegroundColor Yellow
    }
    elseif (($expectedParts[2] - $currentParts[2]) -eq 1) {
      Write-Host "Upgrade mode: $currentVersion -> $ExpectedVersion ($versionSource)" -ForegroundColor Green
    }
    else {
      Write-Host "Recovery upgrade mode: $currentVersion -> $ExpectedVersion ($versionSource). Intermediate interrupted releases are superseded by this complete manifest-verified app snapshot." -ForegroundColor Yellow
    }
  }

  Invoke-Stage 'install release ZIP into repository' {
    Invoke-Checked 'node' @((Join-Path $script:SourceRoot 'scripts\86chaos-release-workflow\install-app-only.cjs'), '--source', $script:SourceRoot, '--repository', $Repository, '--expected-version', $ExpectedVersion)
    $installedPackage = Join-Path $Repository 'package.json'
    if (-not (Test-Path -LiteralPath $installedPackage)) { throw "Release overlay completed without restoring repository package.json: $installedPackage" }
    $installedVersion = [string](Get-Content -Raw -LiteralPath $installedPackage | ConvertFrom-Json).version
    if ($installedVersion -ne $ExpectedVersion) { throw "Repository reports $installedVersion after overlay; expected $ExpectedVersion." }
    Write-Host "Release ZIP extracted and installed into repository: $Repository" -ForegroundColor Green
  }

  Set-Location -LiteralPath $Repository
  Invoke-Stage 'repository safety before dependencies' { Invoke-Checked 'npm' @('run', 'git:safety') }
  Invoke-Stage 'install locked dependencies' { Invoke-Checked 'npm' @('ci') }
  Invoke-Stage 'version and source validation' { Invoke-Checked 'npm' @('run', "validate:$ExpectedVersion") }
  Invoke-Stage 'current release regression tests' { Invoke-Checked 'npm' @('run', "test:repair:$ExpectedVersion"); Invoke-Checked 'npm' @('run', 'test:schedule-runtime:17.0.11') }
  $env:NODE_OPTIONS = '--max-old-space-size=4096'
  $env:GENERATE_SOURCEMAP = 'false'
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
    Invoke-Git @('commit', '-m', "Release ${ExpectedVersion}: generated artifact-aware checkout recovery repair")
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
    $attempt = 0
    do {
      $attempt++
      try {
        $identity = Invoke-RestMethod -Method Get -Uri "$StableTestingAlias/api/build-identity?workflow=$([uri]::EscapeDataString($script:HeadSha))&attempt=$attempt" -TimeoutSec 30
        $observedVersion = if ($identity.version) { [string]$identity.version } else { 'unknown' }
        $observedCommit = if ($identity.gitCommit) { [string]$identity.gitCommit } else { 'unknown' }
        Write-Host "Vercel wait attempt $($attempt): version=$observedVersion commit=$observedCommit" -ForegroundColor DarkYellow
      }
      catch {
        $identity = $null
        Write-Host "Vercel wait attempt $($attempt): deployment identity is not reachable yet." -ForegroundColor DarkYellow
      }
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
    $env:CHAOS_RELEASE_CHECK_HEARTBEAT_MS = '15000'
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
