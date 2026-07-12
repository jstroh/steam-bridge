[CmdletBinding()]
param(
  [ValidateSet("baseline", "managed", "managed-routes", "shortcut-routes", "checkout", "persistent-reuse", "full", "preflight", "readiness", "shortcut")]
  [string]$Suite = "baseline",

  [ValidateSet("steam-launch", "steam-app", "direct")]
  [string]$LaunchMode = "steam-launch",

  [string]$AppDir = "",
  [string]$CandidateAuditManifest = "",
  [string]$ArtifactRoot = "",
  [int]$AppId = 480,
  [string]$NativePath = "",
  [string]$ShortcutGameId = "",
  [switch]$InstallShortcut,
  [switch]$AssumeShortcutConfigured,
  [string]$SteamUserId = "",
  [string]$ShortcutsPath = "",
  [string]$ShortcutName = "Steam Bridge Smoke",
  [string]$ShortcutExe = "",
  [string]$ShortcutStartDir = "",
  [string]$ShortcutLaunchPrefix = "",
  [string]$JavaScriptRunnerExe = "",
  [string]$LaunchEnvFile = "",
  [switch]$AllowShortcutUpdateWhileSteamRunning,
  [string]$OverlayProfile = "diagnostic",
  [string]$OverlayDisableDirectComposition = "",
  [string]$WindowMode = "windowed",
  [string]$WebUrl = "",
  [ValidateSet("web", "native")]
  [string]$StoreRoute = "web",
  [string]$Dialog = "Friends",
  [string]$UserDialog = "steamid",
  [string]$ShortcutTarget = "friends",
  [string]$CheckoutTransactionId = "123456789",
  [string]$CheckoutJsonFile = "",
  [string]$InitTxnRequestFile = "",
  [string]$InitTxnResponseFile = "",
  [string]$InitTxnApiKeyEnv = "",
  [ValidateSet("", "sandbox", "production")]
  [string]$InitTxnEndpoint = "",
  [switch]$RequireMicroTxnCallback,
  [string]$OnlyCase = "",
  [int]$TimeoutSeconds = 120,
  [switch]$SkipNativeLoadGate,
  [switch]$SkipRenderHealthGate,
  [switch]$AllowUnhealthyDefaultRender,
  [switch]$CleanStaleOverlayHelpers,
  [switch]$AllowUnhealthySteamClientLogs,
  [int]$SteamClientHealthRecentMinutes = 30,
  [switch]$PrivateEnvImported,
  [switch]$CloseProbe,
  [ValidateSet("auto", "toggle", "escape", "close-tab", "toggle-sendinput", "escape-sendinput", "close-tab-sendinput", "web-close-click-sendinput")]
  [string]$CloseProbeInput = "auto",
  [int]$CloseProbeSettleMs = 750,
  [int]$CloseProbeTimeoutSeconds = 110,
  [string]$PresenterMode = "",
  [ValidateSet("", "default", "opengl", "gl", "wgl", "windows-opengl", "d3d", "d3d11", "direct3d", "direct3d11", "dxgi", "windows-d3d11")]
  [string]$NativeHostBackend = "",
  [ValidateSet("", "default", "popup", "popup-layered", "control", "overlapped", "plain")]
  [string]$NativeHostStyle = "",
  [string]$OverlayInProcessGpu = "",
  [string]$OverlayScrubChildEnv = "",
  [string]$OverlayIsolateChildProcesses = "",
  [switch]$TaskCleanupExpected
)

$ErrorActionPreference = "Stop"

if (-not ("SteamBridgeExactProcessStop" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class SteamBridgeExactProcessStop {
  public const int Terminated = 0;
  public const int OpenNotFound = 1;
  public const int IdentityMismatch = 2;
  public const int InvalidIdentity = 3;
  public const int OpenDenied = 4;
  public const int OpenFailed = 5;
  public const int CreationQueryFailed = 6;
  public const int AlreadyExited = 7;
  public const int TerminateFailed = 8;
  public const int WaitFailed = 9;
  public const int WaitTimedOut = 10;

  private const uint ProcessTerminate = 0x0001;
  private const uint ProcessQueryLimitedInformation = 0x1000;
  private const uint Synchronize = 0x00100000;
  private const uint WaitObject0 = 0x00000000;
  private const uint WaitTimeout = 0x00000102;
  private const uint WaitFailedResult = 0xFFFFFFFF;
  private const int ErrorInvalidParameter = 87;
  private const int ErrorNotFound = 1168;
  private const int ErrorAccessDenied = 5;

  [StructLayout(LayoutKind.Sequential)]
  private struct FileTime {
    public uint Low;
    public uint High;
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern SafeProcessHandle OpenProcess(
    uint desiredAccess,
    [MarshalAs(UnmanagedType.Bool)] bool inheritHandle,
    uint processId
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool GetProcessTimes(
    SafeProcessHandle process,
    out FileTime creation,
    out FileTime exit,
    out FileTime kernel,
    out FileTime user
  );

  [DllImport("kernel32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool TerminateProcess(SafeProcessHandle process, uint exitCode);

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern uint WaitForSingleObject(SafeProcessHandle handle, uint milliseconds);

  private static int ClassifyOpenError(int error) {
    if (error == ErrorInvalidParameter || error == ErrorNotFound) {
      return OpenNotFound;
    }
    return error == ErrorAccessDenied ? OpenDenied : OpenFailed;
  }

  private static long ReadCreationTicks(SafeProcessHandle process) {
    FileTime creation;
    FileTime exit;
    FileTime kernel;
    FileTime user;
    if (!GetProcessTimes(process, out creation, out exit, out kernel, out user)) {
      return 0;
    }
    long creationFileTime = ((long)creation.High << 32) | creation.Low;
    try {
      return DateTime.FromFileTimeUtc(creationFileTime).Ticks;
    } catch {
      return 0;
    }
  }

  public static long CaptureExactStartTicks(int processId, long expectedCimCreationTicks) {
    if (processId <= 0 || expectedCimCreationTicks <= 0) {
      return 0;
    }
    uint access = ProcessQueryLimitedInformation | Synchronize;
    using (SafeProcessHandle process = OpenProcess(access, false, unchecked((uint)processId))) {
      if (process == null || process.IsInvalid) {
        return 0;
      }
      long actualCreationTicks = ReadCreationTicks(process);
      if (actualCreationTicks <= 0 ||
          (actualCreationTicks / 10L) != (expectedCimCreationTicks / 10L) ||
          WaitForSingleObject(process, 0) != WaitTimeout) {
        return 0;
      }
      return actualCreationTicks;
    }
  }

  public static int TerminateExact(int processId, long expectedNativeCreationTicks, int waitMilliseconds) {
    if (processId <= 0 || expectedNativeCreationTicks <= 0 || waitMilliseconds < 0) {
      return InvalidIdentity;
    }

    uint access = ProcessTerminate | ProcessQueryLimitedInformation | Synchronize;
    using (SafeProcessHandle process = OpenProcess(access, false, unchecked((uint)processId))) {
      if (process == null || process.IsInvalid) {
        return ClassifyOpenError(Marshal.GetLastWin32Error());
      }

      long actualCreationTicks = ReadCreationTicks(process);
      if (actualCreationTicks <= 0) {
        return CreationQueryFailed;
      }
      if (actualCreationTicks != expectedNativeCreationTicks) {
        return IdentityMismatch;
      }

      uint before = WaitForSingleObject(process, 0);
      if (before == WaitObject0) {
        return AlreadyExited;
      }
      if (before == WaitFailedResult) {
        return WaitFailed;
      }
      if (before != WaitTimeout) {
        return WaitFailed;
      }

      if (!TerminateProcess(process, 1)) {
        return WaitForSingleObject(process, 0) == WaitObject0 ? AlreadyExited : TerminateFailed;
      }

      uint after = WaitForSingleObject(process, unchecked((uint)waitMilliseconds));
      if (after == WaitObject0) {
        return Terminated;
      }
      if (after == WaitTimeout) {
        return WaitTimedOut;
      }
      return WaitFailed;
    }
  }
}
"@
}

function Invoke-ExactProcessStop {
  param([int]$ProcessId, [int64]$ExpectedStartTicks, [int]$WaitMilliseconds = 5000)

  $resultCode = [SteamBridgeExactProcessStop]::TerminateExact(
    $ProcessId,
    $ExpectedStartTicks,
    $WaitMilliseconds
  )
  $status = switch ($resultCode) {
    ([SteamBridgeExactProcessStop]::Terminated) { "terminated"; break }
    ([SteamBridgeExactProcessStop]::OpenNotFound) { "open-not-found"; break }
    ([SteamBridgeExactProcessStop]::IdentityMismatch) { "identity-mismatch"; break }
    ([SteamBridgeExactProcessStop]::InvalidIdentity) { "invalid-identity"; break }
    ([SteamBridgeExactProcessStop]::OpenDenied) { "open-denied"; break }
    ([SteamBridgeExactProcessStop]::OpenFailed) { "open-failed"; break }
    ([SteamBridgeExactProcessStop]::CreationQueryFailed) { "creation-query-failed"; break }
    ([SteamBridgeExactProcessStop]::AlreadyExited) { "already-exited"; break }
    ([SteamBridgeExactProcessStop]::TerminateFailed) { "terminate-failed"; break }
    ([SteamBridgeExactProcessStop]::WaitFailed) { "wait-failed"; break }
    ([SteamBridgeExactProcessStop]::WaitTimedOut) { "wait-timeout"; break }
    default { "unknown-failed" }
  }
  return [PSCustomObject]@{
    status = $status
    ok = ($status -in @("terminated", "open-not-found", "identity-mismatch", "already-exited"))
  }
}

function Get-ExactProcessNativeStartTicks {
  param([int]$ProcessId, [int64]$CimStartTicks)

  return [int64][SteamBridgeExactProcessStop]::CaptureExactStartTicks($ProcessId, $CimStartTicks)
}
$CloseProbeEvidenceSchema = 2
$SameProcessUserGestureEvidenceSchema = 3
$CloseProbeForegroundHandoff = "owner-process-native-show-v1"
$SameProcessUserGestureForegroundHandoff = "same-process-user-gesture-v1"
$ExternalForegroundTransition = "external-foreground-event-v1"
$AutorunUserGestureGatePolicy = "single-cycle-active-v1"
$PersistentReuseGatePolicy = "initial-user-gesture-verify-only-v1"
$PersistentReuseEvidenceSchema = 1

function Test-PathAncestorChainHasReparsePoint {
  param([string]$Path)

  $cursor = [System.IO.Path]::GetFullPath($Path)
  if (-not (Test-Path -LiteralPath $cursor)) {
    $cursor = Split-Path -Parent $cursor
  }
  while ($cursor) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
      if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        return $true
      }
    }
    $parent = Split-Path -Parent $cursor
    if (-not $parent -or $parent -eq $cursor) {
      break
    }
    $cursor = $parent
  }
  return $false
}

if (-not $AppDir) {
  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir -and (Test-Path -LiteralPath (Join-Path $scriptDir "SteamBridgeSmoke.exe"))) {
    $AppDir = $scriptDir
  } else {
    $AppDir = Join-Path (Get-Location) "dist\electron-smoke\x86_64-pc-windows-msvc\SteamBridgeSmoke-win32-x64"
  }
}
$AppDir = [System.IO.Path]::GetFullPath($AppDir)

if ($CandidateAuditManifest) {
  $CandidateAuditManifest = [System.IO.Path]::GetFullPath($CandidateAuditManifest)
}

if (-not $ArtifactRoot) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-overlay-matrix-$timestamp"
}

$defaultLaunchEnvFile = [System.IO.Path]::GetFullPath(
  (Join-Path $env:LOCALAPPDATA "SteamBridgeSmoke\steam-bridge-windows-smoke.env")
)
if (-not $LaunchEnvFile) {
  $LaunchEnvFile = $defaultLaunchEnvFile
} else {
  $LaunchEnvFile = [System.IO.Path]::GetFullPath($LaunchEnvFile)
}
$pathTrimChars = @([char]92, [char]47)
$pathSeparator = [string][System.IO.Path]::DirectorySeparatorChar
$normalizedCandidateRoot = $AppDir.TrimEnd($pathTrimChars).ToLowerInvariant()
$normalizedLaunchEnvFile = $LaunchEnvFile.ToLowerInvariant()
$launchEnvOutsideCandidate = [bool](
  $normalizedLaunchEnvFile -ne $normalizedCandidateRoot -and
  -not $normalizedLaunchEnvFile.StartsWith($normalizedCandidateRoot + $pathSeparator)
)
$launchEnvUsesDefaultPath = [bool]$LaunchEnvFile.Equals(
  $defaultLaunchEnvFile,
  [System.StringComparison]::OrdinalIgnoreCase
)
$candidatePathHasNoReparsePoints = -not (Test-PathAncestorChainHasReparsePoint -Path $AppDir)
$launchEnvPathHasNoReparsePoints = -not (Test-PathAncestorChainHasReparsePoint -Path $LaunchEnvFile)
if (-not $launchEnvOutsideCandidate) {
  throw "-LaunchEnvFile must resolve outside -AppDir."
}
if ($CandidateAuditManifest -and (-not $candidatePathHasNoReparsePoints -or -not $launchEnvPathHasNoReparsePoints)) {
  throw "Candidate-bound runs require reparse-point-free candidate and launch-environment path ancestry."
}

if (-not $WebUrl) {
  $WebUrl = "https://store.steampowered.com/app/$AppId/"
}

if ($Suite -eq "readiness" -and $LaunchMode -notin @("steam-launch", "steam-app")) {
  throw "-Suite readiness checks live Steam-launched readiness and requires -LaunchMode steam-launch or -LaunchMode steam-app."
}

if ($Suite -eq "shortcut" -and $LaunchMode -ne "steam-launch") {
  throw "-Suite shortcut configures the stable non-Steam shortcut and requires -LaunchMode steam-launch."
}

if ($Suite -eq "persistent-reuse" -and $LaunchMode -ne "steam-launch") {
  throw "-Suite persistent-reuse is public App ID 480 same-process proof and requires -LaunchMode steam-launch."
}

if ($LaunchMode -eq "steam-app" -and ($InstallShortcut -or $AssumeShortcutConfigured -or $ShortcutGameId)) {
  throw "-LaunchMode steam-app launches the configured Steam app ID directly; do not pass shortcut setup or shortcut game ID options."
}

if ($LaunchMode -eq "steam-app" -and $AppId -eq 480) {
  throw "-LaunchMode steam-app requires your configured Steam app ID; use the non-Steam shortcut mode for public App ID 480 smoke proof."
}

function Resolve-HelperPath {
  $helper = Join-Path $AppDir "windows-electron-smoke.ps1"
  if (-not (Test-Path -LiteralPath $helper)) {
    throw "Missing windows-electron-smoke.ps1 at $helper"
  }
  return $helper
}

function Resolve-RenderHealthProbePath {
  $probe = Join-Path $AppDir "windows-render-health-probe.ps1"
  if (Test-Path -LiteralPath $probe) {
    return $probe
  }

  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir) {
    $repoProbe = Join-Path $scriptDir "windows-render-health-probe.ps1"
    if (Test-Path -LiteralPath $repoProbe) {
      return $repoProbe
    }
  }

  throw "Missing windows-render-health-probe.ps1 beside the package or matrix script."
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe"
  }
  return $exe
}

function Resolve-ShortcutExe {
  if ($ShortcutExe) {
    if (-not (Test-Path -LiteralPath $ShortcutExe)) {
      throw "Missing Windows shortcut executable at $ShortcutExe"
    }
    return $ShortcutExe
  }

  return (Resolve-SmokeExe)
}

function Resolve-ShortcutStartDir {
  if ($ShortcutStartDir) {
    if (-not (Test-Path -LiteralPath $ShortcutStartDir)) {
      throw "Missing Windows shortcut start directory at $ShortcutStartDir"
    }
    return $ShortcutStartDir
  }

  if ($ShortcutExe) {
    return (Split-Path -Parent (Resolve-ShortcutExe))
  }

  return $AppDir
}

function Resolve-SteamBridgeRuntimeDirectory {
  $requiredFiles = @(
    "steam_bridge_native.win32-x64-msvc.node",
    "steam_api64.dll",
    "sdkencryptedappticket64.dll"
  )
  $candidates = @(
    (Join-Path $AppDir "resources\app.asar.unpacked\node_modules\steam-bridge"),
    (Join-Path $AppDir "resources\app\node_modules\steam-bridge")
  )
  $complete = @()

  foreach ($candidate in $candidates) {
    $present = @($requiredFiles | Where-Object { Test-Path -LiteralPath (Join-Path $candidate $_) })
    if ($present.Count -gt 0 -and $present.Count -ne $requiredFiles.Count) {
      throw "Incomplete Steam Bridge Windows runtime at $candidate. Found: $($present -join ', ')."
    }
    if ($present.Count -eq $requiredFiles.Count) {
      $complete += $candidate
    }
  }

  if ($complete.Count -eq 0) {
    throw "No complete Steam Bridge Windows runtime found under $AppDir."
  }
  if ($complete.Count -gt 1) {
    throw "Ambiguous Steam Bridge Windows runtime layout: $($complete -join ', ')."
  }
  if ((Test-Path -LiteralPath (Join-Path $AppDir "resources\app.asar")) -and $complete[0] -ne $candidates[0]) {
    throw "An ASAR app must keep the Steam Bridge addon and both runtime DLLs under resources\app.asar.unpacked."
  }

  return $complete[0]
}

function Resolve-NativeAddon {
  return Join-Path (Resolve-SteamBridgeRuntimeDirectory) "steam_bridge_native.win32-x64-msvc.node"
}

function Resolve-SteamInstallPath {
  $steamRegistry = Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue
  if ($steamRegistry -and $steamRegistry.SteamPath) {
    return $steamRegistry.SteamPath
  }
  return Join-Path ${env:ProgramFiles(x86)} "Steam"
}

function Write-MatrixJsonFile {
  param([string]$Path, $Value, [int]$Depth = 8)

  if (-not $Path) {
    return
  }
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText(
    $Path,
    (($Value | ConvertTo-Json -Depth $Depth) + [System.Environment]::NewLine),
    $utf8NoBom
  )
}

function Read-MatrixJsonFile {
  param([string]$Path)

  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  return (Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json)
}

function Join-MatrixLaunchOptions {
  param([string[]]$Arguments)

  return (($Arguments | ForEach-Object {
    $value = [string]$_
    if ($value -match '[\s"]') {
      '"' + ($value -replace '"', '\"') + '"'
    } else {
      $value
    }
  }) -join " ")
}

function Convert-MatrixEventTime {
  param($Value)

  if (-not $Value) {
    return $null
  }

  if ($Value -is [datetime]) {
    return ([datetime]$Value).ToUniversalTime()
  }

  $text = [string]$Value
  if ($text -match '^/Date\((-?\d+)\)/$') {
    try {
      return [System.DateTimeOffset]::FromUnixTimeMilliseconds([int64]$Matches[1]).UtcDateTime
    } catch {
      return $null
    }
  }

  try {
    return ([datetime]::Parse(
      $text,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
    )).ToUniversalTime()
  } catch {
    return $null
  }
}

function Select-CodeIntegrityEventsSince {
  param($Events, [datetime]$Since)

  if (-not $Since) {
    return @($Events)
  }

  $threshold = $Since.ToUniversalTime().AddSeconds(-2)
  return @(
    $Events |
      Where-Object {
        $eventTime = Convert-MatrixEventTime -Value $_.timeCreated
        $eventTime -and $eventTime -ge $threshold
      }
  )
}

function Write-MatrixTextFile {
  param([string]$Path, [string[]]$Lines)

  if (-not $Path) {
    return
  }
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText(
    $Path,
    ((@($Lines) -join [System.Environment]::NewLine) + [System.Environment]::NewLine),
    $utf8NoBom
  )
}

function Copy-LogTail {
  param([string]$Source, [string]$Destination, [int]$Tail = 300)

  if (-not (Test-Path -LiteralPath $Source)) {
    return
  }

  $lines = @(Get-Content -LiteralPath $Source -Tail $Tail -ErrorAction SilentlyContinue)
  Write-MatrixTextFile -Path $Destination -Lines $lines
}

function Limit-DiagnosticLine {
  param([string]$Line, [int]$MaxLength = 500)

  $trimmed = ([string]$Line).Trim()
  if ($trimmed.Length -le $MaxLength) {
    return $trimmed
  }
  return ($trimmed.Substring(0, $MaxLength) + " ...[truncated]")
}

function Get-SteamClientDiagnosticLogNames {
  return @(
    "cef_log.txt",
    "webhelper.txt",
    "steamwebhelper.log",
    "webhelper_js.txt",
    "console_log.txt",
    "gameoverlay_renderer.txt",
    "gameoverlay_ui.txt",
    "steamui_system.txt"
  )
}

function Get-LatestSteamProcessStartUtc {
  param([object[]]$SteamProcesses)

  $startTimes = @()
  foreach ($process in @($SteamProcesses)) {
    if (-not $process -or -not $process.StartTime) {
      continue
    }
    try {
      $startTimes += ([datetime]$process.StartTime).ToUniversalTime()
    } catch {
      # Process start times are diagnostic only; ignore inaccessible entries.
    }
  }

  if ($startTimes.Count -eq 0) {
    return $null
  }
  return ($startTimes | Sort-Object -Descending | Select-Object -First 1)
}

function ConvertTo-SteamLogTimestampUtc {
  param([string]$Line)

  $culture = [System.Globalization.CultureInfo]::InvariantCulture
  if ($Line -match '^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]') {
    try {
      $parsed = [datetime]::ParseExact($Matches[1], "yyyy-MM-dd HH:mm:ss", $culture)
      return [datetime]::SpecifyKind($parsed, [System.DateTimeKind]::Local).ToUniversalTime()
    } catch {
      return $null
    }
  }

  if ($Line -match '^\[[^:\]]+:[^:\]]+:(\d{2})(\d{2})/(\d{2})(\d{2})(\d{2})(?:\.(\d+))?:') {
    try {
      $millisecondText = if ($Matches[6]) { ([string]$Matches[6]).Substring(0, [math]::Min(3, ([string]$Matches[6]).Length)).PadRight(3, '0') } else { "000" }
      $timestampText = "{0:0000}-{1:00}-{2:00} {3:00}:{4:00}:{5:00}.{6}" -f `
        (Get-Date).Year,
        ([int]$Matches[1]),
        ([int]$Matches[2]),
        ([int]$Matches[3]),
        ([int]$Matches[4]),
        ([int]$Matches[5]),
        $millisecondText
      $parsed = [datetime]::ParseExact($timestampText, "yyyy-MM-dd HH:mm:ss.fff", $culture)
      return [datetime]::SpecifyKind($parsed, [System.DateTimeKind]::Local).ToUniversalTime()
    } catch {
      return $null
    }
  }

  if ($Line -match '^[A-Za-z]{3} ([A-Za-z]{3})\s+(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\d{4}) UTC -') {
    try {
      $months = @{
        Jan = 1; Feb = 2; Mar = 3; Apr = 4; May = 5; Jun = 6;
        Jul = 7; Aug = 8; Sep = 9; Oct = 10; Nov = 11; Dec = 12
      }
      if (-not $months.ContainsKey($Matches[1])) {
        return $null
      }
      $timestampText = "{0:0000}-{1:00}-{2:00} {3:00}:{4:00}:{5:00}" -f `
        ([int]$Matches[6]),
        ([int]$months[$Matches[1]]),
        ([int]$Matches[2]),
        ([int]$Matches[3]),
        ([int]$Matches[4]),
        ([int]$Matches[5])
      $parsed = [datetime]::ParseExact($timestampText, "yyyy-MM-dd HH:mm:ss", $culture)
      return [datetime]::SpecifyKind($parsed, [System.DateTimeKind]::Utc)
    } catch {
      return $null
    }
  }

  return $null
}

