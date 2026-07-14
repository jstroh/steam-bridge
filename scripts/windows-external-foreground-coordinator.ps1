[CmdletBinding()]
param(
  [string]$CaseDirectory = "",
  [string]$ExpectedExecutable = "",
  [string]$ExpectedWindowTitle = "Steam Bridge Electron Smoke",
  [string]$ExpectedAction = "",
  [int]$TimeoutSeconds = 180,
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

function Test-ExactKeys {
  param($Value, [string[]]$Keys)

  if (-not $Value) {
    return $false
  }
  $actual = @($Value.PSObject.Properties.Name | Sort-Object)
  $expected = @($Keys | Sort-Object)
  return (($actual -join "`n") -ceq ($expected -join "`n"))
}

function Read-ReadyMarker {
  param([string]$Path, [string]$Action)

  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if ($item.Length -lt 2 -or $item.Length -gt 4096) {
    throw "External foreground ready marker has an invalid size."
  }
  $marker = [System.IO.File]::ReadAllText($item.FullName) | ConvertFrom-Json -ErrorAction Stop
  $keys = @(
    "action",
    "activationInputCount",
    "challenge",
    "closeInputCount",
    "kind",
    "mechanism",
    "requestOrdinal",
    "schema",
    "sourceBound",
    "transitionHookReady"
  )
  if (
    -not (Test-ExactKeys -Value $marker -Keys $keys) -or
    $marker.kind -cne "steam-bridge-windows-external-foreground-ready" -or
    $marker.schema -ne 1 -or
    $marker.action -cne $Action -or
    $marker.requestOrdinal -ne 1 -or
    $marker.mechanism -cne "external-foreground-event-v1" -or
    [string]$marker.challenge -cnotmatch "^[0-9a-f]{32}$" -or
    $marker.sourceBound -ne $true -or
    $marker.transitionHookReady -ne $true -or
    $marker.activationInputCount -ne 0 -or
    $marker.closeInputCount -ne 0
  ) {
    throw "External foreground ready marker failed exact validation."
  }
  return $marker
}

function Write-AtomicJson {
  param([string]$Path, $Value)

  $fullPath = Resolve-FullPath $Path
  $parent = Split-Path -Parent $fullPath
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $temporary = "$fullPath.tmp-$([Guid]::NewGuid().ToString('N'))"
  try {
    [System.IO.File]::WriteAllText(
      $temporary,
      (($Value | ConvertTo-Json -Depth 8) + [Environment]::NewLine),
      (New-Object System.Text.UTF8Encoding($false))
    )
    if (Test-Path -LiteralPath $fullPath) {
      throw "Atomic JSON destination already exists."
    }
    [System.IO.File]::Move($temporary, $fullPath)
  } finally {
    Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
  }
}

function New-ControllerAcknowledgment {
  param($Marker)

  return [ordered]@{
    kind = "steam-bridge-windows-external-foreground-ack"
    schema = 1
    action = [string]$Marker.action
    requestOrdinal = [int]$Marker.requestOrdinal
    mechanism = [string]$Marker.mechanism
    challenge = [string]$Marker.challenge
    clickCompleted = $true
    activationInputCount = 0
    closeInputCount = 0
  }
}

function Wait-ForPath {
  param([string]$Path, [datetime]$Deadline)

  while (-not (Test-Path -LiteralPath $Path)) {
    if ([DateTime]::UtcNow -ge $Deadline) {
      throw "Timed out waiting for the external foreground marker."
    }
    Start-Sleep -Milliseconds 25
  }
}

function Invoke-SelfTest {
  $root = Join-Path $env:TEMP "steam-bridge-foreground-coordinator-$([Guid]::NewGuid().ToString('N'))"
  try {
    New-Item -ItemType Directory -Path $root | Out-Null
    $markerPath = Join-Path $root "external-foreground-ready.json"
    $ackPath = Join-Path $root "external-foreground-ack.json"
    $marker = [ordered]@{
      kind = "steam-bridge-windows-external-foreground-ready"
      schema = 1
      action = "presenter-persistent-reuse-three-cycle"
      requestOrdinal = 1
      mechanism = "external-foreground-event-v1"
      challenge = "a" * 32
      sourceBound = $true
      transitionHookReady = $true
      activationInputCount = 0
      closeInputCount = 0
    }
    Write-AtomicJson -Path $markerPath -Value $marker
    $validated = Read-ReadyMarker -Path $markerPath -Action $marker.action
    Write-AtomicJson -Path $ackPath -Value (New-ControllerAcknowledgment -Marker $validated)
    $ack = [System.IO.File]::ReadAllText($ackPath) | ConvertFrom-Json
    if (
      -not (Test-ExactKeys -Value $ack -Keys @(
        "action",
        "activationInputCount",
        "challenge",
        "clickCompleted",
        "closeInputCount",
        "kind",
        "mechanism",
        "requestOrdinal",
        "schema"
      )) -or
      $ack.challenge -cne $marker.challenge -or
      $ack.clickCompleted -ne $true
    ) {
      throw "External foreground coordinator self-test acknowledgment failed."
    }
    $badMarker = [ordered]@{}
    foreach ($property in $marker.GetEnumerator()) {
      $badMarker[$property.Key] = $property.Value
    }
    $badMarker.challenge = "short"
    $badMarkerPath = Join-Path $root "bad-ready.json"
    Write-AtomicJson -Path $badMarkerPath -Value $badMarker
    $rejected = $false
    try {
      Read-ReadyMarker -Path $badMarkerPath -Action $marker.action | Out-Null
    } catch {
      $rejected = $true
    }
    if (-not $rejected) {
      throw "External foreground coordinator self-test accepted an invalid marker."
    }
    Write-Host "Windows external foreground coordinator self-test passed."
  } finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($SelfTest) {
  Invoke-SelfTest
}

if ($env:OS -ne "Windows_NT") {
  if ($SelfTest) {
    exit 0
  }
  throw "Windows external foreground coordination requires Windows."
}
if (-not $SelfTest) {
  if (-not [Environment]::UserInteractive) {
    throw "Windows external foreground coordination requires an interactive desktop."
  }
  if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 900) {
    throw "TimeoutSeconds must be between 1 and 900."
  }
  if (-not $ExpectedAction) {
    throw "ExpectedAction is required."
  }

  $CaseDirectory = Resolve-FullPath $CaseDirectory
  $ExpectedExecutable = Resolve-FullPath $ExpectedExecutable
  if (-not (Test-Path -LiteralPath $ExpectedExecutable -PathType Leaf)) {
    throw "Expected executable was not found."
  }
  $executableItem = Get-Item -LiteralPath $ExpectedExecutable -Force
  if (($executableItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Expected executable must not be a reparse point."
  }
}

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class SteamBridgeForegroundCoordinator {
  const uint INPUT_MOUSE = 0;
  const uint MOUSEEVENTF_MOVE = 0x0001;
  const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  const uint MOUSEEVENTF_LEFTUP = 0x0004;
  const uint MOUSEEVENTF_MOVE_NOCOALESCE = 0x2000;
  const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
  const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;
  const int SM_XVIRTUALSCREEN = 76;
  const int SM_YVIRTUALSCREEN = 77;
  const int SM_CXVIRTUALSCREEN = 78;
  const int SM_CYVIRTUALSCREEN = 79;

  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public uint type;
    public InputUnion u;
  }

  [StructLayout(LayoutKind.Explicit)]
  public struct InputUnion {
    [FieldOffset(0)] public MOUSEINPUT mi;
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

  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll", SetLastError = true)] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll", SetLastError = true)] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);

  public static void ConfigureDpiAwareness() {
    try {
      if (!SetProcessDpiAwarenessContext(new IntPtr(-4))) {
        SetProcessDPIAware();
      }
    } catch (EntryPointNotFoundException) {
      SetProcessDPIAware();
    }
    try {
      SetThreadDpiAwarenessContext(new IntPtr(-4));
    } catch (EntryPointNotFoundException) {}
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
    input.u.mi.dwFlags = flags | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    input.u.mi.dwExtraInfo = IntPtr.Zero;
    return input;
  }

  public static uint SendSingleClick(int x, int y, out int lastError) {
    INPUT[] inputs = new INPUT[3];
    inputs[0] = MouseInput(x, y, MOUSEEVENTF_MOVE | MOUSEEVENTF_MOVE_NOCOALESCE);
    inputs[1] = MouseInput(x, y, MOUSEEVENTF_LEFTDOWN);
    inputs[2] = MouseInput(x, y, MOUSEEVENTF_LEFTUP);
    uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    lastError = sent == inputs.Length ? 0 : Marshal.GetLastWin32Error();
    return sent;
  }
}
'@

