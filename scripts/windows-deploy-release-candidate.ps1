[CmdletBinding()]
param(
  [string]$SourceDirectory = "",
  [string]$ActiveDirectory = "",
  [string]$AuditManifest = "",
  [string]$EvidenceDirectory = "",
  [string]$RollbackDirectory = "",
  [string]$NodeExecutable = "",
  [switch]$Elevated,
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
$script:FingerprintPrefix = "STEAM_BRIDGE_WINDOWS_CANDIDATE_BINDING "

function Resolve-FullPath {
  param([string]$Path)

  if (-not $Path) {
    throw "A path is required."
  }
  return [System.IO.Path]::GetFullPath($Path)
}

function Test-PathInsideDirectory {
  param([string]$Path, [string]$Directory)

  $fullPath = Resolve-FullPath $Path
  $fullDirectory = (Resolve-FullPath $Directory).TrimEnd("\") + "\"
  return $fullPath.StartsWith($fullDirectory, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function ConvertTo-NativeArgument {
  param([string]$Value)

  if ($null -eq $Value) {
    return '""'
  }
  if ($Value -notmatch '[\s"]') {
    return $Value
  }
  return '"' + ([regex]::Replace($Value, '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

function Get-DeploymentArguments {
  $arguments = @(
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $PSCommandPath,
    "-SourceDirectory",
    $SourceDirectory,
    "-ActiveDirectory",
    $ActiveDirectory,
    "-AuditManifest",
    $AuditManifest,
    "-EvidenceDirectory",
    $EvidenceDirectory,
    "-Elevated"
  )
  if ($RollbackDirectory) {
    $arguments += @("-RollbackDirectory", $RollbackDirectory)
  }
  if ($NodeExecutable) {
    $arguments += @("-NodeExecutable", $NodeExecutable)
  }
  return @($arguments | ForEach-Object { ConvertTo-NativeArgument ([string]$_) })
}

function Write-JsonEvidence {
  param([string]$Path, [object]$Value)

  $json = $Value | ConvertTo-Json -Depth 12
  $temporaryPath = "$Path.tmp-$([Guid]::NewGuid().ToString('N'))"
  [IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function Get-SteamIdentity {
  return @(Get-CimInstance Win32_Process -Filter "Name = 'steam.exe'" -ErrorAction Stop |
    Sort-Object ProcessId |
    ForEach-Object {
      [PSCustomObject]@{
        processId = [int]$_.ProcessId
        sessionId = [int]$_.SessionId
        creationDate = [string]$_.CreationDate
      }
    })
}

function Test-SteamIdentityEqual {
  param([object[]]$Before, [object[]]$After)

  return (($Before | ConvertTo-Json -Compress) -ceq ($After | ConvertTo-Json -Compress))
}

function Get-ProcessesFromDirectory {
  param([string]$Directory)

  $directoryPrefix = (Resolve-FullPath $Directory).TrimEnd("\") + "\"
  return @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
    $processPath = ""
    try {
      $processPath = [string]$_.Path
    } catch {
      $processPath = ""
    }
    if ($processPath -and $processPath.StartsWith($directoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      [PSCustomObject]@{
        processId = [int]$_.Id
        processName = [string]$_.ProcessName
        executablePath = $processPath
      }
    }
  })
}

function Assert-NoCandidateProcesses {
  param([string]$Directory, [string]$Label)

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return
  }
  $processes = @(Get-ProcessesFromDirectory $Directory)
  if ($processes.Count -ne 0) {
    throw "$Label has running processes; close them before deployment."
  }
}

function Invoke-CandidateFingerprint {
  param(
    [string]$Directory,
    [string]$Manifest,
    [string]$NodePath,
    [string]$FingerprintScript
  )

  $output = @(& $NodePath $FingerprintScript --directory $Directory --audit-manifest $Manifest 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "Candidate fingerprint failed: $($output -join [Environment]::NewLine)"
  }
  $bindingLine = @($output | Where-Object { [string]$_ -like "$($script:FingerprintPrefix)*" })
  if ($bindingLine.Count -ne 1) {
    throw "Candidate fingerprint did not emit exactly one binding."
  }
  return ([string]$bindingLine[0]).Substring($script:FingerprintPrefix.Length) | ConvertFrom-Json
}

function Invoke-CandidateProtection {
  param(
    [string]$Directory,
    [ValidateSet("Apply", "Audit")][string]$Mode,
    [string]$EvidencePath,
    [string]$ProtectionScript
  )

  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $ProtectionScript `
    -CandidateDirectory $Directory -Mode $Mode -EvidencePath $EvidencePath
  if ($LASTEXITCODE -ne 0) {
    throw "Candidate write-protection $Mode failed."
  }
  $result = Get-Content -LiteralPath $EvidencePath -Raw | ConvertFrom-Json
  if ($result.ok -ne $true -or $result.writeProtected -ne $true) {
    throw "Candidate write-protection $Mode did not produce a successful audit."
  }
  return $result
}

function Move-DeploymentCandidate {
  param([string]$Stage, [string]$Active, [string]$Rollback)

  $activeMoved = $false
  if (Test-Path -LiteralPath $Active) {
    Move-Item -LiteralPath $Active -Destination $Rollback
    $activeMoved = $true
  }
  try {
    Move-Item -LiteralPath $Stage -Destination $Active
  } catch {
    if ($activeMoved -and -not (Test-Path -LiteralPath $Active) -and (Test-Path -LiteralPath $Rollback)) {
      Move-Item -LiteralPath $Rollback -Destination $Active
    }
    throw
  }
  return [PSCustomObject]@{
    activeMoved = $activeMoved
    candidateInstalled = $true
  }
}

function Restore-DeploymentRollback {
  param([string]$Active, [string]$Rollback, [string]$Failed)

  if (-not (Test-Path -LiteralPath $Rollback -PathType Container)) {
    throw "Deployment failed after activation and no rollback directory is available."
  }
  if (Test-Path -LiteralPath $Failed) {
    throw "Failed-candidate preservation path already exists."
  }
  if (Test-Path -LiteralPath $Active) {
    Move-Item -LiteralPath $Active -Destination $Failed
  }
  Move-Item -LiteralPath $Rollback -Destination $Active
}

function Invoke-SelfTest {
  $root = Join-Path ([IO.Path]::GetTempPath()) ("steam-bridge-deploy-self-test-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $root | Out-Null
  try {
    $stage = Join-Path $root "stage"
    $active = Join-Path $root "active"
    $rollback = Join-Path $root "rollback"
    $failed = Join-Path $root "failed"
    New-Item -ItemType Directory -Path $stage,$active | Out-Null
    Set-Content -LiteralPath (Join-Path $stage "candidate.txt") -Value "new" -NoNewline
    Set-Content -LiteralPath (Join-Path $active "candidate.txt") -Value "old" -NoNewline
    $move = Move-DeploymentCandidate -Stage $stage -Active $active -Rollback $rollback
    if (-not $move.activeMoved -or (Get-Content -LiteralPath (Join-Path $active "candidate.txt") -Raw) -cne "new") {
      throw "Transactional activation self-test failed."
    }
    Restore-DeploymentRollback -Active $active -Rollback $rollback -Failed $failed
    if (
      (Get-Content -LiteralPath (Join-Path $active "candidate.txt") -Raw) -cne "old" -or
      (Get-Content -LiteralPath (Join-Path $failed "candidate.txt") -Raw) -cne "new"
    ) {
      throw "Transactional rollback self-test failed."
    }
    if (-not (Test-PathInsideDirectory -Path (Join-Path $root "child") -Directory $root)) {
      throw "Path containment self-test failed."
    }
    if ((ConvertTo-NativeArgument 'C:\path with spaces\value') -cne '"C:\path with spaces\value"') {
      throw "Elevation argument quoting self-test failed."
    }
    Write-Host "Windows release-candidate deployment self-test passed."
  } finally {
    if (Test-Path -LiteralPath $root) {
      Remove-Item -LiteralPath $root -Recurse -Force
    }
  }
}

if ($SelfTest) {
  Invoke-SelfTest
  exit 0
}

if ($env:OS -ne "Windows_NT") {
  throw "Windows release-candidate deployment requires Windows."
}
if (-not $SourceDirectory -or -not $ActiveDirectory -or -not $AuditManifest -or -not $EvidenceDirectory) {
  throw "SourceDirectory, ActiveDirectory, AuditManifest, and EvidenceDirectory are required."
}

if (-not (Test-IsAdministrator)) {
  if ($Elevated) {
    throw "The elevated deployment phase is not running as Administrator."
  }
  $powershellPath = Join-Path $PSHOME "powershell.exe"
  $argumentLine = (Get-DeploymentArguments) -join " "
  $process = Start-Process -FilePath $powershellPath -Verb RunAs -WindowStyle Hidden `
    -ArgumentList $argumentLine -Wait -PassThru
  exit $process.ExitCode
}

$source = Resolve-FullPath $SourceDirectory
$active = Resolve-FullPath $ActiveDirectory
$manifest = Resolve-FullPath $AuditManifest
$evidenceRoot = Resolve-FullPath $EvidenceDirectory
$activeParent = Split-Path -Parent $active
$activeLeaf = Split-Path -Leaf $active
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$stage = Join-Path $activeParent (".{0}-stage-{1}-{2}" -f $activeLeaf, $timestamp, [Guid]::NewGuid().ToString("N"))
$rollback = if ($RollbackDirectory) {
  Resolve-FullPath $RollbackDirectory
} else {
  Join-Path $activeParent ("rollback-before-{0}-{1}" -f $activeLeaf, $timestamp)
}
$failed = Join-Path $activeParent ("failed-{0}-{1}" -f $activeLeaf, $timestamp)
$fingerprintScript = Join-Path $PSScriptRoot "windows-release-candidate-fingerprint.cjs"
$protectionScript = Join-Path $PSScriptRoot "windows-protect-release-candidate.ps1"
$nodePath = if ($NodeExecutable) { Resolve-FullPath $NodeExecutable } else { (Get-Command node.exe -ErrorAction Stop).Source }
$deploymentEvidencePath = Join-Path $evidenceRoot "deployment.json"
$previousActiveProtectionEvidencePath = Join-Path $evidenceRoot "previous-active-write-protection.json"
$stageProtectionEvidencePath = Join-Path $evidenceRoot "stage-write-protection.json"
$activeProtectionEvidencePath = Join-Path $evidenceRoot "active-write-protection.json"

foreach ($requiredFile in @($manifest, $fingerprintScript, $protectionScript, $nodePath)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required deployment input is missing: $requiredFile"
  }
}
if (-not (Test-Path -LiteralPath $source -PathType Container)) {
  throw "Source candidate directory is missing."
}
if (-not (Test-Path -LiteralPath $activeParent -PathType Container)) {
  throw "Active candidate parent directory is missing."
}
if (
  $source -ieq $active -or
  (Test-PathInsideDirectory -Path $source -Directory $active) -or
  (Test-PathInsideDirectory -Path $active -Directory $source)
) {
  throw "Source and active candidate directories must not overlap."
}
if ((Split-Path -Parent $rollback) -ine $activeParent -or (Split-Path -Parent $failed) -ine $activeParent) {
  throw "Rollback and failed-candidate paths must be direct siblings of the active directory."
}
if (
  $rollback -ieq $active -or
  $failed -ieq $active -or
  $rollback -ieq $failed -or
  $stage -ieq $active -or
  $stage -ieq $rollback -or
  $stage -ieq $failed
) {
  throw "Active, stage, rollback, and failed-candidate paths must be distinct."
}
if (
  $evidenceRoot -ieq $source -or
  $evidenceRoot -ieq $active -or
  (Test-PathInsideDirectory -Path $evidenceRoot -Directory $source) -or
  (Test-PathInsideDirectory -Path $evidenceRoot -Directory $active)
) {
  throw "Evidence directory must be outside the source and active candidates."
}
foreach ($unusedPath in @($stage, $rollback, $failed)) {
  if (Test-Path -LiteralPath $unusedPath) {
    throw "Deployment preservation path already exists: $unusedPath"
  }
}
foreach ($unusedEvidencePath in @(
  $deploymentEvidencePath,
  $previousActiveProtectionEvidencePath,
  $stageProtectionEvidencePath,
  $activeProtectionEvidencePath
)) {
  if (Test-Path -LiteralPath $unusedEvidencePath) {
    throw "Deployment evidence path already exists: $unusedEvidencePath"
  }
}

New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null
$steamBefore = @(Get-SteamIdentity)
$evidence = [ordered]@{
  kind = "steam-bridge-windows-release-candidate-deployment"
  schemaVersion = 1
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  sourceDirectory = $source
  activeDirectory = $active
  stageDirectory = $stage
  rollbackDirectory = $rollback
  failedCandidateDirectory = $failed
  sourceBinding = $null
  stageBinding = $null
  activeBinding = $null
  previousActiveWriteProtection = $null
  stageWriteProtection = $null
  activeWriteProtection = $null
  previousActivePresent = (Test-Path -LiteralPath $active -PathType Container)
  previousActiveMoved = $false
  candidateInstalled = $false
  rollbackRestored = $false
  failedCandidatePreserved = $false
  steamBefore = $steamBefore
  steamAfter = @()
  steamIdentityUnchanged = $false
  ok = $false
  error = $null
}

try {
  Assert-NoCandidateProcesses -Directory $source -Label "Source candidate"
  Assert-NoCandidateProcesses -Directory $active -Label "Active candidate"
  $evidence.sourceBinding = Invoke-CandidateFingerprint -Directory $source -Manifest $manifest -NodePath $nodePath -FingerprintScript $fingerprintScript
  if ($evidence.previousActivePresent) {
    $evidence.previousActiveWriteProtection = Invoke-CandidateProtection -Directory $active -Mode Audit `
      -EvidencePath $previousActiveProtectionEvidencePath -ProtectionScript $protectionScript
  }

  Copy-Item -LiteralPath $source -Destination $stage -Recurse -Force
  $evidence.stageBinding = Invoke-CandidateFingerprint -Directory $stage -Manifest $manifest -NodePath $nodePath -FingerprintScript $fingerprintScript
  if ([string]$evidence.sourceBinding.bindingSha256 -cne [string]$evidence.stageBinding.bindingSha256) {
    throw "Staged candidate binding differs from the source candidate."
  }
  $evidence.stageWriteProtection = Invoke-CandidateProtection -Directory $stage -Mode Apply `
    -EvidencePath $stageProtectionEvidencePath -ProtectionScript $protectionScript

  $move = Move-DeploymentCandidate -Stage $stage -Active $active -Rollback $rollback
  $evidence.previousActiveMoved = $move.activeMoved
  $evidence.candidateInstalled = $move.candidateInstalled
  $evidence.activeWriteProtection = Invoke-CandidateProtection -Directory $active -Mode Audit `
    -EvidencePath $activeProtectionEvidencePath -ProtectionScript $protectionScript
  $evidence.activeBinding = Invoke-CandidateFingerprint -Directory $active -Manifest $manifest -NodePath $nodePath -FingerprintScript $fingerprintScript
  if ([string]$evidence.sourceBinding.bindingSha256 -cne [string]$evidence.activeBinding.bindingSha256) {
    throw "Active candidate binding differs from the source candidate."
  }

  $evidence.steamAfter = @(Get-SteamIdentity)
  $evidence.steamIdentityUnchanged = Test-SteamIdentityEqual -Before $steamBefore -After $evidence.steamAfter
  if (-not $evidence.steamIdentityUnchanged) {
    throw "Steam process identity changed during candidate deployment."
  }
  $evidence.ok = $true
} catch {
  $evidence.error = $_.Exception.Message
  if ($evidence.candidateInstalled) {
    try {
      if (-not $evidence.previousActiveMoved) {
        if (Test-Path -LiteralPath $failed) {
          throw "Failed-candidate preservation path already exists."
        }
        if (Test-Path -LiteralPath $active) {
          Move-Item -LiteralPath $active -Destination $failed
          $evidence.failedCandidatePreserved = $true
        }
      } else {
        Restore-DeploymentRollback -Active $active -Rollback $rollback -Failed $failed
        $evidence.rollbackRestored = $true
        $evidence.failedCandidatePreserved = (Test-Path -LiteralPath $failed -PathType Container)
      }
    } catch {
      $evidence.error = "$($evidence.error) Rollback also failed: $($_.Exception.Message)"
    }
  }
  try {
    $evidence.steamAfter = @(Get-SteamIdentity)
    $evidence.steamIdentityUnchanged = Test-SteamIdentityEqual -Before $steamBefore -After $evidence.steamAfter
  } catch {
    $evidence.steamIdentityUnchanged = $false
  }
  Write-JsonEvidence -Path $deploymentEvidencePath -Value $evidence
  throw
}

Write-JsonEvidence -Path $deploymentEvidencePath -Value $evidence
Write-Host "Steam Bridge candidate deployed and audited."
Write-Host "Active: $active"
if ($evidence.previousActiveMoved) {
  Write-Host "Rollback retained: $rollback"
}
Write-Host "Evidence: $deploymentEvidencePath"