function Get-SteamClientRenderingHealth {
  param([datetime]$CurrentSteamStartUtc = [datetime]::MinValue)

  $steamPath = Resolve-SteamInstallPath
  $logs = Join-Path $steamPath "logs"
  $generatedAt = (Get-Date).ToUniversalTime()
  $cutoff = $generatedAt.AddMinutes(-1 * [math]::Max(1, $SteamClientHealthRecentMinutes))
  $currentSteamCutoff = $null
  $effectiveCutoff = $cutoff
  if ($CurrentSteamStartUtc -gt [datetime]::MinValue) {
    $currentSteamCutoff = $CurrentSteamStartUtc.ToUniversalTime()
    if ($currentSteamCutoff -gt $effectiveCutoff) {
      $effectiveCutoff = $currentSteamCutoff
    }
  }
  $signals = @()
  $warnings = @()

  $severePatterns = @(
    @{ code = "steam-cef-dxgi-not-currently-available"; pattern = "(?i)(0x887A0022|887a0022|DXGI_ERROR_NOT_CURRENTLY_AVAILABLE)" },
    @{ code = "steam-cef-angle-context-lost"; pattern = "(?i)(context lost|EGL_CONTEXT_LOST|display had a context loss|Could not create additional swap chains|Device lost in SwapChain11)" },
    @{ code = "steam-cef-gpu-process-crash"; pattern = "(?i)(Exiting GPU process because|GPU process exited unexpectedly|GPU process has crashed)" },
    @{ code = "steam-overlay-swapchain-failure"; pattern = "(?i)(CreateSwapChainForHWND failed|g_IDXGIFactory2_CreateSwapChainForHWND failed)" },
    @{ code = "steam-overlay-resource-failure"; pattern = "(?i)(CreateProcess failed\. Error: 1455|Failed creating file mapping)" }
  )
  $warningPatterns = @(
    @{ code = "steam-cef-paint-event-warning"; pattern = "(?i)Failed creating CEF paint event" }
  )

  if (-not (Test-Path -LiteralPath $logs)) {
    return [PSCustomObject]@{
      kind = "steam-bridge-windows-steam-client-rendering-health"
      generatedAt = $generatedAt.ToString("o")
      status = "unknown"
      healthy = $false
      recentWindowMinutes = $SteamClientHealthRecentMinutes
      currentSteamStartUtc = if ($currentSteamCutoff) { $currentSteamCutoff.ToString("o") } else { $null }
      effectiveRecentCutoffUtc = $effectiveCutoff.ToString("o")
      logDirectory = $logs
      recentSevereSignalCount = 0
      staleSevereSignalCount = 0
      recentSevereSignals = @()
      staleSevereSignals = @()
      warnings = @("Steam log directory was not found.")
    }
  }

  foreach ($name in Get-SteamClientDiagnosticLogNames) {
    $source = Join-Path $logs $name
    if (-not (Test-Path -LiteralPath $source)) {
      continue
    }

    try {
      $file = Get-Item -LiteralPath $source
      $tailLines = @(Get-Content -LiteralPath $source -Tail 1000 -ErrorAction SilentlyContinue)
      for ($index = 0; $index -lt $tailLines.Count; $index += 1) {
        $line = [string]$tailLines[$index]
        $matchedSevere = $false
        foreach ($pattern in $severePatterns) {
          if ($line -notmatch $pattern.pattern) {
            continue
          }

          $timestampUtc = ConvertTo-SteamLogTimestampUtc -Line $line
          $isRecent = if ($timestampUtc) {
            $timestampUtc -ge $effectiveCutoff
          } else {
            $file.LastWriteTimeUtc -ge $effectiveCutoff
          }
          $signals += [PSCustomObject]@{
            code = $pattern.code
            logFile = $name
            tailLine = ($index + 1)
            timestampUtc = if ($timestampUtc) { $timestampUtc.ToString("o") } else { $null }
            recent = [bool]$isRecent
            line = Limit-DiagnosticLine -Line $line
          }
          $matchedSevere = $true
          break
        }
        if ($matchedSevere) {
          continue
        }

        foreach ($pattern in $warningPatterns) {
          if ($line -notmatch $pattern.pattern) {
            continue
          }
          if ($warnings.Count -lt 10) {
            $warnings += ("{0}: {1} tail line {2}: {3}" -f `
              $pattern.code,
              $name,
              ($index + 1),
              (Limit-DiagnosticLine -Line $line))
          }
          break
        }
      }
    } catch {
      $warnings += ("{0}: failed to scan rendering health: {1}" -f $name, $_.Exception.Message)
    }
  }

  $recentSignals = @($signals | Where-Object { $_.recent })
  $staleSignals = @($signals | Where-Object { -not $_.recent })
  $status = "healthy"
  if ($recentSignals.Count -gt 0) {
    $status = "unhealthy"
  } elseif ($staleSignals.Count -gt 0) {
    $status = "stale-signals"
  }

  return [PSCustomObject]@{
    kind = "steam-bridge-windows-steam-client-rendering-health"
    generatedAt = $generatedAt.ToString("o")
    status = $status
    healthy = ($status -ne "unhealthy")
    recentWindowMinutes = $SteamClientHealthRecentMinutes
    currentSteamStartUtc = if ($currentSteamCutoff) { $currentSteamCutoff.ToString("o") } else { $null }
    effectiveRecentCutoffUtc = $effectiveCutoff.ToString("o")
    logDirectory = $logs
    recentSevereSignalCount = $recentSignals.Count
    staleSevereSignalCount = $staleSignals.Count
    recentSevereSignals = @($recentSignals | Select-Object -Last 30)
    staleSevereSignals = @($staleSignals | Select-Object -Last 30)
    warnings = @($warnings)
  }
}

function Get-RedactedSteamConfigLabel {
  param([string]$ConfigPath, [string]$SteamPath)

  $normalizedPath = $ConfigPath -replace '/', '\'
  $normalizedSteamPath = $SteamPath -replace '/', '\'
  $steamConfigPath = (Join-Path $normalizedSteamPath "config\config.vdf") -replace '/', '\'
  if ($normalizedPath -ieq $steamConfigPath) {
    return "steam/config.vdf"
  }
  if ($normalizedPath -match '\\userdata\\[^\\]+\\config\\localconfig\.vdf$') {
    return "userdata/*/config/localconfig.vdf"
  }
  return (Split-Path -Leaf $ConfigPath)
}

function Get-CommandLineArgumentValue {
  param([string]$CommandLine, [string]$Name)

  if (-not $CommandLine) {
    return $null
  }
  $pattern = '(?i)(?:^|\s)-' + [regex]::Escape($Name) + '\s+([^\s]+)'
  $match = [regex]::Match($CommandLine, $pattern)
  if (-not $match.Success) {
    return $null
  }
  return $match.Groups[1].Value
}

function ConvertTo-NullableInt {
  param([string]$Value)

  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) {
    return $parsed
  }
  return $null
}

function Get-OverlayHelperDiagnostics {
  $helpers = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '(?i)^gameoverlayui(64)?\.exe$' })

  foreach ($helper in $helpers) {
    $targetPid = ConvertTo-NullableInt -Value (Get-CommandLineArgumentValue -CommandLine $helper.CommandLine -Name "pid")
    $steamPid = ConvertTo-NullableInt -Value (Get-CommandLineArgumentValue -CommandLine $helper.CommandLine -Name "steampid")
    $targetProcess = if ($targetPid) { Get-Process -Id $targetPid -ErrorAction SilentlyContinue } else { $null }
    $steamProcess = if ($steamPid) { Get-Process -Id $steamPid -ErrorAction SilentlyContinue } else { $null }
    $isOrphaned = [bool]($targetPid -and -not $targetProcess -and ((-not $steamPid) -or -not $steamProcess))

    [PSCustomObject]@{
      processName = $helper.Name
      processId = $helper.ProcessId
      parentProcessId = $helper.ParentProcessId
      createdAt = if ($helper.CreationDate) { $helper.CreationDate.ToUniversalTime().ToString("o") } else { $null }
      targetPid = $targetPid
      targetExists = [bool]$targetProcess
      targetName = if ($targetProcess) { $targetProcess.ProcessName } else { $null }
      steamPid = $steamPid
      steamParentExists = [bool]$steamProcess
      orphaned = $isOrphaned
    }
  }
}

function Convert-BytesToMegabytes {
  param($Bytes)

  if ($null -eq $Bytes) {
    return $null
  }
  return [math]::Round(([double]$Bytes / 1MB), 1)
}

function Convert-KilobytesToMegabytes {
  param($Kilobytes)

  if ($null -eq $Kilobytes) {
    return $null
  }
  return [math]::Round(([double]$Kilobytes / 1024), 1)
}

function Get-WindowsResourceSnapshot {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
  $pageFiles = @(Get-CimInstance Win32_PageFileUsage -ErrorAction SilentlyContinue |
    Select-Object Name,AllocatedBaseSize,CurrentUsage,PeakUsage)
  $disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue |
    Select-Object DeviceID,
      @{Name = "sizeGB"; Expression = { [math]::Round(([double]$_.Size / 1GB), 1) } },
      @{Name = "freeGB"; Expression = { [math]::Round(([double]$_.FreeSpace / 1GB), 1) } })
  $topProcesses = @(Get-Process -ErrorAction SilentlyContinue |
    Sort-Object PrivateMemorySize64 -Descending |
    Select-Object -First 15 ProcessName,Id,
      @{Name = "privateMB"; Expression = { Convert-BytesToMegabytes $_.PrivateMemorySize64 } },
      @{Name = "workingSetMB"; Expression = { Convert-BytesToMegabytes $_.WorkingSet64 } })
  $topServiceProcessIds = @($topProcesses |
    Where-Object { $_.ProcessName -eq "svchost" } |
    ForEach-Object { $_.Id })
  $topServices = @()
  if ($topServiceProcessIds.Count -gt 0) {
    $topServices = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue |
      Where-Object { $topServiceProcessIds -contains $_.ProcessId } |
      Select-Object Name,DisplayName,ProcessId,State)
  }

  return [PSCustomObject]@{
    operatingSystem = if ($os) {
      [PSCustomObject]@{
        totalPhysicalMB = Convert-KilobytesToMegabytes $os.TotalVisibleMemorySize
        freePhysicalMB = Convert-KilobytesToMegabytes $os.FreePhysicalMemory
        totalVirtualMB = Convert-KilobytesToMegabytes $os.TotalVirtualMemorySize
        freeVirtualMB = Convert-KilobytesToMegabytes $os.FreeVirtualMemory
        pagefileTotalMB = Convert-KilobytesToMegabytes $os.SizeStoredInPagingFiles
        pagefileFreeMB = Convert-KilobytesToMegabytes $os.FreeSpaceInPagingFiles
      }
    } else {
      $null
    }
    pageFiles = @($pageFiles)
    disks = @($disks)
    topProcessesByPrivateMemory = @($topProcesses)
    servicesForTopSvchostProcesses = @($topServices)
  }
}

function Stop-StaleSteamOverlayHelpers {
  param([string]$DestinationFile)

  $helpers = @(Get-OverlayHelperDiagnostics)
  $staleHelpers = @($helpers | Where-Object { $_.orphaned })
  $results = @()
  foreach ($helper in $staleHelpers) {
    $cimStartTicks = if ($helper.createdAt) {
      ([DateTime]$helper.createdAt).ToUniversalTime().Ticks
    } else {
      [int64]0
    }
    $nativeStartTicks = Get-ExactProcessNativeStartTicks `
      -ProcessId ([int]$helper.processId) `
      -CimStartTicks $cimStartTicks
    $stopResult = Invoke-ExactProcessStop `
      -ProcessId ([int]$helper.processId) `
      -ExpectedStartTicks $nativeStartTicks
    $results += [PSCustomObject]@{
      processId = $helper.processId
      targetPid = $helper.targetPid
      steamPid = $helper.steamPid
      status = $stopResult.status
      error = if ($stopResult.ok) { $null } else { "exact-process-stop-failed" }
    }
  }

  Write-MatrixJsonFile -Path $DestinationFile -Value ([PSCustomObject]@{
    kind = "steam-bridge-windows-stale-overlay-helper-cleanup"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    staleOverlayHelpersBeforeCleanup = @($staleHelpers)
    cleanupResults = @($results)
    overlayHelpersAfterCleanup = @(Get-OverlayHelperDiagnostics)
  }) -Depth 8
  Write-Host ("Stale Steam overlay helper cleanup checked {0} helper(s), terminated {1}. Details: {2}" -f $helpers.Count, ($results | Where-Object { $_.status -eq "terminated" }).Count, $DestinationFile)
}

function Get-SmokePackageProcesses {
  $trimChars = @([char]92, [char]47)
  $pathSeparator = [string][char]92
  $normalizedAppDir = ([System.IO.Path]::GetFullPath($AppDir)).TrimEnd($trimChars).ToLowerInvariant()
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'SteamBridgeSmoke.exe'" -ErrorAction Stop)
  $matched = @()

  foreach ($process in $processes) {
    $executablePath = [string]$process.ExecutablePath
    $commandLine = [string]$process.CommandLine
    $executablePathLower = $executablePath.ToLowerInvariant()
    $commandLineLower = $commandLine.ToLowerInvariant()
    $belongsToPackage = (
      ($executablePathLower -and $executablePathLower.StartsWith($normalizedAppDir + $pathSeparator)) -or
      ($commandLineLower -and $commandLineLower.Contains($normalizedAppDir + $pathSeparator))
    )
    if (-not $belongsToPackage) {
      continue
    }

    $matched += [PSCustomObject]@{
      processId = [int]$process.ProcessId
      parentProcessId = [int]$process.ParentProcessId
      sessionId = [int]$process.SessionId
      creationDate = $process.CreationDate
      executablePath = if ($executablePath) { $executablePath } else { $null }
      commandLine = Limit-DiagnosticLine -Line $commandLine -MaxLength 1000
    }
  }

  return @($matched)
}

function Stop-SmokePackageProcesses {
  param([string]$DestinationFile, [string]$Phase)

  $before = @(Get-SmokePackageProcesses)
  $results = @()
  foreach ($process in $before) {
    $cimStartTicks = if ($process.creationDate) {
      ([DateTime]$process.creationDate).ToUniversalTime().Ticks
    } else {
      [int64]0
    }
    $nativeStartTicks = Get-ExactProcessNativeStartTicks `
      -ProcessId ([int]$process.processId) `
      -CimStartTicks $cimStartTicks
    $stopResult = Invoke-ExactProcessStop `
      -ProcessId ([int]$process.processId) `
      -ExpectedStartTicks $nativeStartTicks
    $results += [PSCustomObject]@{
      processId = $process.processId
      status = $stopResult.status
      error = if ($stopResult.ok) { $null } else { "exact-process-stop-failed" }
    }
  }

  if ($before.Count -gt 0) {
    Start-Sleep -Milliseconds 500
  }

  $after = @(Get-SmokePackageProcesses)
  $cleanup = [PSCustomObject]@{
    kind = "steam-bridge-windows-smoke-process-cleanup"
    phase = $Phase
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    ok = ($after.Count -eq 0)
    packageAppDirPresent = -not [string]::IsNullOrWhiteSpace($AppDir)
    processesBeforeCleanup = @($before | ForEach-Object {
      [PSCustomObject]@{
        processId = $_.processId
        parentProcessId = $_.parentProcessId
        sessionId = $_.sessionId
        creationDatePresent = ($null -ne $_.creationDate)
        executablePathPresent = -not [string]::IsNullOrWhiteSpace([string]$_.executablePath)
        commandLinePresent = -not [string]::IsNullOrWhiteSpace([string]$_.commandLine)
        packagePathMatched = $true
      }
    })
    cleanupResults = @($results)
    processesAfterCleanup = @($after | ForEach-Object {
      [PSCustomObject]@{
        processId = $_.processId
        parentProcessId = $_.parentProcessId
        sessionId = $_.sessionId
        creationDatePresent = ($null -ne $_.creationDate)
        executablePathPresent = -not [string]::IsNullOrWhiteSpace([string]$_.executablePath)
        commandLinePresent = -not [string]::IsNullOrWhiteSpace([string]$_.commandLine)
        packagePathMatched = $true
      }
    })
  }
  Write-MatrixJsonFile -Path $DestinationFile -Value $cleanup -Depth 8

  if ($before.Count -gt 0) {
    Write-Host ("Processed {0} leftover SteamBridgeSmoke package process(es) for {1}. Details: {2}" -f $before.Count, $Phase, $DestinationFile)
  }
  if ($after.Count -gt 0) {
    throw "Found $($after.Count) leftover SteamBridgeSmoke package process(es) after cleanup. See $DestinationFile."
  }
}

function Start-LaunchEnvRollbackTransaction {
  param([string]$Path)

  $transaction = [ordered]@{
    attempted = $true
    originalPresent = (Test-Path -LiteralPath $Path)
    backupCreated = $false
    backupPath = ""
    originalBytes = $null
  }
  if ($transaction.originalPresent) {
    $transaction.originalBytes = [System.IO.File]::ReadAllBytes($Path)
    $transaction.backupPath = "{0}.steam-bridge-backup-{1}" -f $Path, ([System.Guid]::NewGuid().ToString("N"))
    Move-Item -LiteralPath $Path -Destination $transaction.backupPath -ErrorAction Stop
    $transaction.backupCreated = $true
  }
  return [PSCustomObject]$transaction
}

function Test-LaunchEnvBytesMatch {
  param([byte[]]$ExpectedBytes, [string]$Path)

  if ($null -eq $ExpectedBytes -or -not (Test-Path -LiteralPath $Path)) {
    return $false
  }
  $actualBytes = [System.IO.File]::ReadAllBytes($Path)
  if ($actualBytes.Length -ne $ExpectedBytes.Length) {
    return $false
  }
  for ($index = 0; $index -lt $ExpectedBytes.Length; $index += 1) {
    if ($actualBytes[$index] -ne $ExpectedBytes[$index]) {
      return $false
    }
  }
  return $true
}

function Complete-LaunchEnvRollbackTransaction {
  param($Transaction, [string]$Path, [string]$DestinationFile)

  $evidence = [ordered]@{
    kind = "steam-bridge-windows-launch-env-rollback"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    attempted = ($null -ne $Transaction -and $Transaction.attempted -eq $true)
    originalPresent = ($null -ne $Transaction -and $Transaction.originalPresent -eq $true)
    backupCreated = ($null -ne $Transaction -and $Transaction.backupCreated -eq $true)
    generatedRemoved = $false
    originalRestored = $false
    restoredBytesMatch = $false
    backupRemoved = $false
    ok = $false
    error = ""
  }

  try {
    if (-not $evidence.attempted) {
      $evidence.generatedRemoved = $null
      $evidence.originalRestored = $null
      $evidence.restoredBytesMatch = $null
      $evidence.backupRemoved = $null
      $evidence.ok = $true
      return [PSCustomObject]$evidence
    }

    if (Test-Path -LiteralPath $Path) {
      Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
    }
    $evidence.generatedRemoved = -not (Test-Path -LiteralPath $Path)

    if ($evidence.originalPresent) {
      if (-not $Transaction.backupPath -or -not (Test-Path -LiteralPath $Transaction.backupPath)) {
        throw "Launch-env rollback backup is missing."
      }
      Move-Item -LiteralPath $Transaction.backupPath -Destination $Path -ErrorAction Stop
      $evidence.originalRestored = (Test-Path -LiteralPath $Path)
      $evidence.restoredBytesMatch = (
        $evidence.originalRestored -and
        (Test-LaunchEnvBytesMatch -ExpectedBytes $Transaction.originalBytes -Path $Path)
      )
      $evidence.backupRemoved = -not (Test-Path -LiteralPath $Transaction.backupPath)
    } else {
      $evidence.originalRestored = -not (Test-Path -LiteralPath $Path)
      $evidence.restoredBytesMatch = $evidence.originalRestored
      $evidence.backupRemoved = $true
    }
    $evidence.ok = (
      $evidence.generatedRemoved -and
      $evidence.originalRestored -and
      $evidence.restoredBytesMatch -and
      $evidence.backupRemoved
    )
  } catch {
    $evidence.error = "launch-env-rollback-failed"
  } finally {
    if ($null -ne $Transaction -and $Transaction.PSObject.Properties.Name -contains "originalBytes") {
      $Transaction.originalBytes = $null
    }
    Write-MatrixJsonFile -Path $DestinationFile -Value ([PSCustomObject]$evidence) -Depth 5
  }
  return [PSCustomObject]$evidence
}

function Test-NeedsWindowsLiveRunReadiness {
  return ($LaunchMode -in @("steam-launch", "steam-app") -and $Suite -ne "preflight" -and $Suite -ne "shortcut")
}

function Test-IsLiveSteamLaunchSuite {
  $needsReadiness = Test-NeedsWindowsLiveRunReadiness
  return ($needsReadiness -and $Suite -ne "readiness")
}

function Convert-OverlayFlagToBoolean {
  param([string]$Value)

  if (-not $Value) {
    return $false
  }
  $normalized = $Value.Trim().ToLowerInvariant()
  return @("1", "true", "yes", "on") -contains $normalized
}

function Test-UsesDefaultWindowsRenderPath {
  return (
    -not $OverlayInProcessGpu -and
    -not (Convert-OverlayFlagToBoolean -Value $OverlayDisableDirectComposition) -and
    -not $NativeHostBackend -and
    -not $NativeHostStyle
  )
}

function Test-UsesNativeWindowsPresenter {
  if (-not $PresenterMode) {
    return $true
  }

  $normalized = $PresenterMode.Trim().ToLowerInvariant()
  return -not (@("session", "fallback", "compatibility", "off", "false", "0", "disabled") -contains $normalized)
}

function Resolve-ExpectedWindowsNativeHostBackend {
  if (-not (Test-UsesNativeWindowsPresenter)) {
    return ""
  }

  $requested = $NativeHostBackend.Trim().ToLowerInvariant()
  if (@("opengl", "gl", "wgl", "windows-opengl") -contains $requested) {
    return "windows-opengl"
  }
  if (@("d3d", "d3d11", "direct3d", "direct3d11", "dxgi", "windows-d3d11") -contains $requested) {
    return "windows-d3d11"
  }

  return "windows-d3d11"
}

function Get-CurrentWindowsSessionId {
  return [System.Diagnostics.Process]::GetCurrentProcess().SessionId
}

function Get-InteractiveWindowsSessionIds {
  return @(
    Get-Process explorer -ErrorAction SilentlyContinue |
      Where-Object { $_.SessionId -gt 0 } |
      Select-Object -ExpandProperty SessionId -Unique |
      Sort-Object
  )
}

function Get-WindowsSessionSummary {
  $currentSessionId = Get-CurrentWindowsSessionId
  $interactiveSessionIds = @(Get-InteractiveWindowsSessionIds)

  return [PSCustomObject]@{
    currentSessionId = $currentSessionId
    interactiveSessionIds = @($interactiveSessionIds)
    currentSessionInteractive = ($interactiveSessionIds -contains $currentSessionId)
  }
}

function Format-SessionIdList {
  param([object[]]$SessionIds)

  if (-not $SessionIds -or $SessionIds.Count -eq 0) {
    return "none"
  }
  return ((@($SessionIds) | ForEach-Object { [string]$_ }) -join ", ")
}

function Test-WindowsLiveRunReadiness {
  param([string]$DestinationFile)

  $sessionSummary = Get-WindowsSessionSummary
  $steamProcesses = @(Get-Process steam -ErrorAction SilentlyContinue |
    Select-Object ProcessName,Id,SessionId,StartTime,Responding,MainWindowTitle,Path)
  $overlayHelpers = @(Get-OverlayHelperDiagnostics)
  $staleOverlayHelpers = @($overlayHelpers | Where-Object { $_.orphaned })
  $resourceSnapshot = Get-WindowsResourceSnapshot
  $renderingHealth = Get-SteamClientRenderingHealth -CurrentSteamStartUtc (Get-LatestSteamProcessStartUtc -SteamProcesses $steamProcesses)
  $warnings = @()
  $errors = @()

  if ($steamProcesses.Count -eq 0) {
    $errors += (
      "Steam is not running. Start Steam once in the interactive Windows desktop session, " +
      "wait for the client UI to render normally, then rerun the matrix. The matrix will not silently start Steam for live overlay proof."
    )
  }
  if (-not $sessionSummary.currentSessionInteractive) {
    $errors += (
      "Windows live Steam-launched overlay proof must run from the interactive desktop session. " +
      "Current PowerShell SessionId=$($sessionSummary.currentSessionId); " +
      "interactive explorer SessionId(s)=$(Format-SessionIdList $sessionSummary.interactiveSessionIds). " +
      "Run the matrix from the Parsec/local desktop session or an /IT scheduled task. SSH Session 0 can produce " +
      "DXGI_ERROR_NOT_CURRENTLY_AVAILABLE / 0x887A0022 swap-chain failures that are not Steam Bridge overlay bugs."
    )
  }
  $foreignSteam = @($steamProcesses | Where-Object { $_.SessionId -ne $sessionSummary.currentSessionId })
  if ($foreignSteam.Count -gt 0) {
    $steamSessionIds = @($steamProcesses | Select-Object -ExpandProperty SessionId -Unique | Sort-Object)
    $errors += (
      "Steam is running in a different Windows session. " +
      "Current PowerShell SessionId=$($sessionSummary.currentSessionId); Steam SessionId(s)=$(Format-SessionIdList $steamSessionIds). " +
      "Fully quit Steam in the other session, then start Steam from the same interactive session as the matrix."
    )
  }
  if ($staleOverlayHelpers.Count -gt 0) {
    $errors += (
      "Found $($staleOverlayHelpers.Count) orphaned Steam overlay helper process(es). " +
      "Rerun with -CleanStaleOverlayHelpers before live overlay proof."
    )
  }

  $freeVirtualMB = $null
  if ($resourceSnapshot -and $resourceSnapshot.operatingSystem) {
    $freeVirtualMB = $resourceSnapshot.operatingSystem.freeVirtualMB
  }
  if ($freeVirtualMB -ne $null -and $freeVirtualMB -lt 2048) {
    $warnings += "Windows free virtual memory is low ($freeVirtualMB MB); Steam overlay helper creation can fail under resource pressure."
  }
  if ($renderingHealth.status -eq "stale-signals") {
    $warnings += (
      "Steam client logs contain $($renderingHealth.staleSevereSignalCount) stale severe rendering signal(s). " +
      "Confirm the Steam client UI renders normally before live overlay proof."
    )
  }
  foreach ($warning in @($renderingHealth.warnings)) {
    $warnings += $warning
  }
  if ($steamProcesses.Count -gt 0 -and $renderingHealth.status -eq "unhealthy") {
    $message = (
      "Steam client rendering health is unhealthy: " +
      "$($renderingHealth.recentSevereSignalCount) severe CEF/GPU/overlay rendering signal(s) " +
      "within the last $($renderingHealth.recentWindowMinutes) minute(s). " +
      "Recover the Steam client UI before live overlay proof."
    )
    if ($AllowUnhealthySteamClientLogs) {
      $warnings += ($message + " Continuing because -AllowUnhealthySteamClientLogs was provided.")
    } else {
      $errors += $message
    }
  }

  Write-MatrixJsonFile -Path $DestinationFile -Value ([PSCustomObject]@{
    kind = "steam-bridge-windows-live-run-readiness"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    ready = ($errors.Count -eq 0)
    windowsSession = $sessionSummary
    steamProcesses = @($steamProcesses)
    overlayHelpers = @($overlayHelpers)
    staleOverlayHelperCount = $staleOverlayHelpers.Count
    resourceSnapshot = $resourceSnapshot
    renderingHealth = $renderingHealth
    warnings = @($warnings)
    errors = @($errors)
  }) -Depth 8

  foreach ($warning in $warnings) {
    Write-Host ("  live-readiness warning: {0}" -f $warning)
  }
  if ($errors.Count -gt 0) {
    foreach ($errorMessage in $errors) {
      Write-Host ("  live-readiness error: {0}" -f $errorMessage)
    }
    throw "Windows live Steam-launched overlay readiness failed. See $DestinationFile."
  }
  Write-Host ("Windows live Steam-launched overlay readiness passed. Details: {0}" -f $DestinationFile)
}

function Collect-SteamClientDiagnostics {
  param([string]$DestinationDir, [string]$Phase)

  try {
    New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
    $steamPath = Resolve-SteamInstallPath
    $logs = Join-Path $steamPath "logs"
    $generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    $sessionSummary = Get-WindowsSessionSummary
    $processes = @(Get-Process steam,steamwebhelper,gameoverlayui,gameoverlayui64,SteamBridgeSmoke -ErrorAction SilentlyContinue |
      Select-Object ProcessName,Id,SessionId,StartTime,Responding,MainWindowTitle,Path)
    $overlayHelpers = @(Get-OverlayHelperDiagnostics)
    $resourceSnapshot = Get-WindowsResourceSnapshot
    $renderingHealth = Get-SteamClientRenderingHealth -CurrentSteamStartUtc (Get-LatestSteamProcessStartUtc -SteamProcesses @($processes | Where-Object { $_.ProcessName -eq "steam" }))
    $logFiles = @()
    if (Test-Path -LiteralPath $logs) {
      $logFiles = @(Get-ChildItem -LiteralPath $logs -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object Name,FullName,LastWriteTime,Length)
    }

    Write-MatrixJsonFile -Path (Join-Path $DestinationDir "steam-client-state.json") -Value ([PSCustomObject]@{
      kind = "steam-bridge-windows-steam-client-diagnostics"
      phase = $Phase
      generatedAt = $generatedAt
      steamPath = $steamPath
      logDirectory = $logs
      windowsSession = $sessionSummary
      processes = @($processes)
      overlayHelpers = @($overlayHelpers)
      staleOverlayHelperCount = @($overlayHelpers | Where-Object { $_.orphaned }).Count
      resourceSnapshot = $resourceSnapshot
      renderingHealth = $renderingHealth
      logFiles = @($logFiles | Select-Object -First 40)
    }) -Depth 8
    Write-MatrixJsonFile -Path (Join-Path $DestinationDir "steam-client-rendering-health.json") -Value $renderingHealth -Depth 8

    $knownLogs = @(Get-SteamClientDiagnosticLogNames)
    foreach ($name in $knownLogs) {
      $source = Join-Path $logs $name
      $safeName = $name -replace '[^A-Za-z0-9_.-]', '_'
      Copy-LogTail -Source $source -Destination (Join-Path $DestinationDir "$safeName.tail.txt")
    }

    $errorPatterns = @(
      "0x887A0022",
      "DXGI",
      "SwapChain",
      "context lost",
      "GPU process",
      "gameoverlay",
      "CEF",
      "crash",
      "error",
      "failed"
    )
    $errorPatternRegex = (($errorPatterns | ForEach-Object { [regex]::Escape($_) }) -join "|")
    $matchingLines = @()
    $scanFiles = @()
    foreach ($name in $knownLogs) {
      $source = Join-Path $logs $name
      if (Test-Path -LiteralPath $source) {
        $scanFiles += Get-Item -LiteralPath $source
      }
    }
    foreach ($file in $scanFiles) {
      try {
        $tailLines = @(Get-Content -LiteralPath $file.FullName -Tail 1000 -ErrorAction SilentlyContinue)
        $matchedForFile = @()
        for ($index = 0; $index -lt $tailLines.Count; $index += 1) {
          $line = [string]$tailLines[$index]
          if ($line -match $errorPatternRegex) {
            $matchedForFile += ("{0}:tail+{1}: {2}" -f $file.Name, ($index + 1), $line)
          }
        }
        foreach ($match in @($matchedForFile | Select-Object -Last 80)) {
          $matchingLines += $match
        }
      } catch {
        $matchingLines += ("{0}: failed to scan: {1}" -f $file.Name, $_.Exception.Message)
      }
    }
    Write-MatrixTextFile -Path (Join-Path $DestinationDir "steam-client-error-lines.txt") -Lines $matchingLines

    $configHints = @()
    $configCandidates = @(
      (Join-Path $steamPath "config\config.vdf")
    )
    $userdata = Join-Path $steamPath "userdata"
    if (Test-Path -LiteralPath $userdata) {
      $configCandidates += @(Get-ChildItem -LiteralPath $userdata -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path (Join-Path $_.FullName "config") "localconfig.vdf" })
    }
    foreach ($configPath in $configCandidates) {
      if (-not (Test-Path -LiteralPath $configPath)) {
        continue
      }
      try {
        $renderingConfigRegex = '(?i)(cef|webview|gpu[_a-z0-9 -]*(accelerat|web|render)|hardware[_a-z0-9 -]*accelerat|direct[_a-z0-9 -]*composition|direct[_a-z0-9 -]*write|dwrite)'
        $matches = @(Select-String -LiteralPath $configPath -Pattern $renderingConfigRegex -ErrorAction SilentlyContinue |
          Where-Object { $_.Line -notmatch 'LocalizedTagNames' } |
          Select-Object -First 80)
        $configLabel = Get-RedactedSteamConfigLabel -ConfigPath $configPath -SteamPath $steamPath
        foreach ($match in $matches) {
          $configHints += ("{0}:{1}: {2}" -f $configLabel, $match.LineNumber, (Limit-DiagnosticLine -Line $match.Line))
        }
      } catch {
        $configHints += ("{0}: failed to scan: {1}" -f (Get-RedactedSteamConfigLabel -ConfigPath $configPath -SteamPath $steamPath), $_.Exception.Message)
      }
    }
    Write-MatrixTextFile -Path (Join-Path $DestinationDir "steam-client-config-rendering-hints.txt") -Lines $configHints

    Write-Host ("Collected Steam client diagnostics for {0}: {1}" -f $Phase, $DestinationDir)
  } catch {
    Write-Host ("Steam client diagnostic capture failed for {0}: {1}" -f $Phase, $_.Exception.Message)
  }
}

function Resolve-UpsertShortcutPath {
  $scriptPath = Join-Path $AppDir "upsert-steam-shortcut.cjs"
  if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Missing upsert-steam-shortcut.cjs at $scriptPath"
  }
  return $scriptPath
}

function Resolve-CheckoutValidatorPath {
  $packageRoots = @(
    (Join-Path $AppDir "resources\steam-bridge-tools"),
    (Join-Path $AppDir "resources\app\node_modules\steam-bridge")
  )
  $complete = @()
  foreach ($packageRoot in $packageRoots) {
    $validator = Join-Path $packageRoot "bin\validate-checkout-target.cjs"
    $runtimeEntry = Join-Path $packageRoot "dist\index.js"
    $validatorPresent = Test-Path -LiteralPath $validator
    $runtimePresent = Test-Path -LiteralPath $runtimeEntry
    if ($validatorPresent -xor $runtimePresent) {
      throw "Incomplete checkout validator tool tree at $packageRoot; bin\validate-checkout-target.cjs and dist\index.js must stay package-relative."
    }
    if ($validatorPresent -and $runtimePresent) {
      $complete += $validator
    }
  }
  if ($complete.Count -eq 1) {
    return $complete[0]
  }
  if ($complete.Count -gt 1) {
    throw "Ambiguous checkout-target validator layout: $($complete -join ', ')."
  }

  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir) {
    $repoRoot = Split-Path -Parent $scriptDir
    $repoValidator = Join-Path $repoRoot "packages\steam-bridge\bin\validate-checkout-target.cjs"
    if (Test-Path -LiteralPath $repoValidator) {
      return $repoValidator
    }
  }

  throw "Missing Steam checkout target validator. ASAR packages must provide a complete resources\steam-bridge-tools package tree or run the matrix from a repo checkout."
}

function Resolve-JavaScriptRunner {
  if ($JavaScriptRunnerExe) {
    if (-not (Test-Path -LiteralPath $JavaScriptRunnerExe)) {
      throw "Missing JavaScript runner executable at $JavaScriptRunnerExe"
    }
    return [PSCustomObject]@{
      Command = $JavaScriptRunnerExe
      UseElectronRunAsNode = $true
    }
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    return [PSCustomObject]@{
      Command = $node.Source
      UseElectronRunAsNode = $false
    }
  }

  return [PSCustomObject]@{
    Command = Resolve-SmokeExe
    UseElectronRunAsNode = $true
  }
}

function Get-CandidateBinding {
  if (-not $CandidateAuditManifest) {
    return $null
  }
  if (-not (Test-Path -LiteralPath $CandidateAuditManifest -PathType Leaf)) {
    throw "Candidate audit manifest was not found."
  }
  $fingerprintHelper = Join-Path $AppDir "windows-release-candidate-fingerprint.cjs"
  if (-not (Test-Path -LiteralPath $fingerprintHelper -PathType Leaf)) {
    throw "The candidate package is missing windows-release-candidate-fingerprint.cjs."
  }
  $runner = Resolve-JavaScriptRunner
  $output = Invoke-JavaScriptRunner -Runner $runner -Arguments @(
    $fingerprintHelper,
    "--directory", $AppDir,
    "--audit-manifest", $CandidateAuditManifest
  )
  return Read-PrefixedJson `
    -Text ($output -join [System.Environment]::NewLine) `
    -Prefix "STEAM_BRIDGE_WINDOWS_CANDIDATE_BINDING "
}

function ConvertTo-WindowsProcessArgument {
  param([AllowNull()][string]$Argument)

  if ($null -eq $Argument) {
    return '""'
  }
  if ($Argument.Length -gt 0 -and $Argument -notmatch '[\s"]') {
    return $Argument
  }

  $result = New-Object System.Text.StringBuilder
  [void]$result.Append('"')
  $backslashes = 0
  foreach ($char in $Argument.ToCharArray()) {
    if ($char -eq '\') {
      $backslashes += 1
      continue
    }
    if ($char -eq '"') {
      if ($backslashes -gt 0) {
        [void]$result.Append(('\' * ($backslashes * 2)))
        $backslashes = 0
      }
      [void]$result.Append('\"')
      continue
    }
    if ($backslashes -gt 0) {
      [void]$result.Append(('\' * $backslashes))
      $backslashes = 0
    }
    [void]$result.Append($char)
  }
  if ($backslashes -gt 0) {
    [void]$result.Append(('\' * ($backslashes * 2)))
  }
  [void]$result.Append('"')
  return $result.ToString()
}

function Join-WindowsProcessArguments {
  param([string[]]$Arguments)

  return (($Arguments | ForEach-Object { ConvertTo-WindowsProcessArgument $_ }) -join " ")
}

function Invoke-ElectronJavaScriptRunner {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  $previousElectronRunAsNode = [System.Environment]::GetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "Process")
  try {
    [System.Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "1", "Process")
    try {
      $process = Start-Process `
        -FilePath $Command `
        -ArgumentList (Join-WindowsProcessArguments -Arguments $Arguments) `
        -Wait `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath
    } catch {
      return [PSCustomObject]@{
        ExitCode = 1
        Output = @($_.Exception.Message)
      }
    }
    $output = @()
    if (Test-Path -LiteralPath $stdoutPath) {
      $output += @(Get-Content -LiteralPath $stdoutPath -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
    }
    if (Test-Path -LiteralPath $stderrPath) {
      $output += @(Get-Content -LiteralPath $stderrPath -ErrorAction SilentlyContinue | ForEach-Object { [string]$_ })
    }
    return [PSCustomObject]@{
      ExitCode = $process.ExitCode
      Output = @($output)
    }
  } finally {
    [System.Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", $previousElectronRunAsNode, "Process")
    Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-JavaScriptRunner {
  param(
    [Parameter(Mandatory = $true)]
    $Runner,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  if ($Runner.UseElectronRunAsNode) {
    $result = Invoke-ElectronJavaScriptRunner -Command $Runner.Command -Arguments $Arguments
    $output = @($result.Output)
    $exitCode = $result.ExitCode
  } else {
    $output = @(& $Runner.Command @Arguments 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
  }
  if ($exitCode -ne 0) {
    $outputText = (@($output) -join [System.Environment]::NewLine)
    if (
      $Runner.UseElectronRunAsNode -and
      $outputText -match "(?i)(Application Control|Device Guard|blocked this file|organization's Device Guard policy)"
    ) {
      throw (
        "The packaged Electron JavaScript runner was blocked by Windows App Control while resolving the Steam shortcut. " +
        "Install standalone Node.js on this Windows machine, use a trusted/reputable signed package, or update shortcuts.vdf from a repo checkout with Node before live overlay proof. " +
        "Original runner output: $outputText"
      )
    }
    throw "JavaScript runner failed with exit code $exitCode."
  }
  return $output
}

function Test-MatrixUsesCheckoutTarget {
  param([object[]]$Cases)

  return [bool](@($Cases | Where-Object {
    $_.checkoutTransactionId -or $_.checkoutJsonFile -or $_.initTxnRequestFile -or $_.shortcutTarget -eq "checkout"
  }).Count -gt 0)
}

function Test-MatrixRequiresMicroTxnCallback {
  param([object[]]$Cases)

  return [bool](@($Cases | Where-Object {
    $_.requireMicroTxnCallback
  }).Count -gt 0)
}

function Get-JsonPropertyValue {
  param($Object, [string[]]$Names)

  if ($null -eq $Object) {
    return $null
  }
  foreach ($name in $Names) {
    $property = $Object.PSObject.Properties[$name]
    if ($property) {
      return $property.Value
    }
  }
  return $null
}

function Test-JsonPresentField {
  param($Object, [string[]]$Names)

  $value = Get-JsonPropertyValue -Object $Object -Names $Names
  if ($null -eq $value) {
    return $false
  }
  return ([string]$value).Trim().Length -gt 0
}

function Get-JsonArrayValue {
  param($Object, [string[]]$Names)

  $value = Get-JsonPropertyValue -Object $Object -Names $Names
  if ($null -eq $value -or -not ($value -is [System.Array])) {
    return @()
  }
  return @($value)
}

function Normalize-InitTxnRequestSession {
  param($Value)

  $session = ([string]$Value).Trim().ToLowerInvariant()
  if ($session -eq "web") {
    return "web"
  }
  if ($session -in @("client-default", "default-client", "default")) {
    return "client-default"
  }
  return "client"
}

function Test-InitTxnItemHasRequiredFields {
  param($Item)

  return (
    (Test-JsonPresentField -Object $Item -Names @("itemId", "itemid")) -and
    (Test-JsonPresentField -Object $Item -Names @("quantity", "qty")) -and
    (Test-JsonPresentField -Object $Item -Names @("amount")) -and
    (Test-JsonPresentField -Object $Item -Names @("description"))
  )
}

function Test-InitTxnBundleHasRequiredFields {
  param($Bundle)

  return (
    (Test-JsonPresentField -Object $Bundle -Names @("bundleId", "bundleid")) -and
    (Test-JsonPresentField -Object $Bundle -Names @("quantity", "qty")) -and
    (Test-JsonPresentField -Object $Bundle -Names @("description"))
  )
}

function Write-InitTxnRequestShapePreflight {
  if (-not $InitTxnRequestFile) {
    return
  }

  $preflightDir = Join-Path $ArtifactRoot "00-preflight"
  New-Item -ItemType Directory -Force -Path $preflightDir | Out-Null

  $request = Read-MatrixJsonFile -Path $InitTxnRequestFile
  if ($null -eq $request -or $request -is [System.Array]) {
    throw "Invalid -InitTxnRequestFile (request JSON must be an object)."
  }

  $requestAppId = Get-JsonPropertyValue -Object $request -Names @("appId", "appid")
  $requestAppIdPresent = Test-JsonPresentField -Object $request -Names @("appId", "appid")
  $requestAppIdMatches = $false
  if ($requestAppIdPresent) {
    try {
      $requestAppIdMatches = ([int64]$requestAppId -eq [int64]$AppId)
    } catch {
      throw "Invalid -InitTxnRequestFile (app ID must be numeric when present)."
    }
    if (-not $requestAppIdMatches) {
      throw "Invalid -InitTxnRequestFile (app ID does not match -AppId)."
    }
  }

  $session = Normalize-InitTxnRequestSession (Get-JsonPropertyValue -Object $request -Names @("session", "userSession", "usersession"))
  $items = @(Get-JsonArrayValue -Object $request -Names @("items"))
  $bundles = @(Get-JsonArrayValue -Object $request -Names @("bundles"))
  $itemsWithMissingFields = @($items | Where-Object { -not (Test-InitTxnItemHasRequiredFields -Item $_) }).Count
  $bundlesWithMissingFields = @($bundles | Where-Object { -not (Test-InitTxnBundleHasRequiredFields -Bundle $_) }).Count

  $shape = [PSCustomObject]@{
    kind = "steam-bridge-windows-init-txn-request-shape"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    source = "init-txn-request-file"
    hasRequestFile = $true
    requestFileExists = $true
    requestAppIdPresent = [bool]$requestAppIdPresent
    requestAppIdMatches = [bool]$requestAppIdMatches
    matrixAppIdForced = $true
    session = $session
    usersession = if ($session -eq "client-default") { "omitted" } else { $session }
    hasUserSessionField = [bool]($session -ne "client-default")
    hasOrderId = [bool](Test-JsonPresentField -Object $request -Names @("orderId", "orderid"))
    hasSteamId64 = [bool](Test-JsonPresentField -Object $request -Names @("steamId64", "steamid", "steamId"))
    hasLanguage = [bool](Test-JsonPresentField -Object $request -Names @("language"))
    hasCurrency = [bool](Test-JsonPresentField -Object $request -Names @("currency"))
    hasIpAddress = [bool](Test-JsonPresentField -Object $request -Names @("ipAddress", "ipaddress"))
    itemCount = $items.Count
    bundleCount = $bundles.Count
    itemsHaveRequiredFields = [bool]($items.Count -gt 0 -and $itemsWithMissingFields -eq 0)
    bundlesHaveRequiredFields = [bool]($bundlesWithMissingFields -eq 0)
  }

  Write-MatrixJsonFile -Path (Join-Path $preflightDir "init-txn-request-shape.json") -Value $shape -Depth 8
}

function Invoke-InitTxnCapture {
  param([object[]]$Cases)

  if (-not $InitTxnRequestFile) {
    return
  }

  if ($CheckoutJsonFile) {
    throw "Use either -CheckoutJsonFile or -InitTxnRequestFile, not both."
  }
  if ($InitTxnResponseFile) {
    throw "-InitTxnResponseFile is not supported for Windows in-app InitTxn capture; the smoke app creates the transaction after Steam init."
  }
  if (-not (Test-MatrixUsesCheckoutTarget -Cases $Cases)) {
    throw "-InitTxnRequestFile requires a selected checkout target case."
  }
  if ($AppId -eq 480) {
    throw "-InitTxnRequestFile requires a configured Steam app/product; public App ID 480 only proves checkout routing."
  }
  if ($RequireMicroTxnCallback -and $LaunchMode -ne "steam-app") {
    throw "-RequireMicroTxnCallback with -InitTxnRequestFile requires -LaunchMode steam-app so Steam launches the configured app, not a non-Steam shortcut."
  }
  if (-not (Test-Path -LiteralPath $InitTxnRequestFile)) {
    throw "Invalid -InitTxnRequestFile (file was not found)."
  }

  Write-InitTxnRequestShapePreflight

  $captureLog = [PSCustomObject]@{
    kind = "steam-bridge-windows-init-txn-request"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    source = "init-txn-request-file"
    hasRequestFile = $true
    captureInApp = $true
    apiKeyEnvProvided = [bool]$InitTxnApiKeyEnv
    endpointOption = $InitTxnEndpoint
  }
  Write-MatrixJsonFile -Path (Join-Path (Join-Path $ArtifactRoot "00-preflight") "init-txn-capture.json") -Value $captureLog -Depth 12

  Write-Host "Configured Windows InitTxn checkout: source=init-txn-request-file capture=in-app expectedAppId=checked"
}

function Test-InitTxnEnvironmentReadiness {
  param([object[]]$Cases)

  if (-not $InitTxnRequestFile) {
    return
  }

  $preflightDir = Join-Path $ArtifactRoot "00-preflight"
  New-Item -ItemType Directory -Force -Path $preflightDir | Out-Null

  $apiKeyValue = $null
  if ($InitTxnApiKeyEnv) {
    $apiKeyValue = [System.Environment]::GetEnvironmentVariable($InitTxnApiKeyEnv, "Process")
  }

  $readiness = [PSCustomObject]@{
    kind = "steam-bridge-windows-init-txn-environment"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    hasRequestFile = [bool]$InitTxnRequestFile
    requestFileExists = [bool]($InitTxnRequestFile -and (Test-Path -LiteralPath $InitTxnRequestFile))
    launchMode = $LaunchMode
    requireMicroTxnCallback = [bool]$RequireMicroTxnCallback
    selectedCallbackCase = [bool](Test-MatrixRequiresMicroTxnCallback -Cases $Cases)
    apiKeyEnvProvided = [bool]$InitTxnApiKeyEnv
    apiKeyEnvNameLength = if ($InitTxnApiKeyEnv) { $InitTxnApiKeyEnv.Length } else { 0 }
    apiKeyProcessValuePresent = [bool]$apiKeyValue
    apiKeyProcessValueLength = if ($apiKeyValue) { $apiKeyValue.Length } else { 0 }
  }

  Write-MatrixJsonFile -Path (Join-Path $preflightDir "init-txn-env.json") -Value $readiness -Depth 8

  if (-not $InitTxnApiKeyEnv) {
    throw "-InitTxnRequestFile requires -InitTxnApiKeyEnv so the smoke app can call Steam's InitTxn Web API."
  }

  if (-not $apiKeyValue) {
    throw (
      "Missing Steam publisher Web API key environment variable for private InitTxn checkout. " +
      "Pass it with windows-overlay-task.ps1 -PrivateEnvFile <local NAME=VALUE file> or set it in the invoking process before running windows-overlay-matrix.ps1."
    )
  }
}

function Test-CheckoutJsonFile {
  param([object[]]$Cases)

  if ($RequireMicroTxnCallback -and -not $CheckoutJsonFile -and -not $InitTxnRequestFile) {
    throw "-RequireMicroTxnCallback requires -CheckoutJsonFile or -InitTxnRequestFile with a real configured Steam app/product."
  }

  if ($RequireMicroTxnCallback -and -not (Test-MatrixRequiresMicroTxnCallback -Cases $Cases)) {
    throw "-RequireMicroTxnCallback requires a selected checkout callback case."
  }

  if ($RequireMicroTxnCallback -and $AppId -eq 480) {
    throw "-RequireMicroTxnCallback requires a configured Steam app/product; public App ID 480 only proves checkout routing."
  }
  if ($RequireMicroTxnCallback -and $LaunchMode -ne "steam-app") {
    throw "-RequireMicroTxnCallback requires -LaunchMode steam-app so Steam launches the configured app, not a non-Steam shortcut."
  }

  if (-not $CheckoutJsonFile) {
    return
  }
  if (-not (Test-MatrixUsesCheckoutTarget -Cases $Cases)) {
    return
  }
  if (-not (Test-Path -LiteralPath $CheckoutJsonFile)) {
    throw "Invalid -CheckoutJsonFile (file was not found)."
  }

  $validator = Resolve-CheckoutValidatorPath
  $runner = Resolve-JavaScriptRunner
  $arguments = @($validator, "--file", $CheckoutJsonFile, "--expected-app-id", "$AppId", "--quiet")
  $output = @()
  $exitCode = 1
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    if ($runner.UseElectronRunAsNode) {
      $result = Invoke-ElectronJavaScriptRunner -Command $runner.Command -Arguments $arguments
      $output = @($result.Output)
      $exitCode = $result.ExitCode
    } else {
      $output = @(& $runner.Command @arguments 2>&1 | ForEach-Object { [string]$_ })
      $exitCode = $LASTEXITCODE
    }
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    $message = ((@($output) | Where-Object { $_ } | Select-Object -Last 1) -join " ").Trim()
    if (-not $message) {
      $message = "validator exited with code $exitCode"
    }
    throw "Invalid -CheckoutJsonFile ($message)"
  }

  Write-Host "Validated Windows checkout JSON target: source=json-file expectedAppId=checked"
}

function Resolve-AutorunUserGestureGateCase {
  param($Case)

  $expectedAction = ""
  $targetId = ""
  switch -CaseSensitive ([string]$Case.id) {
    "11-managed-web-open-and-wait" {
      $expectedAction = "presenter-web-open-and-wait"
      $targetId = "presenter-web-wait"
      break
    }
    "11b-managed-duplicate-open-guard" {
      $expectedAction = "presenter-duplicate-open-guard"
      $targetId = "presenter-duplicate-guard"
      break
    }
    "12-managed-store-open-and-wait" { $expectedAction = "presenter-store-open-and-wait"; break }
    "13-managed-friends-open-and-wait" { $expectedAction = "presenter-friends-open-and-wait"; break }
    "14-managed-dialog-open-and-wait" { $expectedAction = "presenter-dialog-auto-open-and-wait"; break }
    "15-managed-shortcut" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "15-managed-shortcut-keyboard" { $expectedAction = "presenter-shortcut"; break }
    "16-managed-checkout-route" { $expectedAction = "presenter-checkout"; break }
    "17-managed-profile-open-and-wait" { $expectedAction = "presenter-profile-open-and-wait"; break }
    "18-managed-players-open-and-wait" { $expectedAction = "presenter-players-open-and-wait"; break }
    "19-managed-community-open-and-wait" { $expectedAction = "presenter-community-open-and-wait"; break }
    "20-managed-stats-open-and-wait" { $expectedAction = "presenter-stats-open-and-wait"; break }
    "21-managed-achievements-open-and-wait" { $expectedAction = "presenter-achievements-open-and-wait"; break }
    "22-managed-user-open-and-wait" { $expectedAction = "presenter-user-open-and-wait"; break }
    "30-shortcut-friends-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-web-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-store-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-profile-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-players-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-community-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-stats-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-achievements-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-user-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "30-shortcut-dialog-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    "02-checkout-approval" { $expectedAction = "presenter-checkout"; break }
    "03-shortcut-checkout" { $expectedAction = "presenter-shortcut"; break }
    "04-shortcut-checkout-open-and-wait" { $expectedAction = "presenter-shortcut-open-and-wait"; break }
    default { return $null }
  }

  if ([string]$Case.action -cne $expectedAction) {
    return $null
  }
  if (-not $targetId) {
    $targetId = "autorun-user-gesture-target"
  }

  return [PSCustomObject]@{
    action = $expectedAction
    targetId = $targetId
  }
}

function Resolve-PersistentReuseGateCase {
  param($Case)

  if (
    [string]$Case.id -cne "40-persistent-reuse-three-cycle" -or
    [string]$Case.action -cne "presenter-persistent-reuse-three-cycle" -or
    [int]$Case.persistentReuseCycles -ne 3 -or
    $Case.persistentReuseGate -ne $true -or
    [string]$Case.persistentReuseGatePolicy -cne $PersistentReuseGatePolicy -or
    [int]$Case.persistentReuseEvidenceSchema -ne $PersistentReuseEvidenceSchema
  ) {
    return $null
  }

  return [PSCustomObject]@{
    action = "presenter-persistent-reuse-three-cycle"
    targetId = "autorun-user-gesture-target"
    policy = $PersistentReuseGatePolicy
    evidenceSchema = $PersistentReuseEvidenceSchema
  }
}

function Test-MatrixCloseProbeRequirements {
  param([object[]]$Cases)

  $shortcutToggleCases = @($Cases | Where-Object { $_.shortcutToggleProbe })
  if ($shortcutToggleCases.Count -gt 0 -and -not $CloseProbe) {
    $caseIds = (($shortcutToggleCases | ForEach-Object { $_.id }) -join ", ")
    throw "Selected Windows shortcut toggle probe case(s) require -CloseProbe so the matrix can send Shift+Tab and capture close/back-to-app proof: $caseIds"
  }

  $persistentReuseCases = @($Cases | Where-Object { $_.persistentReuseCycles -gt 0 })
  if ($persistentReuseCases.Count -gt 0 -and -not $CloseProbe) {
    $caseIds = (($persistentReuseCases | ForEach-Object { $_.id }) -join ", ")
    throw "Selected Windows persistent-reuse case(s) require -CloseProbe so each shown cycle can close through the exact-host gate: $caseIds"
  }

  $userGestureCases = @($Cases | Where-Object { $_.autorunUserGestureGate })
  if ($userGestureCases.Count -gt 0 -and -not $CloseProbe) {
    $caseIds = (($userGestureCases | ForEach-Object { $_.id }) -join ", ")
    throw "Selected Windows user-gesture gate case(s) require -CloseProbe so the matrix can deliver and audit the one-shot renderer click: $caseIds"
  }
  $unsupportedUserGestureCases = @($userGestureCases | Where-Object {
    $null -eq (Resolve-AutorunUserGestureGateCase -Case $_) -and
    $null -eq (Resolve-PersistentReuseGateCase -Case $_)
  })
  if ($unsupportedUserGestureCases.Count -gt 0) {
    $caseIds = (($unsupportedUserGestureCases | ForEach-Object { $_.id }) -join ", ")
    throw "The bounded Windows user-gesture gate supports only exact single-cycle active case/action pairs: $caseIds"
  }
}

function Resolve-ShortcutsPath {
  if ($ShortcutsPath) {
    return $ShortcutsPath
  }

  $steamPath = Resolve-SteamInstallPath
  $userdata = Join-Path $steamPath "userdata"
  if ($SteamUserId) {
    return Join-Path (Join-Path (Join-Path $userdata $SteamUserId) "config") "shortcuts.vdf"
  }

  if (-not (Test-Path -LiteralPath $userdata)) {
    throw "Could not find Steam userdata directory at $userdata. Pass -ShortcutsPath or -SteamUserId."
  }

  $candidates = @(Get-ChildItem -LiteralPath $userdata -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path (Join-Path $_.FullName "config") "shortcuts.vdf" } |
    Where-Object { Test-Path -LiteralPath $_ })
  if ($candidates.Count -eq 1) {
    return $candidates[0]
  }
  if ($candidates.Count -gt 1) {
    throw "Multiple Steam shortcuts.vdf files found. Pass -ShortcutsPath or -SteamUserId."
  }

  $userDirs = @(Get-ChildItem -LiteralPath $userdata -Directory -ErrorAction SilentlyContinue)
  if ($userDirs.Count -eq 1) {
    return Join-Path (Join-Path $userDirs[0].FullName "config") "shortcuts.vdf"
  }
  throw "Could not infer a Steam shortcut file. Pass -ShortcutsPath or -SteamUserId."
}

function Get-AppControlPolicyState {
  $policy = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
  if (-not $policy) {
    return $null
  }
  return $policy.VerifiedAndReputablePolicyState
}

function Get-PreflightAppControlSummary {
  param([string]$PreflightJson)

  $preflight = Read-MatrixJsonFile -Path $PreflightJson
  if (-not $preflight -or -not $preflight.appControl) {
    return [PSCustomObject]@{
      available = $false
      verifiedAndReputablePolicyState = Get-AppControlPolicyState
      ciToolAvailable = $false
      ciToolExitCode = $null
      verifiedAndReputableEnforced = $false
      enforcedPolicies = @()
      enforcedPolicyNames = @()
    }
  }

  $appControl = $preflight.appControl
  $enforcedPolicies = @($appControl.enforcedPolicies)
  $enforcedPolicyNames = @(
    $enforcedPolicies |
      ForEach-Object {
        if ($_.friendlyName) {
          $_.friendlyName
        }
      }
  )

  return [PSCustomObject]@{
    available = $true
    verifiedAndReputablePolicyState = $appControl.verifiedAndReputablePolicyState
    ciToolAvailable = $appControl.ciToolAvailable
    ciToolExitCode = $appControl.ciToolExitCode
    ciToolPath = $appControl.ciToolPath
    ciToolError = $appControl.ciToolError
    verifiedAndReputableEnforced = [bool]$appControl.verifiedAndReputableEnforced
    enforcedPolicies = @($enforcedPolicies)
    enforcedPolicyNames = @($enforcedPolicyNames)
  }
}

function New-NativeLoadGateBlocker {
  param(
    $AppControlSummary,
    [string]$GateLog,
    [string]$PostGatePreflightLog,
    [string]$PostGatePreflightJson,
    [string]$DiagnosticDir,
    [datetime]$GateStartedAt,
    [string]$OriginalError
  )

  $postGatePreflight = Read-MatrixJsonFile -Path $PostGatePreflightJson
  $codeIntegrityEvents = @()
  if ($postGatePreflight -and $postGatePreflight.recentCodeIntegrityEvents) {
    $codeIntegrityEvents = @($postGatePreflight.recentCodeIntegrityEvents)
  }
  $allCodeIntegrityEventCount = @($codeIntegrityEvents).Count
  $codeIntegrityEvents = Select-CodeIntegrityEventsSince -Events $codeIntegrityEvents -Since $GateStartedAt
  $ignoredOlderCodeIntegrityEventCount = $allCodeIntegrityEventCount - @($codeIntegrityEvents).Count

  $codeIntegrityMessages = @(
    $codeIntegrityEvents |
      ForEach-Object {
        if ($_.message) {
          $_.message
        }
      }
  )
  $codeIntegrityPolicyBlock = @(
    $codeIntegrityMessages |
      Where-Object {
        $_ -match "Enterprise signing level requirements" -or
          $_ -match "violated code integrity policy" -or
          $_ -match "Application Control policy has blocked"
      }
  ).Count -gt 0
  $verifiedAndReputableBlock = (
    [bool]$AppControlSummary.verifiedAndReputableEnforced -or
    $AppControlSummary.verifiedAndReputablePolicyState -eq 1
  )
  $blockerCode = if ($verifiedAndReputableBlock -or $codeIntegrityPolicyBlock) {
    "windows-app-control-native-load-block"
  } else {
    "windows-native-load-gate-failure"
  }
  $nextActions = if ($blockerCode -eq "windows-app-control-native-load-block") {
    @(
      "Use a trusted and reputable publisher-signed package.",
      "Or explicitly move this development machine's Smart App Control/App Control policy out of enforcement before live overlay proof.",
      "Then rerun the Windows matrix native-load gate before Steam-launched overlay cases."
    )
  } else {
    @(
      "Inspect the native-load gate helper log and crash diagnostics.",
      "Rerun the report-only preflight and direct native-load gate before Steam-launched overlay cases."
    )
  }

  return [PSCustomObject]@{
    kind = "steam-bridge-windows-native-load-gate-blocker"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    gateStartedAt = if ($GateStartedAt) { $GateStartedAt.ToUniversalTime().ToString("o") } else { $null }
    blockerCode = $blockerCode
    verifiedAndReputableBlock = $verifiedAndReputableBlock
    codeIntegrityPolicyBlock = $codeIntegrityPolicyBlock
    originalError = $OriginalError
    paths = [PSCustomObject]@{
      gateLog = $GateLog
      postGatePreflightLog = $PostGatePreflightLog
      postGatePreflightJson = $PostGatePreflightJson
      diagnosticDir = $DiagnosticDir
    }
    appControl = $AppControlSummary
    postGateCodeIntegrityEvents = @($codeIntegrityEvents)
    ignoredOlderCodeIntegrityEventCount = $ignoredOlderCodeIntegrityEventCount
    nextActions = @($nextActions)
  }
}

function New-SteamLaunchBlocker {
  param(
    $Case,
    [string]$PostCasePreflightLog,
    [string]$PostCasePreflightJson,
    [datetime]$CaseStartedAt,
    [string]$OriginalError
  )

  $postCasePreflight = Read-MatrixJsonFile -Path $PostCasePreflightJson
  $appControlSummary = Get-PreflightAppControlSummary -PreflightJson $PostCasePreflightJson
  $codeIntegrityEvents = @()
  if ($postCasePreflight -and $postCasePreflight.recentCodeIntegrityEvents) {
    $codeIntegrityEvents = @($postCasePreflight.recentCodeIntegrityEvents)
  }
  $allCodeIntegrityEventCount = @($codeIntegrityEvents).Count
  $codeIntegrityEvents = Select-CodeIntegrityEventsSince -Events $codeIntegrityEvents -Since $CaseStartedAt
  $ignoredOlderCodeIntegrityEventCount = $allCodeIntegrityEventCount - @($codeIntegrityEvents).Count

  $codeIntegrityMessages = @(
    $codeIntegrityEvents |
      ForEach-Object {
        if ($_.message) {
          $_.message
        }
      }
  )
  $codeIntegrityPolicyBlock = @(
    $codeIntegrityMessages |
      Where-Object {
        $_ -match "Enterprise signing level requirements" -or
          $_ -match "violated code integrity policy" -or
          $_ -match "Application Control policy has blocked" -or
          $_ -match "Device Guard policy"
      }
  ).Count -gt 0
  $steamProcessPolicyBlock = @(
    $codeIntegrityMessages |
      Where-Object {
        $_ -match "\\Steam\\steam[.]exe" -and $_ -match "SteamBridgeSmoke[.]exe"
      }
  ).Count -gt 0
  $blockerCode = if ($appControlSummary.verifiedAndReputableEnforced -and $codeIntegrityPolicyBlock) {
    "windows-app-control-steam-launch-block"
  } else {
    "windows-steam-launch-no-result"
  }
  $nextActions = if ($blockerCode -eq "windows-app-control-steam-launch-block") {
    @(
      "Use a trusted and reputable publisher-signed package.",
      "Or explicitly move this development machine's Smart App Control/App Control policy out of enforcement before live overlay proof.",
      "Then rerun the native-load gate and the Steam-launched matrix case."
    )
  } else {
    @(
      "Inspect the case helper log, Steam client diagnostics, and post-case preflight.",
      "Confirm the Steam shortcut game ID and launch env file, then rerun one focused case."
    )
  }

  return [PSCustomObject]@{
    kind = "steam-bridge-windows-steam-launch-blocker"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    caseStartedAt = if ($CaseStartedAt) { $CaseStartedAt.ToUniversalTime().ToString("o") } else { $null }
    blockerCode = $blockerCode
    caseId = $Case.id
    action = $Case.action
    codeIntegrityPolicyBlock = $codeIntegrityPolicyBlock
    steamProcessPolicyBlock = $steamProcessPolicyBlock
    originalError = $OriginalError
    paths = [PSCustomObject]@{
      postCasePreflightLog = $PostCasePreflightLog
      postCasePreflightJson = $PostCasePreflightJson
    }
    appControl = $appControlSummary
    postCaseCodeIntegrityEvents = @($codeIntegrityEvents)
    ignoredOlderCodeIntegrityEventCount = $ignoredOlderCodeIntegrityEventCount
    nextActions = @($nextActions)
  }
}

function Test-AppControlBlockText {
  param([string]$Text)

  if (-not $Text) {
    return $false
  }

  return (
    $Text -match "(?i)Application Control policy has blocked" -or
    $Text -match "(?i)Enterprise signing level requirements" -or
    $Text -match "(?i)violated code integrity policy" -or
    $Text -match "(?i)Device Guard policy"
  )
}

function New-CaseAppControlBlocker {
  param(
    $Case,
    [string]$ResultFile,
    [string]$HelperLog,
    [string]$PostCasePreflightLog,
    [string]$PostCasePreflightJson,
    [datetime]$CaseStartedAt,
    [string]$OriginalError
  )

  $postCasePreflight = Read-MatrixJsonFile -Path $PostCasePreflightJson
  $appControlSummary = Get-PreflightAppControlSummary -PreflightJson $PostCasePreflightJson
  $codeIntegrityEvents = @()
  if ($postCasePreflight -and $postCasePreflight.recentCodeIntegrityEvents) {
    $codeIntegrityEvents = @($postCasePreflight.recentCodeIntegrityEvents)
  }
  $allCodeIntegrityEventCount = @($codeIntegrityEvents).Count
  $codeIntegrityEvents = Select-CodeIntegrityEventsSince -Events $codeIntegrityEvents -Since $CaseStartedAt
  $ignoredOlderCodeIntegrityEventCount = $allCodeIntegrityEventCount - @($codeIntegrityEvents).Count

  $codeIntegrityMessages = @(
    $codeIntegrityEvents |
      ForEach-Object {
        if ($_.message) {
          $_.message
        }
      }
  )
  $codeIntegrityPolicyBlock = @(
    $codeIntegrityMessages |
      Where-Object { Test-AppControlBlockText -Text $_ }
  ).Count -gt 0

  $resultText = ""
  if ($ResultFile -and (Test-Path -LiteralPath $ResultFile)) {
    $resultText = Get-Content -Raw -LiteralPath $ResultFile
  }

  return [PSCustomObject]@{
    kind = "steam-bridge-windows-case-app-control-blocker"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    caseStartedAt = if ($CaseStartedAt) { $CaseStartedAt.ToUniversalTime().ToString("o") } else { $null }
    blockerCode = "windows-app-control-native-dependency-block"
    caseId = $Case.id
    action = $Case.action
    resultPolicyBlock = Test-AppControlBlockText -Text $resultText
    codeIntegrityPolicyBlock = $codeIntegrityPolicyBlock
    verifiedAndReputableBlock = (
      [bool]$appControlSummary.verifiedAndReputableEnforced -or
      $appControlSummary.verifiedAndReputablePolicyState -eq 1
    )
    originalError = $OriginalError
    paths = [PSCustomObject]@{
      resultFile = $ResultFile
      helperLog = $HelperLog
      postCasePreflightLog = $PostCasePreflightLog
      postCasePreflightJson = $PostCasePreflightJson
    }
    appControl = $appControlSummary
    postCaseCodeIntegrityEvents = @($codeIntegrityEvents)
    ignoredOlderCodeIntegrityEventCount = $ignoredOlderCodeIntegrityEventCount
    nextActions = @(
      "Use a trusted and reputable publisher-signed package.",
      "Or explicitly move this development machine's Smart App Control/App Control policy out of enforcement before live overlay proof.",
      "Then rerun the focused Steam-launched matrix case."
    )
  }
}

function Test-NativeLoadGate {
  param([string]$PreflightDir, [string]$PreflightJson)

  if ($SkipNativeLoadGate) {
    return
  }

  $nativeAddon = if ($NativePath) { $NativePath } else { Resolve-NativeAddon }
  if (-not (Test-Path -LiteralPath $nativeAddon)) {
    throw "Missing native addon at $nativeAddon"
  }

  $appControlSummary = Get-PreflightAppControlSummary -PreflightJson $PreflightJson
  Write-MatrixJsonFile -Path (Join-Path $PreflightDir "native-load-gate-app-control.json") -Value $appControlSummary -Depth 8

  $policyState = $appControlSummary.verifiedAndReputablePolicyState
  $signature = Get-AuthenticodeSignature -LiteralPath $nativeAddon

  if ($appControlSummary.verifiedAndReputableEnforced) {
    Write-Host "Windows Smart App Control/App Control VerifiedAndReputable policy is enforced; running a native-load gate because Authenticode status alone is not enough proof."
    Write-Host ("  ciTool: {0}" -f $appControlSummary.ciToolPath)
    Write-Host ("  native addon Authenticode status: {0}" -f $signature.Status)
    foreach ($policyName in @($appControlSummary.enforcedPolicyNames)) {
      Write-Host ("  enforced policy: {0}" -f $policyName)
    }
  } elseif ($policyState -eq 1) {
    Write-Host "Windows Smart App Control/App Control appears enabled; running a native-load gate because Authenticode status alone is not enough proof."
    Write-Host ("  native addon Authenticode status: {0}" -f $signature.Status)
  }
  if ($NativePath) {
    Write-Host "Windows native-load gate is using STEAM_BRIDGE_NATIVE_PATH override for diagnostics."
    Write-Host ("  native override path: {0}" -f $NativePath)
  }

  $gateDir = Join-Path $PreflightDir "native-load-gate"
  $gateLog = Join-Path $gateDir "helper.log"
  $resultFile = Join-Path $gateDir "result.log"
  $diagnosticDir = Join-Path $gateDir "diagnostics"
  $gateTimeoutSeconds = if ($TimeoutSeconds -lt 30) { $TimeoutSeconds } else { 30 }
  $expectedNativeHostBackend = Resolve-ExpectedWindowsNativeHostBackend
  $gateAction = if ($expectedNativeHostBackend) { "presenter-ready" } else { "none" }

  Write-Host "Running Windows native-load gate with the packaged app."
  $gateArgs = @(
    "-Mode", "direct",
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-Action", $gateAction,
    "-ResultFile", $resultFile,
    "-DiagnosticDir", $diagnosticDir,
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode,
    "-ResultDelayMs", "1000",
    "-TimeoutSeconds", "$gateTimeoutSeconds",
    "-AllowSteamNotRunning",
    "-RequireNoOverlayActivation",
    "-RequireNoCrashes"
  )
  if ($expectedNativeHostBackend) {
    Write-Host ("Windows native-load gate will require native presenter backend {0}." -f $expectedNativeHostBackend)
    $gateArgs += @(
      "-RequireEvent", "overlay:presenter-ready",
      "-RequireNativeHostBackend", $expectedNativeHostBackend
    )
  }
  if ($OverlayInProcessGpu) {
    $gateArgs += @("-OverlayInProcessGpu", $OverlayInProcessGpu)
  }
  if ($OverlayDisableDirectComposition) {
    $gateArgs += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }
  if ($PresenterMode) {
    $gateArgs += @("-PresenterMode", $PresenterMode)
  }
  if ($NativeHostBackend) {
    $gateArgs += @("-NativeHostBackend", $NativeHostBackend)
  }
  if ($NativeHostStyle) {
    $gateArgs += @("-NativeHostStyle", $NativeHostStyle)
  }
  if ($OverlayScrubChildEnv) {
    $gateArgs += @("-OverlayScrubChildEnv", $OverlayScrubChildEnv)
  }
  if ($OverlayIsolateChildProcesses) {
    $gateArgs += @("-OverlayIsolateChildProcesses", $OverlayIsolateChildProcesses)
  }
  if ($NativePath) {
    $gateArgs += @("-NativePath", $NativePath)
  }

  $gateStartedAt = Get-Date
  try {
    Invoke-Helper -Arguments $gateArgs -LogFile $gateLog
  } catch {
    $postGatePreflightLog = Join-Path $gateDir "post-gate-preflight.log"
    $postGatePreflightJson = Join-Path $gateDir "post-gate-preflight.json"
    $postGatePreflightArgs = @(
      "-Mode", "preflight",
      "-AppDir", $AppDir,
      "-AppId", "$AppId",
      "-PreflightJsonFile", $postGatePreflightJson
    )
    if ($NativePath) {
      $postGatePreflightArgs += @("-NativePath", $NativePath)
    }
    try {
      Invoke-Helper -Arguments $postGatePreflightArgs -LogFile $postGatePreflightLog
    } catch {
      Write-Host ("Post-gate preflight failed; continuing with original native-load gate failure. Output path: {0}" -f $postGatePreflightLog)
    }
    $blocker = New-NativeLoadGateBlocker `
      -AppControlSummary $appControlSummary `
      -GateLog $gateLog `
      -PostGatePreflightLog $postGatePreflightLog `
      -PostGatePreflightJson $postGatePreflightJson `
      -DiagnosticDir $diagnosticDir `
      -GateStartedAt $gateStartedAt `
      -OriginalError $_.Exception.Message
    Write-MatrixJsonFile -Path (Join-Path $PreflightDir "native-load-gate-blocker.json") -Value $blocker -Depth 10
    throw (
      "Windows native-load gate failed before live overlay cases. " +
      "The exact packaged app could not initialize Steam cleanly; see $gateLog, $postGatePreflightLog, post-gate-preflight.json, native-load-gate-blocker.json, and $diagnosticDir. " +
      "On Smart App Control/App Control machines, a local self-signed Authenticode result can still fail this gate, especially when VerifiedAndReputableDesktop policies are enforced. " +
      "Use a trusted/reputable publisher-signed package or explicitly disable SAC on this development machine before live overlay proof. " +
      "Original error: $($_.Exception.Message)"
    )
  }
}

function Invoke-RenderHealthGate {
  param([string]$PreflightDir)

  if (-not (Test-IsLiveSteamLaunchSuite)) {
    return
  }

  $gatePath = Join-Path $PreflightDir "render-health-gate.json"
  if ($SkipRenderHealthGate) {
    Write-MatrixJsonFile -Path $gatePath -Value ([PSCustomObject]@{
      kind = "steam-bridge-windows-render-health-gate"
      generatedAt = (Get-Date).ToUniversalTime().ToString("o")
      required = $false
      skipped = $true
      reason = "skip-render-health-gate"
    }) -Depth 6
    Write-Host "Windows render-health gate skipped because -SkipRenderHealthGate was provided."
    return
  }

  if (-not (Test-UsesDefaultWindowsRenderPath)) {
    Write-MatrixJsonFile -Path $gatePath -Value ([PSCustomObject]@{
      kind = "steam-bridge-windows-render-health-gate"
      generatedAt = (Get-Date).ToUniversalTime().ToString("o")
      required = $false
      skipped = $true
      reason = "non-default-render-comparison"
      overlayInProcessGpu = $OverlayInProcessGpu
      overlayDisableDirectComposition = $OverlayDisableDirectComposition
      presenterMode = $PresenterMode
      nativeHostBackend = $NativeHostBackend
      nativeHostStyle = $NativeHostStyle
    }) -Depth 6
    Write-Host "Windows render-health gate skipped for an explicit non-default render comparison."
    return
  }

  $probe = Resolve-RenderHealthProbePath
  $renderHealthDir = Join-Path $PreflightDir "render-health"
  $renderHealthLog = Join-Path $PreflightDir "render-health.log"
  $summaryPath = Join-Path $renderHealthDir "render-health-summary.json"
  $required = -not [bool]$AllowUnhealthyDefaultRender
  $probeArgs = @(
    "-AppDir", $AppDir,
    "-ArtifactRoot", $renderHealthDir,
    "-AppId", "$AppId",
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode
  )
  if ($required) {
    $probeArgs += @("-FailOnUnhealthyDefault")
  }

  Write-Host "Running Windows render-health gate before live Steam overlay cases."
  $output = @()
  $exitCode = 1
  $probeError = $null
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $probe @probeArgs *>&1
      $exitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $renderHealthLog) | Out-Null
    $output | Tee-Object -FilePath $renderHealthLog
    if ($exitCode -ne 0) {
      throw "windows-render-health-probe.ps1 exited with code $exitCode"
    }
  } catch {
    $probeError = $_.Exception.Message
  }

  $summary = Read-MatrixJsonFile -Path $summaryPath
  $recommendation = if ($summary) { $summary.recommendation } else { $null }
  $ready = if ($recommendation) { [bool]$recommendation.readyForSteamOverlayMatrix } else { $false }
  Write-MatrixJsonFile -Path $gatePath -Value ([PSCustomObject]@{
    kind = "steam-bridge-windows-render-health-gate"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    required = $required
    skipped = $false
    passed = ($probeError -eq $null -and ($ready -or -not $required))
    status = if ($recommendation) { $recommendation.status } else { $null }
    readyForSteamOverlayMatrix = $ready
    nextAction = if ($recommendation) { $recommendation.nextAction } else { $null }
    summaryPath = $summaryPath
    logPath = $renderHealthLog
    error = $probeError
  }) -Depth 8

  if ($probeError) {
    throw (
      "Windows render-health gate failed before live overlay cases. " +
      "See $renderHealthLog, $summaryPath, and $gatePath. $probeError"
    )
  }

  if ($required -and -not $ready) {
    throw (
      "Windows default render health is not ready for Steam-launched overlay matrix proof. " +
      "See $summaryPath and $gatePath."
    )
  }

  Write-Host ("Windows render-health gate passed. Details: {0}" -f $summaryPath)
}

function Read-PrefixedJson {
  param([string]$Text, [string]$Prefix)

  $line = ($Text -split "\r?\n" | Where-Object { $_.StartsWith($Prefix) } | Select-Object -Last 1)
  if (-not $line) {
    throw "Missing $Prefix line in helper output."
  }
  return ($line.Substring($Prefix.Length) | ConvertFrom-Json)
}

function ConvertTo-SanitizedShortcutEntry {
  param($Entry)

  if ($null -eq $Entry) {
    return $null
  }
  return [PSCustomObject]@{
    appId = [uint32]$Entry.appid
    gameId = [string]$Entry.gameId
    appNamePresent = -not [string]::IsNullOrWhiteSpace([string]$Entry.appName)
    exePresent = -not [string]::IsNullOrWhiteSpace([string]$Entry.exe)
    exePathPresent = -not [string]::IsNullOrWhiteSpace([string]$Entry.exePath)
    exeExists = [bool]$Entry.exeExists
    startDirPresent = -not [string]::IsNullOrWhiteSpace([string]$Entry.startDir)
    startDirPathPresent = -not [string]::IsNullOrWhiteSpace([string]$Entry.startDirPath)
    startDirExists = [bool]$Entry.startDirExists
    launchOptionsPresent = -not [string]::IsNullOrWhiteSpace([string]$Entry.launchOptions)
    allowOverlay = [uint32]$Entry.allowOverlay
  }
}

function ConvertTo-SanitizedShortcutResult {
  param($Result, [bool]$BackupCreated)

  return [PSCustomObject]@{
    appNamePresent = -not [string]::IsNullOrWhiteSpace([string]$Result.appName)
    key = [string]$Result.key
    action = [string]$Result.action
    changed = [bool]$Result.changed
    dryRun = [bool]$Result.dryRun
    shortcutsPathPresent = -not [string]::IsNullOrWhiteSpace([string]$Result.shortcutsPath)
    outputPathPresent = -not [string]::IsNullOrWhiteSpace([string]$Result.outputPath)
    appId = [uint32]$Result.appid
    gameId = [string]$Result.gameId
    launchUrl = [string]$Result.launchUrl
    expected = ConvertTo-SanitizedShortcutEntry -Entry $Result.expected
    existing = ConvertTo-SanitizedShortcutEntry -Entry $Result.existing
    existingMatches = [bool]$Result.existingMatches
    backupCreated = $BackupCreated
  }
}

function Get-StableShortcutLaunchOptions {
  if ($ShortcutLaunchPrefix) {
    $envOption = Join-MatrixLaunchOptions @("--steam-bridge-smoke-env-file=$LaunchEnvFile")
    return (($ShortcutLaunchPrefix.Trim(), $envOption) -join " ").Trim()
  }

  $helper = Resolve-HelperPath
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $helper `
    -Mode print-launch-options `
    -AppDir $AppDir `
    -AppId $AppId `
    -SmokeEnvFile $LaunchEnvFile
  $line = @($output | Where-Object {
    $text = [string]$_
    $text -and
      $text -notlike "Steam launch options:*" -and
      $text -notlike "Steam shortcut launch options:*" -and
      $text -notlike "Launch URL:*"
  } | Select-Object -First 1)
  if (-not $line) {
    throw "Could not compute stable Windows shortcut launch options."
  }
  if ($LaunchEnvFile -and $line -notmatch "--steam-bridge-smoke-env-file=") {
    throw "Computed Windows shortcut launch options do not include the smoke env file."
  }
  return [string]$line
}

function Ensure-SteamShortcut {
  $shortcuts = Resolve-ShortcutsPath
  $upsert = Resolve-UpsertShortcutPath
  $runner = Resolve-JavaScriptRunner
  $exe = Resolve-ShortcutExe
  $startDir = Resolve-ShortcutStartDir
  $launchOptions = Get-StableShortcutLaunchOptions
  $backupRoot = Join-Path (Join-Path $env:LOCALAPPDATA "SteamBridgeSmoke") "shortcut-backups"
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $backup = Join-Path $backupRoot ("windows-shortcuts-{0}.vdf.bak" -f ([System.Guid]::NewGuid().ToString("N")))
  $baseArgs = @(
    $upsert,
    "--shortcuts", $shortcuts,
    "--backup", $backup,
    "--app-name", $ShortcutName,
    "--exe", $exe,
    "--start-dir", $startDir,
    "--launch-options", $launchOptions,
    "--json"
  )

  $dryOutput = Invoke-JavaScriptRunner -Runner $runner -Arguments @($baseArgs + "--dry-run")
  $dryResult = Read-PrefixedJson -Text ($dryOutput -join "`n") -Prefix "STEAM_SHORTCUT_RESULT "
  $sanitizedDryResult = ConvertTo-SanitizedShortcutResult -Result $dryResult -BackupCreated $false

  if (-not $InstallShortcut) {
    if ($AssumeShortcutConfigured) {
      $assumedShortcutPath = Join-Path (Join-Path $ArtifactRoot "00-preflight") "assumed-shortcut.json"
      $assumedShortcut = [PSCustomObject]@{
        ok = -not [bool]$dryResult.changed
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        shortcutNamePresent = -not [string]::IsNullOrWhiteSpace($ShortcutName)
        requestedShortcutGameId = $ShortcutGameId
        expectedShortcutGameId = [string]$dryResult.gameId
        changed = [bool]$dryResult.changed
        action = $dryResult.action
        existingMatches = [bool]$dryResult.existingMatches
        result = $sanitizedDryResult
      }
      Write-MatrixJsonFile -Path $assumedShortcutPath -Value $assumedShortcut -Depth 12

      if ($dryResult.changed) {
        throw (
          "The assumed Steam shortcut `"$ShortcutName`" does not match the current package. " +
          "Refresh it with -Suite shortcut -InstallShortcut while Steam is closed before live overlay cases. " +
          "Details: $assumedShortcutPath"
        )
      }
      if ($ShortcutGameId -and ([string]$ShortcutGameId -ne [string]$dryResult.gameId)) {
        throw (
          "The provided -ShortcutGameId $ShortcutGameId does not match the stable shortcut game ID $($dryResult.gameId) " +
          "for `"$ShortcutName`". Details: $assumedShortcutPath"
        )
      }
      $script:ShortcutGameId = [string]$dryResult.gameId
      Write-Host ("Windows assumed Steam shortcut verified. Launch URL: steam://rungameid/{0}" -f $script:ShortcutGameId)
      return
    }
    throw "Steam-launched Windows matrix runs require -InstallShortcut or -AssumeShortcutConfigured so the shortcut uses -LaunchEnvFile."
  }

  if ($dryResult.changed -and (Get-Process steam -ErrorAction SilentlyContinue) -and -not $AllowShortcutUpdateWhileSteamRunning) {
    throw (
      "The Steam shortcut `"$ShortcutName`" needs to be $($dryResult.action), but Steam is running. " +
      "Fully quit Steam and rerun this matrix, or pass -AllowShortcutUpdateWhileSteamRunning if you intentionally want to update shortcuts.vdf while Steam is open."
    )
  }

  $output = Invoke-JavaScriptRunner -Runner $runner -Arguments $baseArgs
  $result = Read-PrefixedJson -Text ($output -join "`n") -Prefix "STEAM_SHORTCUT_RESULT "
  $sanitizedResult = ConvertTo-SanitizedShortcutResult `
    -Result $result `
    -BackupCreated:(Test-Path -LiteralPath $backup)
  Write-Host ("STEAM_SHORTCUT_RESULT_SANITIZED {0}" -f ($sanitizedResult | ConvertTo-Json -Compress -Depth 5))
  if (-not $ShortcutGameId) {
    $script:ShortcutGameId = [string]$result.gameId
  }
}

function New-Case {
  param(
    [string]$Id,
    [string]$Action,
    [string[]]$RequireEvent = @(),
    [switch]$RequireOverlayActivated,
    [switch]$RequireNoOverlayActivation,
    [switch]$AllowOverlayNotReady,
    [switch]$RequirePassiveNotification,
    [switch]$RequireManagedOverlayComplete,
    [switch]$RequireMicroTxnCallback,
    [switch]$CloseProbeOnActivation,
    [switch]$ShortcutToggleProbe,
    [switch]$AutorunUserGestureGate,
    [switch]$PersistentReuseGate,
    [string]$ManagedOverlayResultMode = "",
    [string]$WebModal = "",
    [string]$StoreRouteOverride = "",
    [string]$DialogOverride = "",
    [string]$UserDialogOverride = "",
    [string]$ShortcutTargetOverride = "",
    [string]$CheckoutTransactionIdOverride = "",
    [string]$CheckoutJsonFileOverride = "",
    [string]$InitTxnRequestFileOverride = "",
    [int]$PersistentReuseCycles = 0,
    [int]$ResultDelayMs = 8000
  )

  return [PSCustomObject]@{
    id = $Id
    action = $Action
    requireEvent = $RequireEvent
    requireOverlayActivated = [bool]$RequireOverlayActivated
    requireNoOverlayActivation = [bool]$RequireNoOverlayActivation
    allowOverlayNotReady = [bool]$AllowOverlayNotReady
    requirePassiveNotification = [bool]$RequirePassiveNotification
    requireManagedOverlayComplete = [bool]$RequireManagedOverlayComplete
    requireMicroTxnCallback = [bool]$RequireMicroTxnCallback
    closeProbeOnActivation = [bool]$CloseProbeOnActivation
    shortcutToggleProbe = [bool]$ShortcutToggleProbe
    autorunUserGestureGate = [bool]$AutorunUserGestureGate
    persistentReuseGate = [bool]$PersistentReuseGate
    persistentReuseGatePolicy = if ($PersistentReuseGate) { $PersistentReuseGatePolicy } else { "" }
    persistentReuseEvidenceSchema = if ($PersistentReuseGate) { $PersistentReuseEvidenceSchema } else { 0 }
    initialUserGestureCycle = if ($PersistentReuseGate) { 1 } else { 0 }
    verifyOnlyCycles = if ($PersistentReuseGate) { @(2, 3) } else { @() }
    closeVerificationOrdinals = if ($PersistentReuseGate) { @(1, 2, 3) } else { @() }
    managedOverlayResultMode = $ManagedOverlayResultMode
    webModal = $WebModal
    storeRoute = $StoreRouteOverride
    dialog = $DialogOverride
    userDialog = $UserDialogOverride
    shortcutTarget = $ShortcutTargetOverride
    checkoutTransactionId = $CheckoutTransactionIdOverride
    checkoutJsonFile = $CheckoutJsonFileOverride
    initTxnRequestFile = $InitTxnRequestFileOverride
    persistentReuseCycles = [Math]::Max(0, $PersistentReuseCycles)
    resultDelayMs = $ResultDelayMs
  }
}

function New-ManagedOpenAndWaitCase {
  param(
    [string]$Id,
    [string]$Action,
    [string]$DialogOverride = "",
    [string]$ShortcutTargetOverride = "",
    [string]$CheckoutTransactionIdOverride = "",
    [string]$CheckoutJsonFileOverride = "",
    [string]$InitTxnRequestFileOverride = "",
    [string]$WebModal = "",
    [string]$StoreRouteOverride = "",
    [switch]$AutorunUserGestureGate,
    [switch]$RequireMicroTxnCallback
  )

  return New-Case `
    -Id $Id `
    -Action $Action `
    -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") `
    -RequireOverlayActivated `
    -RequireManagedOverlayComplete `
    -ManagedOverlayResultMode "complete" `
    -DialogOverride $DialogOverride `
    -ShortcutTargetOverride $ShortcutTargetOverride `
    -CheckoutTransactionIdOverride $CheckoutTransactionIdOverride `
    -CheckoutJsonFileOverride $CheckoutJsonFileOverride `
    -InitTxnRequestFileOverride $InitTxnRequestFileOverride `
    -AutorunUserGestureGate:$AutorunUserGestureGate `
    -RequireMicroTxnCallback:$RequireMicroTxnCallback `
    -WebModal $WebModal `
    -StoreRouteOverride $StoreRouteOverride
}

function New-ShortcutOpenAndWaitCase {
  param(
    [string]$Id,
    [string]$ShortcutTargetOverride,
    [string]$CheckoutTransactionIdOverride = "",
    [string]$CheckoutJsonFileOverride = "",
    [string]$InitTxnRequestFileOverride = "",
    [string]$WebModal = "",
    [string]$StoreRouteOverride = "",
    [switch]$AutorunUserGestureGate
  )

  return New-Case `
    -Id $Id `
    -Action "presenter-shortcut-open-and-wait" `
    -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:shortcut-open", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") `
    -RequireOverlayActivated `
    -RequireManagedOverlayComplete `
    -ManagedOverlayResultMode "complete" `
    -ShortcutTargetOverride $ShortcutTargetOverride `
    -CheckoutTransactionIdOverride $CheckoutTransactionIdOverride `
    -CheckoutJsonFileOverride $CheckoutJsonFileOverride `
    -InitTxnRequestFileOverride $InitTxnRequestFileOverride `
    -AutorunUserGestureGate:$AutorunUserGestureGate `
    -WebModal $WebModal `
    -StoreRouteOverride $StoreRouteOverride
}

function New-PublicShortcutRouteCases {
  $targets = @(
    "friends",
    "web",
    "store",
    "profile",
    "players",
    "community",
    "stats",
    "achievements",
    "user",
    "dialog"
  )

  $cases = @()
  foreach ($target in $targets) {
    $caseId = "30-shortcut-{0}-open-and-wait" -f $target
    $webModal = if ($target -eq "web") { "true" } else { "" }
    $storeRouteOverride = if ($target -eq "store") { $StoreRoute } else { "" }
    $cases += New-ShortcutOpenAndWaitCase `
      -Id $caseId `
      -ShortcutTargetOverride $target `
      -WebModal $webModal `
      -StoreRouteOverride $storeRouteOverride `
      -AutorunUserGestureGate
  }

  return $cases
}

function Get-MatrixCases {
  $checkoutTransactionIdForCase = if ($CheckoutJsonFile -or $InitTxnRequestFile) { "" } else { $CheckoutTransactionId }
  $checkoutJsonFileForCase = if ($CheckoutJsonFile) { $CheckoutJsonFile } else { "" }
  $checkoutInitTxnRequestFileForCase = if ($InitTxnRequestFile) { $InitTxnRequestFile } else { "" }
  $shortcutCheckoutTransactionIdForCase = if ($ShortcutTarget -eq "checkout" -and -not $CheckoutJsonFile -and -not $InitTxnRequestFile) { $CheckoutTransactionId } else { "" }
  $shortcutCheckoutJsonFileForCase = if ($ShortcutTarget -eq "checkout" -and $CheckoutJsonFile) { $CheckoutJsonFile } else { "" }
  $shortcutCheckoutInitTxnRequestFileForCase = if ($ShortcutTarget -eq "checkout" -and $InitTxnRequestFile) { $InitTxnRequestFile } else { "" }
  $persistentReuseResultDelayMs = [Math]::Max(
    180000,
    (($CloseProbeTimeoutSeconds * 3) + 30) * 1000
  )
  $baseline = @(
    New-Case -Id "01-web" -Action "web" -RequireEvent @("overlay:web") -RequireOverlayActivated -WebModal "true"
    New-Case -Id "02-store" -Action "store" -RequireEvent @("overlay:store") -RequireOverlayActivated
    New-Case -Id "03-friends-dialog" -Action "friends" -RequireEvent @("overlay:dialog") -RequireOverlayActivated -DialogOverride $Dialog
    New-Case -Id "04-achievement-progress" -Action "achievement-progress" -RequireEvent @("achievement:progress") -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 2500
    New-Case -Id "05-achievement-unlock" -Action "achievement-unlock" -RequireEvent @("achievement:unlock") -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 2500
    New-Case -Id "99-none" -Action "none" -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 1200
  )

  $managed = @(
    New-Case -Id "10-presenter-ready" -Action "presenter-ready" -RequireEvent @("overlay:presenter-ready") -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 1200
    New-ManagedOpenAndWaitCase -Id "11-managed-web-open-and-wait" -Action "presenter-web-open-and-wait" -WebModal "true" -AutorunUserGestureGate
    New-Case `
      -Id "11b-managed-duplicate-open-guard" `
      -Action "presenter-duplicate-open-guard" `
      -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-duplicate-open-guard", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") `
      -RequireOverlayActivated `
      -RequireManagedOverlayComplete `
      -ManagedOverlayResultMode "complete" `
      -WebModal "true" `
      -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "12-managed-store-open-and-wait" -Action "presenter-store-open-and-wait" -StoreRouteOverride $StoreRoute -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "13-managed-friends-open-and-wait" -Action "presenter-friends-open-and-wait" -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "14-managed-dialog-open-and-wait" -Action "presenter-dialog-auto-open-and-wait" -DialogOverride $Dialog -AutorunUserGestureGate
    New-ShortcutOpenAndWaitCase -Id "15-managed-shortcut" -ShortcutTargetOverride $ShortcutTarget -CheckoutTransactionIdOverride $shortcutCheckoutTransactionIdForCase -CheckoutJsonFileOverride $shortcutCheckoutJsonFileForCase -InitTxnRequestFileOverride $shortcutCheckoutInitTxnRequestFileForCase -AutorunUserGestureGate
    New-Case `
      -Id "15-managed-shortcut-keyboard" `
      -Action "presenter-shortcut" `
      -RequireEvent @("overlay:presenter-shortcut-ready", "overlay:shortcut-open", "overlay:presenter-wait-shown", "overlay:presenter-wait-closed", "overlay:presenter-parked") `
      -RequireOverlayActivated `
      -RequireManagedOverlayComplete `
      -ManagedOverlayResultMode "complete" `
      -CloseProbeOnActivation `
      -ShortcutToggleProbe `
      -ShortcutTargetOverride $ShortcutTarget `
      -CheckoutTransactionIdOverride $shortcutCheckoutTransactionIdForCase `
      -CheckoutJsonFileOverride $shortcutCheckoutJsonFileForCase `
      -InitTxnRequestFileOverride $shortcutCheckoutInitTxnRequestFileForCase `
      -AutorunUserGestureGate `
      -ResultDelayMs 30000
    New-Case -Id "16-managed-checkout-route" -Action "presenter-checkout" -RequireEvent @("overlay:presenter-open", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-checkout-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete" -CheckoutTransactionIdOverride $checkoutTransactionIdForCase -CheckoutJsonFileOverride $checkoutJsonFileForCase -InitTxnRequestFileOverride $checkoutInitTxnRequestFileForCase -RequireMicroTxnCallback:$RequireMicroTxnCallback -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "17-managed-profile-open-and-wait" -Action "presenter-profile-open-and-wait" -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "18-managed-players-open-and-wait" -Action "presenter-players-open-and-wait" -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "19-managed-community-open-and-wait" -Action "presenter-community-open-and-wait" -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "20-managed-stats-open-and-wait" -Action "presenter-stats-open-and-wait" -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "21-managed-achievements-open-and-wait" -Action "presenter-achievements-open-and-wait" -AutorunUserGestureGate
    New-ManagedOpenAndWaitCase -Id "22-managed-user-open-and-wait" -Action "presenter-user-open-and-wait" -AutorunUserGestureGate
    New-Case -Id "23-raw-native-dialog-open-observe" -Action "presenter-dialog" -RequireEvent @("overlay:presenter-open") -RequireOverlayActivated -DialogOverride $Dialog -CloseProbeOnActivation -ResultDelayMs 12000
    New-Case -Id "24-raw-native-user-open-observe" -Action "presenter-user-native" -RequireEvent @("overlay:presenter-open") -RequireOverlayActivated -UserDialogOverride $UserDialog -CloseProbeOnActivation -ResultDelayMs 12000
    New-Case -Id "25-managed-achievement-progress" -Action "presenter-achievement-progress" -RequireEvent @("overlay:presenter-attach", "achievement:progress", "overlay:passive-notification-needs-present", "overlay:passive-notification-parked") -RequireNoOverlayActivation -AllowOverlayNotReady -RequirePassiveNotification -ResultDelayMs 10000
    New-Case -Id "26-managed-achievement-unlock" -Action "presenter-achievement-unlock" -RequireEvent @("overlay:presenter-attach", "achievement:unlock", "overlay:passive-notification-needs-present", "overlay:passive-notification-parked") -RequireNoOverlayActivation -AllowOverlayNotReady -RequirePassiveNotification -ResultDelayMs 10000
  )

  $shortcutRoutes = @(New-PublicShortcutRouteCases)

  $persistentReuse = @(
    New-Case `
      -Id "40-persistent-reuse-three-cycle" `
      -Action "presenter-persistent-reuse-three-cycle" `
      -RequireEvent @("overlay:presenter-persistent-reuse-start", "overlay:presenter-persistent-reuse-cycle", "overlay:presenter-persistent-reuse-complete") `
      -RequireOverlayActivated `
      -WebModal "true" `
      -AutorunUserGestureGate `
      -PersistentReuseGate `
      -PersistentReuseCycles 3 `
      -ResultDelayMs $persistentReuseResultDelayMs
  )

  $checkout = @(
    New-Case `
      -Id "01-checkout-prepare" `
      -Action "presenter-checkout" `
      -RequireEvent @("overlay:presenter-checkout-ready") `
      -RequireNoOverlayActivation `
      -AllowOverlayNotReady `
      -ResultDelayMs 1200
    New-Case `
      -Id "02-checkout-approval" `
      -Action "presenter-checkout" `
      -RequireEvent @("overlay:presenter-open", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-checkout-open-and-wait-complete") `
      -RequireOverlayActivated `
      -RequireManagedOverlayComplete `
      -ManagedOverlayResultMode "complete" `
      -CheckoutTransactionIdOverride $checkoutTransactionIdForCase `
      -CheckoutJsonFileOverride $checkoutJsonFileForCase `
      -InitTxnRequestFileOverride $checkoutInitTxnRequestFileForCase `
      -RequireMicroTxnCallback:$RequireMicroTxnCallback `
      -AutorunUserGestureGate
    New-Case `
      -Id "03-shortcut-checkout" `
      -Action "presenter-shortcut" `
      -RequireEvent @("overlay:presenter-shortcut-ready", "overlay:shortcut-open", "overlay:presenter-wait-shown", "overlay:presenter-wait-closed", "overlay:presenter-parked") `
      -RequireOverlayActivated `
      -RequireManagedOverlayComplete `
      -ManagedOverlayResultMode "complete" `
      -CloseProbeOnActivation `
      -ShortcutToggleProbe `
      -ShortcutTargetOverride "checkout" `
      -CheckoutTransactionIdOverride $checkoutTransactionIdForCase `
      -CheckoutJsonFileOverride $checkoutJsonFileForCase `
      -InitTxnRequestFileOverride $checkoutInitTxnRequestFileForCase `
      -AutorunUserGestureGate `
      -ResultDelayMs 30000
    New-Case `
      -Id "04-shortcut-checkout-open-and-wait" `
      -Action "presenter-shortcut-open-and-wait" `
      -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:shortcut-open", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") `
      -RequireOverlayActivated `
      -RequireManagedOverlayComplete `
      -ManagedOverlayResultMode "complete" `
      -ShortcutTargetOverride "checkout" `
      -CheckoutTransactionIdOverride $checkoutTransactionIdForCase `
      -CheckoutJsonFileOverride $checkoutJsonFileForCase `
      -InitTxnRequestFileOverride $checkoutInitTxnRequestFileForCase `
      -AutorunUserGestureGate
  )
  if ($InitTxnRequestFile) {
    $checkout = @($checkout | Where-Object { @("01-checkout-prepare", "02-checkout-approval") -contains $_.id })
  }

  switch ($Suite) {
    "baseline" { return $baseline }
    "managed" { return $managed }
    "managed-routes" {
      $publicManagedRouteExclusions = @(
        "16-managed-checkout-route",
        "23-raw-native-dialog-open-observe",
        "24-raw-native-user-open-observe"
      )
      return @($managed | Where-Object {
        $_.id -notin $publicManagedRouteExclusions
      })
    }
    "shortcut-routes" { return $shortcutRoutes }
    "checkout" { return $checkout }
    "persistent-reuse" { return $persistentReuse }
    "full" { return @($baseline + $managed + $shortcutRoutes) }
    "preflight" { return @() }
    "readiness" { return @() }
    "shortcut" { return @() }
  }
}

function Get-SelectedMatrixCases {
  $cases = @(Get-MatrixCases)
  if (-not $OnlyCase) {
    return $cases
  }

  $selected = @($cases | Where-Object { $_.id -eq $OnlyCase -or $_.action -eq $OnlyCase })
  if ($selected.Count -eq 0) {
    $available = (($cases | ForEach-Object { "{0} ({1})" -f $_.id, $_.action }) -join ", ")
    if (-not $available) {
      $available = "none for suite $Suite"
    }
    throw "No Windows overlay matrix case matched -OnlyCase '$OnlyCase'. Available cases: $available"
  }
  if ($selected.Count -gt 1) {
    $matches = (($selected | ForEach-Object { "{0} ({1})" -f $_.id, $_.action }) -join ", ")
    throw "-OnlyCase '$OnlyCase' matched multiple cases: $matches"
  }
  return $selected
}

function Write-MatrixManifest {
  param([object[]]$Cases)

  $expectedNativeHostBackend = Resolve-ExpectedWindowsNativeHostBackend
  $publicSyntheticCheckout = (
    $Suite -eq "checkout" -and
    $AppId -eq 480 -and
    $CheckoutTransactionId -eq "123456789" -and
    -not $CheckoutJsonFile -and
    -not $InitTxnRequestFile -and
    -not $InitTxnResponseFile -and
    -not $InitTxnApiKeyEnv -and
    -not $InitTxnEndpoint -and
    -not $RequireMicroTxnCallback
  )
  $launchKind = if ($LaunchMode -eq "steam-app") { "app" } elseif ($LaunchMode -eq "steam-launch") { "shortcut" } else { "direct" }
  $manifestCases = @(
    $Cases |
      ForEach-Object {
        [PSCustomObject]@{
          id = $_.id
          action = $_.action
          requireEvent = @($_.requireEvent)
          requireOverlayActivated = [bool]$_.requireOverlayActivated
          requireNoOverlayActivation = [bool]$_.requireNoOverlayActivation
          allowOverlayNotReady = [bool]$_.allowOverlayNotReady
          requirePassiveNotification = [bool]$_.requirePassiveNotification
          requireManagedOverlayComplete = [bool]$_.requireManagedOverlayComplete
          requireMicroTxnCallback = [bool]$_.requireMicroTxnCallback
          closeProbeOnActivation = [bool]$_.closeProbeOnActivation
          shortcutToggleProbe = [bool]$_.shortcutToggleProbe
          autorunUserGestureGate = [bool]$_.autorunUserGestureGate
          persistentReuseGate = [bool]$_.persistentReuseGate
          persistentReuseGatePolicy = [string]$_.persistentReuseGatePolicy
          persistentReuseEvidenceSchema = [int]$_.persistentReuseEvidenceSchema
          initialUserGestureCycle = [int]$_.initialUserGestureCycle
          verifyOnlyCycles = @($_.verifyOnlyCycles)
          closeVerificationOrdinals = @($_.closeVerificationOrdinals)
          closeProbeEvidenceSchema = if ($_.autorunUserGestureGate) {
            $SameProcessUserGestureEvidenceSchema
          } else {
            $CloseProbeEvidenceSchema
          }
          closeProbeForegroundHandoff = if ($_.autorunUserGestureGate) {
            $SameProcessUserGestureForegroundHandoff
          } else {
            $CloseProbeForegroundHandoff
          }
          externalForegroundTransition = if ($_.autorunUserGestureGate) {
            $ExternalForegroundTransition
          } else {
            ""
          }
          expectedCloseProbeInput = Resolve-CloseProbeInputForCase -Case $_
          managedOverlayResultMode = $_.managedOverlayResultMode
          webModal = $_.webModal
          storeRoute = $_.storeRoute
          dialog = $_.dialog
          userDialog = $_.userDialog
          shortcutTarget = $_.shortcutTarget
          hasCheckoutTransactionId = [bool]$_.checkoutTransactionId
          hasCheckoutJsonFile = [bool]$_.checkoutJsonFile
          hasInitTxnRequestFile = [bool]$_.initTxnRequestFile
          persistentReuseCycles = [int]$_.persistentReuseCycles
          resultDelayMs = $_.resultDelayMs
        }
      }
  )

  $manifest = [PSCustomObject]@{
    kind = "steam-bridge-windows-overlay-matrix-manifest"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    suite = $Suite
    launchMode = $LaunchMode
    launchKind = $launchKind
    appId = $AppId
    onlyCase = $OnlyCase
    expectedCaseCount = $manifestCases.Count
    candidatePathHasNoReparsePoints = $candidatePathHasNoReparsePoints
    launchEnvOutsideCandidate = $launchEnvOutsideCandidate
    launchEnvPathHasNoReparsePoints = $launchEnvPathHasNoReparsePoints
    launchEnvUsesDefaultPath = $launchEnvUsesDefaultPath
    webUrlUsesPublicDefault = [bool](
      $AppId -eq 480 -and
      $WebUrl -ceq "https://store.steampowered.com/app/480/"
    )
    shortcutNamePresent = -not [string]::IsNullOrWhiteSpace($ShortcutName)
    shortcutExeConfigured = [bool]$ShortcutExe
    shortcutStartDirConfigured = [bool]$ShortcutStartDir
    shortcutLaunchPrefixConfigured = [bool]$ShortcutLaunchPrefix
    javaScriptRunnerExeConfigured = [bool]$JavaScriptRunnerExe
    overlayProfile = $OverlayProfile
    presenterMode = $PresenterMode
    nativeHostBackend = $NativeHostBackend
    nativeHostStyle = $NativeHostStyle
    expectedNativeHostBackend = $expectedNativeHostBackend
    nativePathOverride = [bool]$NativePath
    overlayInProcessGpu = $OverlayInProcessGpu
    overlayDisableDirectComposition = $OverlayDisableDirectComposition
    overlayScrubChildEnv = $OverlayScrubChildEnv
    overlayIsolateChildProcesses = $OverlayIsolateChildProcesses
    windowMode = $WindowMode
    closeProbe = [bool]$CloseProbe
    closeProbeInput = $CloseProbeInput
    autorunUserGestureGatePolicy = $AutorunUserGestureGatePolicy
    persistentReuseGatePolicy = $PersistentReuseGatePolicy
    supportedPersistentReuseEvidenceSchemas = @($PersistentReuseEvidenceSchema)
    closeProbeEvidenceSchema = $CloseProbeEvidenceSchema
    supportedCloseProbeEvidenceSchemas = @(
      $CloseProbeEvidenceSchema,
      $SameProcessUserGestureEvidenceSchema
    )
    closeProbeForegroundHandoff = $CloseProbeForegroundHandoff
    supportedCloseProbeForegroundHandoffs = @(
      $CloseProbeForegroundHandoff,
      $SameProcessUserGestureForegroundHandoff
    )
    supportedExternalForegroundTransitions = @($ExternalForegroundTransition)
    skipNativeLoadGate = [bool]$SkipNativeLoadGate
    skipRenderHealthGate = [bool]$SkipRenderHealthGate
    allowUnhealthyDefaultRender = [bool]$AllowUnhealthyDefaultRender
    allowUnhealthySteamClientLogs = [bool]$AllowUnhealthySteamClientLogs
    cleanStaleOverlayHelpers = [bool]$CleanStaleOverlayHelpers
    steamClientHealthRecentMinutes = [int]$SteamClientHealthRecentMinutes
    privateEnvImported = [bool]$PrivateEnvImported
    timeoutSeconds = [int]$TimeoutSeconds
    closeProbeSettleMs = [int]$CloseProbeSettleMs
    closeProbeTimeoutSeconds = [int]$CloseProbeTimeoutSeconds
    requireMicroTxnCallback = [bool]$RequireMicroTxnCallback
    candidateBinding = $candidateBinding
    cleanupContract = [PSCustomObject]@{
      processCleanupRequired = [bool](Test-IsLiveSteamLaunchSuite)
      launchEnvRollbackRequired = [bool](Test-IsLiveSteamLaunchSuite)
      taskCleanupExpected = [bool]$TaskCleanupExpected
      steamContinuityRequired = [bool]((Test-IsLiveSteamLaunchSuite) -and $TaskCleanupExpected)
    }
    initTxnCapture = [PSCustomObject]@{
      hasRequestFile = [bool]$InitTxnRequestFile
      hasResponseFile = [bool]$InitTxnResponseFile
      captureInApp = [bool]$InitTxnRequestFile
      apiKeyEnvProvided = [bool]$InitTxnApiKeyEnv
      endpointOption = $InitTxnEndpoint
      publicSyntheticCheckout = [bool]$publicSyntheticCheckout
    }
    installShortcut = [bool]$InstallShortcut
    assumeShortcutConfigured = [bool]$AssumeShortcutConfigured
    targetHints = [PSCustomObject]@{
      hasWebUrl = [bool]$WebUrl
      storeRoute = $StoreRoute
      dialog = $Dialog
      userDialog = $UserDialog
      shortcutTarget = $ShortcutTarget
      hasCheckoutTransactionId = [bool]($CheckoutTransactionId -and -not $CheckoutJsonFile -and -not $InitTxnRequestFile)
      hasCheckoutJsonFile = [bool]$CheckoutJsonFile
      hasInitTxnRequestFile = [bool]$InitTxnRequestFile
    }
    cases = @($manifestCases)
  }

  $manifestPath = Join-Path $ArtifactRoot "matrix-manifest.json"
  Write-MatrixJsonFile -Path $manifestPath -Value $manifest -Depth 8
  Write-Host ("Windows overlay matrix manifest: {0}" -f $manifestPath)
}

function Invoke-Helper {
  param([string[]]$Arguments, [string]$LogFile)

  $helper = Resolve-HelperPath
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

  try {
    $output = @()
    $exitCode = 1
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $helper @Arguments *>&1
      $exitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    $output | Tee-Object -FilePath $LogFile
    if ($exitCode -ne 0) {
      $completed = @($output | Where-Object {
        $_ -and (
          ([string]$_).StartsWith("Windows steam-launch smoke completed.") -or
          ([string]$_).StartsWith("Windows steam-app smoke completed.")
        )
      }).Count -gt 0
      if (-not $completed) {
        throw "windows-electron-smoke.ps1 exited with code $exitCode"
      }
      Write-Host ("windows-electron-smoke.ps1 returned code {0} after the completed marker; continuing." -f $exitCode)
    }
  } catch {
    Write-Host ("Helper failed; output preserved at {0}" -f $LogFile)
    throw
  }
}

function Test-SmokeResultPayload {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $false
  }

  return [bool](Select-String -LiteralPath $Path -SimpleMatch -Pattern "STEAM_BRIDGE_SMOKE_RESULT " -Quiet -ErrorAction SilentlyContinue)
}

function Resolve-CloseProbeInputForCase {
  param($Case)

  if ($CloseProbeInput -ne "auto") {
    return $CloseProbeInput
  }

  $action = ([string]$Case.action).ToLowerInvariant()
  $id = ([string]$Case.id).ToLowerInvariant()
  $shortcutTarget = ([string]$Case.shortcutTarget).ToLowerInvariant()
  $webPanelTokens = @(
    "checkout",
    "web",
    "store",
    "friends",
    "dialog",
    "chat",
    "profile",
    "players",
    "community",
    "stats",
    "achievements",
    "user"
  )

  if ($action -eq "presenter-duplicate-open-guard") {
    return "web-close-click-sendinput"
  }

  if ($action -eq "presenter-persistent-reuse-three-cycle") {
    return "web-close-click-sendinput"
  }

  foreach ($token in $webPanelTokens) {
    if ($action.Contains($token) -or $id.Contains($token) -or $shortcutTarget.Contains($token)) {
      return "web-close-click-sendinput"
    }
  }

  if ([bool]$Case.shortcutToggleProbe) {
    return "toggle-sendinput"
  }

  return "escape-sendinput"
}

function Test-CaseUsesCloseProbe {
  param($Case)

  return [bool](
    $CloseProbe -and
    (
      $Case.requireManagedOverlayComplete -or
      $Case.closeProbeOnActivation -or
      $Case.shortcutToggleProbe -or
      $Case.autorunUserGestureGate -or
      $Case.persistentReuseCycles -gt 0
    )
  )
}

function Start-WindowsOverlayCloseProbe {
  param($Case, [string]$CaseDir, [string]$DiagnosticDir, [string]$ControlFile)

  $shortcutToggleProbe = [bool]$Case.shortcutToggleProbe
  $useUserGestureGate = [bool]$Case.autorunUserGestureGate
  $usePersistentReuseGate = [bool]$Case.persistentReuseGate
  $evidenceSchema = if ($useUserGestureGate) {
    $SameProcessUserGestureEvidenceSchema
  } else {
    $CloseProbeEvidenceSchema
  }
  $externalForegroundTransition = if ($useUserGestureGate) {
    $ExternalForegroundTransition
  } else {
    ""
  }
  $userGestureAction = ""
  $userGestureTargetId = ""
  if ($useUserGestureGate) {
    $userGestureCase = Resolve-AutorunUserGestureGateCase -Case $Case
    if ($null -eq $userGestureCase) {
      $userGestureCase = Resolve-PersistentReuseGateCase -Case $Case
    }
    if ($null -eq $userGestureCase) {
      throw "Unsupported Windows user-gesture gate case/action pair: $($Case.id) / $($Case.action)"
    }
    $userGestureAction = [string]$userGestureCase.action
    $userGestureTargetId = [string]$userGestureCase.targetId
  }
  if (-not (Test-CaseUsesCloseProbe -Case $Case)) {
    return $null
  }

  $lifecycleLog = Join-Path $DiagnosticDir "lifecycle.jsonl"
  $probeLog = Join-Path $CaseDir "close-probe.log"
  $externalForegroundReadyMarker = Join-Path $CaseDir "external-foreground-ready.json"
  $externalForegroundControllerAck = Join-Path $CaseDir "external-foreground-ack.json"
  $externalForegroundChallenge = [Guid]::NewGuid().ToString("N")
  $input = Resolve-CloseProbeInputForCase -Case $Case
  $settleMs = [Math]::Max(0, $CloseProbeSettleMs)
  $expectedCloseCount = [Math]::Max(1, [int]$Case.persistentReuseCycles)
  $timeoutSeconds = [Math]::Max(1, ($CloseProbeTimeoutSeconds * $expectedCloseCount))
  $controlHandoffOnlyExpected = ($useUserGestureGate -or $expectedCloseCount -eq 1)
  $foregroundHandoff = if ($useUserGestureGate) {
    $SameProcessUserGestureForegroundHandoff
  } else {
    $CloseProbeForegroundHandoff
  }
  $preserveControlFile = ($expectedCloseCount -gt 1)
  $controlFileBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($ControlFile))
  $externalForegroundReadyMarkerBase64 = [Convert]::ToBase64String(
    [Text.Encoding]::UTF8.GetBytes($externalForegroundReadyMarker)
  )
  $externalForegroundControllerAckBase64 = [Convert]::ToBase64String(
    [Text.Encoding]::UTF8.GetBytes($externalForegroundControllerAck)
  )
  New-Item -ItemType Directory -Force -Path $CaseDir | Out-Null
  Remove-Item -LiteralPath $probeLog -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $externalForegroundReadyMarker -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $externalForegroundControllerAck -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath ($externalForegroundControllerAck + ".tmp") -Force -ErrorAction SilentlyContinue

  $probeScript = @"
`$ErrorActionPreference = "Continue"
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class SteamBridgeWindowsProbe {
  const uint INPUT_MOUSE = 0;
  const uint INPUT_KEYBOARD = 1;
  const uint KEYEVENTF_KEYUP = 0x0002;
  const uint MOUSEEVENTF_MOVE = 0x0001;
  const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  const uint MOUSEEVENTF_LEFTUP = 0x0004;
  const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
  const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;
  const int SM_XVIRTUALSCREEN = 76;
  const int SM_YVIRTUALSCREEN = 77;
  const int SM_CXVIRTUALSCREEN = 78;
  const int SM_CYVIRTUALSCREEN = 79;
  const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
  const uint WINEVENT_OUTOFCONTEXT = 0x0000;
  const uint WINEVENT_SKIPOWNPROCESS = 0x0002;
  const uint WM_QUIT = 0x0012;
  const uint PM_NOREMOVE = 0x0000;

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public InputUnion u;
  }

  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion {
    [FieldOffset(0)]
    public MOUSEINPUT mi;

    [FieldOffset(0)]
    public KEYBDINPUT ki;

    [FieldOffset(0)]
    public HARDWAREINPUT hi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct HARDWAREINPUT {
    public uint uMsg;
    public ushort wParamL;
    public ushort wParamH;
  }

  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  struct MSG {
    public IntPtr hwnd;
    public uint message;
    public UIntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public POINT pt;
    public uint lPrivate;
  }

  [UnmanagedFunctionPointer(CallingConvention.Winapi)]
  delegate void WinEventDelegate(
    IntPtr hook,
    uint eventType,
    IntPtr hwnd,
    int objectId,
    int childId,
    uint eventThread,
    uint eventTime
  );

  [DllImport("user32.dll", SetLastError = true)]
  static extern IntPtr SetWinEventHook(
    uint eventMin,
    uint eventMax,
    IntPtr module,
    WinEventDelegate callback,
    uint processId,
    uint threadId,
    uint flags
  );

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool UnhookWinEvent(IntPtr hook);

  [DllImport("user32.dll", SetLastError = true)]
  static extern int GetMessage(out MSG message, IntPtr hwnd, uint filterMin, uint filterMax);

  [DllImport("user32.dll")]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool TranslateMessage(ref MSG message);

  [DllImport("user32.dll")]
  static extern IntPtr DispatchMessage(ref MSG message);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool PeekMessage(out MSG message, IntPtr hwnd, uint filterMin, uint filterMax, uint remove);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  static extern bool PostThreadMessage(uint threadId, uint message, UIntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll")]
  static extern uint GetCurrentThreadId();

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindowEnabled(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

  [DllImport("user32.dll")]
  public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT point);

  [DllImport("user32.dll")]
  public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetDpiForWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);

  [DllImport("user32.dll", SetLastError = true)]
  static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll", SetLastError = true)]
  static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);

  [DllImport("user32.dll", SetLastError = true)]
  static extern bool SetProcessDPIAware();

  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

  public sealed class ForegroundTransitionWaiter : IDisposable {
    readonly IntPtr expectedWindow;
    readonly uint expectedProcessId;
    readonly ManualResetEvent ready = new ManualResetEvent(false);
    readonly ManualResetEvent matched = new ManualResetEvent(false);
    Thread thread;
    WinEventDelegate callback;
    GCHandle callbackHandle;
    IntPtr hook = IntPtr.Zero;
    uint nativeThreadId;
    int armed;
    int eventCount;
    int disposed;
    int lastError;

    internal ForegroundTransitionWaiter(IntPtr expectedWindow, uint expectedProcessId) {
      this.expectedWindow = expectedWindow;
      this.expectedProcessId = expectedProcessId;
    }

    public bool Start(int readyTimeoutMilliseconds) {
      if (readyTimeoutMilliseconds < 1 || thread != null) {
        return false;
      }
      thread = new Thread(Run);
      thread.IsBackground = true;
      thread.Name = "SteamBridgeForegroundTransitionWaiter";
      thread.Start();
      return ready.WaitOne(readyTimeoutMilliseconds) && hook != IntPtr.Zero;
    }

    void Run() {
      nativeThreadId = GetCurrentThreadId();
      MSG queuedMessage;
      PeekMessage(out queuedMessage, IntPtr.Zero, 0, 0, PM_NOREMOVE);
      callback = OnWinEvent;
      callbackHandle = GCHandle.Alloc(callback);
      hook = SetWinEventHook(
        EVENT_SYSTEM_FOREGROUND,
        EVENT_SYSTEM_FOREGROUND,
        IntPtr.Zero,
        callback,
        expectedProcessId,
        0,
        WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS
      );
      if (hook == IntPtr.Zero) {
        lastError = Marshal.GetLastWin32Error();
      }
      ready.Set();
      if (hook == IntPtr.Zero) {
        callbackHandle.Free();
        return;
      }

      try {
        MSG message;
        int result;
        while ((result = GetMessage(out message, IntPtr.Zero, 0, 0)) > 0) {
          TranslateMessage(ref message);
          DispatchMessage(ref message);
        }
        if (result < 0) {
          lastError = Marshal.GetLastWin32Error();
        }
      } finally {
        if (!UnhookWinEvent(hook) && lastError == 0) {
          lastError = Marshal.GetLastWin32Error();
        }
        hook = IntPtr.Zero;
        if (callbackHandle.IsAllocated) {
          callbackHandle.Free();
        }
      }
    }

    void OnWinEvent(
      IntPtr eventHook,
      uint eventType,
      IntPtr hwnd,
      int objectId,
      int childId,
      uint eventThread,
      uint eventTime
    ) {
      if (
        eventType == EVENT_SYSTEM_FOREGROUND &&
        Volatile.Read(ref armed) == 1 &&
        hwnd == expectedWindow
      ) {
        Interlocked.Increment(ref eventCount);
        matched.Set();
      }
    }

    public void Arm() {
      Interlocked.Exchange(ref armed, 1);
    }

    public bool Wait(int timeoutMilliseconds) {
      return timeoutMilliseconds >= 0 && matched.WaitOne(timeoutMilliseconds);
    }

    public int LastError {
      get { return lastError; }
    }

    public int EventCount {
      get { return Volatile.Read(ref eventCount); }
    }

    public bool Stop(int timeoutMilliseconds) {
      if (timeoutMilliseconds < 0) {
        return false;
      }
      if (Interlocked.Exchange(ref disposed, 1) != 0) {
        return thread == null || !thread.IsAlive;
      }
      if (
        thread != null &&
        thread.IsAlive &&
        nativeThreadId != 0 &&
        !PostThreadMessage(nativeThreadId, WM_QUIT, UIntPtr.Zero, IntPtr.Zero)
      ) {
        lastError = Marshal.GetLastWin32Error();
      }
      bool stopped = thread == null || thread.Join(timeoutMilliseconds);
      if (stopped) {
        ready.Dispose();
        matched.Dispose();
      }
      return stopped;
    }

    public void Dispose() {
      Stop(5000);
    }
  }

  public static ForegroundTransitionWaiter CreateForegroundTransitionWaiter(
    IntPtr expectedWindow,
    uint expectedProcessId
  ) {
    return new ForegroundTransitionWaiter(expectedWindow, expectedProcessId);
  }

  public static string ConfigureDpiAwareness() {
    int contextError = 0;
    string processStatus;
    try {
      if (SetProcessDpiAwarenessContext(new IntPtr(-4))) {
        processStatus = "process-per-monitor-v2";
      } else {
        contextError = Marshal.GetLastWin32Error();
        processStatus = "process-unchanged:" + contextError;
      }
    } catch (EntryPointNotFoundException) {
      contextError = -1;
      processStatus = "process-api-unavailable";
    }

    if (!processStatus.StartsWith("process-per-monitor-v2") && SetProcessDPIAware()) {
      processStatus = "process-system-aware-fallback";
    }

    try {
      IntPtr previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
      if (previous != IntPtr.Zero) {
        return processStatus + ";thread-per-monitor-v2";
      }
      int threadError = Marshal.GetLastWin32Error();
      return processStatus + ";thread-unchanged:" + threadError;
    } catch (EntryPointNotFoundException) {
      return processStatus + ";thread-api-unavailable";
    }
  }

  static INPUT KeyInput(ushort virtualKey, uint flags) {
    INPUT input = new INPUT();
    input.type = INPUT_KEYBOARD;
    input.u.ki.wVk = virtualKey;
    input.u.ki.wScan = 0;
    input.u.ki.dwFlags = flags;
    input.u.ki.time = 0;
    input.u.ki.dwExtraInfo = IntPtr.Zero;
    return input;
  }

  static INPUT MouseInput(int x, int y, uint flags) {
    int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
    int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
    int width = Math.Max(1, GetSystemMetrics(SM_CXVIRTUALSCREEN));
    int height = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN));
    int dx = (int)Math.Round(((double)(x - left) * 65535.0) / Math.Max(1, width - 1));
    int dy = (int)Math.Round(((double)(y - top) * 65535.0) / Math.Max(1, height - 1));

    INPUT input = new INPUT();
    input.type = INPUT_MOUSE;
    input.u.mi.dx = Math.Max(0, Math.Min(65535, dx));
    input.u.mi.dy = Math.Max(0, Math.Min(65535, dy));
    input.u.mi.mouseData = 0;
    input.u.mi.dwFlags = flags | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    input.u.mi.time = 0;
    input.u.mi.dwExtraInfo = IntPtr.Zero;
    return input;
  }

  public static uint SendKeyChord(ushort[] virtualKeys, out int lastError) {
    INPUT[] inputs = new INPUT[virtualKeys.Length * 2];
    int index = 0;
    for (int i = 0; i < virtualKeys.Length; i++) {
      inputs[index++] = KeyInput(virtualKeys[i], 0);
    }
    for (int i = virtualKeys.Length - 1; i >= 0; i--) {
      inputs[index++] = KeyInput(virtualKeys[i], KEYEVENTF_KEYUP);
    }

    uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    lastError = sent == inputs.Length ? 0 : Marshal.GetLastWin32Error();
    return sent;
  }

  public static uint SendMouseClickInput(int x, int y, out int lastError) {
    INPUT[] inputs = new INPUT[3];
    inputs[0] = MouseInput(x, y, MOUSEEVENTF_MOVE);
    inputs[1] = MouseInput(x, y, MOUSEEVENTF_LEFTDOWN);
    inputs[2] = MouseInput(x, y, MOUSEEVENTF_LEFTUP);

    uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    lastError = sent == inputs.Length ? 0 : Marshal.GetLastWin32Error();
    return sent;
  }
}
'@

`$script:ProbeDpiAwareness = [SteamBridgeWindowsProbe]::ConfigureDpiAwareness()
`$script:SmokeControlFile = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('$controlFileBase64'))
`$script:ControlHandoffOnlyExpected = [bool]::Parse('$controlHandoffOnlyExpected')
`$script:PreserveSmokeControlFile = [bool]::Parse('$preserveControlFile')
`$script:UseUserGestureGate = [bool]::Parse('$useUserGestureGate')
`$script:UsePersistentReuseGate = [bool]::Parse('$usePersistentReuseGate')
`$script:PersistentReuseGatePolicy = '$PersistentReuseGatePolicy'
`$script:PersistentReuseEvidenceSchema = $PersistentReuseEvidenceSchema
`$script:UserGestureAction = '$userGestureAction'
`$script:UserGestureTargetId = '$userGestureTargetId'
`$script:ExternalForegroundRequestOrdinal = 1
`$script:ExternalForegroundTransition = '$externalForegroundTransition'
`$script:ExternalForegroundReadyMarker = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String('$externalForegroundReadyMarkerBase64')
)
`$script:ExternalForegroundControllerAck = [Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String('$externalForegroundControllerAckBase64')
)
`$script:ExternalForegroundChallenge = '$externalForegroundChallenge'
`$script:CloseCycleOrdinal = 1
`$script:UserGestureActivationSent = `$false
`$script:UserGestureGateConsumed = `$false
`$script:UserGestureSourceWindowHandle = [IntPtr]::Zero
`$script:UserGestureSourceWindowOwnerPid = [uint32]0
`$script:UserGestureSourceProcessStartTicks = [int64]0
`$script:UserGestureRendererGeometry = `$null
`$script:PersistentReuseNativeHostHandle = [IntPtr]::Zero
`$script:PersistentReuseNativeHostOwnerPid = [uint32]0

