[CmdletBinding()]
param(
  [string]$CandidateDirectory = "",
  [ValidateSet("Apply", "Audit")]
  [string]$Mode = "Audit",
  [string]$EvidencePath = "",
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

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

function Get-CandidateEntries {
  param([string]$Directory)

  return @(Get-ChildItem -LiteralPath $Directory -Force -Recurse -ErrorAction Stop)
}

function Assert-NoReparsePoints {
  param([string]$Directory, $Entries)

  $current = Get-Item -LiteralPath $Directory -Force -ErrorAction Stop
  while ($current) {
    if (($current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Candidate directory ancestry must not contain reparse points."
    }
    $parent = Split-Path -Parent $current.FullName
    if (-not $parent -or $parent -eq $current.FullName) {
      break
    }
    $current = Get-Item -LiteralPath $parent -Force -ErrorAction Stop
  }
  foreach ($entry in @($Entries)) {
    if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Candidate directory descendants must not contain reparse points."
    }
  }
}

function Get-ExplicitRules {
  param($Acl)

  return @($Acl.GetAccessRules(
    $true,
    $false,
    [System.Security.Principal.SecurityIdentifier]
  ))
}

function Test-CanonicalRootRule {
  param(
    $Rule,
    [string]$Identity,
    [System.Security.AccessControl.FileSystemRights]$Rights,
    [switch]$ReadExecuteOnly
  )

  $expectedInheritance = (
    [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
    [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
  )
  $rightsMatch = if ($ReadExecuteOnly) {
    $disallowedRights = (
      [System.Security.AccessControl.FileSystemRights]::Write -bor
      [System.Security.AccessControl.FileSystemRights]::Delete -bor
      [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
      [System.Security.AccessControl.FileSystemRights]::ChangePermissions -bor
      [System.Security.AccessControl.FileSystemRights]::TakeOwnership
    )
    (
      ($Rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::ReadAndExecute) -eq
        [System.Security.AccessControl.FileSystemRights]::ReadAndExecute -and
      ($Rule.FileSystemRights -band $disallowedRights) -eq 0
    )
  } else {
    $Rule.FileSystemRights -eq $Rights
  }
  return (
    [string]$Rule.IdentityReference.Value -eq $Identity -and
    $Rule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
    $rightsMatch -and
    $Rule.InheritanceFlags -eq $expectedInheritance -and
    $Rule.PropagationFlags -eq [System.Security.AccessControl.PropagationFlags]::None -and
    $Rule.IsInherited -eq $false
  )
}

function Get-CandidateProtectionAudit {
  param([string]$Directory)

  $entries = @(Get-CandidateEntries -Directory $Directory)
  Assert-NoReparsePoints -Directory $Directory -Entries $entries

  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $identity.User) {
    throw "Could not resolve the current Windows identity."
  }
  $currentSid = [string]$identity.User.Value
  $systemSid = "S-1-5-18"
  $administratorsSid = "S-1-5-32-544"
  $rootAcl = Get-Acl -LiteralPath $Directory -ErrorAction Stop
  $rootRules = @(Get-ExplicitRules -Acl $rootAcl)
  $currentRuleOk = @($rootRules | Where-Object {
      Test-CanonicalRootRule `
        -Rule $_ `
        -Identity $currentSid `
        -Rights ([System.Security.AccessControl.FileSystemRights]::ReadAndExecute) `
        -ReadExecuteOnly
    }).Count -eq 1
  $systemRuleOk = @($rootRules | Where-Object {
      Test-CanonicalRootRule `
        -Rule $_ `
        -Identity $systemSid `
        -Rights ([System.Security.AccessControl.FileSystemRights]::FullControl)
    }).Count -eq 1
  $administratorsRuleOk = @($rootRules | Where-Object {
      Test-CanonicalRootRule `
        -Rule $_ `
        -Identity $administratorsSid `
        -Rights ([System.Security.AccessControl.FileSystemRights]::FullControl)
    }).Count -eq 1
  $canonicalRules = @($currentRuleOk, $systemRuleOk, $administratorsRuleOk)

  $protectedChildCount = 0
  $explicitChildRuleCount = 0
  foreach ($entry in $entries) {
    $acl = Get-Acl -LiteralPath $entry.FullName -ErrorAction Stop
    if ($acl.AreAccessRulesProtected) {
      $protectedChildCount += 1
    }
    $explicitChildRuleCount += @(Get-ExplicitRules -Acl $acl).Count
  }

  $fileCount = @($entries | Where-Object { -not $_.PSIsContainer }).Count
  $directoryCount = @($entries | Where-Object { $_.PSIsContainer }).Count
  $ok = (
    $rootAcl.AreAccessRulesProtected -and
    $rootRules.Count -eq 3 -and
    @($canonicalRules | Where-Object { $_ -eq $true }).Count -eq 3 -and
    $protectedChildCount -eq 0 -and
    $explicitChildRuleCount -eq 0
  )

  return [PSCustomObject]@{
    kind = "steam-bridge-windows-candidate-write-protection"
    schemaVersion = 1
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    mode = $Mode.ToLowerInvariant()
    rootInheritanceProtected = [bool]$rootAcl.AreAccessRulesProtected
    rootExplicitRuleCount = $rootRules.Count
    canonicalRuleCount = @($canonicalRules | Where-Object { $_ -eq $true }).Count
    childEntryCount = $entries.Count
    fileCount = $fileCount
    directoryCount = $directoryCount
    protectedChildCount = $protectedChildCount
    explicitChildRuleCount = $explicitChildRuleCount
    currentIdentityReadExecuteOnly = [bool]$canonicalRules[0]
    systemFullControl = [bool]$canonicalRules[1]
    administratorsFullControl = [bool]$canonicalRules[2]
    limitedLaunchRequired = $true
    writeProtected = [bool]$ok
    ok = [bool]$ok
  }
}

function Invoke-Icacls {
  param([string[]]$Arguments)

  $icacls = Join-Path $env:SystemRoot "System32\icacls.exe"
  & $icacls @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "icacls failed with exit code $LASTEXITCODE."
  }
}

function Set-CandidateProtection {
  param([string]$Directory)

  $candidatePrefix = $Directory.TrimEnd("\") + "\"
  $running = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.ExecutablePath -and
    ([string]$_.ExecutablePath).StartsWith($candidatePrefix, [System.StringComparison]::OrdinalIgnoreCase)
  })
  if ($running.Count -ne 0) {
    throw "Candidate write protection requires zero running candidate processes."
  }

  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $identity.User) {
    throw "Could not resolve the current Windows identity."
  }
  $currentSid = [string]$identity.User.Value
  Invoke-Icacls -Arguments @(
    $Directory,
    "/inheritance:r",
    "/grant:r",
    "*${currentSid}:(OI)(CI)(RX)",
    "*S-1-5-18:(OI)(CI)(F)",
    "*S-1-5-32-544:(OI)(CI)(F)",
    "/Q"
  )
  Invoke-Icacls -Arguments @(
    (Join-Path $Directory "*"),
    "/reset",
    "/T",
    "/C",
    "/Q"
  )
}