if ($SelfTest) {
  Write-Host "Windows external foreground coordinator native compile passed."
  exit 0
}

[SteamBridgeForegroundCoordinator]::ConfigureDpiAwareness()
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
$readyPath = Join-Path $CaseDirectory "external-foreground-ready.json"
$ackPath = Join-Path $CaseDirectory "external-foreground-ack.json"
$evidencePath = Join-Path $CaseDirectory "external-foreground-coordinator.json"
$evidence = [ordered]@{
  kind = "steam-bridge-windows-external-foreground-coordinator"
  schemaVersion = 1
  generatedAt = $null
  action = $ExpectedAction
  markerValidated = $false
  exactExecutableMatched = $false
  exactTitleMatched = $false
  processIdentityStable = $false
  sameInteractiveSession = $false
  sourceInitiallyNotForeground = $false
  titleBarGeometryValid = $false
  pointOwnerMatches = $false
  pointRootMatches = $false
  dpi = 0
  sendInputCount = 0
  clickCompleted = $false
  acknowledgmentWritten = $false
  errorKind = "none"
  ok = $false
}

try {
  Wait-ForPath -Path $readyPath -Deadline $deadline
  if (Test-Path -LiteralPath $ackPath) {
    throw "External foreground acknowledgment already exists."
  }
  $marker = Read-ReadyMarker -Path $readyPath -Action $ExpectedAction
  $evidence.markerValidated = $true

  $processName = [IO.Path]::GetFileNameWithoutExtension($ExpectedExecutable)
  $candidates = @(Get-Process -Name $processName -ErrorAction SilentlyContinue | Where-Object {
    try {
      $_.Refresh()
      $_.MainWindowHandle -ne [IntPtr]::Zero -and
      [string]$_.Path -and
      ([string]$_.Path).Equals($ExpectedExecutable, [StringComparison]::OrdinalIgnoreCase) -and
      $_.MainWindowTitle -ceq $ExpectedWindowTitle
    } catch {
      $false
    }
  })
  if ($candidates.Count -ne 1) {
    throw "Expected exactly one eligible source window."
  }
  $source = $candidates[0]
  $source.Refresh()
  $sourceStartTicks = [int64]$source.StartTime.ToUniversalTime().Ticks
  $handle = [IntPtr]$source.MainWindowHandle
  $evidence.exactExecutableMatched = $true
  $evidence.exactTitleMatched = $true
  $evidence.sameInteractiveSession = ($source.SessionId -eq [Diagnostics.Process]::GetCurrentProcess().SessionId)
  $evidence.sourceInitiallyNotForeground = ([SteamBridgeForegroundCoordinator]::GetForegroundWindow() -ne $handle)
  if (
    -not $evidence.sameInteractiveSession -or
    -not $evidence.sourceInitiallyNotForeground -or
    -not [SteamBridgeForegroundCoordinator]::IsWindow($handle) -or
    -not [SteamBridgeForegroundCoordinator]::IsWindowEnabled($handle) -or
    [SteamBridgeForegroundCoordinator]::IsIconic($handle)
  ) {
    throw "Source window is not eligible for one foreground click."
  }

  $ownerPid = [uint32]0
  if (
    [SteamBridgeForegroundCoordinator]::GetWindowThreadProcessId($handle, [ref]$ownerPid) -eq 0 -or
    $ownerPid -ne [uint32]$source.Id
  ) {
    throw "Source window owner does not match the exact process."
  }
  $rect = New-Object SteamBridgeForegroundCoordinator+RECT
  $clientRect = New-Object SteamBridgeForegroundCoordinator+RECT
  $clientOrigin = New-Object SteamBridgeForegroundCoordinator+POINT
  if (
    -not [SteamBridgeForegroundCoordinator]::GetWindowRect($handle, [ref]$rect) -or
    -not [SteamBridgeForegroundCoordinator]::GetClientRect($handle, [ref]$clientRect) -or
    -not [SteamBridgeForegroundCoordinator]::ClientToScreen($handle, [ref]$clientOrigin)
  ) {
    throw "Source title-bar geometry is unavailable."
  }
  $titleBarHeight = [int]$clientOrigin.Y - [int]$rect.Top
  $windowWidth = [int]$rect.Right - [int]$rect.Left
  if ($titleBarHeight -lt 8 -or $titleBarHeight -gt 256 -or $windowWidth -lt 200) {
    throw "Source title-bar geometry is outside the safe range."
  }
  $x = [int][Math]::Floor(([int]$rect.Left + [int]$rect.Right) / 2.0)
  $y = [int]$rect.Top + [int][Math]::Floor($titleBarHeight / 2.0)
  if ($y -ge $clientOrigin.Y -or $x -le $rect.Left -or $x -ge $rect.Right) {
    throw "Computed title-bar point is invalid."
  }
  $evidence.titleBarGeometryValid = $true
  $evidence.dpi = [int][SteamBridgeForegroundCoordinator]::GetDpiForWindow($handle)
  if ($evidence.dpi -lt 48 -or $evidence.dpi -gt 768) {
    throw "Source window DPI is invalid."
  }

  $point = New-Object SteamBridgeForegroundCoordinator+POINT
  $point.X = $x
  $point.Y = $y
  $pointHandle = [SteamBridgeForegroundCoordinator]::WindowFromPoint($point)
  $pointPid = [uint32]0
  $pointThread = [SteamBridgeForegroundCoordinator]::GetWindowThreadProcessId($pointHandle, [ref]$pointPid)
  $evidence.pointOwnerMatches = ($pointThread -gt 0 -and $pointPid -eq [uint32]$source.Id)
  $evidence.pointRootMatches = ([SteamBridgeForegroundCoordinator]::GetAncestor($pointHandle, 2) -eq $handle)
  if (-not $evidence.pointOwnerMatches -or -not $evidence.pointRootMatches) {
    throw "Computed title-bar point does not belong to the exact source window."
  }

  $source.Refresh()
  $evidence.processIdentityStable = (
    [int64]$source.StartTime.ToUniversalTime().Ticks -eq $sourceStartTicks -and
    [IntPtr]$source.MainWindowHandle -eq $handle -and
    [string]$source.Path -and
    ([string]$source.Path).Equals($ExpectedExecutable, [StringComparison]::OrdinalIgnoreCase) -and
    $source.MainWindowTitle -ceq $ExpectedWindowTitle
  )
  if (
    -not $evidence.processIdentityStable -or
    [SteamBridgeForegroundCoordinator]::GetForegroundWindow() -eq $handle
  ) {
    throw "Source process or foreground state changed before click dispatch."
  }

  $lastError = 0
  $sent = [SteamBridgeForegroundCoordinator]::SendSingleClick($x, $y, [ref]$lastError)
  $evidence.sendInputCount = [int]$sent
  if ($sent -ne 3 -or $lastError -ne 0) {
    throw "Single title-bar click dispatch failed."
  }
  $evidence.clickCompleted = $true
  Write-AtomicJson -Path $ackPath -Value (New-ControllerAcknowledgment -Marker $marker)
  $evidence.acknowledgmentWritten = $true
  $evidence.generatedAt = [DateTime]::UtcNow.ToString("o")
  $evidence.ok = $true
  Write-AtomicJson -Path $evidencePath -Value $evidence
  $evidence | ConvertTo-Json -Depth 8
} catch {
  $evidence.generatedAt = [DateTime]::UtcNow.ToString("o")
  $evidence.errorKind = "coordinator-failed"
  if (Test-Path -LiteralPath $CaseDirectory -PathType Container) {
    try {
      if (-not (Test-Path -LiteralPath $evidencePath)) {
        Write-AtomicJson -Path $evidencePath -Value $evidence
      }
    } catch {}
  }
  throw
}