`$script:ProbeScreenshotAssemblyError = `$null
try {
  Add-Type -AssemblyName System.Drawing
  Add-Type -AssemblyName System.Windows.Forms
} catch {
  `$script:ProbeScreenshotAssemblyError = `$_.Exception.Message
}

function Send-NativeKeyChord {
  param([int[]]`$VirtualKeys)

  `$keys = [uint16[]]`$VirtualKeys
  `$lastError = 0
  `$sent = [SteamBridgeWindowsProbe]::SendKeyChord(`$keys, [ref]`$lastError)
  [PSCustomObject]@{
    sent = `$sent
    expected = (`$keys.Length * 2)
    lastError = `$lastError
  }
}

function Send-NativeMouseClick {
  param([int]`$X, [int]`$Y)

  `$lastError = 0
  `$sent = [SteamBridgeWindowsProbe]::SendMouseClickInput(`$X, `$Y, [ref]`$lastError)

  return [PSCustomObject]@{
    sent = `$sent
    expected = 3
    lastError = `$lastError
    method = "sendinput"
    x = `$X
    y = `$Y
  }
}

function Get-AutorunUserGestureGateLifecycleState {
  `$state = [ordered]@{
    readyEvents = @()
    consumedEvents = @()
    rejectedEvents = @()
  }
  if (-not (Test-Path -LiteralPath '$lifecycleLog')) {
    return [PSCustomObject]`$state
  }

  foreach (`$line in @(Get-Content -LiteralPath '$lifecycleLog' -ErrorAction SilentlyContinue)) {
    try {
      `$event = `$line | ConvertFrom-Json -ErrorAction Stop
    } catch {
      continue
    }
    if (`$event.type -eq "event:autorun:user-gesture-gate-ready") {
      `$state.readyEvents += `$event
    } elseif (`$event.type -eq "event:autorun:user-gesture-gate-consumed") {
      `$state.consumedEvents += `$event
    } elseif (`$event.type -eq "event:autorun:user-gesture-gate-rejected") {
      `$state.rejectedEvents += `$event
    }
  }
  return [PSCustomObject]`$state
}

function Resolve-AutorunUserGestureGateTarget {
  param([object]`$ReadyEvent)

  `$evidence = [ordered]@{
    ready = `$false
    reason = "gate-ready-event-missing"
    binding = [ordered]@{
      sourceProcessPresent = `$false
      sourceProcessIdentityPresent = `$false
      sourceWindowPresent = `$false
      ownerMatchesLifecycleProcess = `$false
      sourceMatchesControlProcess = `$false
      sourceMatchesBoundWindow = `$false
      sourceMatchesBoundProcessIdentity = `$false
      sameInteractiveSession = `$false
      sourceWindowEnabled = `$false
      sourceWindowNotIconic = `$false
      sourceWindowForeground = `$false
    }
    target = `$null
    dpi = [ordered]@{
      rendererScalePresent = `$false
      windowDpiPresent = `$false
      scaleAgrees = `$false
      clientGeometryAgrees = `$false
    }
  }
  if (-not `$ReadyEvent) {
    return [PSCustomObject]`$evidence
  }

  `$payload = `$ReadyEvent.payload
  `$target = `$payload.target
  `$viewport = `$payload.viewport
  `$readyBinding = `$payload.binding
  if (
    `$payload.schema -ne 1 -or
    `$payload.mechanism -cne "same-process-user-gesture" -or
    `$payload.action -cne `$script:UserGestureAction -or
    `$payload.targetId -cne `$script:UserGestureTargetId -or
    `$payload.ready -ne `$true -or
    -not `$target -or
    -not `$viewport -or
    -not `$readyBinding -or
    `$readyBinding.senderMatches -ne `$true -or
    `$readyBinding.mainFrameMatches -ne `$true -or
    `$readyBinding.nonceMatches -ne `$true
  ) {
    `$evidence.reason = "gate-ready-event-invalid"
    return [PSCustomObject]`$evidence
  }

  `$rawNumericValues = @(
    `$target.left,
    `$target.top,
    `$target.width,
    `$target.height,
    `$viewport.devicePixelRatio,
    `$viewport.width,
    `$viewport.height,
    `$ReadyEvent.pid
  )
  `$invalidRawNumericValues = @(
    `$rawNumericValues |
      Where-Object { `$null -eq `$_ -or `$_ -isnot [ValueType] -or `$_ -is [bool] }
  )
  if (`$invalidRawNumericValues.Count -gt 0) {
    `$evidence.reason = "gate-target-geometry-invalid"
    return [PSCustomObject]`$evidence
  }

  `$left = [double]`$target.left
  `$top = [double]`$target.top
  `$width = [double]`$target.width
  `$height = [double]`$target.height
  `$rendererScale = [double]`$viewport.devicePixelRatio
  `$viewportWidth = [double]`$viewport.width
  `$viewportHeight = [double]`$viewport.height
  `$sourcePidValue = [double]`$ReadyEvent.pid
  `$finiteValues = @(`$left, `$top, `$width, `$height, `$rendererScale, `$viewportWidth, `$viewportHeight) |
    Where-Object { [double]::IsNaN(`$_) -or [double]::IsInfinity(`$_) }
  if (
    `$finiteValues.Count -gt 0 -or
    `$left -lt 0 -or `$top -lt 0 -or `$width -le 0 -or `$height -le 0 -or
    `$left + `$width -gt `$viewportWidth -or `$top + `$height -gt `$viewportHeight -or
    `$rendererScale -lt 0.5 -or `$rendererScale -gt 8.0 -or
    [double]::IsNaN(`$sourcePidValue) -or [double]::IsInfinity(`$sourcePidValue) -or
    `$sourcePidValue -lt 1 -or `$sourcePidValue -gt [int]::MaxValue -or
    [Math]::Floor(`$sourcePidValue) -ne `$sourcePidValue
  ) {
    `$evidence.reason = "gate-target-geometry-invalid"
    return [PSCustomObject]`$evidence
  }
  `$evidence.dpi.rendererScalePresent = `$true

  `$sourcePid = [int]`$ReadyEvent.pid
  if (`$sourcePid -le 0) {
    `$evidence.reason = "gate-source-process-missing"
    return [PSCustomObject]`$evidence
  }
  `$sourceProcess = Get-Process -Id `$sourcePid -ErrorAction SilentlyContinue
  `$evidence.binding.sourceProcessPresent = `$null -ne `$sourceProcess
  if (-not `$sourceProcess) {
    `$evidence.reason = "gate-source-process-missing"
    return [PSCustomObject]`$evidence
  }
  `$sourceProcessStartTicks = [int64]0
  try {
    `$sourceProcessStartTicks = [int64]`$sourceProcess.StartTime.ToUniversalTime().Ticks
  } catch {
    `$sourceProcessStartTicks = [int64]0
  }
  `$evidence.binding.sourceProcessIdentityPresent = `$sourceProcessStartTicks -gt 0
  if (-not `$evidence.binding.sourceProcessIdentityPresent) {
    `$evidence.reason = "gate-source-process-identity-missing"
    return [PSCustomObject]`$evidence
  }
  `$control = Read-SmokeControlDescriptor
  `$evidence.binding.sourceMatchesControlProcess = (
    `$control.valid -and
    `$control.handoffOnly -eq `$script:ControlHandoffOnlyExpected -and
    `$sourcePid -eq `$control.pid
  )
  if (-not `$evidence.binding.sourceMatchesControlProcess) {
    `$evidence.reason = "gate-source-control-process-mismatch"
    return [PSCustomObject]`$evidence
  }
  `$sourceHandle = `$sourceProcess.MainWindowHandle
  `$evidence.binding.sourceWindowPresent = (
    `$sourceHandle -and
    `$sourceHandle -ne [IntPtr]::Zero -and
    [SteamBridgeWindowsProbe]::IsWindow(`$sourceHandle)
  )
  if (-not `$evidence.binding.sourceWindowPresent) {
    `$evidence.reason = "gate-source-window-missing"
    return [PSCustomObject]`$evidence
  }
  `$evidence.binding.sourceMatchesBoundWindow = (
    `$script:UserGestureSourceWindowHandle -eq [IntPtr]::Zero -or
    `$sourceHandle -eq `$script:UserGestureSourceWindowHandle
  )
  `$evidence.binding.sourceMatchesBoundProcessIdentity = (
    `$script:UserGestureSourceProcessStartTicks -le 0 -or
    `$sourceProcessStartTicks -eq `$script:UserGestureSourceProcessStartTicks
  )

  `$ownerPid = [uint32]0
  `$ownerThread = [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$sourceHandle, [ref]`$ownerPid)
  `$evidence.binding.ownerMatchesLifecycleProcess = (`$ownerThread -gt 0 -and `$ownerPid -eq [uint32]`$sourcePid)
  `$evidence.binding.sameInteractiveSession = (
    `$sourceProcess.SessionId -eq [Diagnostics.Process]::GetCurrentProcess().SessionId
  )
  `$evidence.binding.sourceWindowEnabled = [SteamBridgeWindowsProbe]::IsWindowEnabled(`$sourceHandle)
  `$evidence.binding.sourceWindowNotIconic = -not [SteamBridgeWindowsProbe]::IsIconic(`$sourceHandle)
  `$evidence.binding.sourceWindowForeground = (
    [SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$sourceHandle
  )
  if (
    -not `$evidence.binding.ownerMatchesLifecycleProcess -or
    -not `$evidence.binding.sourceMatchesControlProcess -or
    -not `$evidence.binding.sourceMatchesBoundWindow -or
    -not `$evidence.binding.sourceMatchesBoundProcessIdentity -or
    -not `$evidence.binding.sameInteractiveSession -or
    -not `$evidence.binding.sourceWindowEnabled -or
    -not `$evidence.binding.sourceWindowNotIconic
  ) {
    `$evidence.reason = "gate-source-window-not-eligible"
    return [PSCustomObject]`$evidence
  }

  `$windowDpi = [SteamBridgeWindowsProbe]::GetDpiForWindow(`$sourceHandle)
  if (`$windowDpi -lt 48 -or `$windowDpi -gt 768) {
    `$evidence.reason = "gate-source-window-dpi-invalid"
    return [PSCustomObject]`$evidence
  }
  `$windowScale = [double]`$windowDpi / 96.0
  `$evidence.dpi.windowDpiPresent = `$true
  `$evidence.dpi.scaleAgrees = [Math]::Abs(`$windowScale - `$rendererScale) -le 0.02
  `$evidence.dpi.rendererScale = `$rendererScale
  `$evidence.dpi.windowScale = `$windowScale
  if (-not `$evidence.dpi.scaleAgrees) {
    `$evidence.reason = "gate-source-window-dpi-mismatch"
    return [PSCustomObject]`$evidence
  }

  `$clientRect = New-Object SteamBridgeWindowsProbe+RECT
  `$clientOrigin = New-Object SteamBridgeWindowsProbe+POINT
  if (
    -not [SteamBridgeWindowsProbe]::GetClientRect(`$sourceHandle, [ref]`$clientRect) -or
    -not [SteamBridgeWindowsProbe]::ClientToScreen(`$sourceHandle, [ref]`$clientOrigin)
  ) {
    `$evidence.reason = "gate-source-client-geometry-unavailable"
    return [PSCustomObject]`$evidence
  }
  `$clientWidth = [double](`$clientRect.Right - `$clientRect.Left)
  `$clientHeight = [double](`$clientRect.Bottom - `$clientRect.Top)
  `$expectedClientWidth = `$viewportWidth * `$windowScale
  `$expectedClientHeight = `$viewportHeight * `$windowScale
  `$geometryTolerance = 2.0
  `$evidence.dpi.clientGeometryAgrees = (
    [Math]::Abs(`$clientWidth - `$expectedClientWidth) -le `$geometryTolerance -and
    [Math]::Abs(`$clientHeight - `$expectedClientHeight) -le `$geometryTolerance
  )
  if (-not `$evidence.dpi.clientGeometryAgrees) {
    `$evidence.reason = "gate-source-client-geometry-mismatch"
    return [PSCustomObject]`$evidence
  }
  `$x = [int][Math]::Round(`$clientOrigin.X + ((`$left + (`$width / 2.0)) * `$windowScale))
  `$y = [int][Math]::Round(`$clientOrigin.Y + ((`$top + (`$height / 2.0)) * `$windowScale))
  `$clientRight = `$clientOrigin.X + (`$clientRect.Right - `$clientRect.Left)
  `$clientBottom = `$clientOrigin.Y + (`$clientRect.Bottom - `$clientRect.Top)
  if (
    `$x -lt `$clientOrigin.X -or `$x -ge `$clientRight -or
    `$y -lt `$clientOrigin.Y -or `$y -ge `$clientBottom
  ) {
    `$evidence.reason = "gate-target-outside-source-client"
    return [PSCustomObject]`$evidence
  }

  `$script:UserGestureSourceWindowHandle = `$sourceHandle
  `$script:UserGestureSourceWindowOwnerPid = [uint32]`$sourcePid
  `$script:UserGestureSourceProcessStartTicks = `$sourceProcessStartTicks
  `$script:UserGestureRendererGeometry = [PSCustomObject]@{
    target = [PSCustomObject]@{
      left = `$left
      top = `$top
      width = `$width
      height = `$height
    }
    viewport = [PSCustomObject]@{
      width = `$viewportWidth
      height = `$viewportHeight
      devicePixelRatio = `$rendererScale
    }
  }
  `$evidence.target = [PSCustomObject]@{
    x = `$x
    y = `$y
    source = "renderer-button-physical-dpi"
    insideSourceClient = `$true
  }
  if (-not `$evidence.binding.sourceWindowForeground) {
    `$evidence.reason = "gate-source-window-awaiting-external-foreground"
    return [PSCustomObject]`$evidence
  }
  `$evidence.ready = `$true
  `$evidence.reason = "gate-target-ready"
  return [PSCustomObject]`$evidence
}

function Confirm-AutorunUserGestureActivationTarget {
  `$evidence = [ordered]@{
    eligible = `$false
    reason = "gate-source-window-unbound"
    binding = [ordered]@{
      sourceWindowValid = `$false
      sourceOwnerPresent = `$false
      sourceMatchesBoundProcess = `$false
      sourceMatchesBoundProcessIdentity = `$false
      sourceMatchesBoundWindow = `$false
      sourceMatchesControlProcess = `$false
      sameInteractiveSession = `$false
      sourceWindowEnabled = `$false
      sourceWindowNotIconic = `$false
      targetInsideSourceClient = `$false
      pointWindowPresent = `$false
      pointOwnerMatchesBoundProcess = `$false
      pointRootMatchesSourceWindow = `$false
      sourceWindowForeground = `$false
    }
    target = `$null
    clientGeometry = `$null
    rendererGeometry = `$null
    dpi = [ordered]@{
      rendererScalePresent = `$false
      windowDpiPresent = `$false
      scaleAgrees = `$false
      clientGeometryAgrees = `$false
    }
  }

  `$handle = `$script:UserGestureSourceWindowHandle
  `$rendererGeometry = `$script:UserGestureRendererGeometry
  if (-not `$rendererGeometry) {
    return [PSCustomObject]`$evidence
  }
  `$rendererTarget = `$rendererGeometry.target
  `$rendererViewport = `$rendererGeometry.viewport
  `$rendererScale = [double]`$rendererViewport.devicePixelRatio
  `$evidence.rendererGeometry = `$rendererGeometry
  `$evidence.dpi.rendererScalePresent = `$true
  `$evidence.dpi.rendererScale = `$rendererScale
  `$evidence.binding.sourceWindowValid = (
    `$handle -and
    `$handle -ne [IntPtr]::Zero -and
    [SteamBridgeWindowsProbe]::IsWindow(`$handle)
  )
  if (-not `$evidence.binding.sourceWindowValid) {
    return [PSCustomObject]`$evidence
  }

  `$sourceOwnerPid = [uint32]0
  `$sourceOwnerThread = [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(
    `$handle,
    [ref]`$sourceOwnerPid
  )
  `$evidence.binding.sourceOwnerPresent = (
    `$sourceOwnerThread -gt 0 -and
    `$sourceOwnerPid -gt 0
  )
  `$evidence.binding.sourceMatchesBoundProcess = (
    `$evidence.binding.sourceOwnerPresent -and
    `$sourceOwnerPid -eq `$script:UserGestureSourceWindowOwnerPid
  )
  `$control = Read-SmokeControlDescriptor
  `$evidence.binding.sourceMatchesControlProcess = (
    `$control.valid -and
    `$control.handoffOnly -eq `$script:ControlHandoffOnlyExpected -and
    `$sourceOwnerPid -eq `$control.pid
  )
  try {
    `$sourceProcess = Get-Process -Id ([int]`$sourceOwnerPid) -ErrorAction Stop
    `$sourceProcessStartTicks = [int64]`$sourceProcess.StartTime.ToUniversalTime().Ticks
    `$evidence.binding.sourceMatchesBoundProcessIdentity = (
      `$script:UserGestureSourceProcessStartTicks -gt 0 -and
      `$sourceProcessStartTicks -eq `$script:UserGestureSourceProcessStartTicks
    )
    `$evidence.binding.sourceMatchesBoundWindow = (`$sourceProcess.MainWindowHandle -eq `$handle)
    `$evidence.binding.sameInteractiveSession = (
      `$sourceProcess.SessionId -eq [Diagnostics.Process]::GetCurrentProcess().SessionId
    )
  } catch {
    `$evidence.binding.sameInteractiveSession = `$false
  }
  `$evidence.binding.sourceWindowEnabled = [SteamBridgeWindowsProbe]::IsWindowEnabled(`$handle)
  `$evidence.binding.sourceWindowNotIconic = -not [SteamBridgeWindowsProbe]::IsIconic(`$handle)

  `$windowDpi = [SteamBridgeWindowsProbe]::GetDpiForWindow(`$handle)
  if (`$windowDpi -ge 48 -and `$windowDpi -le 768) {
    `$windowScale = [double]`$windowDpi / 96.0
    `$evidence.dpi.windowDpiPresent = `$true
    `$evidence.dpi.windowScale = `$windowScale
    `$evidence.dpi.scaleAgrees = [Math]::Abs(`$windowScale - `$rendererScale) -le 0.02
  }

  `$clientRect = New-Object SteamBridgeWindowsProbe+RECT
  `$clientOrigin = New-Object SteamBridgeWindowsProbe+POINT
  if (
    `$evidence.dpi.scaleAgrees -and
    [SteamBridgeWindowsProbe]::GetClientRect(`$handle, [ref]`$clientRect) -and
    [SteamBridgeWindowsProbe]::ClientToScreen(`$handle, [ref]`$clientOrigin)
  ) {
    `$clientWidth = [double](`$clientRect.Right - `$clientRect.Left)
    `$clientHeight = [double](`$clientRect.Bottom - `$clientRect.Top)
    `$evidence.clientGeometry = [PSCustomObject]@{
      originX = [int]`$clientOrigin.X
      originY = [int]`$clientOrigin.Y
      width = [int]`$clientWidth
      height = [int]`$clientHeight
    }
    `$expectedClientWidth = [double]`$rendererViewport.width * `$windowScale
    `$expectedClientHeight = [double]`$rendererViewport.height * `$windowScale
    `$geometryTolerance = 2.0
    `$evidence.dpi.clientGeometryAgrees = (
      [Math]::Abs(`$clientWidth - `$expectedClientWidth) -le `$geometryTolerance -and
      [Math]::Abs(`$clientHeight - `$expectedClientHeight) -le `$geometryTolerance
    )
    `$x = [int][Math]::Round(
      `$clientOrigin.X + (([double]`$rendererTarget.left + ([double]`$rendererTarget.width / 2.0)) * `$windowScale)
    )
    `$y = [int][Math]::Round(
      `$clientOrigin.Y + (([double]`$rendererTarget.top + ([double]`$rendererTarget.height / 2.0)) * `$windowScale)
    )
    `$clientRight = `$clientOrigin.X + (`$clientRect.Right - `$clientRect.Left)
    `$clientBottom = `$clientOrigin.Y + (`$clientRect.Bottom - `$clientRect.Top)
    `$evidence.binding.targetInsideSourceClient = (
      `$evidence.dpi.clientGeometryAgrees -and
      `$x -ge `$clientOrigin.X -and
      `$x -lt `$clientRight -and
      `$y -ge `$clientOrigin.Y -and
      `$y -lt `$clientBottom
    )
    `$evidence.target = [PSCustomObject]@{
      x = `$x
      y = `$y
      source = "renderer-button-physical-dpi-rebound"
      insideSourceClient = `$evidence.binding.targetInsideSourceClient
      reboundFromReadyGeometry = `$true
    }
  }

  if (`$evidence.binding.targetInsideSourceClient) {
    `$point = New-Object SteamBridgeWindowsProbe+POINT
    `$point.X = [int]`$evidence.target.x
    `$point.Y = [int]`$evidence.target.y
    `$pointHandle = [SteamBridgeWindowsProbe]::WindowFromPoint(`$point)
    `$evidence.binding.pointWindowPresent = (
      `$pointHandle -and
      `$pointHandle -ne [IntPtr]::Zero -and
      [SteamBridgeWindowsProbe]::IsWindow(`$pointHandle)
    )
    if (`$evidence.binding.pointWindowPresent) {
      `$pointOwnerPid = [uint32]0
      `$pointOwnerThread = [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(
        `$pointHandle,
        [ref]`$pointOwnerPid
      )
      `$evidence.binding.pointOwnerMatchesBoundProcess = (
        `$pointOwnerThread -gt 0 -and
        `$pointOwnerPid -eq `$script:UserGestureSourceWindowOwnerPid
      )
      `$evidence.binding.pointRootMatchesSourceWindow = (
        [SteamBridgeWindowsProbe]::GetAncestor(`$pointHandle, 2) -eq `$handle
      )
    }
  }
  `$evidence.binding.sourceWindowForeground = (
    [SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle
  )

  `$evidence.eligible = (
    `$evidence.binding.sourceOwnerPresent -and
    `$evidence.binding.sourceMatchesBoundProcess -and
    `$evidence.binding.sourceMatchesBoundProcessIdentity -and
    `$evidence.binding.sourceMatchesBoundWindow -and
    `$evidence.binding.sourceMatchesControlProcess -and
    `$evidence.binding.sameInteractiveSession -and
    `$evidence.binding.sourceWindowEnabled -and
    `$evidence.binding.sourceWindowNotIconic -and
    `$evidence.binding.targetInsideSourceClient -and
    `$evidence.binding.pointWindowPresent -and
    `$evidence.binding.pointOwnerMatchesBoundProcess -and
    `$evidence.binding.pointRootMatchesSourceWindow -and
    `$evidence.binding.sourceWindowForeground
  )
  `$evidence.reason = if (`$evidence.eligible) {
    "gate-source-window-confirmed-before-dispatch"
  } else {
    "gate-source-window-changed-before-dispatch"
  }
  return [PSCustomObject]`$evidence
}

function Wait-AutorunUserGestureSourceFocusReturn {
  param([datetime]`$Deadline)

  `$evidence = [ordered]@{
    observed = `$false
    lifecycleComplete = `$false
    sourceWindowValid = `$false
    ownerMatches = `$false
    sameInteractiveSession = `$false
    focused = `$false
    reason = "focus-return-timeout"
  }
  while ((Get-Date) -lt `$Deadline) {
    `$text = if (Test-Path -LiteralPath '$lifecycleLog') {
      Get-Content -Raw -LiteralPath '$lifecycleLog' -ErrorAction SilentlyContinue
    } else {
      ""
    }
    `$evidence.lifecycleComplete = if (`$script:UsePersistentReuseGate) {
      ([regex]::Matches(`$text, 'overlay:presenter-persistent-reuse-cycle')).Count -eq 3 -and
      ([regex]::Matches(`$text, 'overlay:presenter-after-close-stable')).Count -ge 3 -and
      `$text -match 'overlay:presenter-persistent-reuse-complete'
    } else {
      `$text -match 'callback:overlay-activated' -and
      `$text -match '"active":false' -and
      `$text -match 'overlay:presenter-open-and-wait-complete' -and
      `$text -match 'overlay:presenter-after-close-stable'
    }
    if (-not `$evidence.lifecycleComplete) {
      Start-Sleep -Milliseconds 100
      continue
    }

    `$handle = `$script:UserGestureSourceWindowHandle
    `$evidence.sourceWindowValid = (
      `$handle -and
      `$handle -ne [IntPtr]::Zero -and
      [SteamBridgeWindowsProbe]::IsWindow(`$handle)
    )
    if (-not `$evidence.sourceWindowValid) {
      `$evidence.reason = "source-window-invalid-after-close"
      return [PSCustomObject]`$evidence
    }
    `$ownerPid = [uint32]0
    `$ownerThread = [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$handle, [ref]`$ownerPid)
    `$evidence.ownerMatches = (
      `$ownerThread -gt 0 -and
      `$ownerPid -eq `$script:UserGestureSourceWindowOwnerPid
    )
    try {
      `$ownerProcess = Get-Process -Id ([int]`$ownerPid) -ErrorAction Stop
      `$evidence.sameInteractiveSession = (
        `$ownerProcess.SessionId -eq [Diagnostics.Process]::GetCurrentProcess().SessionId
      )
    } catch {
      `$evidence.sameInteractiveSession = `$false
    }
    `$evidence.focused = [SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle
    if (`$evidence.ownerMatches -and `$evidence.sameInteractiveSession -and `$evidence.focused) {
      `$evidence.observed = `$true
      `$evidence.reason = "exact-source-window-foreground"
      return [PSCustomObject]`$evidence
    }
    Start-Sleep -Milliseconds 100
  }
  return [PSCustomObject]`$evidence
}

function Get-ForegroundProbeSnapshot {
  `$handle = [SteamBridgeWindowsProbe]::GetForegroundWindow()
  `$processId = [uint32]0
  [void][SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$handle, [ref]`$processId)
  `$titleBuilder = New-Object Text.StringBuilder 512
  [void][SteamBridgeWindowsProbe]::GetWindowText(`$handle, `$titleBuilder, `$titleBuilder.Capacity)
  `$process = `$null
  if (`$processId -gt 0) {
    `$process = Get-Process -Id ([int]`$processId) -ErrorAction SilentlyContinue
  }
  `$rect = New-Object -TypeName 'SteamBridgeWindowsProbe+RECT'
  `$hasRect = [SteamBridgeWindowsProbe]::GetWindowRect(`$handle, [ref]`$rect)

  `$snapshot = [ordered]@{
    pid = [int]`$processId
    processName = if (`$process) { `$process.ProcessName } else { "" }
    title = `$titleBuilder.ToString()
    rect = if (`$hasRect) {
      [PSCustomObject]@{
        left = `$rect.Left
        top = `$rect.Top
        right = `$rect.Right
        bottom = `$rect.Bottom
        width = [Math]::Max(0, `$rect.Right - `$rect.Left)
        height = [Math]::Max(0, `$rect.Bottom - `$rect.Top)
      }
    } else {
      `$null
    }
  }
  if (`$script:UsePersistentReuseGate) {
    `$snapshot.handlePresent = (`$handle -and `$handle -ne [IntPtr]::Zero)
  } else {
    `$snapshot.hwnd = ("0x{0:X}" -f `$handle.ToInt64())
  }
  return [PSCustomObject]`$snapshot
}

function Test-WebCloseForegroundCandidate {
  param([object]`$Foreground)

  if (-not `$Foreground -or -not `$Foreground.rect) {
    return `$false
  }

  `$processName = [string]`$Foreground.processName
  `$title = [string]`$Foreground.title
  if (`$title -match '(?i)application error') {
    return `$false
  }

  if (`$processName -eq "SteamBridgeSmoke" -and `$title -eq "Steam Bridge Native Overlay Host") {
    return `$true
  }
  if (`$processName -eq "gameoverlayui64") {
    return `$true
  }
  if (`$processName -eq "steamwebhelper" -and `$title -notmatch '(?i)^Launching') {
    return `$true
  }

  return `$false
}

function Test-WebCloseForegroundAllowsPresenterBounds {
  param([object]`$Foreground)

  if (-not `$Foreground -or -not `$Foreground.rect) {
    return `$true
  }

  if (`$Foreground.rect.width -le 0 -or `$Foreground.rect.height -le 0) {
    return `$true
  }

  if (Test-WebCloseForegroundCandidate `$Foreground) {
    return `$true
  }

  `$processName = [string]`$Foreground.processName
  `$title = [string]`$Foreground.title
  if (`$title -match '(?i)application error') {
    return `$false
  }

  if (`$processName -eq "explorer") {
    `$height = [int]`$Foreground.rect.height
    `$top = [int]`$Foreground.rect.top
    # Explorer can become foreground as the taskbar after Search/Start is cleared.
    # That should not prevent using the already-known native presenter bounds.
    return (`$title -eq "" -and `$height -le 96 -and `$top -ge 0)
  }

  if (`$processName -eq "SteamBridgeSmoke" -and `$title -eq "Steam Bridge Electron Smoke") {
    return `$true
  }

  return `$false
}

function Clear-BlockingForegroundWindow {
  param([object]`$Foreground)

  if (-not `$Foreground -or (Test-WebCloseForegroundCandidate `$Foreground)) {
    return [PSCustomObject]@{
      attempted = `$false
      reason = "foreground-is-overlay-candidate"
      foreground = `$Foreground
    }
  }

  `$processName = [string]`$Foreground.processName
  `$title = [string]`$Foreground.title
  `$key = `$null
  `$reason = `$null

  if (`$title -match '(?i)application error') {
    `$key = 0x0D
    `$reason = "application-error-dialog"
  } elseif (`$processName -in @("SearchHost", "StartMenuExperienceHost", "ShellExperienceHost") -or `$title -eq "Search") {
    `$key = 0x1B
    `$reason = "shell-search-or-start-ui"
  }

  if (`$null -eq `$key) {
    return [PSCustomObject]@{
      attempted = `$false
      reason = "foreground-not-recognized"
      foreground = `$Foreground
    }
  }

  `$sent = Send-NativeKeyChord @(`$key)
  Start-Sleep -Milliseconds 350
  return [PSCustomObject]@{
    attempted = `$true
    reason = `$reason
    key = ("0x{0:X2}" -f `$key)
    nativeInputSent = `$sent
    before = `$Foreground
    after = Get-ForegroundProbeSnapshot
  }
}

function Convert-PresenterBoundsToProbeRect {
  param([object]`$PresenterBounds)

  if (-not `$PresenterBounds -or `$PresenterBounds.width -le 0 -or `$PresenterBounds.height -le 0) {
    return `$null
  }

  [PSCustomObject]@{
    left = `$PresenterBounds.x
    top = `$PresenterBounds.y
    right = `$PresenterBounds.x + `$PresenterBounds.width
    bottom = `$PresenterBounds.y + `$PresenterBounds.height
    width = `$PresenterBounds.width
    height = `$PresenterBounds.height
  }
}

function Find-WebClosePanelRectFromScreenshot {
  param([object]`$Screenshot, [object]`$Foreground)

  if (-not `$Screenshot -or -not `$Screenshot.ok -or -not `$Foreground -or -not `$Foreground.rect) {
    return `$null
  }

  `$bitmap = `$null
  try {
    `$bitmap = [System.Drawing.Bitmap]::FromFile(`$Screenshot.path)
    `$bounds = `$Screenshot.bounds
    `$rect = `$Foreground.rect
    `$scanLeft = [Math]::Max(`$rect.left, `$bounds.left)
    `$scanTop = [Math]::Max(
      [int][Math]::Round(`$rect.top + [Math]::Max(48, `$rect.height * 0.07)),
      `$bounds.top
    )
    `$scanRight = [Math]::Min(`$rect.right, `$bounds.left + `$bounds.width - 1)
    `$scanBottom = [Math]::Min(
      [int][Math]::Round(`$rect.top + (`$rect.height * 0.88)),
      `$bounds.top + `$bounds.height - 1
    )
    if (`$scanRight -le `$scanLeft -or `$scanBottom -le `$scanTop) {
      return `$null
    }

    `$minRunWidth = [int][Math]::Max(360, `$rect.width * 0.45)
    `$top = `$null
    `$bottom = `$null
    `$leftSum = 0
    `$rightSum = 0
    `$runSamples = 0
    `$bestRunWidth = 0
    `$bestRun = `$null
    `$topRun = `$null
    `$consecutiveMisses = 0

    for (`$y = `$scanTop; `$y -le `$scanBottom; `$y += 2) {
      `$runStart = `$null
      `$currentRunWidth = 0
      `$rowBestWidth = 0
      `$rowBestLeft = 0
      `$rowBestRight = 0
      for (`$x = `$scanLeft; `$x -le `$scanRight; `$x += 2) {
        `$bitmapX = [int](`$x - `$bounds.left)
        `$bitmapY = [int](`$y - `$bounds.top)
        if (`$bitmapX -lt 0 -or `$bitmapY -lt 0 -or `$bitmapX -ge `$bitmap.Width -or `$bitmapY -ge `$bitmap.Height) {
          continue
        }

        `$pixel = `$bitmap.GetPixel(`$bitmapX, `$bitmapY)
        `$pixelMax = [Math]::Max(`$pixel.R, [Math]::Max(`$pixel.G, `$pixel.B))
        if (`$pixelMax -gt 24) {
          if (`$null -eq `$runStart) {
            `$runStart = `$x
            `$currentRunWidth = 0
          }
          `$currentRunWidth += 2
        } else {
          if (`$currentRunWidth -gt `$rowBestWidth) {
            `$rowBestWidth = `$currentRunWidth
            `$rowBestLeft = `$runStart
            `$rowBestRight = `$x - 2
          }
          `$runStart = `$null
          `$currentRunWidth = 0
        }
      }
      if (`$currentRunWidth -gt `$rowBestWidth) {
        `$rowBestWidth = `$currentRunWidth
        `$rowBestLeft = `$runStart
        `$rowBestRight = `$scanRight
      }
      if (`$rowBestWidth -gt `$bestRunWidth) {
        `$bestRunWidth = `$rowBestWidth
        `$bestRun = [PSCustomObject]@{
          y = `$y
          left = `$rowBestLeft
          right = `$rowBestRight
          width = `$rowBestWidth
        }
      }
      if (`$rowBestWidth -ge `$minRunWidth) {
        if (`$null -eq `$top) {
          `$top = `$y
          `$topRun = [PSCustomObject]@{
            y = `$y
            left = `$rowBestLeft
            right = `$rowBestRight
            width = `$rowBestWidth
          }
        }
        `$bottom = `$y
        `$leftSum += `$rowBestLeft
        `$rightSum += `$rowBestRight
        `$runSamples += 1
        `$consecutiveMisses = 0
      } elseif (`$null -ne `$top) {
        `$consecutiveMisses += 1
        if (`$consecutiveMisses -ge 8) {
          break
        }
      }
    }

    if (`$null -eq `$top -or `$null -eq `$bottom -or `$runSamples -lt 4) {
      return `$null
    }

    if (`$topRun) {
      `$left = [Math]::Max(`$rect.left, [int]`$topRun.left)
      `$right = [Math]::Min(`$rect.right, [int]`$topRun.right)
    } else {
      `$left = [Math]::Max(`$rect.left, [int][Math]::Round(`$leftSum / `$runSamples))
      `$right = [Math]::Min(`$rect.right, [int][Math]::Round(`$rightSum / `$runSamples))
    }
    `$top = [Math]::Max(`$rect.top, [int]`$top)
    `$bottom = [Math]::Min(`$rect.bottom, [int]`$bottom)
    `$width = [Math]::Max(0, `$right - `$left)
    `$height = [Math]::Max(0, `$bottom - `$top)
    if (`$width -lt `$minRunWidth -or `$height -lt [Math]::Min(180, `$rect.height * 0.25)) {
      return `$null
    }

    return [PSCustomObject]@{
      source = "screenshot-steam-web-panel"
      rect = [PSCustomObject]@{
        left = [int]`$left
        top = [int]`$top
        right = [int]`$right
        bottom = [int]`$bottom
        width = [int]`$width
        height = [int]`$height
      }
      runSamples = `$runSamples
      topRun = `$topRun
      bestRun = `$bestRun
    }
  } catch {
    return `$null
  } finally {
    if (`$bitmap) {
      `$bitmap.Dispose()
    }
  }
}

function Get-WebClosePanelRect {
  param([object]`$Foreground, [object]`$Screenshot = `$null)

  if (Test-WebCloseForegroundCandidate `$Foreground) {
    `$screenshotPanel = Find-WebClosePanelRectFromScreenshot -Screenshot `$Screenshot -Foreground `$Foreground
    if (`$screenshotPanel) {
      return `$screenshotPanel
    }

    return [PSCustomObject]@{
      source = "foreground-window-steam-web-panel"
      rect = `$Foreground.rect
    }
  }

  if (-not (Test-WebCloseForegroundAllowsPresenterBounds `$Foreground)) {
    return `$null
  }

  `$presenterBounds = Get-LifecyclePresenterBounds
  `$presenterRect = Convert-PresenterBoundsToProbeRect `$presenterBounds
  if (`$presenterRect) {
    `$presenterForeground = [PSCustomObject]@{
      processName = "SteamBridgeSmoke"
      title = "Steam Bridge Native Overlay Host"
      rect = `$presenterRect
    }
    `$screenshotPanel = Find-WebClosePanelRectFromScreenshot -Screenshot `$Screenshot -Foreground `$presenterForeground
    if (`$screenshotPanel) {
      return `$screenshotPanel
    }

    return [PSCustomObject]@{
      source = "presenter-bounds"
      rect = `$presenterRect
    }
  }

  return `$null
}

function Focus-SmokeWindowForShortcutProbe {
  `$candidate = Get-Process SteamBridgeSmoke -ErrorAction SilentlyContinue |
    Where-Object { `$_.MainWindowHandle -and `$_.MainWindowHandle -ne [IntPtr]::Zero } |
    Sort-Object StartTime -Descending |
    Select-Object -First 1

  if (-not `$candidate) {
    return [PSCustomObject]@{
      attempted = `$false
      reason = "steam-bridge-smoke-window-not-found"
      foreground = Get-ForegroundProbeSnapshot
    }
  }

  `$handle = `$candidate.MainWindowHandle
  `$wasMinimized = [SteamBridgeWindowsProbe]::IsIconic(`$handle)
  `$restoreResult = `$null
  if (`$wasMinimized) {
    `$restoreResult = [SteamBridgeWindowsProbe]::ShowWindowAsync(`$handle, 9)
  }
  `$setForegroundResult = [SteamBridgeWindowsProbe]::SetForegroundWindow(`$handle)
  `$foreground = Get-ForegroundProbeSnapshot
  `$focusClick = `$null

  if (-not (`$foreground -and `$foreground.pid -eq `$candidate.Id)) {
    `$rect = New-Object SteamBridgeWindowsProbe+RECT
    `$hasRect = [SteamBridgeWindowsProbe]::GetWindowRect(`$handle, [ref]`$rect)
    if (`$hasRect -and `$rect.Right -gt `$rect.Left -and `$rect.Bottom -gt `$rect.Top) {
      `$clickX = [int][Math]::Round((`$rect.Left + `$rect.Right) / 2)
      `$clickY = [int][Math]::Round((`$rect.Top + `$rect.Bottom) / 2)
      `$focusClick = [PSCustomObject]@{
        x = `$clickX
        y = `$clickY
        nativePointerSent = Send-NativeMouseClick `$clickX `$clickY
        rect = [PSCustomObject]@{
          left = `$rect.Left
          top = `$rect.Top
          right = `$rect.Right
          bottom = `$rect.Bottom
          width = `$rect.Right - `$rect.Left
          height = `$rect.Bottom - `$rect.Top
        }
      }
      Start-Sleep -Milliseconds 150
      `$foreground = Get-ForegroundProbeSnapshot
    }
  }

  [PSCustomObject]@{
    attempted = `$true
    pid = `$candidate.Id
    hwnd = ("0x{0:X}" -f `$handle.ToInt64())
    title = `$candidate.MainWindowTitle
    wasMinimized = `$wasMinimized
    restoreResult = `$restoreResult
    setForegroundResult = `$setForegroundResult
    focusClick = `$focusClick
    foreground = `$foreground
    focused = (`$foreground -and `$foreground.pid -eq `$candidate.Id)
  }
}

function Capture-ProbeScreen {
  param([string]`$Name)

  `$path = Join-Path '$CaseDir' ("close-probe-{0}.png" -f `$Name)
  if (`$script:ProbeScreenshotAssemblyError) {
    return [PSCustomObject]@{
      ok = `$false
      path = `$path
      error = `$script:ProbeScreenshotAssemblyError
    }
  }

  try {
    `$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
    if (`$bounds.Width -le 0 -or `$bounds.Height -le 0) {
      throw "Virtual screen has invalid bounds: `$(`$bounds.Width)x`$(`$bounds.Height)."
    }

    `$bitmap = New-Object System.Drawing.Bitmap `$bounds.Width, `$bounds.Height
    `$graphics = [System.Drawing.Graphics]::FromImage(`$bitmap)
    try {
      `$graphics.CopyFromScreen(`$bounds.Left, `$bounds.Top, 0, 0, `$bitmap.Size)
      `$bitmap.Save(`$path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      `$graphics.Dispose()
      `$bitmap.Dispose()
    }

    [PSCustomObject]@{
      ok = `$true
      path = `$path
      bounds = [PSCustomObject]@{
        left = `$bounds.Left
        top = `$bounds.Top
        width = `$bounds.Width
        height = `$bounds.Height
      }
    }
  } catch {
    [PSCustomObject]@{
      ok = `$false
      path = `$path
      error = `$_.Exception.Message
    }
  }
}

function Get-WebCloseClickTarget {
  param([object]`$Foreground, [object]`$Screenshot = `$null)

  `$panel = Get-WebClosePanelRect -Foreground `$Foreground -Screenshot `$Screenshot
  if (-not `$panel -or -not `$panel.rect) {
    return `$null
  }

  `$rect = `$panel.rect
  if (`$panel.source -eq "screenshot-steam-web-panel") {
    # The Steam close glyph is 16x18 logical pixels from the panel corner.
    # Resolve its physical inset from live DPI, with presenter geometry fallback.
    `$scaleEvidence = Get-WebCloseDpiScale
    `$scale = [double]`$scaleEvidence.value
    `$rightInset = [int]([Math]::Min(
      [Math]::Max(1, `$rect.width - 1),
      [Math]::Max(1, [Math]::Round(16 * `$scale))
    ))
    `$topInset = [int]([Math]::Min(
      [Math]::Max(1, `$rect.height - 1),
      [Math]::Max(1, [Math]::Round(18 * `$scale))
    ))
    return [PSCustomObject]@{
      x = [int]([Math]::Round(`$rect.right - `$rightInset))
      y = [int]([Math]::Round(`$rect.top + `$topInset))
      source = `$panel.source
      panel = `$rect
      scale = `$scaleEvidence
      insets = [PSCustomObject]@{
        right = `$rightInset
        top = `$topInset
        logicalRight = 16
        logicalTop = 18
      }
    }
  }

  return [PSCustomObject]@{
    x = [int]([Math]::Round(`$rect.left + (`$rect.width * 0.847)))
    y = [int]([Math]::Round(`$rect.top + (`$rect.height * 0.142)))
    source = `$panel.source
    panel = `$rect
  }
}

function Test-WebClosePanelScreenshot {
  param([object]`$Screenshot, [object]`$Foreground)

  `$target = Get-WebCloseClickTarget -Foreground `$Foreground -Screenshot `$Screenshot
  `$panel = Get-WebClosePanelRect -Foreground `$Foreground -Screenshot `$Screenshot
  if (-not `$Screenshot -or -not `$Screenshot.ok -or -not `$target -or -not `$panel -or -not `$panel.rect) {
    return [PSCustomObject]@{
      ready = `$false
      reason = "missing-screenshot-or-target"
      target = `$target
      foregroundCandidate = Test-WebCloseForegroundCandidate `$Foreground
    }
  }

  `$bitmap = `$null
  try {
    `$bitmap = [System.Drawing.Bitmap]::FromFile(`$Screenshot.path)
    `$bounds = `$Screenshot.bounds
    `$rect = `$panel.rect
    `$sampleLeft = [int]([Math]::Round(`$rect.left + (`$rect.width * 0.12)))
    `$sampleRight = [int]([Math]::Round(`$rect.left + (`$rect.width * 0.86)))
    `$sampleTop = [int]([Math]::Round(`$rect.top + (`$rect.height * 0.11)))
    `$sampleBottom = [int]([Math]::Round(`$rect.top + (`$rect.height * 0.20)))
    `$contentLeft = [int]([Math]::Round(`$rect.left + (`$rect.width * 0.14)))
    `$contentRight = [int]([Math]::Round(`$rect.left + (`$rect.width * 0.85)))
    `$contentTop = [int]([Math]::Round(`$rect.top + (`$rect.height * 0.28)))
    `$contentBottom = [int]([Math]::Round(`$rect.top + (`$rect.height * 0.72)))
    `$total = 0
    `$nonBlack = 0
    `$maxSum = 0
    `$maxSeen = 0
    `$contentTotal = 0
    `$contentBright = 0
    `$contentMaxSeen = 0

    for (`$y = `$sampleTop; `$y -le `$sampleBottom; `$y += 8) {
      for (`$x = `$sampleLeft; `$x -le `$sampleRight; `$x += 8) {
        `$bitmapX = [int](`$x - `$bounds.left)
        `$bitmapY = [int](`$y - `$bounds.top)
        if (`$bitmapX -lt 0 -or `$bitmapY -lt 0 -or `$bitmapX -ge `$bitmap.Width -or `$bitmapY -ge `$bitmap.Height) {
          continue
        }
        `$pixel = `$bitmap.GetPixel(`$bitmapX, `$bitmapY)
        `$pixelMax = [Math]::Max(`$pixel.R, [Math]::Max(`$pixel.G, `$pixel.B))
        `$total += 1
        `$maxSum += `$pixelMax
        `$maxSeen = [Math]::Max(`$maxSeen, `$pixelMax)
        if (`$pixelMax -gt 24) {
          `$nonBlack += 1
        }
      }
    }

    for (`$y = `$contentTop; `$y -le `$contentBottom; `$y += 8) {
      for (`$x = `$contentLeft; `$x -le `$contentRight; `$x += 8) {
        `$bitmapX = [int](`$x - `$bounds.left)
        `$bitmapY = [int](`$y - `$bounds.top)
        if (`$bitmapX -lt 0 -or `$bitmapY -lt 0 -or `$bitmapX -ge `$bitmap.Width -or `$bitmapY -ge `$bitmap.Height) {
          continue
        }
        `$pixel = `$bitmap.GetPixel(`$bitmapX, `$bitmapY)
        `$pixelMax = [Math]::Max(`$pixel.R, [Math]::Max(`$pixel.G, `$pixel.B))
        `$contentTotal += 1
        `$contentMaxSeen = [Math]::Max(`$contentMaxSeen, `$pixelMax)
        if (`$pixelMax -gt 80) {
          `$contentBright += 1
        }
      }
    }

    `$averageMax = if (`$total -gt 0) { `$maxSum / `$total } else { 0 }
    `$chromeReady = (`$total -gt 0 -and `$averageMax -gt 16 -and `$nonBlack -gt ([Math]::Max(6, `$total * 0.12)))
    `$contentReady = (`$contentTotal -gt 0 -and (`$contentBright -gt 3 -or `$contentMaxSeen -gt 120))
    [PSCustomObject]@{
      ready = (`$chromeReady -and `$contentReady)
      target = `$target
      rectSource = `$panel.source
      foregroundCandidate = Test-WebCloseForegroundCandidate `$Foreground
      sample = [PSCustomObject]@{
        left = `$sampleLeft
        top = `$sampleTop
        right = `$sampleRight
        bottom = `$sampleBottom
      }
      contentSample = [PSCustomObject]@{
        left = `$contentLeft
        top = `$contentTop
        right = `$contentRight
        bottom = `$contentBottom
      }
      total = `$total
      nonBlack = `$nonBlack
      averageMax = `$averageMax
      maxSeen = `$maxSeen
      chromeReady = `$chromeReady
      contentTotal = `$contentTotal
      contentBright = `$contentBright
      contentMaxSeen = `$contentMaxSeen
      contentReady = `$contentReady
    }
  } catch {
    [PSCustomObject]@{
      ready = `$false
      reason = `$_.Exception.Message
      target = `$target
    }
  } finally {
    if (`$bitmap) {
      `$bitmap.Dispose()
    }
  }
}

function Wait-WebClosePanelReady {
  param(
    [datetime]`$Deadline,
    [int]`$Cycle = 1
  )

  `$readyDeadline = (Get-Date).AddSeconds([Math]::Min(8, [Math]::Max(1, (`$Deadline - (Get-Date)).TotalSeconds)))
  `$attempt = 0
  `$lastTarget = `$null
  while ((Get-Date) -lt `$readyDeadline) {
    `$attempt += 1
    `$foreground = Get-ForegroundProbeSnapshot
    `$screenshot = Capture-ProbeScreen ("cycle-{0:D2}-web-close-ready-{1:D2}" -f `$Cycle, `$attempt)
    `$target = Get-WebCloseClickTarget -Foreground `$foreground -Screenshot `$screenshot
    if (`$target) {
      `$lastTarget = `$target
    }
    `$analysis = Test-WebClosePanelScreenshot -Screenshot `$screenshot -Foreground `$foreground
    if (`$analysis.ready) {
      Write-ProbeEvent "probe:web-close-ready" ([PSCustomObject]@{
        cycle = `$Cycle
        attempt = `$attempt
        foreground = `$foreground
        screenshot = `$screenshot
        analysis = `$analysis
      })
      return `$analysis
    }
    if (`$target -and (-not `$screenshot -or -not `$screenshot.ok -or `$attempt -ge 8)) {
      `$fallback = [PSCustomObject]@{
        ready = `$true
        reason = if (-not `$screenshot -or -not `$screenshot.ok) { "target-ready-screenshot-unavailable" } else { "target-ready-before-content-gate" }
        target = `$target
        foregroundCandidate = Test-WebCloseForegroundCandidate `$foreground
        screenshot = `$screenshot
      }
      Write-ProbeEvent "probe:web-close-target-ready" ([PSCustomObject]@{
        cycle = `$Cycle
        attempt = `$attempt
        foreground = `$foreground
        screenshot = `$screenshot
        analysis = `$fallback
      })
      return `$fallback
    }

    Start-Sleep -Milliseconds 250
  }

  `$foreground = Get-ForegroundProbeSnapshot
  `$screenshot = Capture-ProbeScreen ("cycle-{0:D2}-web-close-ready-timeout" -f `$Cycle)
  `$analysis = Test-WebClosePanelScreenshot -Screenshot `$screenshot -Foreground `$foreground
  if (-not `$analysis.target -and `$lastTarget) {
    `$analysis | Add-Member -NotePropertyName target -NotePropertyValue `$lastTarget -Force
  }
  Write-ProbeEvent "probe:web-close-ready-timeout" ([PSCustomObject]@{
    cycle = `$Cycle
    attempts = `$attempt
    foreground = `$foreground
    screenshot = `$screenshot
    analysis = `$analysis
  })
  return `$analysis
}

function Get-ProbeProcessSnapshot {
  @(Get-Process steam,SteamBridgeSmoke,gameoverlayui64 -ErrorAction SilentlyContinue |
    Sort-Object ProcessName,Id |
    ForEach-Object {
      [PSCustomObject]@{
        processName = `$_.ProcessName
        pid = `$_.Id
        sessionId = `$_.SessionId
        mainWindowTitle = `$_.MainWindowTitle
      }
    })
}

function Write-ProbeEvent {
  param([string]`$Type, [object]`$Payload)
  [PSCustomObject]@{
    type = `$Type
    at = (Get-Date).ToUniversalTime().ToString("o")
    payload = `$Payload
  } | ConvertTo-Json -Compress -Depth 6 | Add-Content -LiteralPath '$probeLog'
}

function Write-ExternalForegroundReadyMarker {
  `$marker = [ordered]@{
    kind = "steam-bridge-windows-external-foreground-ready"
    schema = 1
    action = `$script:UserGestureAction
    requestOrdinal = `$script:ExternalForegroundRequestOrdinal
    mechanism = `$script:ExternalForegroundTransition
    challenge = `$script:ExternalForegroundChallenge
    sourceBound = `$true
    transitionHookReady = `$true
    activationInputCount = 0
    closeInputCount = 0
  }
  `$temporaryPath = `$script:ExternalForegroundReadyMarker + ".tmp"
  try {
    Remove-Item -LiteralPath `$temporaryPath -Force -ErrorAction SilentlyContinue
    [IO.File]::WriteAllText(
      `$temporaryPath,
      (`$marker | ConvertTo-Json -Compress),
      (New-Object Text.UTF8Encoding(`$false))
    )
    [IO.File]::Move(`$temporaryPath, `$script:ExternalForegroundReadyMarker)
    return [PSCustomObject]@{
      written = `$true
      errorPresent = `$false
      marker = [PSCustomObject]`$marker
    }
  } catch {
    Remove-Item -LiteralPath `$temporaryPath -Force -ErrorAction SilentlyContinue
    return [PSCustomObject]@{
      written = `$false
      errorPresent = `$true
      marker = [PSCustomObject]`$marker
    }
  }
}

function Test-ExternalForegroundJsonInteger {
  param([object]`$Value, [int64]`$Expected)

  return (
    (`$Value -is [int] -or `$Value -is [long]) -and
    [int64]`$Value -eq `$Expected
  )
}

function Read-ExternalForegroundControllerAcknowledgment {
  `$evidence = [ordered]@{
    present = `$false
    valid = `$false
    errorPresent = `$false
    timedOut = `$false
  }
  if (-not (Test-Path -LiteralPath `$script:ExternalForegroundControllerAck)) {
    return [PSCustomObject]`$evidence
  }
  `$evidence.present = `$true
  try {
    `$raw = Get-Content -LiteralPath `$script:ExternalForegroundControllerAck -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace(`$raw)) {
      throw "external-foreground-ack-empty"
    }
    `$ack = `$raw | ConvertFrom-Json -ErrorAction Stop
    `$expectedProperties = @(
      "action",
      "activationInputCount",
      "clickCompleted",
      "closeInputCount",
      "challenge",
      "kind",
      "mechanism",
      "requestOrdinal",
      "schema"
    )
    `$actualProperties = @(`$ack.PSObject.Properties.Name | Sort-Object)
    `$shapeValid = @(
      Compare-Object -ReferenceObject `$expectedProperties -DifferenceObject `$actualProperties
    ).Count -eq 0
    `$evidence.valid = (
      `$shapeValid -and
      `$ack.kind -is [string] -and
      `$ack.kind -ceq "steam-bridge-windows-external-foreground-ack" -and
      (Test-ExternalForegroundJsonInteger `$ack.schema 1) -and
      `$ack.action -is [string] -and
      `$ack.action -ceq `$script:UserGestureAction -and
      (Test-ExternalForegroundJsonInteger `$ack.requestOrdinal `$script:ExternalForegroundRequestOrdinal) -and
      `$ack.mechanism -is [string] -and
      `$ack.mechanism -ceq `$script:ExternalForegroundTransition -and
      `$ack.challenge -is [string] -and
      `$ack.challenge -ceq `$script:ExternalForegroundChallenge -and
      `$ack.clickCompleted -is [bool] -and
      `$ack.clickCompleted -eq `$true -and
      (Test-ExternalForegroundJsonInteger `$ack.activationInputCount 0) -and
      (Test-ExternalForegroundJsonInteger `$ack.closeInputCount 0)
    )
    `$evidence.errorPresent = -not `$evidence.valid
  } catch {
    `$evidence.errorPresent = `$true
  }
  return [PSCustomObject]`$evidence
}

function Wait-ExternalForegroundControllerAcknowledgment {
  param([int]`$TimeoutMilliseconds)

  `$initial = Read-ExternalForegroundControllerAcknowledgment
  if (`$initial.present -or `$TimeoutMilliseconds -le 0) {
    if (-not `$initial.present -and `$TimeoutMilliseconds -le 0) {
      `$initial.timedOut = `$true
    }
    return `$initial
  }

  `$directory = Split-Path -Parent `$script:ExternalForegroundControllerAck
  `$leaf = Split-Path -Leaf `$script:ExternalForegroundControllerAck
  `$watcher = New-Object IO.FileSystemWatcher -ArgumentList `$directory, `$leaf
  `$watcher.NotifyFilter = [IO.NotifyFilters]::FileName -bor [IO.NotifyFilters]::LastWrite
  try {
    `$watcher.EnableRaisingEvents = `$true
    `$afterEnable = Read-ExternalForegroundControllerAcknowledgment
    if (`$afterEnable.present) {
      return `$afterEnable
    }
    `$change = `$watcher.WaitForChanged([IO.WatcherChangeTypes]::All, `$TimeoutMilliseconds)
    if (`$change.TimedOut) {
      return [PSCustomObject]@{
        present = `$false
        valid = `$false
        errorPresent = `$false
        timedOut = `$true
      }
    }
    return Read-ExternalForegroundControllerAcknowledgment
  } catch {
    return [PSCustomObject]@{
      present = `$false
      valid = `$false
      errorPresent = `$true
      timedOut = `$false
    }
  } finally {
    `$watcher.Dispose()
  }
}

function Get-LifecyclePresenterGeometry {
  if (-not (Test-Path -LiteralPath '$lifecycleLog')) {
    return `$null
  }

  `$lines = @(Get-Content -LiteralPath '$lifecycleLog' -ErrorAction SilentlyContinue)
  `$fallback = `$null
  for (`$index = (`$lines.Count - 1); `$index -ge 0; `$index--) {
    try {
      `$event = `$lines[`$index] | ConvertFrom-Json -ErrorAction Stop
    } catch {
      continue
    }

    `$presenter = `$event.payload.presenter
    if (-not `$presenter) {
      continue
    }

    `$nativeHostDiagnostics = `$presenter.nativeHostDiagnostics
    `$nativeRect = `$nativeHostDiagnostics.rect
    `$logicalBounds = `$presenter.bounds
    `$hasNativeRect = `$nativeRect -and `$nativeRect.width -gt 0 -and `$nativeRect.height -gt 0
    `$hasLogicalBounds = `$logicalBounds -and `$logicalBounds.width -gt 0 -and `$logicalBounds.height -gt 0
    if (`$hasNativeRect -or `$hasLogicalBounds) {
      `$candidate = [PSCustomObject]@{
        nativeRect = if (`$hasNativeRect) { `$nativeRect } else { `$null }
        logicalBounds = if (`$hasLogicalBounds) { `$logicalBounds } else { `$null }
        hwnd = if (`$nativeHostDiagnostics) { `$nativeHostDiagnostics.hwnd } else { `$null }
        lifecyclePid = `$event.pid
      }
      if (`$hasNativeRect -and `$hasLogicalBounds) {
        return `$candidate
      }
      if (-not `$fallback) {
        `$fallback = `$candidate
      }
    }
  }

  return `$fallback
}

function Get-PersistentReuseLifecycleState {
  `$state = [ordered]@{
    shownCycles = @()
    completedCycles = @()
    overlayActivationStates = @()
  }
  if (-not (Test-Path -LiteralPath '$lifecycleLog')) {
    return [PSCustomObject]`$state
  }
  foreach (`$line in @(Get-Content -LiteralPath '$lifecycleLog' -ErrorAction SilentlyContinue)) {
    try {
      `$event = `$line | ConvertFrom-Json -ErrorAction Stop
    } catch {
      continue
    }
    if (
      `$event.type -ceq "event:overlay:presenter-wait-shown" -and
      `$event.payload.api -ceq "persistentReuseThreeCycle" -and
      [int]`$event.payload.cycle -ge 1
    ) {
      `$state.shownCycles += [int]`$event.payload.cycle
    } elseif (
      `$event.type -ceq "event:overlay:presenter-persistent-reuse-cycle" -and
      [int]`$event.payload.cycle -ge 1
    ) {
      `$state.completedCycles += [int]`$event.payload.cycle
    } elseif (
      `$event.type -ceq "event:callback:overlay-activated" -and
      `$event.payload.active -is [bool]
    ) {
      `$state.overlayActivationStates += [bool]`$event.payload.active
    }
  }
  return [PSCustomObject]`$state
}

function Read-SmokeControlDescriptor {
  `$descriptor = [ordered]@{
    valid = `$false
    present = `$false
    hostValid = `$false
    portValid = `$false
    tokenPresent = `$false
    processPresent = `$false
    handoffOnly = `$false
    host = ""
    port = 0
    token = ""
    pid = 0
    reason = "control-file-missing"
  }

  if (-not `$script:SmokeControlFile -or -not (Test-Path -LiteralPath `$script:SmokeControlFile)) {
    return [PSCustomObject]`$descriptor
  }
  `$descriptor.present = `$true
  try {
    `$control = Get-Content -Raw -LiteralPath `$script:SmokeControlFile -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    `$descriptor.host = [string]`$control.host
    `$descriptor.port = [int]`$control.port
    `$descriptor.token = [string]`$control.token
    `$descriptor.pid = [int]`$control.pid
    `$descriptor.handoffOnly = (`$control.handoffOnly -eq `$true)
    `$descriptor.hostValid = (`$descriptor.host -eq "127.0.0.1")
    `$descriptor.portValid = (`$descriptor.port -ge 1 -and `$descriptor.port -le 65535)
    `$descriptor.tokenPresent = -not [string]::IsNullOrWhiteSpace(`$descriptor.token)
    `$descriptor.processPresent = (`$descriptor.pid -gt 0)
    `$descriptor.valid = (
      `$descriptor.hostValid -and
      `$descriptor.portValid -and
      `$descriptor.tokenPresent -and
      `$descriptor.processPresent -and
      `$descriptor.handoffOnly -eq `$script:ControlHandoffOnlyExpected
    )
    `$descriptor.reason = if (`$descriptor.valid) { "control-ready" } else { "control-file-invalid" }
  } catch {
    `$descriptor.reason = "control-file-invalid"
  }
  return [PSCustomObject]`$descriptor
}

function Focus-LifecycleNativePresenterForCloseInput {
  `$script:LifecycleNativePresenterCloseHandle = [IntPtr]::Zero
  `$script:LifecycleNativePresenterCloseOwnerPid = [uint32]0
  `$geometry = Get-LifecyclePresenterGeometry
  `$handleText = if (`$geometry) { [string]`$geometry.hwnd } else { "" }
  `$evidence = [ordered]@{
    schema = 2
    source = "lifecycle-native-host"
    mechanism = if (`$script:UseUserGestureGate) { "same-process-user-gesture" } else { "owner-process-native-show" }
    attempted = `$false
    handlePresent = -not [string]::IsNullOrWhiteSpace(`$handleText)
    handleFormatValid = `$false
    windowValid = `$false
    wasForeground = `$false
    setForegroundResult = `$false
    binding = [ordered]@{
      ownerThreadPresent = `$false
      lifecycleProcessPresent = `$false
      ownerMatchesLifecycleProcess = `$false
      ownerMatchesControlProcess = `$false
      sameInteractiveSession = `$false
    }
    transport = [ordered]@{
      ready = `$false
      handoffOnly = `$false
      authenticated = `$false
      responseReceived = `$false
      responseSchemaValid = `$false
    }
    requestCount = 0
    requestOrdinal = 0
    nativeShowCallCount = 0
    nativeShowCompleted = `$false
    requestedWindowMatches = `$false
    sameWindowBeforeAfter = `$false
    ownerReportsForeground = `$false
    messageDelta = [ordered]@{
      setFocus = 0
      activate = 0
      activateApp = 0
    }
    userGestureGate = [ordered]@{
      required = `$script:UseUserGestureGate
      readyEventCount = 0
      consumedEventCount = 0
      rejectedEventCount = 0
      activationInputCount = if (`$script:UserGestureActivationSent) { 1 } else { 0 }
      sourceWindowBound = `$false
    }
    persistentReuse = [ordered]@{
      required = `$script:UsePersistentReuseGate
      policy = if (`$script:UsePersistentReuseGate) { `$script:PersistentReuseGatePolicy } else { "" }
      evidenceSchema = if (`$script:UsePersistentReuseGate) { `$script:PersistentReuseEvidenceSchema } else { 0 }
      cycle = if (`$script:UsePersistentReuseGate) { `$script:CloseCycleOrdinal } else { 0 }
      confirmationMode = if (`$script:UsePersistentReuseGate -and `$script:CloseCycleOrdinal -eq 1) {
        "initial-user-gesture"
      } elseif (`$script:UsePersistentReuseGate) {
        "verify-only"
      } else {
        ""
      }
      baselineHostBound = `$false
      sameHostAsCycleOne = `$false
    }
    focused = `$false
    appReason = "not-requested"
    reason = "missing-lifecycle-native-host"
  }

  if (-not `$evidence.handlePresent) {
    return [PSCustomObject]`$evidence
  }
  if (`$handleText -notmatch '^0x[0-9A-Fa-f]+$') {
    `$evidence.reason = "invalid-lifecycle-native-host"
    return [PSCustomObject]`$evidence
  }

  try {
    `$handleValue = [Convert]::ToInt64(`$handleText.Substring(2), 16)
    `$handle = [IntPtr]::new(`$handleValue)
    `$evidence.handleFormatValid = `$true
  } catch {
    `$evidence.reason = "invalid-lifecycle-native-host"
    return [PSCustomObject]`$evidence
  }

  `$evidence.windowValid = [SteamBridgeWindowsProbe]::IsWindow(`$handle)
  if (-not `$evidence.windowValid) {
    `$evidence.reason = "lifecycle-native-host-not-a-window"
    return [PSCustomObject]`$evidence
  }
  `$script:LifecycleNativePresenterCloseHandle = `$handle

  `$ownerPid = [uint32]0
  `$ownerThread = [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$handle, [ref]`$ownerPid)
  `$lifecyclePid = if (`$geometry -and `$geometry.lifecyclePid) { [int]`$geometry.lifecyclePid } else { 0 }
  `$evidence.binding.ownerThreadPresent = (`$ownerThread -gt 0 -and `$ownerPid -gt 0)
  `$evidence.binding.lifecycleProcessPresent = (`$lifecyclePid -gt 0)
  `$evidence.binding.ownerMatchesLifecycleProcess = (
    `$evidence.binding.ownerThreadPresent -and
    `$evidence.binding.lifecycleProcessPresent -and
    `$ownerPid -eq `$lifecyclePid
  )
  try {
    `$ownerProcess = Get-Process -Id ([int]`$ownerPid) -ErrorAction Stop
    `$currentProcess = [System.Diagnostics.Process]::GetCurrentProcess()
    `$evidence.binding.sameInteractiveSession = (`$ownerProcess.SessionId -eq `$currentProcess.SessionId)
  } catch {
    `$evidence.binding.sameInteractiveSession = `$false
  }
  if (
    -not `$evidence.binding.ownerThreadPresent -or
    -not `$evidence.binding.ownerMatchesLifecycleProcess -or
    -not `$evidence.binding.sameInteractiveSession
  ) {
    `$evidence.reason = "lifecycle-native-host-owner-mismatch"
    return [PSCustomObject]`$evidence
  }
  `$script:LifecycleNativePresenterCloseOwnerPid = `$ownerPid

  `$evidence.attempted = `$true
  `$evidence.wasForeground = ([SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle)
  `$control = Read-SmokeControlDescriptor
  `$evidence.transport.ready = `$control.valid
  `$evidence.transport.handoffOnly = `$control.handoffOnly
  if (-not `$control.valid) {
    `$evidence.reason = `$control.reason
    return [PSCustomObject]`$evidence
  }
  `$evidence.binding.ownerMatchesControlProcess = (`$ownerPid -eq `$control.pid)
  if (-not `$evidence.binding.ownerMatchesControlProcess) {
    `$evidence.reason = "control-process-owner-mismatch"
    return [PSCustomObject]`$evidence
  }

  if (`$script:UsePersistentReuseGate) {
    if (`$script:CloseCycleOrdinal -eq 1) {
      if (`$script:PersistentReuseNativeHostHandle -ne [IntPtr]::Zero) {
        `$evidence.reason = "persistent-native-host-baseline-already-bound"
        return [PSCustomObject]`$evidence
      }
      `$script:PersistentReuseNativeHostHandle = `$handle
      `$script:PersistentReuseNativeHostOwnerPid = `$ownerPid
    }
    `$evidence.persistentReuse.baselineHostBound = (
      `$script:PersistentReuseNativeHostHandle -ne [IntPtr]::Zero -and
      `$script:PersistentReuseNativeHostOwnerPid -gt 0
    )
    `$evidence.persistentReuse.sameHostAsCycleOne = (
      `$evidence.persistentReuse.baselineHostBound -and
      `$handle -eq `$script:PersistentReuseNativeHostHandle -and
      `$ownerPid -eq `$script:PersistentReuseNativeHostOwnerPid
    )
    if (-not `$evidence.persistentReuse.sameHostAsCycleOne) {
      `$evidence.reason = "persistent-native-host-changed"
      return [PSCustomObject]`$evidence
    }
  }

  if (`$script:UseUserGestureGate) {
    `$gateState = Get-AutorunUserGestureGateLifecycleState
    `$evidence.userGestureGate.readyEventCount = `$gateState.readyEvents.Count
    `$evidence.userGestureGate.consumedEventCount = `$gateState.consumedEvents.Count
    `$evidence.userGestureGate.rejectedEventCount = `$gateState.rejectedEvents.Count
    `$sourceHandle = `$script:UserGestureSourceWindowHandle
    `$sourceOwnerPid = [uint32]0
    `$sourceOwnerThread = if (
      `$sourceHandle -and
      `$sourceHandle -ne [IntPtr]::Zero -and
      [SteamBridgeWindowsProbe]::IsWindow(`$sourceHandle)
    ) {
      [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$sourceHandle, [ref]`$sourceOwnerPid)
    } else {
      0
    }
    `$evidence.userGestureGate.sourceWindowBound = (
      `$sourceOwnerThread -gt 0 -and
      `$sourceOwnerPid -eq `$control.pid -and
      `$sourceOwnerPid -eq `$script:UserGestureSourceWindowOwnerPid
    )
    `$evidence.sameWindowBeforeAfter = [SteamBridgeWindowsProbe]::IsWindow(`$handle)
    `$evidence.ownerReportsForeground = (
      `$evidence.sameWindowBeforeAfter -and
      [SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle
    )
    `$evidence.focused = (
      `$evidence.userGestureGate.readyEventCount -eq 1 -and
      `$evidence.userGestureGate.consumedEventCount -eq 1 -and
      `$evidence.userGestureGate.rejectedEventCount -eq 0 -and
      `$evidence.userGestureGate.activationInputCount -eq 1 -and
      `$evidence.userGestureGate.sourceWindowBound -and
      `$evidence.sameWindowBeforeAfter -and
      `$evidence.ownerReportsForeground
    )
    `$evidence.appReason = if (`$evidence.focused) {
      "foreground-confirmed-from-user-gesture"
    } else {
      "user-gesture-foreground-not-observed"
    }
    `$evidence.reason = if (`$evidence.focused) {
      "foreground-confirmed"
    } else {
      "user-gesture-foreground-not-observed"
    }
    return [PSCustomObject]`$evidence
  }

  `$evidence.requestCount = 1
  try {
    `$uri = "http://127.0.0.1:{0}/foreground-handoff" -f `$control.port
    `$headers = @{ "X-Steam-Bridge-Smoke-Token" = `$control.token }
    `$requestBody = @{
      targetWindow = `$handleText
      requestOrdinal = `$script:CloseCycleOrdinal
    } | ConvertTo-Json -Compress
    `$requestParameters = @{
      Method = "Post"
      Uri = `$uri
      Headers = `$headers
      ContentType = "application/json"
      Body = `$requestBody
      TimeoutSec = 5
      ErrorAction = "Stop"
    }
    `$response = Invoke-RestMethod @requestParameters
    `$evidence.transport.responseReceived = `$true
    `$handoff = `$response.handoff
    `$evidence.transport.authenticated = (`$null -ne `$handoff)
    `$evidence.transport.responseSchemaValid = (
      `$handoff -and
      `$handoff.schema -eq 1 -and
      `$handoff.target -eq "lifecycle-native-host" -and
      `$handoff.mechanism -eq "owner-process-native-show" -and
      `$handoff.requestOrdinal -eq `$script:CloseCycleOrdinal -and
      `$handoff.requestedWindowMatches -eq `$true -and
      `$handoff.nativeShowCallCount -in @(0, 1)
    )
    if (`$handoff) {
      `$evidence.requestOrdinal = [int]`$handoff.requestOrdinal
      `$evidence.nativeShowCallCount = [int]`$handoff.nativeShowCallCount
      `$evidence.nativeShowCompleted = (`$handoff.nativeShowCompleted -eq `$true)
      `$evidence.requestedWindowMatches = (`$handoff.requestedWindowMatches -eq `$true)
      `$evidence.sameWindowBeforeAfter = (`$handoff.sameWindowBeforeAfter -eq `$true)
      `$evidence.ownerReportsForeground = (`$handoff.ownerReportsForeground -eq `$true)
      `$evidence.appReason = [string]`$handoff.reason
      if (`$handoff.messageDelta) {
        `$evidence.messageDelta.setFocus = [int]`$handoff.messageDelta.setFocus
        `$evidence.messageDelta.activate = [int]`$handoff.messageDelta.activate
        `$evidence.messageDelta.activateApp = [int]`$handoff.messageDelta.activateApp
      }
    }
  } catch {
    `$evidence.reason = "owner-handoff-request-failed"
    return [PSCustomObject]`$evidence
  } finally {
    if (`$script:SmokeControlFile -and -not `$script:PreserveSmokeControlFile) {
      Remove-Item -LiteralPath `$script:SmokeControlFile -Force -ErrorAction SilentlyContinue
    }
  }

  if (-not `$evidence.transport.responseSchemaValid) {
    `$evidence.reason = "owner-handoff-response-invalid"
    return [PSCustomObject]`$evidence
  }
  `$evidence.focused = (
    `$evidence.requestedWindowMatches -and
    `$evidence.ownerReportsForeground -and
    `$evidence.sameWindowBeforeAfter -and
    [SteamBridgeWindowsProbe]::IsWindow(`$handle) -and
    [SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle
  )
  `$evidence.reason = if (`$evidence.focused) { "foreground-confirmed" } else { "owner-handoff-not-observed" }
  return [PSCustomObject]`$evidence
}

function Confirm-LifecycleNativePresenterForegroundForCloseInput {
  `$handle = `$script:LifecycleNativePresenterCloseHandle
  `$expectedOwnerPid = `$script:LifecycleNativePresenterCloseOwnerPid
  `$evidence = [ordered]@{
    source = "lifecycle-native-host"
    handlePresent = (`$handle -and `$handle -ne [IntPtr]::Zero)
    windowValid = `$false
    ownerMatches = `$false
    enabled = `$false
    notIconic = `$false
    persistentReuseGate = `$script:UsePersistentReuseGate
    persistentReuseGatePolicy = if (`$script:UsePersistentReuseGate) { `$script:PersistentReuseGatePolicy } else { "" }
    persistentReuseEvidenceSchema = if (`$script:UsePersistentReuseGate) { `$script:PersistentReuseEvidenceSchema } else { 0 }
    confirmationMode = if (`$script:UsePersistentReuseGate -and `$script:CloseCycleOrdinal -eq 1) {
      "initial-user-gesture"
    } elseif (`$script:UsePersistentReuseGate) {
      "verify-only"
    } else {
      ""
    }
    baselineHostBound = `$false
    sameHostAsCycleOne = `$false
    focused = `$false
    reason = "missing-lifecycle-native-host"
  }

  if (-not `$evidence.handlePresent) {
    return [PSCustomObject]`$evidence
  }
  `$evidence.windowValid = [SteamBridgeWindowsProbe]::IsWindow(`$handle)
  if (-not `$evidence.windowValid) {
    `$evidence.reason = "lifecycle-native-host-not-a-window"
    return [PSCustomObject]`$evidence
  }
  `$ownerPid = [uint32]0
  `$ownerThread = [SteamBridgeWindowsProbe]::GetWindowThreadProcessId(`$handle, [ref]`$ownerPid)
  `$evidence.ownerMatches = (
    `$ownerThread -gt 0 -and
    `$expectedOwnerPid -gt 0 -and
    `$ownerPid -eq `$expectedOwnerPid
  )
  if (-not `$evidence.ownerMatches) {
    `$evidence.reason = "lifecycle-native-host-owner-changed"
    return [PSCustomObject]`$evidence
  }
  if (`$script:UsePersistentReuseGate) {
    `$evidence.baselineHostBound = (
      `$script:PersistentReuseNativeHostHandle -ne [IntPtr]::Zero -and
      `$script:PersistentReuseNativeHostOwnerPid -gt 0
    )
    `$evidence.sameHostAsCycleOne = (
      `$evidence.baselineHostBound -and
      `$handle -eq `$script:PersistentReuseNativeHostHandle -and
      `$ownerPid -eq `$script:PersistentReuseNativeHostOwnerPid
    )
    if (-not `$evidence.sameHostAsCycleOne) {
      `$evidence.reason = "persistent-native-host-changed-before-dispatch"
      return [PSCustomObject]`$evidence
    }
  }
  `$evidence.enabled = [SteamBridgeWindowsProbe]::IsWindowEnabled(`$handle)
  `$evidence.notIconic = -not [SteamBridgeWindowsProbe]::IsIconic(`$handle)
  if (-not `$evidence.enabled -or -not `$evidence.notIconic) {
    `$evidence.reason = "lifecycle-native-host-not-input-ready"
    return [PSCustomObject]`$evidence
  }
  `$evidence.focused = ([SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle)
  `$evidence.reason = if (`$evidence.focused) { "foreground-confirmed" } else { "foreground-lost-before-dispatch" }
  return [PSCustomObject]`$evidence
}

function Get-LifecyclePresenterBounds {
  `$geometry = Get-LifecyclePresenterGeometry
  if (-not `$geometry) {
    return `$null
  }
  if (`$geometry.nativeRect) {
    return [PSCustomObject]@{
      x = `$geometry.nativeRect.left
      y = `$geometry.nativeRect.top
      width = `$geometry.nativeRect.width
      height = `$geometry.nativeRect.height
      coordinateSpace = "physical-native-host"
    }
  }
  return `$geometry.logicalBounds
}

function Get-WebCloseDpiScale {
  `$geometry = Get-LifecyclePresenterGeometry
  `$nativeRect = if (`$geometry) { `$geometry.nativeRect } else { `$null }
  `$logicalBounds = if (`$geometry) { `$geometry.logicalBounds } else { `$null }
  `$ratioX = `$null
  `$ratioY = `$null
  `$ratioScale = `$null
  if (`$nativeRect -and `$logicalBounds) {
    `$ratioX = [double]`$nativeRect.width / [double]`$logicalBounds.width
    `$ratioY = [double]`$nativeRect.height / [double]`$logicalBounds.height
    if (
      `$ratioX -ge 0.5 -and `$ratioX -le 8.0 -and
      `$ratioY -ge 0.5 -and `$ratioY -le 8.0 -and
      [Math]::Abs(`$ratioX - `$ratioY) -le 0.02
    ) {
      `$ratioScale = (`$ratioX + `$ratioY) / 2.0
    }
  }

  `$dpi = `$null
  `$hwndText = if (`$geometry) { [string]`$geometry.hwnd } else { "" }
  if (`$hwndText -match '^0x[0-9A-Fa-f]+$') {
    try {
      `$hwndValue = [Convert]::ToInt64(`$hwndText.Substring(2), 16)
      `$hwnd = [IntPtr]::new(`$hwndValue)
      if ([SteamBridgeWindowsProbe]::IsWindow(`$hwnd)) {
        `$candidateDpi = [SteamBridgeWindowsProbe]::GetDpiForWindow(`$hwnd)
        if (`$candidateDpi -ge 48 -and `$candidateDpi -le 768) {
          `$dpi = [int]`$candidateDpi
        }
      }
    } catch {
      `$dpi = `$null
    }
  }

  if (`$dpi) {
    return [PSCustomObject]@{
      source = "native-host-window-dpi"
      value = [double]`$dpi / 96.0
      dpi = `$dpi
      ratioX = `$ratioX
      ratioY = `$ratioY
      physicalRect = `$nativeRect
      logicalBounds = `$logicalBounds
    }
  }
  if (`$ratioScale) {
    return [PSCustomObject]@{
      source = "presenter-geometry-ratio"
      value = `$ratioScale
      dpi = `$null
      ratioX = `$ratioX
      ratioY = `$ratioY
      physicalRect = `$nativeRect
      logicalBounds = `$logicalBounds
    }
  }
  return [PSCustomObject]@{
    source = "bounded-geometry-unavailable"
    value = 1.0
    dpi = `$null
    ratioX = `$ratioX
    ratioY = `$ratioY
    physicalRect = `$nativeRect
    logicalBounds = `$logicalBounds
  }
}

Write-ProbeEvent "probe:start" ([PSCustomObject]@{
  lifecycleLog = '$lifecycleLog'
  input = '$input'
  evidenceSchema = $evidenceSchema
  foregroundHandoff = '$foregroundHandoff'
  externalForegroundTransition = '$externalForegroundTransition'
  externalForegroundTransitionEnabled = `$script:UseUserGestureGate
  userGestureGate = `$script:UseUserGestureGate
  persistentReuseGate = `$script:UsePersistentReuseGate
  persistentReuseGatePolicy = if (`$script:UsePersistentReuseGate) { `$script:PersistentReuseGatePolicy } else { "" }
  persistentReuseEvidenceSchema = if (`$script:UsePersistentReuseGate) { `$script:PersistentReuseEvidenceSchema } else { 0 }
  initialUserGestureCycle = if (`$script:UsePersistentReuseGate) { 1 } else { 0 }
  verifyOnlyCycles = if (`$script:UsePersistentReuseGate) { @(2, 3) } else { @() }
  closeVerificationOrdinals = if (`$script:UsePersistentReuseGate) { @(1, 2, 3) } else { @() }
  controlExpected = `$true
  controlHandoffOnlyExpected = `$script:ControlHandoffOnlyExpected
  expectedCloseCount = $expectedCloseCount
  dpiAwareness = `$script:ProbeDpiAwareness
  shortcutToggleProbe = [bool]::Parse('$shortcutToggleProbe')
  settleMs = $settleMs
  timeoutSeconds = $timeoutSeconds
})

`$shortcutToggleProbe = [bool]::Parse('$shortcutToggleProbe')
`$deadline = (Get-Date).AddSeconds($timeoutSeconds)
`$openSent = `$false
`$sent = `$false
`$sentCount = 0
`$terminalFailure = `$false
while ((Get-Date) -lt `$deadline -and -not `$sent -and -not `$terminalFailure) {
  if (Test-Path -LiteralPath '$lifecycleLog') {
    `$text = Get-Content -Raw -LiteralPath '$lifecycleLog' -ErrorAction SilentlyContinue
    if (`$shortcutToggleProbe -and -not `$openSent -and `$text -match 'overlay:presenter-shortcut-ready') {
      Write-ProbeEvent "probe:shortcut-ready" ([PSCustomObject]@{
        foreground = Get-ForegroundProbeSnapshot
        screenshot = Capture-ProbeScreen "shortcut-ready"
        processes = Get-ProbeProcessSnapshot
      })
      `$shortcutFocus = Focus-SmokeWindowForShortcutProbe
      Write-ProbeEvent "probe:shortcut-focus" `$shortcutFocus
      `$nativeOpenInputSent = Send-NativeKeyChord @(0x10, 0x09)
      `$openSent = `$true
      Write-ProbeEvent "probe:shortcut-open-sent" ([PSCustomObject]@{
        input = "toggle-sendinput"
        nativeInputSent = `$nativeOpenInputSent
        focus = `$shortcutFocus
        foreground = Get-ForegroundProbeSnapshot
        processes = Get-ProbeProcessSnapshot
      })
      Start-Sleep -Milliseconds 250
      Write-ProbeEvent "probe:shortcut-open-after-send" ([PSCustomObject]@{
        input = "toggle-sendinput"
        foreground = Get-ForegroundProbeSnapshot
        screenshot = Capture-ProbeScreen "shortcut-open-after-send"
        processes = Get-ProbeProcessSnapshot
      })
    }
    if (`$script:UseUserGestureGate) {
      `$gateState = Get-AutorunUserGestureGateLifecycleState
      if (`$gateState.rejectedEvents.Count -gt 0) {
        Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
          reason = "gate-rejected-before-consumption"
          readyEventCount = `$gateState.readyEvents.Count
          consumedEventCount = `$gateState.consumedEvents.Count
          rejectedEventCount = `$gateState.rejectedEvents.Count
        })
        Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
          cycle = 1
          reason = "user-gesture-gate-rejected"
        })
        `$terminalFailure = `$true
        continue
      }
      if (-not `$script:UserGestureActivationSent -and `$gateState.consumedEvents.Count -gt 0) {
        Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
          reason = "gate-consumed-before-probe-activation"
          readyEventCount = `$gateState.readyEvents.Count
          consumedEventCount = `$gateState.consumedEvents.Count
          rejectedEventCount = `$gateState.rejectedEvents.Count
        })
        Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
          cycle = 1
          reason = "user-gesture-gate-already-consumed"
        })
        `$terminalFailure = `$true
        continue
      }

      if (-not `$script:UserGestureActivationSent) {
        if (`$gateState.readyEvents.Count -gt 1) {
          Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
            reason = "duplicate-gate-ready-events"
            readyEventCount = `$gateState.readyEvents.Count
          })
          Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
            cycle = 1
            reason = "user-gesture-gate-ready-ambiguous"
          })
          `$terminalFailure = `$true
          continue
        }
        if (`$gateState.readyEvents.Count -eq 1) {
          `$gateControl = Read-SmokeControlDescriptor
          if (-not `$gateControl.valid) {
            Start-Sleep -Milliseconds 50
            continue
          }
          `$externalForegroundTransitionCompleted = `$false
          `$activationTarget = Resolve-AutorunUserGestureGateTarget `$gateState.readyEvents[0]
          if (
            -not `$activationTarget.ready -and
            `$activationTarget.reason -eq "gate-source-window-awaiting-external-foreground"
          ) {
            `$foregroundWaiter = [SteamBridgeWindowsProbe]::CreateForegroundTransitionWaiter(
              `$script:UserGestureSourceWindowHandle,
              `$script:UserGestureSourceWindowOwnerPid
            )
            `$foregroundWaiterStarted = `$false
            `$foregroundTransitionObserved = `$false
            `$foregroundTransitionEventCount = 0
            `$foregroundWaiterStopped = `$false
            `$foregroundHookErrorPresent = `$false
            `$foregroundMarkerWritten = `$false
            `$foregroundWaitBudgetExhausted = `$false
            `$foregroundControllerAck = [PSCustomObject]@{
              present = `$false
              valid = `$false
              errorPresent = `$false
              timedOut = `$false
            }
            `$foregroundConfirmation = `$null
            `$foregroundFailureReason = "external-foreground-hook-start-failed"
            try {
              `$remainingBeforeHookStart = [int][Math]::Floor((`$deadline - (Get-Date)).TotalMilliseconds)
              `$hookStartTimeout = [int][Math]::Min(
                5000,
                [Math]::Max(0, `$remainingBeforeHookStart - 1000)
              )
              if (`$hookStartTimeout -gt 0) {
                `$foregroundWaiterStarted = `$foregroundWaiter.Start(`$hookStartTimeout)
              } else {
                `$foregroundFailureReason = "external-foreground-deadline-exhausted"
              }
              if (`$foregroundWaiterStarted) {
                Write-ProbeEvent "probe:external-foreground-source-ready" ([PSCustomObject]@{
                  schema = 1
                  mechanism = `$script:ExternalForegroundTransition
                  action = `$script:UserGestureAction
                  requestOrdinal = `$script:ExternalForegroundRequestOrdinal
                  sourceBound = `$true
                  transitionHookReady = `$true
                  binding = `$activationTarget.binding
                  dpi = `$activationTarget.dpi
                  targetReady = `$null -ne `$activationTarget.target
                  activationInputCount = 0
                  closeInputCount = 0
                })
                `$foregroundWaiter.Arm()
                `$markerResult = Write-ExternalForegroundReadyMarker
                `$foregroundMarkerWritten = `$markerResult.written
                if (`$markerResult.written) {
                  `$remainingBeforeTransitionWait = [int][Math]::Floor(
                    (`$deadline - (Get-Date)).TotalMilliseconds
                  )
                  `$transitionWaitTimeout = [int][Math]::Min(
                    30000,
                    [Math]::Max(0, `$remainingBeforeTransitionWait - 1000)
                  )
                  if (`$transitionWaitTimeout -gt 0) {
                    `$foregroundTransitionObserved = `$foregroundWaiter.Wait(`$transitionWaitTimeout)
                    if (`$foregroundTransitionObserved) {
                      `$remainingBeforeControllerAck = [int][Math]::Floor(
                        (`$deadline - (Get-Date)).TotalMilliseconds
                      )
                      `$controllerAckTimeout = [int][Math]::Max(
                        0,
                        `$remainingBeforeControllerAck - 1000
                      )
                      `$foregroundControllerAck = Wait-ExternalForegroundControllerAcknowledgment ([int]`$controllerAckTimeout)
                    }
                  } else {
                    `$foregroundWaitBudgetExhausted = `$true
                    `$foregroundFailureReason = "external-foreground-deadline-exhausted"
                  }
                } else {
                  `$foregroundFailureReason = "external-foreground-marker-write-failed"
                }
              }
            } finally {
              `$remainingForHookTeardown = [int][Math]::Floor(
                (`$deadline - (Get-Date)).TotalMilliseconds
              )
              `$hookTeardownTimeout = [int][Math]::Min(
                5000,
                [Math]::Max(0, `$remainingForHookTeardown)
              )
              `$foregroundWaiterStopped = `$foregroundWaiter.Stop(`$hookTeardownTimeout)
              `$foregroundTransitionEventCount = `$foregroundWaiter.EventCount
              `$foregroundHookErrorPresent = `$foregroundWaiter.LastError -ne 0
            }
            if (`$foregroundWaiterStarted) {
              if (-not `$foregroundMarkerWritten) {
                `$foregroundFailureReason = "external-foreground-marker-write-failed"
              } elseif (-not `$foregroundWaiterStopped) {
                `$foregroundFailureReason = "external-foreground-hook-teardown-timeout"
              } elseif (`$foregroundHookErrorPresent) {
                `$foregroundFailureReason = "external-foreground-hook-error"
              } elseif (-not `$foregroundTransitionObserved) {
                `$foregroundFailureReason = if (`$foregroundWaitBudgetExhausted) {
                  "external-foreground-deadline-exhausted"
                } else {
                  "external-foreground-transition-timeout"
                }
              } elseif (`$foregroundTransitionEventCount -ne 1) {
                `$foregroundFailureReason = "external-foreground-transition-count-invalid"
              } elseif (-not `$foregroundControllerAck.present) {
                `$foregroundFailureReason = if (`$foregroundControllerAck.timedOut) {
                  "external-foreground-controller-ack-timeout"
                } else {
                  "external-foreground-controller-ack-missing"
                }
              } elseif (-not `$foregroundControllerAck.valid) {
                `$foregroundFailureReason = "external-foreground-controller-ack-invalid"
              } else {
                `$foregroundFailureReason = "external-foreground-source-changed"
              }
            }
            if (
              `$foregroundTransitionObserved -and
              `$foregroundWaiterStopped -and
              -not `$foregroundHookErrorPresent -and
              `$foregroundTransitionEventCount -eq 1 -and
              `$foregroundControllerAck.valid
            ) {
              `$foregroundConfirmation = Confirm-AutorunUserGestureActivationTarget
            }
            if (
              `$foregroundTransitionObserved -and
              `$foregroundWaiterStopped -and
              -not `$foregroundHookErrorPresent -and
              `$foregroundTransitionEventCount -eq 1 -and
              `$foregroundControllerAck.valid -and
              `$foregroundConfirmation.eligible
            ) {
              Write-ProbeEvent "probe:external-foreground-controller-acknowledged" ([PSCustomObject]@{
                schema = 1
                mechanism = `$script:ExternalForegroundTransition
                action = `$script:UserGestureAction
                requestOrdinal = `$script:ExternalForegroundRequestOrdinal
                markerWritten = `$true
                controllerAckValid = `$true
                clickCompleted = `$true
                activationInputCount = 0
                closeInputCount = 0
              })
              Write-ProbeEvent "probe:external-foreground-transition-observed" ([PSCustomObject]@{
                schema = 1
                mechanism = `$script:ExternalForegroundTransition
                action = `$script:UserGestureAction
                requestOrdinal = `$script:ExternalForegroundRequestOrdinal
                transitionObserved = `$true
                eventCount = `$foregroundTransitionEventCount
                hookStopped = `$foregroundWaiterStopped
                hookErrorPresent = `$foregroundHookErrorPresent
                binding = `$foregroundConfirmation.binding
                activationInputCount = 0
                closeInputCount = 0
              })
              `$externalForegroundTransitionCompleted = `$true
              `$activationTarget = Resolve-AutorunUserGestureGateTarget `$gateState.readyEvents[0]
            } else {
              Write-ProbeEvent "probe:external-foreground-transition-rejected" ([PSCustomObject]@{
                schema = 1
                mechanism = `$script:ExternalForegroundTransition
                action = `$script:UserGestureAction
                requestOrdinal = `$script:ExternalForegroundRequestOrdinal
                reason = `$foregroundFailureReason
                hookStarted = `$foregroundWaiterStarted
                hookStopped = `$foregroundWaiterStopped
                hookErrorPresent = `$foregroundHookErrorPresent
                transitionObserved = `$foregroundTransitionObserved
                eventCount = `$foregroundTransitionEventCount
                controllerAckPresent = `$foregroundControllerAck.present
                controllerAckValid = `$foregroundControllerAck.valid
                controllerAckTimedOut = `$foregroundControllerAck.timedOut
                binding = if (`$foregroundConfirmation) { `$foregroundConfirmation.binding } else { `$activationTarget.binding }
                activationInputCount = 0
                closeInputCount = 0
              })
              Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
                reason = `$foregroundFailureReason
                binding = if (`$foregroundConfirmation) { `$foregroundConfirmation.binding } else { `$activationTarget.binding }
                dpi = `$activationTarget.dpi
              })
              Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
                cycle = 1
                reason = "external-foreground-transition-not-observed"
              })
              `$terminalFailure = `$true
              continue
            }
          }
          if (`$activationTarget.ready -and -not `$externalForegroundTransitionCompleted) {
            Write-ProbeEvent "probe:external-foreground-transition-not-required" ([PSCustomObject]@{
              schema = 1
              mechanism = `$script:ExternalForegroundTransition
              action = `$script:UserGestureAction
              requestOrdinal = 0
              alreadyForeground = `$true
              binding = `$activationTarget.binding
              activationInputCount = 0
              closeInputCount = 0
            })
          }
          Write-ProbeEvent "probe:user-gesture-gate-ready" `$activationTarget
          if (-not `$activationTarget.ready) {
            Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
              reason = `$activationTarget.reason
              binding = `$activationTarget.binding
              dpi = `$activationTarget.dpi
            })
            Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
              cycle = 1
              reason = "user-gesture-source-not-eligible"
            })
            `$terminalFailure = `$true
            continue
          }

          `$activationPreDispatch = Confirm-AutorunUserGestureActivationTarget
          Write-ProbeEvent "probe:user-gesture-gate-pre-dispatch" `$activationPreDispatch
          if (-not `$activationPreDispatch.eligible) {
            Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
              reason = `$activationPreDispatch.reason
              binding = `$activationPreDispatch.binding
            })
            Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
              cycle = 1
              reason = "user-gesture-source-changed-before-dispatch"
            })
            `$terminalFailure = `$true
            continue
          }

          `$preDispatchGateState = Get-AutorunUserGestureGateLifecycleState
          if (
            `$preDispatchGateState.readyEvents.Count -ne 1 -or
            `$preDispatchGateState.consumedEvents.Count -ne 0 -or
            `$preDispatchGateState.rejectedEvents.Count -ne 0
          ) {
            Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
              reason = "user-gesture-gate-state-changed-before-dispatch"
              readyEventCount = `$preDispatchGateState.readyEvents.Count
              consumedEventCount = `$preDispatchGateState.consumedEvents.Count
              rejectedEventCount = `$preDispatchGateState.rejectedEvents.Count
            })
            Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
              cycle = 1
              reason = "user-gesture-gate-state-changed-before-dispatch"
            })
            `$terminalFailure = `$true
            continue
          }

          Write-ProbeEvent "probe:user-gesture-gate-activation-dispatch-start" ([PSCustomObject]@{
            input = "renderer-button-click-sendinput"
            target = `$activationPreDispatch.target
            preDispatch = `$activationPreDispatch
            readyEventCount = `$preDispatchGateState.readyEvents.Count
            consumedEventCount = `$preDispatchGateState.consumedEvents.Count
            rejectedEventCount = `$preDispatchGateState.rejectedEvents.Count
          })
          `$activationFinalDispatch = Confirm-AutorunUserGestureActivationTarget
          if (`$activationFinalDispatch.eligible) {
            `$activationPointer = Send-NativeMouseClick ([int]`$activationFinalDispatch.target.x) ([int]`$activationFinalDispatch.target.y)
          } else {
            Write-ProbeEvent "probe:user-gesture-gate-activation-skipped" ([PSCustomObject]@{
              reason = `$activationFinalDispatch.reason
              binding = `$activationFinalDispatch.binding
            })
            Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
              cycle = 1
              reason = "user-gesture-source-changed-at-dispatch"
            })
            `$terminalFailure = `$true
            continue
          }
          Write-ProbeEvent "probe:user-gesture-gate-activation-sent" ([PSCustomObject]@{
            input = "renderer-button-click-sendinput"
            target = `$activationFinalDispatch.target
            binding = `$activationTarget.binding
            dpi = `$activationTarget.dpi
            preDispatch = `$activationPreDispatch
            finalDispatch = `$activationFinalDispatch
            nativePointerSent = `$activationPointer
          })
          `$activationSucceeded = (
            `$activationPointer.sent -eq `$activationPointer.expected -and
            `$activationPointer.lastError -eq 0 -and
            `$activationPointer.x -eq [int]`$activationFinalDispatch.target.x -and
            `$activationPointer.y -eq [int]`$activationFinalDispatch.target.y
          )
          if (-not `$activationSucceeded) {
            Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
              cycle = 1
              reason = "user-gesture-activation-dispatch-failed"
            })
            `$terminalFailure = `$true
            continue
          }
          `$script:UserGestureActivationSent = `$true
        }
      }

      if (`$script:UserGestureActivationSent -and -not `$script:UserGestureGateConsumed) {
        if (`$gateState.consumedEvents.Count -gt 1) {
          Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
            cycle = 1
            reason = "user-gesture-gate-consumption-ambiguous"
          })
          `$terminalFailure = `$true
          continue
        }
        if (`$gateState.consumedEvents.Count -eq 1) {
          `$script:UserGestureGateConsumed = `$true
          Write-ProbeEvent "probe:user-gesture-gate-consumed" ([PSCustomObject]@{
            readyEventCount = `$gateState.readyEvents.Count
            consumedEventCount = `$gateState.consumedEvents.Count
            rejectedEventCount = `$gateState.rejectedEvents.Count
          })
        }
      }

      if (-not `$script:UserGestureGateConsumed) {
        Start-Sleep -Milliseconds 50
        continue
      }
    }
    `$shownEventCount = ([regex]::Matches(`$text, 'overlay:presenter-wait-shown')).Count
    `$cycleReady = if ($expectedCloseCount -gt 1) {
      `$persistentLifecycleState = Get-PersistentReuseLifecycleState
      `$shownCycles = @(`$persistentLifecycleState.shownCycles)
      `$completedCycles = @(`$persistentLifecycleState.completedCycles)
      `$expectedCycle = `$sentCount + 1
      `$expectedCycleCount = @(`$shownCycles | Where-Object { `$_ -eq `$expectedCycle }).Count
      `$outOfOrderCycleCount = @(`$shownCycles | Where-Object { `$_ -gt `$expectedCycle }).Count
      `$completedBefore = @(`$completedCycles | Where-Object { `$_ -lt `$expectedCycle })
      `$completedAtOrAfter = @(`$completedCycles | Where-Object { `$_ -ge `$expectedCycle })
      `$completedBeforeOrdered = (`$completedBefore.Count -eq (`$expectedCycle - 1))
      `$completedBeforeInvalid = (`$completedBefore.Count -gt (`$expectedCycle - 1))
      `$overlayActivationStates = @(`$persistentLifecycleState.overlayActivationStates)
      `$activeCallbackCount = @(`$overlayActivationStates | Where-Object { `$_ -eq `$true }).Count
      `$inactiveCallbackCount = @(`$overlayActivationStates | Where-Object { `$_ -eq `$false }).Count
      `$callbackOrderInvalid = (
        `$activeCallbackCount -gt `$expectedCycle -or
        `$inactiveCallbackCount -gt (`$expectedCycle - 1)
      )
      for (`$completedIndex = 0; `$completedIndex -lt `$completedBefore.Count; `$completedIndex += 1) {
        if (`$completedBefore[`$completedIndex] -ne (`$completedIndex + 1)) {
          `$completedBeforeInvalid = `$true
          `$completedBeforeOrdered = `$false
          break
        }
      }
      if (
        `$expectedCycleCount -gt 1 -or
        `$outOfOrderCycleCount -gt 0 -or
        `$completedBeforeInvalid -or
        `$completedAtOrAfter.Count -gt 0 -or
        `$callbackOrderInvalid
      ) {
        Write-ProbeEvent "probe:incomplete" ([PSCustomObject]@{
          cycle = `$expectedCycle
          reason = "persistent-cycle-readiness-order-invalid"
          expectedCycleCount = `$expectedCycleCount
          outOfOrderCycleCount = `$outOfOrderCycleCount
          completedBeforeCount = `$completedBefore.Count
          completedAtOrAfterCount = `$completedAtOrAfter.Count
          activeCallbackCount = `$activeCallbackCount
          inactiveCallbackCount = `$inactiveCallbackCount
        })
        `$terminalFailure = `$true
        `$false
      } else {
        `$expectedCycleCount -eq 1 -and
        `$completedBeforeOrdered -and
        `$activeCallbackCount -eq `$expectedCycle -and
        `$inactiveCallbackCount -eq (`$expectedCycle - 1)
      }
    } else {
      `$shownEventCount -gt `$sentCount -or (`$text -match 'callback:overlay-activated' -and `$text -match '"active":true')
    }
    if (`$cycleReady) {
      `$cycle = `$sentCount + 1
      `$script:CloseCycleOrdinal = `$cycle
      `$detectedForeground = Get-ForegroundProbeSnapshot
      Write-ProbeEvent "probe:detected" ([PSCustomObject]@{
        cycle = `$cycle
        foreground = `$detectedForeground
        screenshot = Capture-ProbeScreen ("cycle-{0:D2}-detected" -f `$cycle)
        processes = Get-ProbeProcessSnapshot
      })
      if (-not `$script:UseUserGestureGate) {
        `$foregroundClear = Clear-BlockingForegroundWindow `$detectedForeground
        if (`$foregroundClear.attempted) {
          Write-ProbeEvent "probe:foreground-clear" `$foregroundClear
        }
      }
      if ($settleMs -gt 0) {
        Start-Sleep -Milliseconds $settleMs
      }
      `$webCloseReadiness = `$null
      if ('$input' -eq 'web-close-click-sendinput') {
        `$webCloseReadiness = Wait-WebClosePanelReady -Deadline `$deadline -Cycle `$cycle
      }
      Write-ProbeEvent "probe:before-send" ([PSCustomObject]@{
        cycle = `$cycle
        foreground = Get-ForegroundProbeSnapshot
        screenshot = Capture-ProbeScreen ("cycle-{0:D2}-before-send" -f `$cycle)
        webCloseReadiness = `$webCloseReadiness
        processes = Get-ProbeProcessSnapshot
      })
      `$target = `$null
      if ('$input' -eq 'web-close-click-sendinput') {
        `$foreground = Get-ForegroundProbeSnapshot
        if (`$webCloseReadiness -and `$webCloseReadiness.target) {
          `$target = `$webCloseReadiness.target
        }
        if (-not `$target) {
          `$target = Get-WebCloseClickTarget `$foreground
        }
        Write-ProbeEvent "probe:web-close-click-target" ([PSCustomObject]@{
          cycle = `$cycle
          target = `$target
          foreground = `$foreground
        })
        if (-not `$target) {
          Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
            cycle = `$cycle
            reason = "close-click-coordinate-source-unavailable"
          })
          `$terminalFailure = `$true
          continue
        }
      }
      `$nativePresenterFocus = Focus-LifecycleNativePresenterForCloseInput
      `$nativePresenterFocus | Add-Member -NotePropertyName cycle -NotePropertyValue `$cycle -Force
      Write-ProbeEvent "probe:native-presenter-focus" `$nativePresenterFocus
      if (-not `$nativePresenterFocus.focused) {
        Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
          cycle = `$cycle
          reason = "native-presenter-focus-not-confirmed"
          focus = `$nativePresenterFocus
        })
        `$terminalFailure = `$true
        continue
      }
      `$nativeInputSent = `$null
      `$nativePointerSent = `$null
      `$shell = `$null
      if ('$input' -eq 'escape' -or '$input' -eq 'close-tab' -or '$input' -eq 'toggle') {
        `$shell = New-Object -ComObject WScript.Shell
      }
      `$nativePresenterPreDispatch = Confirm-LifecycleNativePresenterForegroundForCloseInput
      `$nativePresenterPreDispatch | Add-Member -NotePropertyName cycle -NotePropertyValue `$cycle -Force
      if (-not `$nativePresenterPreDispatch.focused) {
        Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
          cycle = `$cycle
          reason = "native-presenter-focus-lost-before-dispatch"
          focus = `$nativePresenterFocus
          preDispatch = `$nativePresenterPreDispatch
        })
        `$terminalFailure = `$true
        continue
      }
      Write-ProbeEvent "probe:close-input-dispatch-start" ([PSCustomObject]@{
        cycle = `$cycle
        input = '$input'
        nativePresenterPreDispatch = `$nativePresenterPreDispatch
      })
      if ('$input' -eq 'escape') {
        `$shell.SendKeys('{ESC}')
      } elseif ('$input' -eq 'close-tab') {
        `$shell.SendKeys('^w')
      } elseif ('$input' -eq 'escape-sendinput') {
        `$nativeInputSent = Send-NativeKeyChord @(0x1B)
      } elseif ('$input' -eq 'close-tab-sendinput') {
        `$nativeInputSent = Send-NativeKeyChord @(0x11, 0x57)
      } elseif ('$input' -eq 'toggle-sendinput') {
        `$nativeInputSent = Send-NativeKeyChord @(0x10, 0x09)
      } elseif ('$input' -eq 'web-close-click-sendinput') {
        if (`$target) {
          `$nativePointerSent = Send-NativeMouseClick ([int]`$target.x) ([int]`$target.y)
          if (`$nativePointerSent) {
            `$nativePointerSent | Add-Member -NotePropertyName coordinateSource -NotePropertyValue `$target.source -Force
          } else {
            `$nativePointerSent = [PSCustomObject]@{
              sent = 0
              expected = 3
              lastError = -1
              error = "native-mouse-click-returned-no-result"
              x = [int]`$target.x
              y = [int]`$target.y
              coordinateSource = `$target.source
            }
          }
        } else {
          `$nativePointerSent = [PSCustomObject]@{
            sent = 0
            expected = 3
            lastError = -1
            error = "close-click-coordinate-source-unavailable"
          }
        }
      } else {
        `$shell.SendKeys('+{TAB}')
      }
      Write-ProbeEvent "probe:sent" ([PSCustomObject]@{
        cycle = `$cycle
        input = '$input'
        nativePresenterPreDispatch = `$nativePresenterPreDispatch
        nativeInputSent = `$nativeInputSent
        nativePointerSent = `$nativePointerSent
        foreground = Get-ForegroundProbeSnapshot
        processes = Get-ProbeProcessSnapshot
      })
      Start-Sleep -Milliseconds 250
      Write-ProbeEvent "probe:after-send" ([PSCustomObject]@{
        cycle = `$cycle
        input = '$input'
        foreground = Get-ForegroundProbeSnapshot
        screenshot = Capture-ProbeScreen ("cycle-{0:D2}-after-send" -f `$cycle)
        processes = Get-ProbeProcessSnapshot
      })
      `$inputSucceeded = if (`$nativePointerSent) {
        `$nativePointerSent.sent -eq `$nativePointerSent.expected -and `$nativePointerSent.lastError -eq 0
      } elseif (`$nativeInputSent) {
        `$nativeInputSent.sent -eq `$nativeInputSent.expected -and `$nativeInputSent.lastError -eq 0
      } else {
        `$true
      }
      if (-not `$inputSucceeded) {
        Write-ProbeEvent "probe:incomplete" ([PSCustomObject]@{
          cycle = `$cycle
          reason = "close-input-dispatch-failed"
          sentCount = `$sentCount
          expectedCloseCount = $expectedCloseCount
        })
        `$terminalFailure = `$true
        continue
      }
      `$sentCount += 1
      `$sent = (`$sentCount -eq $expectedCloseCount)
    }
  }
  if (-not `$sent -and -not `$terminalFailure) {
    Start-Sleep -Milliseconds 250
  }
}

if (`$script:UseUserGestureGate -and `$sentCount -eq $expectedCloseCount) {
  `$focusReturn = Wait-AutorunUserGestureSourceFocusReturn -Deadline `$deadline
  Write-ProbeEvent "probe:user-gesture-app-focus-return" `$focusReturn
  if (-not `$focusReturn.observed) {
    `$sent = `$false
    `$terminalFailure = `$true
  }
}

if (`$sentCount -eq $expectedCloseCount) {
  if (-not `$terminalFailure) {
    Write-ProbeEvent "probe:complete" ([PSCustomObject]@{
      sentCount = `$sentCount
      expectedCloseCount = $expectedCloseCount
    })
  } else {
    Write-ProbeEvent "probe:incomplete" ([PSCustomObject]@{
      reason = "source-focus-return-not-observed"
      sentCount = `$sentCount
      expectedCloseCount = $expectedCloseCount
    })
  }
} elseif (`$terminalFailure) {
  Write-ProbeEvent "probe:incomplete" ([PSCustomObject]@{
    reason = "terminal-cycle-failure"
    sentCount = `$sentCount
    expectedCloseCount = $expectedCloseCount
  })
} else {
  Write-ProbeEvent "probe:timeout" ([PSCustomObject]@{
    shortcutToggleProbe = `$shortcutToggleProbe
    openSent = `$openSent
    sentCount = `$sentCount
    expectedCloseCount = $expectedCloseCount
  })
}
"@

  $probeScriptPath = Join-Path $CaseDir "close-probe.ps1"
  Set-Content -LiteralPath $probeScriptPath -Value $probeScript -Encoding UTF8
  $probeArgs = @(
    "-NoProfile",
    "-WindowStyle",
    "Hidden",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $probeScriptPath
  )
  Write-Host ("Starting Windows overlay close probe for {0}; script: {1}; log: {2}" -f $Case.id, $probeScriptPath, $probeLog)
  return Start-Process -FilePath "powershell.exe" -ArgumentList $probeArgs -PassThru
}

function Stop-WindowsOverlayCloseProbe {
  param($Process)

  if (-not $Process) {
    return
  }

  try {
    $Process.Refresh()
    if (-not $Process.HasExited) {
      Wait-Process -Id $Process.Id -Timeout 2 -ErrorAction SilentlyContinue
      $Process.Refresh()
    }
    if (-not $Process.HasExited) {
      $Process.Kill()
      [void]$Process.WaitForExit(5000)
    }
  } catch {
    Write-Host ("Windows close probe cleanup warning: {0}" -f $_.Exception.Message)
  }
}

function Wait-WindowsOverlayCloseProbeTerminal {
  param($Process, [string]$ProbeLog, [datetime]$Deadline)

  while ((Get-Date) -lt $Deadline) {
    try {
      $Process.Refresh()
      if ($Process.HasExited) { break }
    } catch {
      break
    }
    Start-Sleep -Milliseconds 100
  }

  $processExited = $false
  $processExitCode = $null
  try {
    $Process.Refresh()
    $processExited = $Process.HasExited
    if ($processExited) {
      $processExitCode = [int]$Process.ExitCode
    }
  } catch {}

  $events = @()
  $parseErrorCount = 0
  if (Test-Path -LiteralPath $ProbeLog -PathType Leaf) {
    foreach ($line in Get-Content -LiteralPath $ProbeLog) {
      if ([string]::IsNullOrWhiteSpace($line)) { continue }
      try {
        $events += ($line | ConvertFrom-Json)
      } catch {
        $parseErrorCount += 1
      }
    }
  }

  $completeEvents = @($events | Where-Object { $_.type -eq "probe:complete" })
  $incompleteEvents = @($events | Where-Object { $_.type -eq "probe:incomplete" })
  $timeoutEvents = @($events | Where-Object { $_.type -eq "probe:timeout" })
  $focusReturnEvents = @($events | Where-Object { $_.type -eq "probe:user-gesture-app-focus-return" })
  $terminalEventCount = $completeEvents.Count + $incompleteEvents.Count + $timeoutEvents.Count
  $focusReturnObserved = (
    $focusReturnEvents.Count -eq 1 -and
    $focusReturnEvents[0].payload.observed -eq $true -and
    $focusReturnEvents[0].payload.lifecycleComplete -eq $true -and
    $focusReturnEvents[0].payload.sourceWindowValid -eq $true -and
    $focusReturnEvents[0].payload.ownerMatches -eq $true -and
    $focusReturnEvents[0].payload.sameInteractiveSession -eq $true -and
    $focusReturnEvents[0].payload.focused -eq $true -and
    [string]$focusReturnEvents[0].payload.reason -eq "exact-source-window-foreground"
  )
  $terminalExclusive = (
    $processExited -and
    $processExitCode -eq 0 -and
    $parseErrorCount -eq 0 -and
    $terminalEventCount -eq 1
  )

  return [PSCustomObject]@{
    processExited = $processExited
    processExitCode = $processExitCode
    logPresent = Test-Path -LiteralPath $ProbeLog -PathType Leaf
    parseErrorCount = $parseErrorCount
    completeEventCount = $completeEvents.Count
    incompleteEventCount = $incompleteEvents.Count
    timeoutEventCount = $timeoutEvents.Count
    terminalEventCount = $terminalEventCount
    terminalExclusive = $terminalExclusive
    focusReturnEventCount = $focusReturnEvents.Count
    focusReturnObserved = $focusReturnObserved
    ok = (
      $terminalExclusive -and
      $completeEvents.Count -eq 1 -and
      $incompleteEvents.Count -eq 0 -and
      $timeoutEvents.Count -eq 0 -and
      $focusReturnObserved
    )
  }
}

function Invoke-Preflight {
  $preflightDir = Join-Path $ArtifactRoot "00-preflight"
  New-Item -ItemType Directory -Force -Path $preflightDir | Out-Null
  $preflightLog = Join-Path $preflightDir "preflight.log"
  $preflightJson = Join-Path $preflightDir "preflight.json"
  $preflightArgs = @(
    "-Mode", "preflight",
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-PreflightJsonFile", $preflightJson
  )
  if ($NativePath) {
    $preflightArgs += @("-NativePath", $NativePath)
  }

  try {
    Invoke-Helper -Arguments $preflightArgs -LogFile $preflightLog
  } finally {
    Collect-SteamClientDiagnostics -DestinationDir (Join-Path $preflightDir "steam-client") -Phase "preflight"
  }

  if (Test-NeedsWindowsLiveRunReadiness) {
    Test-WindowsLiveRunReadiness -DestinationFile (Join-Path $preflightDir "live-run-readiness.json")
  }

  if ($Suite -ne "preflight" -and $Suite -ne "readiness" -and $Suite -ne "shortcut") {
    Test-NativeLoadGate -PreflightDir $preflightDir -PreflightJson $preflightJson
    Invoke-RenderHealthGate -PreflightDir $preflightDir
    Stop-SmokePackageProcesses -DestinationFile (Join-Path $preflightDir "smoke-process-cleanup-after-render-health.json") -Phase "after-render-health"
  }
}

function Resolve-MatrixCaseTimeoutSeconds {
  param($Case)

  if ($Case.persistentReuseGate -eq $true) {
    return [int][Math]::Max(
      [Math]::Max(
        $TimeoutSeconds,
        [Math]::Ceiling(([int]$Case.resultDelayMs) / 1000) + 30
      ),
      ($CloseProbeTimeoutSeconds * [Math]::Max(1, [int]$Case.persistentReuseCycles)) + 60
    )
  }
  return $TimeoutSeconds
}

function Write-CaseLaunchEnv {
  param(
    $Case,
    [string]$ResultFile,
    [string]$DiagnosticDir,
    [string]$ControlFile,
    [switch]$ControlHandoffOnly,
    [switch]$KeepOpenAfterResult
  )

  $args = @(
    "-Mode", "write-launch-env",
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-Action", $Case.action,
    "-ResultFile", $ResultFile,
    "-DiagnosticDir", $DiagnosticDir,
    "-SmokeEnvFile", $LaunchEnvFile,
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode,
    "-WebUrl", $WebUrl,
    "-ResultDelayMs", "$($Case.resultDelayMs)",
    "-TimeoutSeconds", "$(Resolve-MatrixCaseTimeoutSeconds -Case $Case)"
  )
  if ($OverlayInProcessGpu) {
    $args += @("-OverlayInProcessGpu", $OverlayInProcessGpu)
  }
  if ($OverlayDisableDirectComposition) {
    $args += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }
  if ($PresenterMode) {
    $args += @("-PresenterMode", $PresenterMode)
  }
  if ($NativeHostBackend) {
    $args += @("-NativeHostBackend", $NativeHostBackend)
  }
  if ($NativeHostStyle) {
    $args += @("-NativeHostStyle", $NativeHostStyle)
  }
  if ($OverlayScrubChildEnv) {
    $args += @("-OverlayScrubChildEnv", $OverlayScrubChildEnv)
  }
  if ($OverlayIsolateChildProcesses) {
    $args += @("-OverlayIsolateChildProcesses", $OverlayIsolateChildProcesses)
  }
  if ($NativePath) {
    $args += @("-NativePath", $NativePath)
  }
  if ($ControlFile) {
    $args += @("-ControlServer", "-ControlFile", $ControlFile)
    if ($ControlHandoffOnly) {
      $args += "-ControlHandoffOnly"
    }
  }
  if ($KeepOpenAfterResult) {
    $args += "-KeepOpenAfterResult"
  }
  if ($Case.autorunUserGestureGate) {
    $args += "-AutorunUserGestureGate"
  }
  if ($Case.webModal) {
    $args += @("-WebModal", $Case.webModal)
  }
  if ($Case.storeRoute) {
    $args += @("-StoreRoute", $Case.storeRoute)
  }
  if ($Case.dialog) {
    $args += @("-Dialog", $Case.dialog)
  } elseif ($Dialog) {
    $args += @("-Dialog", $Dialog)
  }
  if ($Case.userDialog) {
    $args += @("-UserDialog", $Case.userDialog)
  } elseif ($UserDialog) {
    $args += @("-UserDialog", $UserDialog)
  }
  if ($Case.shortcutTarget) {
    $args += @("-ShortcutTarget", $Case.shortcutTarget)
  }
  if ($Case.checkoutTransactionId) {
    $args += @("-CheckoutTransactionId", $Case.checkoutTransactionId)
  }
  if ($Case.checkoutJsonFile) {
    $args += @("-CheckoutJsonFile", $Case.checkoutJsonFile)
  }
  if ($Case.initTxnRequestFile) {
    $args += @("-InitTxnRequestFile", $Case.initTxnRequestFile)
    if ($InitTxnApiKeyEnv) {
      $args += @("-InitTxnApiKeyEnv", $InitTxnApiKeyEnv)
    }
    if ($InitTxnEndpoint) {
      $args += @("-InitTxnEndpoint", $InitTxnEndpoint)
    }
  }
  if ($Case.managedOverlayResultMode) {
    $args += @("-ManagedOverlayResultMode", $Case.managedOverlayResultMode)
  }

  $launchEnvLog = Join-Path (Split-Path -Parent $ResultFile) "launch-env.log"
  Invoke-Helper -Arguments $args -LogFile $launchEnvLog
}

function Minimize-DesktopWindowsForSteamLaunch {
  param([string]$CaseDir)

  $evidencePath = Join-Path $CaseDir "desktop-minimize.json"
  $evidence = [ordered]@{
    attempted = $false
    ok = $false
    error = ""
  }

  try {
    $evidence.attempted = $true
    $shell = New-Object -ComObject Shell.Application
    $shell.MinimizeAll()
    $evidence.ok = $true
  } catch {
    $evidence.error = $_.Exception.Message
    Write-Host ("Windows desktop minimize warning before Steam launch: {0}" -f $_.Exception.Message)
  }

  Write-MatrixJsonFile -Path $evidencePath -Value $evidence -Depth 4
}

function Read-MatrixSmokeResult {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing persistent-reuse smoke result."
  }
  $line = Get-Content -LiteralPath $Path -ErrorAction Stop |
    Where-Object { $_.StartsWith("STEAM_BRIDGE_SMOKE_RESULT ") } |
    Select-Object -Last 1
  if (-not $line) {
    throw "Persistent-reuse smoke result does not contain STEAM_BRIDGE_SMOKE_RESULT."
  }
  return ($line.Substring("STEAM_BRIDGE_SMOKE_RESULT ".Length) | ConvertFrom-Json)
}

function Read-MatrixSmokeControlDescriptor {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  $control = Read-MatrixJsonFile -Path $Path
  if (
    -not $control -or
    [string]$control.host -ne "127.0.0.1" -or
    [int]$control.port -lt 1 -or
    [int]$control.port -gt 65535 -or
    [string]::IsNullOrWhiteSpace([string]$control.token) -or
    [int]$control.pid -le 0 -or
    $control.handoffOnly -eq $true
  ) {
    throw "Persistent-reuse control descriptor is invalid or not full-control scoped."
  }
  return $control
}

function Wait-MatrixSmokeControlDescriptor {
  param([string]$Path, [int]$WaitSeconds)

  $deadline = (Get-Date).AddSeconds([Math]::Max(1, $WaitSeconds))
  while ((Get-Date) -lt $deadline) {
    try {
      $control = Read-MatrixSmokeControlDescriptor -Path $Path
      if ($control) {
        return $control
      }
    } catch {}
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out waiting for the readiness-gated persistent-reuse control descriptor."
}

function Read-MatrixHandoffOnlySmokeControlDescriptor {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }
  $control = Read-MatrixJsonFile -Path $Path
  $controlProcess = if ([int]$control.pid -gt 0) {
    Get-Process -Id ([int]$control.pid) -ErrorAction SilentlyContinue
  } else {
    $null
  }
  if (
    -not $control -or
    [string]$control.host -ne "127.0.0.1" -or
    [int]$control.port -lt 1 -or
    [int]$control.port -gt 65535 -or
    [string]::IsNullOrWhiteSpace([string]$control.token) -or
    [int]$control.pid -le 0 -or
    $control.handoffOnly -ne $true -or
    -not $controlProcess
  ) {
    throw "User-gesture completion control descriptor is invalid or not handoff-only scoped."
  }
  return $control
}

function Wait-MatrixHandoffOnlySmokeControlDescriptor {
  param([string]$Path, [int]$WaitSeconds)

  $deadline = (Get-Date).AddSeconds([Math]::Max(1, $WaitSeconds))
  while ((Get-Date) -lt $deadline) {
    try {
      $control = Read-MatrixHandoffOnlySmokeControlDescriptor -Path $Path
      if ($control) {
        return $control
      }
    } catch {}
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out waiting for the handoff-only user-gesture completion descriptor."
}

function Invoke-MatrixSmokeControlRequest {
  param(
    $Control,
    [ValidateSet("GET", "POST")][string]$Method,
    [string]$Path,
    $Body = $null,
    [int]$RequestTimeoutSeconds = 30
  )

  $request = @{
    Method = $Method
    Uri = ("http://127.0.0.1:{0}{1}" -f [int]$Control.port, $Path)
    Headers = @{ "X-Steam-Bridge-Smoke-Token" = [string]$Control.token }
    TimeoutSec = [Math]::Max(1, $RequestTimeoutSeconds)
    ErrorAction = "Stop"
  }
  if ($null -ne $Body) {
    $request.ContentType = "application/json"
    $request.Body = ($Body | ConvertTo-Json -Compress -Depth 8)
  }
  return Invoke-RestMethod @request
}

function Invoke-PersistentReuseCase {
  param($Case)

  if ($Case.persistentReuseGate -eq $true) {
    Invoke-MatrixCase -Case $Case
    return
  }

  $caseDir = Join-Path $ArtifactRoot $Case.id
  $resultFile = Join-Path $caseDir "result.log"
  $launchResultFile = Join-Path $caseDir "launch-result.log"
  $diagnosticDir = Join-Path $caseDir "diagnostics"
  $helperLog = Join-Path $caseDir "helper.log"
  $controlFile = Join-Path $caseDir "smoke-control.json"
  $readinessFile = Join-Path $caseDir "persistent-control-readiness.json"
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
  Remove-Item -LiteralPath $resultFile,$launchResultFile,$controlFile -Force -ErrorAction SilentlyContinue

  $launchCase = New-Case `
    -Id $Case.id `
    -Action "presenter-ready" `
    -RequireEvent @("overlay:presenter-ready") `
    -RequireNoOverlayActivation `
    -AllowOverlayNotReady `
    -ResultDelayMs 1200
  Write-CaseLaunchEnv `
    -Case $launchCase `
    -ResultFile $launchResultFile `
    -DiagnosticDir $diagnosticDir `
    -ControlFile $controlFile `
    -KeepOpenAfterResult
  Minimize-DesktopWindowsForSteamLaunch -CaseDir $caseDir

  $args = @(
    "-Mode", "steam-launch",
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-Action", "presenter-ready",
    "-ResultFile", $launchResultFile,
    "-DiagnosticDir", $diagnosticDir,
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode,
    "-WebUrl", $WebUrl,
    "-WebModal", "true",
    "-ResultDelayMs", "1200",
    "-TimeoutSeconds", "$TimeoutSeconds",
    "-ShortcutGameId", $ShortcutGameId,
    "-RequireSteamLaunch",
    "-RequireNoOverlayActivation",
    "-AllowOverlayNotReady",
    "-RequireEvent", "overlay:presenter-ready",
    "-RequireNoCrashes",
    "-RequireZeroManagedOverlayTiming",
    "-KeepOpenAfterResult",
    "-ControlServer",
    "-ControlFile", $controlFile
  )
  if ($OverlayInProcessGpu) {
    $args += @("-OverlayInProcessGpu", $OverlayInProcessGpu)
  }
  if ($OverlayDisableDirectComposition) {
    $args += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }
  if ($PresenterMode) {
    $args += @("-PresenterMode", $PresenterMode)
  }
  if ($NativeHostBackend) {
    $args += @("-NativeHostBackend", $NativeHostBackend)
  }
  if ($NativeHostStyle) {
    $args += @("-NativeHostStyle", $NativeHostStyle)
  }
  if ($OverlayScrubChildEnv) {
    $args += @("-OverlayScrubChildEnv", $OverlayScrubChildEnv)
  }
  if ($OverlayIsolateChildProcesses) {
    $args += @("-OverlayIsolateChildProcesses", $OverlayIsolateChildProcesses)
  }
  if ($NativePath) {
    $args += @("-NativePath", $NativePath)
  }
  $expectedNativeHostBackend = Resolve-ExpectedWindowsNativeHostBackend
  if ($expectedNativeHostBackend) {
    $args += @("-RequireNativeHostBackend", $expectedNativeHostBackend)
  }

  $closeProbeProcess = $null
  $control = $null
  try {
    Write-Host ("Launching one readiness-gated Windows persistent presenter for {0}." -f $Case.id)
    Invoke-Helper -Arguments $args -LogFile $helperLog
    $launchResult = Read-MatrixSmokeResult -Path $launchResultFile
    $control = Wait-MatrixSmokeControlDescriptor -Path $controlFile -WaitSeconds $TimeoutSeconds
    $snapshotResponse = Invoke-MatrixSmokeControlRequest `
      -Control $control `
      -Method "GET" `
      -Path "/snapshot" `
      -RequestTimeoutSeconds 10
    $snapshot = $snapshotResponse.snapshot
    $presenter = if ($snapshot.overlay.nativePresenter.ok -eq $true) {
      $snapshot.overlay.nativePresenter.value
    } else {
      $null
    }
    $readiness = [PSCustomObject]@{
      kind = "steam-bridge-windows-persistent-control-readiness"
      generatedAt = (Get-Date).ToUniversalTime().ToString("o")
      ok = (
        $snapshotResponse.ok -eq $true -and
        $snapshot.process.pid -eq $control.pid -and
        $snapshot.process.platform -eq "win32" -and
        $snapshot.process.arch -eq "x64" -and
        $snapshot.steam.initialized -eq $true -and
        $presenter -and
        $presenter.closed -eq $false -and
        $presenter.nativeSurfaceOwner -eq $true -and
        $presenter.electronOverlay.presenterMode -eq "persistent" -and
        [int]$presenter.electronOverlay.controllerGeneration -gt 0 -and
        [int]$presenter.nativeSurfaceLeaseGeneration -gt 0
      )
      controlProcessMatches = ($snapshot.process.pid -eq $control.pid)
      windowsX64 = ($snapshot.process.platform -eq "win32" -and $snapshot.process.arch -eq "x64")
      steamInitialized = ($snapshot.steam.initialized -eq $true)
      presenterOpen = ($presenter -and $presenter.closed -eq $false)
      presenterOwned = ($presenter -and $presenter.nativeSurfaceOwner -eq $true)
      persistentMode = ($presenter -and $presenter.electronOverlay.presenterMode -eq "persistent")
      controllerGenerationPositive = ($presenter -and [int]$presenter.electronOverlay.controllerGeneration -gt 0)
      nativeSurfaceLeaseGenerationPositive = ($presenter -and [int]$presenter.nativeSurfaceLeaseGeneration -gt 0)
      cycles = [int]$Case.persistentReuseCycles
    }
    Write-MatrixJsonFile -Path $readinessFile -Value $readiness -Depth 5
    if (-not $readiness.ok) {
      throw "Persistent-reuse control server did not reach the required one-controller readiness state."
    }

    $closeProbeProcess = Start-WindowsOverlayCloseProbe `
      -Case $Case `
      -CaseDir $caseDir `
      -DiagnosticDir $diagnosticDir `
      -ControlFile $controlFile
    $requestTimeout = [Math]::Max(
      $TimeoutSeconds,
      ($CloseProbeTimeoutSeconds * [int]$Case.persistentReuseCycles) + 30
    )
    $actionResponse = Invoke-MatrixSmokeControlRequest `
      -Control $control `
      -Method "POST" `
      -Path "/action" `
      -Body ([PSCustomObject]@{
        action = [string]$Case.action
        resultDelayMs = [int]$Case.resultDelayMs
        resultFile = $resultFile
        requireOverlayActive = $false
      }) `
      -RequestTimeoutSeconds $requestTimeout
    if ($actionResponse.ok -ne $true) {
      throw "Persistent-reuse control action failed."
    }
    $result = Read-MatrixSmokeResult -Path $resultFile
    if (
      $result.ok -ne $true -or
      $result.action.ok -ne $true -or
      [string]$result.action.action -ne [string]$Case.action
    ) {
      throw "Persistent-reuse control result failed before semantic audit."
    }
  } finally {
    if ($control) {
      try {
        [void](Invoke-MatrixSmokeControlRequest `
          -Control $control `
          -Method "POST" `
          -Path "/quit" `
          -Body ([PSCustomObject]@{}) `
          -RequestTimeoutSeconds 5)
      } catch {
        Write-Host "Persistent-reuse control quit was unavailable; process cleanup remains authoritative."
      }
      $quitDeadline = (Get-Date).AddSeconds(10)
      while ((Get-Date) -lt $quitDeadline -and (Get-Process -Id ([int]$control.pid) -ErrorAction SilentlyContinue)) {
        Start-Sleep -Milliseconds 100
      }
    }
    Stop-WindowsOverlayCloseProbe -Process $closeProbeProcess
    Remove-Item -LiteralPath $controlFile -Force -ErrorAction SilentlyContinue
    Collect-SteamClientDiagnostics -DestinationDir (Join-Path $caseDir "steam-client") -Phase ("case-{0}" -f $Case.id)
  }
}

function Invoke-MatrixCase {
  param($Case)

  $caseDir = Join-Path $ArtifactRoot $Case.id
  $resultFile = Join-Path $caseDir "result.log"
  $diagnosticDir = Join-Path $caseDir "diagnostics"
  $helperLog = Join-Path $caseDir "helper.log"
  $useCloseProbe = Test-CaseUsesCloseProbe -Case $Case
  $keepOpenForUserGestureCompletion = [bool]$Case.autorunUserGestureGate
  $controlFile = if ($useCloseProbe) { Join-Path $caseDir "smoke-control.json" } else { "" }
  $caseTimeoutSeconds = Resolve-MatrixCaseTimeoutSeconds -Case $Case
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
  if ($controlFile) {
    Remove-Item -LiteralPath $controlFile -Force -ErrorAction SilentlyContinue
  }

  $mode = if ($LaunchMode -eq "steam-launch") {
    "steam-launch"
  } elseif ($LaunchMode -eq "steam-app") {
    "steam-app"
  } else {
    "direct"
  }
  $args = @(
    "-Mode", $mode,
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-Action", $Case.action,
    "-ResultFile", $resultFile,
    "-DiagnosticDir", $diagnosticDir,
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode,
    "-WebUrl", $WebUrl,
    "-ResultDelayMs", "$($Case.resultDelayMs)",
    "-TimeoutSeconds", "$caseTimeoutSeconds",
    "-RequireNoCrashes"
  )
  if ($OverlayInProcessGpu) {
    $args += @("-OverlayInProcessGpu", $OverlayInProcessGpu)
  }
  if ($PresenterMode) {
    $args += @("-PresenterMode", $PresenterMode)
  }
  if ($NativeHostBackend) {
    $args += @("-NativeHostBackend", $NativeHostBackend)
  }
  if ($NativeHostStyle) {
    $args += @("-NativeHostStyle", $NativeHostStyle)
  }
  if ($OverlayScrubChildEnv) {
    $args += @("-OverlayScrubChildEnv", $OverlayScrubChildEnv)
  }
  if ($OverlayIsolateChildProcesses) {
    $args += @("-OverlayIsolateChildProcesses", $OverlayIsolateChildProcesses)
  }
  if ($NativePath) {
    $args += @("-NativePath", $NativePath)
  }
  if ($controlFile) {
    $args += @("-ControlServer", "-ControlHandoffOnly", "-ControlFile", $controlFile)
  }
  if ($Case.autorunUserGestureGate) {
    $args += @("-AutorunUserGestureGate", "-KeepOpenAfterResult")
  }
  if ($Case.allowOverlayNotReady) {
    $args += "-AllowOverlayNotReady"
  }

  if ($LaunchMode -in @("steam-launch", "steam-app")) {
    Write-CaseLaunchEnv `
      -Case $Case `
      -ResultFile $resultFile `
      -DiagnosticDir $diagnosticDir `
      -ControlFile $controlFile `
      -ControlHandoffOnly:([bool]$controlFile) `
      -KeepOpenAfterResult:$keepOpenForUserGestureCompletion
    Minimize-DesktopWindowsForSteamLaunch -CaseDir $caseDir
    if ($LaunchMode -eq "steam-launch") {
      if (-not $ShortcutGameId) {
        throw "Missing -ShortcutGameId for steam-launch matrix mode."
      }
      $args += @("-ShortcutGameId", $ShortcutGameId)
    }
    $args += "-RequireSteamLaunch"
  }
  if ($OverlayDisableDirectComposition) {
    $args += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }
  if ($Case.webModal) {
    $args += @("-WebModal", $Case.webModal)
  }
  if ($Case.storeRoute) {
    $args += @("-StoreRoute", $Case.storeRoute)
  }
  if ($Case.dialog) {
    $args += @("-Dialog", $Case.dialog)
  } elseif ($Dialog) {
    $args += @("-Dialog", $Dialog)
  }
  if ($Case.userDialog) {
    $args += @("-UserDialog", $Case.userDialog)
  } elseif ($UserDialog) {
    $args += @("-UserDialog", $UserDialog)
  }
  if ($Case.shortcutTarget) {
    $args += @("-ShortcutTarget", $Case.shortcutTarget)
  }
  if ($Case.checkoutTransactionId) {
    $args += @("-CheckoutTransactionId", $Case.checkoutTransactionId)
  }
  if ($Case.checkoutJsonFile) {
    $args += @("-CheckoutJsonFile", $Case.checkoutJsonFile)
  }
  if ($Case.initTxnRequestFile) {
    $args += @("-InitTxnRequestFile", $Case.initTxnRequestFile)
    if ($InitTxnApiKeyEnv) {
      $args += @("-InitTxnApiKeyEnv", $InitTxnApiKeyEnv)
    }
    if ($InitTxnEndpoint) {
      $args += @("-InitTxnEndpoint", $InitTxnEndpoint)
    }
  }
  if ($Case.managedOverlayResultMode) {
    $args += @("-ManagedOverlayResultMode", $Case.managedOverlayResultMode)
  }
  if ($Case.requireOverlayActivated) {
    $args += "-RequireOverlayActivated"
  }
  if ($Case.requireNoOverlayActivation) {
    $args += "-RequireNoOverlayActivation"
  }
  if ($Case.requirePassiveNotification) {
    $args += "-RequirePassiveNotification"
  }
  if ($Case.requireManagedOverlayComplete) {
    $args += "-RequireManagedOverlayComplete"
  }
  if ($Case.requireMicroTxnCallback) {
    $args += "-RequireMicroTxnCallback"
  }
  $requiredEvents = @($Case.requireEvent)
  if ($requiredEvents.Count -gt 0) {
    $args += "-RequireEvent"
    $args += $requiredEvents
  }
  if ($Case.action -like "presenter-*") {
    $expectedNativeHostBackend = Resolve-ExpectedWindowsNativeHostBackend
    if ($expectedNativeHostBackend) {
      $args += @("-RequireNativeHostBackend", $expectedNativeHostBackend)
    }
    $args += "-RequireZeroManagedOverlayTiming"
  }

  Write-Host ("Running Windows overlay case {0}: {1}" -f $Case.id, $Case.action)
  $closeProbeProcess = Start-WindowsOverlayCloseProbe `
    -Case $Case `
    -CaseDir $caseDir `
    -DiagnosticDir $diagnosticDir `
    -ControlFile $controlFile
  $closeProbeDeadline = (Get-Date).AddSeconds(
    [Math]::Max(1, ($CloseProbeTimeoutSeconds * [Math]::Max(1, [int]$Case.persistentReuseCycles))) + 2
  )
  $caseStartedAt = Get-Date
  try {
    Invoke-Helper -Arguments $args -LogFile $helperLog
    if ($keepOpenForUserGestureCompletion) {
      $terminal = Wait-WindowsOverlayCloseProbeTerminal `
        -Process $closeProbeProcess `
        -ProbeLog (Join-Path $caseDir "close-probe.log") `
        -Deadline $closeProbeDeadline
      $result = Read-MatrixSmokeResult -Path $resultFile
      $completionControl = $null
      if ($terminal.ok) {
        try {
          $completionControl = Wait-MatrixHandoffOnlySmokeControlDescriptor `
            -Path $controlFile `
            -WaitSeconds 5
        } catch {}
      }
      $controlDescriptorValid = [bool]$completionControl
      $controlProcessMatchesResult = (
        $completionControl -and
        [int]$completionControl.pid -eq [int]$result.snapshot.process.pid
      )
      $quitAttempted = $false
      $quitResponseOk = $false
      $sourceProcessExited = $false
      if ($terminal.ok -and $controlProcessMatchesResult) {
        $quitAttempted = $true
        try {
          $quitResponse = Invoke-MatrixSmokeControlRequest `
            -Control $completionControl `
            -Method "POST" `
            -Path "/quit" `
            -Body ([PSCustomObject]@{}) `
            -RequestTimeoutSeconds 5
          $quitResponseOk = $quitResponse.ok -eq $true
        } catch {}
        if ($quitResponseOk) {
          $sourceExitDeadline = (Get-Date).AddSeconds(10)
          while (
            (Get-Date) -lt $sourceExitDeadline -and
            (Get-Process -Id ([int]$completionControl.pid) -ErrorAction SilentlyContinue)
          ) {
            Start-Sleep -Milliseconds 100
          }
          $sourceProcessExited = -not [bool](
            Get-Process -Id ([int]$completionControl.pid) -ErrorAction SilentlyContinue
          )
        }
      }

      $completionEvidence = [PSCustomObject]@{
        schema = 1
        required = $true
        probeProcessExited = $terminal.processExited
        probeExitCode = $terminal.processExitCode
        probeLogPresent = $terminal.logPresent
        probeParseErrorCount = $terminal.parseErrorCount
        completeEventCount = $terminal.completeEventCount
        incompleteEventCount = $terminal.incompleteEventCount
        timeoutEventCount = $terminal.timeoutEventCount
        terminalEventCount = $terminal.terminalEventCount
        terminalExclusive = $terminal.terminalExclusive
        focusReturnEventCount = $terminal.focusReturnEventCount
        focusReturnObserved = $terminal.focusReturnObserved
        controlDescriptorValid = $controlDescriptorValid
        controlHandoffOnly = ($completionControl -and $completionControl.handoffOnly -eq $true)
        controlProcessMatchesResult = $controlProcessMatchesResult
        quitAttempted = $quitAttempted
        quitResponseOk = $quitResponseOk
        sourceProcessExited = $sourceProcessExited
        ok = (
          $terminal.ok -and
          $controlDescriptorValid -and
          $controlProcessMatchesResult -and
          $quitResponseOk -and
          $sourceProcessExited
        )
      }
      Write-MatrixJsonFile `
        -Path (Join-Path $caseDir "user-gesture-completion.json") `
        -Value $completionEvidence `
        -Depth 5
      if (-not $completionEvidence.ok) {
        throw "User-gesture focus-return completion handshake failed."
      }
    }
  } catch {
    if ($LaunchMode -in @("steam-launch", "steam-app")) {
      $resultHasSmokePayload = Test-SmokeResultPayload -Path $resultFile
      $postCasePreflightLog = Join-Path $caseDir "post-case-preflight.log"
      $postCasePreflightJson = Join-Path $caseDir "post-case-preflight.json"
      $postCasePreflightArgs = @(
        "-Mode", "preflight",
        "-AppDir", $AppDir,
        "-AppId", "$AppId",
        "-PreflightJsonFile", $postCasePreflightJson
      )
      if ($NativePath) {
        $postCasePreflightArgs += @("-NativePath", $NativePath)
      }
      try {
        Invoke-Helper -Arguments $postCasePreflightArgs -LogFile $postCasePreflightLog
      } catch {
        Write-Host ("Post-case preflight failed; preserving original case failure. Output path: {0}" -f $postCasePreflightLog)
      }
      if ($resultHasSmokePayload) {
        $resultText = Get-Content -Raw -LiteralPath $resultFile
        if (Test-AppControlBlockText -Text $resultText) {
          $blocker = New-CaseAppControlBlocker `
            -Case $Case `
            -ResultFile $resultFile `
            -HelperLog $helperLog `
            -PostCasePreflightLog $postCasePreflightLog `
            -PostCasePreflightJson $postCasePreflightJson `
            -CaseStartedAt $caseStartedAt `
            -OriginalError $_.Exception.Message
          $blockerPath = Join-Path $caseDir "case-app-control-blocker.json"
          Write-MatrixJsonFile -Path $blockerPath -Value $blocker -Depth 10
          Write-Host ("Smoke result contains a Windows App Control block; wrote {0}." -f $blockerPath)
        } else {
          Write-Host "Smoke result payload exists; preserving the verifier failure without writing a Steam launch blocker."
        }
      } else {
        $blocker = New-SteamLaunchBlocker `
          -Case $Case `
          -PostCasePreflightLog $postCasePreflightLog `
          -PostCasePreflightJson $postCasePreflightJson `
          -CaseStartedAt $caseStartedAt `
          -OriginalError $_.Exception.Message
        Write-MatrixJsonFile -Path (Join-Path $caseDir "steam-launch-blocker.json") -Value $blocker -Depth 10
      }
    }
    throw
  } finally {
    Stop-WindowsOverlayCloseProbe -Process $closeProbeProcess
    if ($controlFile) {
      Remove-Item -LiteralPath $controlFile -Force -ErrorAction SilentlyContinue
    }
    Collect-SteamClientDiagnostics -DestinationDir (Join-Path $caseDir "steam-client") -Phase ("case-{0}" -f $Case.id)
  }
}

Resolve-SmokeExe | Out-Null
New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null
$candidateBinding = Get-CandidateBinding
$selectedMatrixCases = @(Get-SelectedMatrixCases)
Invoke-InitTxnCapture -Cases $selectedMatrixCases
Test-InitTxnEnvironmentReadiness -Cases $selectedMatrixCases
$selectedMatrixCases = @(Get-SelectedMatrixCases)
Test-CheckoutJsonFile -Cases $selectedMatrixCases
Test-MatrixCloseProbeRequirements -Cases $selectedMatrixCases

Write-Host "Windows overlay matrix:"
Write-Host ("  suite: {0}" -f $Suite)
Write-Host ("  launchMode: {0}" -f $LaunchMode)
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  candidateAuditManifest: {0}" -f $(if ($CandidateAuditManifest) { "present" } else { "" }))
Write-Host ("  artifactRoot: {0}" -f $ArtifactRoot)
Write-Host ("  appId: {0}" -f $AppId)
Write-Host ("  overlayProfile: {0}" -f $OverlayProfile)
Write-Host ("  presenterMode: {0}" -f $PresenterMode)
Write-Host ("  nativeHostBackend: {0}" -f $NativeHostBackend)
Write-Host ("  expectedNativeHostBackend: {0}" -f (Resolve-ExpectedWindowsNativeHostBackend))
Write-Host ("  nativeHostStyle: {0}" -f $NativeHostStyle)
Write-Host ("  inProcessGpu: {0}" -f $OverlayInProcessGpu)
Write-Host ("  disableDirectComposition: {0}" -f $OverlayDisableDirectComposition)
Write-Host ("  scrubChildEnv: {0}" -f $OverlayScrubChildEnv)
Write-Host ("  isolateChildProcesses: {0}" -f $OverlayIsolateChildProcesses)
Write-Host ("  skipRenderHealthGate: {0}" -f $SkipRenderHealthGate)
Write-Host ("  allowUnhealthyDefaultRender: {0}" -f $AllowUnhealthyDefaultRender)
Write-Host ("  userDialog: {0}" -f $UserDialog)
Write-Host ("  cleanStaleOverlayHelpers: {0}" -f $CleanStaleOverlayHelpers)
Write-Host ("  checkoutJsonFile: {0}" -f $(if ($CheckoutJsonFile) { "present" } else { "" }))
Write-Host ("  initTxnRequestFile: {0}" -f $(if ($InitTxnRequestFile) { "present" } else { "" }))
Write-Host ("  initTxnResponseFile: {0}" -f $(if ($CheckoutJsonFile -and $InitTxnRequestFile) { "present" } else { "" }))
Write-Host ("  initTxnCapture: {0}" -f $(if ($InitTxnRequestFile) { "in-app" } else { "" }))
Write-Host ("  requireMicroTxnCallback: {0}" -f $RequireMicroTxnCallback)
if ($OnlyCase) {
  Write-Host ("  onlyCase: {0}" -f $OnlyCase)
}
if ($LaunchMode -in @("steam-launch", "steam-app")) {
  Write-Host ("  launchEnvFile: {0}" -f $(if ($LaunchEnvFile) { "configured" } else { "" }))
  if ($LaunchMode -eq "steam-launch") {
    Write-Host ("  installShortcut: {0}" -f $InstallShortcut)
    if ($ShortcutExe) {
      Write-Host "  shortcutExe: configured"
    }
    if ($ShortcutStartDir) {
      Write-Host "  shortcutStartDir: configured"
    }
    if ($ShortcutLaunchPrefix) {
      Write-Host "  shortcutLaunchPrefix: configured"
    }
    if ($JavaScriptRunnerExe) {
      Write-Host "  javaScriptRunnerExe: configured"
    }
  } else {
    Write-Host "  realSteamAppLaunchOptions: --steam-bridge-smoke-env-file=<launchEnvFile>"
  }
}

Write-MatrixManifest -Cases $selectedMatrixCases
$isLiveSteamLaunchSuite = Test-IsLiveSteamLaunchSuite
$launchEnvTransaction = $null
$runFailure = $null
$cleanupFailures = New-Object System.Collections.Generic.List[string]
$completionLabel = "Windows overlay matrix passed."

try {
  if ($CleanStaleOverlayHelpers) {
    Stop-StaleSteamOverlayHelpers -DestinationFile (Join-Path $ArtifactRoot "stale-overlay-helper-cleanup.json")
  }
  if ($isLiveSteamLaunchSuite) {
    Stop-SmokePackageProcesses -DestinationFile (Join-Path $ArtifactRoot "smoke-process-cleanup-before-run.json") -Phase "before-run"
  }

  Invoke-Preflight

  if ($LaunchMode -eq "steam-launch" -and $Suite -eq "shortcut") {
    Ensure-SteamShortcut
    $completionLabel = "Windows overlay matrix shortcut setup passed. Launch URL: steam://rungameid/$ShortcutGameId"
  } elseif ($Suite -eq "readiness") {
    $completionLabel = "Windows overlay matrix readiness passed."
  } else {
    if ($isLiveSteamLaunchSuite -and $LaunchMode -eq "steam-launch") {
      Ensure-SteamShortcut
    }
    if ($isLiveSteamLaunchSuite) {
      $launchEnvTransaction = Start-LaunchEnvRollbackTransaction -Path $LaunchEnvFile
    }

    foreach ($case in $selectedMatrixCases) {
      if ([int]$case.persistentReuseCycles -gt 0) {
        Invoke-PersistentReuseCase -Case $case
      } else {
        Invoke-MatrixCase -Case $case
      }
    }
  }
} catch {
  $runFailure = $_
} finally {
  if ($isLiveSteamLaunchSuite) {
    try {
      Stop-SmokePackageProcesses `
        -DestinationFile (Join-Path $ArtifactRoot "smoke-process-cleanup-after-cases.json") `
        -Phase "after-cases"
    } catch {
      $cleanupFailures.Add("package-process-cleanup-failed")
    }

    $rollback = Complete-LaunchEnvRollbackTransaction `
      -Transaction $launchEnvTransaction `
      -Path $LaunchEnvFile `
      -DestinationFile (Join-Path $ArtifactRoot "launch-env-rollback.json")
    if (-not $rollback.ok) {
      $cleanupFailures.Add("launch-env-rollback-failed")
    }

    if ($CleanStaleOverlayHelpers) {
      try {
        Stop-StaleSteamOverlayHelpers -DestinationFile (Join-Path $ArtifactRoot "stale-overlay-helper-cleanup-after-run.json")
      } catch {
        $cleanupFailures.Add("stale-overlay-helper-cleanup-failed")
      }
    }
  }
}

if ($runFailure) {
  if ($cleanupFailures.Count -gt 0) {
    Write-Host ("Windows overlay cleanup also failed: {0}" -f ($cleanupFailures -join ", "))
  }
  throw $runFailure
}
if ($cleanupFailures.Count -gt 0) {
  throw ("Windows overlay cleanup failed: {0}" -f ($cleanupFailures -join ", "))
}

Write-Host ("{0} Artifacts: {1}" -f $completionLabel, $ArtifactRoot)