function Write-Evidence {
  param([string]$Path, $Value)

  if (-not $Path) {
    return
  }
  $fullPath = Resolve-FullPath $Path
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $temporary = "$fullPath.tmp-$([System.Guid]::NewGuid().ToString('N'))"
  try {
    [System.IO.File]::WriteAllText(
      $temporary,
      (($Value | ConvertTo-Json -Depth 8) + [System.Environment]::NewLine),
      (New-Object System.Text.UTF8Encoding($false))
    )
    Move-Item -LiteralPath $temporary -Destination $fullPath -Force
  } finally {
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
  }
}

function Restore-SelfTestDirectory {
  param([string]$Directory)

  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    return
  }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $currentSid = [string]$identity.User.Value
  Invoke-Icacls -Arguments @(
    $Directory,
    "/grant:r",
    "*${currentSid}:(OI)(CI)(F)",
    "/Q"
  )
  Invoke-Icacls -Arguments @(
    (Join-Path $Directory "*"),
    "/reset",
    "/T",
    "/C",
    "/Q"
  )
}

function Invoke-SelfTest {
  $root = Join-Path $env:TEMP "steam-bridge-candidate-protection-$([System.Guid]::NewGuid().ToString('N'))"
  try {
    $nested = Join-Path $root "nested"
    New-Item -ItemType Directory -Force -Path $nested | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $root "root.txt"), "root")
    [System.IO.File]::WriteAllText((Join-Path $nested "child.txt"), "child")
    Set-CandidateProtection -Directory $root
    $audit = Get-CandidateProtectionAudit -Directory $root
    if (-not $audit.ok -or $audit.fileCount -ne 2 -or $audit.directoryCount -ne 1) {
      throw "Candidate write-protection self-test audit failed."
    }
    $probe = Join-Path $root "write-probe.tmp"
    $writeDenied = $false
    try {
      [System.IO.File]::WriteAllText($probe, "probe")
    } catch [System.UnauthorizedAccessException] {
      $writeDenied = $true
    }
    if (-not $writeDenied -or (Test-Path -LiteralPath $probe)) {
      throw "Candidate write-protection self-test did not deny a root write."
    }
    if ([System.IO.File]::ReadAllText((Join-Path $nested "child.txt")) -ne "child") {
      throw "Candidate write-protection self-test lost read access."
    }
    Write-Host "Windows candidate write-protection self-test passed."
  } finally {
    Restore-SelfTestDirectory -Directory $root
    $resolvedRoot = Resolve-FullPath $root
    $temporaryPrefix = (Resolve-FullPath $env:TEMP).TrimEnd("\") + "\"
    if ($resolvedRoot.StartsWith($temporaryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedRoot -Force -Recurse -ErrorAction SilentlyContinue
    }
  }
}

if ($SelfTest) {
  Invoke-SelfTest
  exit 0
}

if ($env:OS -ne "Windows_NT") {
  throw "Windows candidate write protection requires Windows."
}

$CandidateDirectory = Resolve-FullPath $CandidateDirectory
if (-not (Test-Path -LiteralPath $CandidateDirectory -PathType Container)) {
  throw "Candidate directory was not found."
}
$candidateRoot = [System.IO.Path]::GetPathRoot($CandidateDirectory).TrimEnd("\")
if ($CandidateDirectory.TrimEnd("\") -eq $candidateRoot) {
  throw "Candidate directory must not be a volume root."
}
if (
  -not (Test-Path -LiteralPath (Join-Path $CandidateDirectory "SteamBridgeSmoke.exe") -PathType Leaf) -or
  -not (Test-Path -LiteralPath (Join-Path $CandidateDirectory "resources") -PathType Container)
) {
  throw "Candidate directory does not have the packaged Windows smoke shape."
}
if ($EvidencePath) {
  $EvidencePath = Resolve-FullPath $EvidencePath
  if (Test-PathInsideDirectory -Path $EvidencePath -Directory $CandidateDirectory) {
    throw "Evidence path must be outside the candidate directory."
  }
}

$entries = @(Get-CandidateEntries -Directory $CandidateDirectory)
Assert-NoReparsePoints -Directory $CandidateDirectory -Entries $entries
if ($Mode -eq "Apply") {
  Set-CandidateProtection -Directory $CandidateDirectory
}
$evidence = Get-CandidateProtectionAudit -Directory $CandidateDirectory
Write-Evidence -Path $EvidencePath -Value $evidence
$evidence | ConvertTo-Json -Depth 8
if (-not $evidence.ok) {
  exit 1
}
