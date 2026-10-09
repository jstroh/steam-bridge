[CmdletBinding()]
param(
  [string]$CandidateDirectory = "",
  [ValidateSet("Apply", "Audit")]
  [string]$Mode = "Audit",
  [string]$EvidencePath = "",
  [string]$ExecutableName = "SteamBridgeSmoke.exe",
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

function Get-RootAclBoundary {
  param($Acl)

  $rules = @($Acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
  $inheritedCount = @($rules | Where-Object { $_.IsInherited }).Count
  return [PSCustomObject]@{
    allRuleCount = $rules.Count
    inheritedRuleCount = $inheritedCount
    ok = [bool]($Acl.AreAccessRulesProtected -and $rules.Count -eq 4 -and $inheritedCount -eq 0)
  }
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
  $ownerRightsSid = "S-1-3-4"
  $rootAcl = Get-Acl -LiteralPath $Directory -ErrorAction Stop
  $rootBoundary = Get-RootAclBoundary -Acl $rootAcl
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
  $ownerRightsRuleOk = @($rootRules | Where-Object {
      Test-CanonicalRootRule `
        -Rule $_ `
        -Identity $ownerRightsSid `
        -Rights ([System.Security.AccessControl.FileSystemRights]::ReadPermissions)
    }).Count -eq 1
  $canonicalRules = @($currentRuleOk, $systemRuleOk, $administratorsRuleOk, $ownerRightsRuleOk)

  $protectedChildCount = 0
  $explicitChildRuleCount = 0
  $invalidChildRuleCount = 0
  foreach ($entry in $entries) {
    $acl = Get-Acl -LiteralPath $entry.FullName -ErrorAction Stop
    if ($acl.AreAccessRulesProtected) {
      $protectedChildCount += 1
    }
    $explicitChildRuleCount += @(Get-ExplicitRules -Acl $acl).Count
    $childRules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
    $expectedChildInheritance = if ($entry.PSIsContainer) {
      [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    } else { [System.Security.AccessControl.InheritanceFlags]::None }
    $expectedRights = @{
      $currentSid = [System.Security.AccessControl.FileSystemRights]::ReadAndExecute
      $systemSid = [System.Security.AccessControl.FileSystemRights]::FullControl
      $administratorsSid = [System.Security.AccessControl.FileSystemRights]::FullControl
      $ownerRightsSid = [System.Security.AccessControl.FileSystemRights]::ReadPermissions
    }
    $childOk = $childRules.Count -eq 4
    foreach ($sid in $expectedRights.Keys) {
      $matching = @($childRules | Where-Object {
        [string]$_.IdentityReference.Value -eq $sid -and
        $_.IsInherited -and $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow -and
        $_.InheritanceFlags -eq $expectedChildInheritance -and
        $_.PropagationFlags -eq [System.Security.AccessControl.PropagationFlags]::None -and
        $(if ($sid -eq $currentSid) {
          ($_.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::ReadAndExecute) -eq $expectedRights[$sid] -and
          ($_.FileSystemRights -band ([System.Security.AccessControl.FileSystemRights]::Write -bor
            [System.Security.AccessControl.FileSystemRights]::Delete -bor
            [System.Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
            [System.Security.AccessControl.FileSystemRights]::ChangePermissions -bor
            [System.Security.AccessControl.FileSystemRights]::TakeOwnership)) -eq 0
        } else { $_.FileSystemRights -eq $expectedRights[$sid] })
      })
      if ($matching.Count -ne 1) { $childOk = $false }
    }
    if (-not $childOk) { $invalidChildRuleCount += 1 }
  }

  $fileCount = @($entries | Where-Object { -not $_.PSIsContainer }).Count
  $directoryCount = @($entries | Where-Object { $_.PSIsContainer }).Count
  $ok = (
    $rootAcl.AreAccessRulesProtected -and
    $rootBoundary.ok -and
    $rootRules.Count -eq 4 -and
    @($canonicalRules | Where-Object { $_ -eq $true }).Count -eq 4 -and
    $protectedChildCount -eq 0 -and
    $explicitChildRuleCount -eq 0 -and
    $invalidChildRuleCount -eq 0
  )

  return [PSCustomObject]@{
    kind = "steam-bridge-windows-candidate-write-protection"
    schemaVersion = 2
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    mode = $Mode.ToLowerInvariant()
    rootInheritanceProtected = [bool]$rootAcl.AreAccessRulesProtected
    rootExplicitRuleCount = $rootRules.Count
    rootInheritedRuleCount = $rootBoundary.inheritedRuleCount
    canonicalRuleCount = @($canonicalRules | Where-Object { $_ -eq $true }).Count
    childEntryCount = $entries.Count
    fileCount = $fileCount
    directoryCount = $directoryCount
    protectedChildCount = $protectedChildCount
    explicitChildRuleCount = $explicitChildRuleCount
    invalidChildRuleCount = $invalidChildRuleCount
    ownerRightsReadControlOnly = [bool]$ownerRightsRuleOk
    namespaceAttested = $false
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
  if ((Get-CandidateProtectionAudit -Directory $Directory).ok) {
    return
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
  Invoke-Icacls -Arguments @(
    $Directory,
    "/grant:r",
    "*S-1-3-4:(OI)(CI)(RC)",
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
  $selfTestIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $selfTestPrincipal = New-Object System.Security.Principal.WindowsPrincipal($selfTestIdentity)
  if ($selfTestPrincipal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Candidate protection self-test requires a Limited non-elevated token."
  }
  $rootModel = New-Object System.Security.AccessControl.DirectorySecurity
  $rootModelSddl = "D:P(A;OICI;FRFX;;;" + $selfTestIdentity.User.Value +
    ")(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;RC;;;OW)"
  $rootModel.SetSecurityDescriptorSddlForm($rootModelSddl)
  if (-not (Get-RootAclBoundary -Acl $rootModel).ok) { throw "Canonical root-boundary self-test failed." }
  $rootModel.SetSecurityDescriptorSddlForm($rootModelSddl + "(A;ID;WD;;;WD)")
  $inheritedRoot = Get-RootAclBoundary -Acl $rootModel
  if (-not $rootModel.AreAccessRulesProtected -or @(Get-ExplicitRules -Acl $rootModel).Count -ne 4 `
    -or $inheritedRoot.allRuleCount -ne 5 -or $inheritedRoot.inheritedRuleCount -ne 1 -or $inheritedRoot.ok) {
    throw "Inherited root-only rule self-test failed."
  }
  if (-not ("SteamBridgeProtectionSelfTestRestore" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class SteamBridgeProtectionSelfTestRestore {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern SafeFileHandle CreateFileW(string path, uint access, uint share,
    IntPtr attributes, uint disposition, uint flags, IntPtr template);
  [DllImport("advapi32.dll", SetLastError=true)]
  private static extern bool GetSecurityDescriptorDacl(IntPtr descriptor, out bool present, out IntPtr dacl, out bool defaulted);
  [DllImport("advapi32.dll")]
  private static extern uint SetSecurityInfo(SafeFileHandle handle, uint kind, uint information,
    IntPtr owner, IntPtr group, IntPtr dacl, IntPtr sacl);
  public static SafeFileHandle Open(string path) {
    return OpenWithRights(path, 0x00040000);
  }
  public static SafeFileHandle OpenRecovery(string path) {
    return OpenWithRights(path, 0x00060000);
  }
  private static SafeFileHandle OpenWithRights(string path, uint access) {
    var handle = CreateFileW(path, access, 3, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
    if (handle.IsInvalid) { int code=Marshal.GetLastWin32Error(); handle.Dispose(); throw new Win32Exception(code); }
    return handle;
  }
  public static void Restore(SafeFileHandle handle, byte[] descriptor, bool protect) {
    var pinned=GCHandle.Alloc(descriptor, GCHandleType.Pinned);
    try {
      bool present, defaulted; IntPtr dacl;
      if (!GetSecurityDescriptorDacl(pinned.AddrOfPinnedObject(), out present, out dacl, out defaulted) || !present || dacl==IntPtr.Zero)
        throw new InvalidOperationException("self-test-descriptor-extraction-failed");
      uint code=SetSecurityInfo(handle, 1, 4u | (protect ? 0x80000000u : 0x20000000u), IntPtr.Zero, IntPtr.Zero, dacl, IntPtr.Zero);
      if (code!=0) throw new Win32Exception((int)code, "self-test-setsecurityinfo-failed");
    } finally { pinned.Free(); }
  }
}
"@
  }
  $root = Join-Path $env:TEMP "steam-bridge-candidate-protection-$([System.Guid]::NewGuid().ToString('N'))"
  $restores = @()
  $checksPassed = $false
  try {
    $nested = Join-Path $root "nested"
    New-Item -ItemType Directory -Force -Path $nested | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $root "root.txt"), "root")
    [System.IO.File]::WriteAllText((Join-Path $nested "child.txt"), "child")
    Write-Host "Candidate protection self-test fixture: $root"
    foreach ($target in @($root, $nested, (Join-Path $root "root.txt"), (Join-Path $nested "child.txt"))) {
      $acl = Get-Acl -LiteralPath $target -ErrorAction Stop
      $restores += [PSCustomObject]@{
        handle = [SteamBridgeProtectionSelfTestRestore]::OpenRecovery($target)
        descriptor = $acl.GetSecurityDescriptorBinaryForm()
        protected = $acl.AreAccessRulesProtected
      }
    }
    Set-CandidateProtection -Directory $root
    $audit = Get-CandidateProtectionAudit -Directory $root
    if (-not $audit.ok -or -not $audit.ownerRightsReadControlOnly -or $audit.canonicalRuleCount -ne 4 `
      -or $audit.invalidChildRuleCount -ne 0 -or $audit.fileCount -ne 2 -or $audit.directoryCount -ne 1) {
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
    $changeDenied = $false
    try {
      $dacProbe = [SteamBridgeProtectionSelfTestRestore]::Open($root)
      $dacProbe.Dispose()
    } catch [System.ComponentModel.Win32Exception] {
      if ($_.Exception.GetBaseException().NativeErrorCode -ne 5) { throw }
      $changeDenied = $true
    }
    if (-not $changeDenied) { throw "Candidate owner must not be able to reopen WRITE_DAC after protection." }
    if ([System.IO.File]::ReadAllText((Join-Path $nested "child.txt")) -ne "child") {
      throw "Candidate write-protection self-test lost read access."
    }
    $checksPassed = $true
  } finally {
    $restoreFailures = @()
    $restoreOrdinal = 0
    try {
      foreach ($saved in $restores) {
        $restoreOrdinal += 1
        try {
          [SteamBridgeProtectionSelfTestRestore]::Restore($saved.handle, $saved.descriptor, $saved.protected)
        } catch {
          $cause = $_.Exception.GetBaseException()
          $phase = if ($cause.Message -eq "self-test-setsecurityinfo-failed") { "setsecurityinfo" } `
            elseif ($cause.Message -eq "self-test-descriptor-extraction-failed") { "descriptor" } else { "managed" }
          $code = if ($cause -is [System.ComponentModel.Win32Exception]) { [string]$cause.NativeErrorCode } else { "unknown" }
          $restoreFailures += "fixture-$restoreOrdinal/$phase/$code"
        }
      }
    } finally {
      foreach ($saved in $restores) { $saved.handle.Dispose() }
    }
    if ($restoreFailures.Count) {
      throw "Self-test fixture recovery incomplete ($($restoreFailures -join ', ')); do not infer cleanup: $root"
    }
    Restore-SelfTestDirectory -Directory $root
    $resolvedRoot = Resolve-FullPath $root
    $temporaryPrefix = (Resolve-FullPath $env:TEMP).TrimEnd("\") + "\"
    if ($resolvedRoot.StartsWith($temporaryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedRoot -Force -Recurse -ErrorAction Stop
      if (Test-Path -LiteralPath $resolvedRoot) { throw "Owned self-test fixture remains after cleanup." }
    } else {
      throw "Owned self-test fixture failed its cleanup boundary."
    }
  }
  if ($checksPassed) { Write-Host "Windows candidate write-protection self-test passed." }
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
  [System.IO.Path]::GetFileName($ExecutableName) -cne $ExecutableName -or
  [System.IO.Path]::GetExtension($ExecutableName) -ine ".exe"
) {
  throw "ExecutableName must be a single .exe filename."
}
if (
  -not (Test-Path -LiteralPath (Join-Path $CandidateDirectory $ExecutableName) -PathType Leaf) -or
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
