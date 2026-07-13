[CmdletBinding()]
param(
  [string]$AppDir = "",
  [string]$ArtifactRoot = "",
  [int]$AppId = 480,
  [string]$OverlayProfile = "diagnostic",
  [string]$WindowMode = "windowed",
  [int]$ResultDelayMs = 3000,
  [int]$FirstRenderTimeoutSeconds = 20,
  [int]$ResultTimeoutSeconds = 20,
  [int]$PostResultCrashWindowMs = 3000,
  [int]$ScreenshotSettleMs = 500,
  [int]$SampleStep = 8,
  [switch]$FailOnUnhealthyDefault
)

$ErrorActionPreference = "Stop"
$ResultPrefix = "STEAM_BRIDGE_SMOKE_RESULT "
$FatalLifecycleEventTypes = @(
  "app:render-process-gone",
  "app:child-process-gone",
  "app:gpu-process-crashed",
  "process:uncaught-exception",
  "process:unhandled-rejection"
)

if (-not $AppDir) {
  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir -and (Test-Path -LiteralPath (Join-Path $scriptDir "SteamBridgeSmoke.exe"))) {
    $AppDir = $scriptDir
  } else {
    $AppDir = Join-Path (Get-Location) "dist\electron-smoke\x86_64-pc-windows-msvc\SteamBridgeSmoke-win32-x64"
  }
}

if (-not $ArtifactRoot) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-render-health-$timestamp"
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe"
  }
  return $exe
}

function Write-JsonFile {
  param([string]$Path, $Value, [int]$Depth = 10)

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

function Format-SessionIdList {
  param([object[]]$SessionIds)

  if (-not $SessionIds -or $SessionIds.Count -eq 0) {
    return "none"
  }

  return ((@($SessionIds) | ForEach-Object { [string]$_ }) -join ", ")
}

function Assert-InteractiveDesktopSession {
  $currentSessionId = Get-CurrentWindowsSessionId
  $interactiveSessionIds = @(Get-InteractiveWindowsSessionIds)
  if ($interactiveSessionIds -notcontains $currentSessionId) {
    throw (
      "Windows render-health probe must run from the interactive desktop session. " +
      "Current PowerShell SessionId=$currentSessionId; " +
      "interactive explorer SessionId(s)=$(Format-SessionIdList $interactiveSessionIds). " +
      "Run from the Parsec/local desktop session or a temporary /IT scheduled task."
    )
  }
}

function Initialize-ScreenshotApis {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

  $type = [System.Management.Automation.PSTypeName]"SteamBridgeWindowsRenderProbe.NativeMethods"
  if ($type.Type) {
    return
  }

  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace SteamBridgeWindowsRenderProbe {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  public static class NativeMethods {
    [DllImport("user32.dll")]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
  }
}
"@
}

function Wait-ForMainWindow {
  param([int]$ProcessId, [int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) {
      return $null
    }
    if ($process.MainWindowHandle -and $process.MainWindowHandle -ne [IntPtr]::Zero) {
      return $process
    }
    Start-Sleep -Milliseconds 200
  }

  return (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Get-WindowClientBounds {
  param($Process)

  if (-not $Process -or -not $Process.MainWindowHandle -or $Process.MainWindowHandle -eq [IntPtr]::Zero) {
    return $null
  }

  $rect = New-Object SteamBridgeWindowsRenderProbe.RECT
  if (-not [SteamBridgeWindowsRenderProbe.NativeMethods]::GetClientRect($Process.MainWindowHandle, [ref]$rect)) {
    return $null
  }

  $point = New-Object SteamBridgeWindowsRenderProbe.POINT
  $point.X = 0
  $point.Y = 0
  if (-not [SteamBridgeWindowsRenderProbe.NativeMethods]::ClientToScreen($Process.MainWindowHandle, [ref]$point)) {
    return $null
  }

  return [PSCustomObject]@{
    x = $point.X
    y = $point.Y
    width = [Math]::Max(0, $rect.Right - $rect.Left)
    height = [Math]::Max(0, $rect.Bottom - $rect.Top)
  }
}

function Focus-MainWindow {
  param($Process)

  if (-not $Process -or -not $Process.MainWindowHandle -or $Process.MainWindowHandle -eq [IntPtr]::Zero) {
    return $false
  }

  [void][SteamBridgeWindowsRenderProbe.NativeMethods]::ShowWindow($Process.MainWindowHandle, 9)
  return [SteamBridgeWindowsRenderProbe.NativeMethods]::SetForegroundWindow($Process.MainWindowHandle)
}

function Capture-DesktopScreenshot {
  param([string]$Path)

  Initialize-ScreenshotApis
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  return [PSCustomObject]@{
    path = $Path
    width = $bounds.Width
    height = $bounds.Height
  }
}

function Save-ClientScreenshot {
  param([string]$DesktopPath, [string]$ClientPath, $ClientBounds)

  if (-not $ClientBounds -or $ClientBounds.width -le 0 -or $ClientBounds.height -le 0) {
    return $null
  }

  $desktop = [System.Drawing.Bitmap]::FromFile($DesktopPath)
  try {
    $x = [Math]::Max(0, [int]$ClientBounds.x)
    $y = [Math]::Max(0, [int]$ClientBounds.y)
    $right = [Math]::Min($desktop.Width, $x + [int]$ClientBounds.width)
    $bottom = [Math]::Min($desktop.Height, $y + [int]$ClientBounds.height)
    $width = [Math]::Max(0, $right - $x)
    $height = [Math]::Max(0, $bottom - $y)
    if ($width -le 0 -or $height -le 0) {
      return $null
    }

    $cropRect = New-Object System.Drawing.Rectangle $x, $y, $width, $height
    $client = $desktop.Clone($cropRect, $desktop.PixelFormat)
    try {
      $client.Save($ClientPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $client.Dispose()
    }

    return [PSCustomObject]@{
      path = $ClientPath
      x = $x
      y = $y
      width = $width
      height = $height
    }
  } finally {
    $desktop.Dispose()
  }
}

function Analyze-ClientScreenshot {
  param([string]$Path, [int]$Step)

  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
    return [PSCustomObject]@{
      available = $false
      reason = "missing-client-screenshot"
      blankLike = $true
      contentVisible = $false
    }
  }

  $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
  try {
    $sampleCount = 0
    $darkCount = 0
    $contrastCount = 0
    $sum = 0.0
    $sumSquares = 0.0
    $buckets = New-Object "System.Collections.Generic.HashSet[string]"
    $stepValue = [Math]::Max(1, $Step)

    for ($y = 0; $y -lt $bitmap.Height; $y += $stepValue) {
      for ($x = 0; $x -lt $bitmap.Width; $x += $stepValue) {
        $pixel = $bitmap.GetPixel($x, $y)
        $luminance = (0.2126 * $pixel.R) + (0.7152 * $pixel.G) + (0.0722 * $pixel.B)
        $sum += $luminance
        $sumSquares += ($luminance * $luminance)
        if ($luminance -lt 150) {
          $darkCount += 1
        }
        [void]$buckets.Add(("{0:x1}{1:x1}{2:x1}" -f [int][Math]::Floor($pixel.R / 16), [int][Math]::Floor($pixel.G / 16), [int][Math]::Floor($pixel.B / 16)))
        $sampleCount += 1
      }
    }

    if ($sampleCount -le 0) {
      throw "No pixels sampled from $Path"
    }

    $mean = $sum / $sampleCount
    $variance = [Math]::Max(0.0, ($sumSquares / $sampleCount) - ($mean * $mean))
    $stdDev = [Math]::Sqrt($variance)

    for ($y = 0; $y -lt $bitmap.Height; $y += $stepValue) {
      for ($x = 0; $x -lt $bitmap.Width; $x += $stepValue) {
        $pixel = $bitmap.GetPixel($x, $y)
        $luminance = (0.2126 * $pixel.R) + (0.7152 * $pixel.G) + (0.0722 * $pixel.B)
        if ([Math]::Abs($luminance - $mean) -gt 55) {
          $contrastCount += 1
        }
      }
    }

    $darkPixelRatio = $darkCount / $sampleCount
    $contrastPixelRatio = $contrastCount / $sampleCount
    $blankLike = (
      $darkPixelRatio -lt 0.01 -and
      $contrastPixelRatio -lt 0.02 -and
      $stdDev -lt 35.0
    )

    return [PSCustomObject]@{
      available = $true
      width = $bitmap.Width
      height = $bitmap.Height
      sampleStep = $stepValue
      sampleCount = $sampleCount
      darkPixelRatio = [Math]::Round($darkPixelRatio, 5)
      contrastPixelRatio = [Math]::Round($contrastPixelRatio, 5)
      luminanceMean = [Math]::Round($mean, 2)
      luminanceStdDev = [Math]::Round($stdDev, 2)
      quantizedBucketCount = $buckets.Count
      blankLike = $blankLike
      contentVisible = (-not $blankLike)
    }
  } finally {
    $bitmap.Dispose()
  }
}

function Read-LifecycleEvents {
  param([string]$LifecyclePath)

  if (-not (Test-Path -LiteralPath $LifecyclePath)) {
    return @()
  }

  $events = New-Object System.Collections.Generic.List[object]
  foreach ($line in (Get-Content -LiteralPath $LifecyclePath -ErrorAction SilentlyContinue)) {
    if (-not $line) {
      continue
    }
    try {
      $events.Add(($line | ConvertFrom-Json)) | Out-Null
    } catch {
      $events.Add([PSCustomObject]@{
        type = "parse-error"
        raw = $line
        error = $_.Exception.Message
      }) | Out-Null
    }
  }

  return $events.ToArray()
}

function Convert-LifecycleEventBrief {
  param($Event)

  if (-not $Event) {
    return $null
  }

  $payload = $Event.payload
  $reason = $null
  $exitCode = $null
  $serviceName = $null
  if ($payload) {
    if ($payload.reason) {
      $reason = $payload.reason
    } elseif ($payload.details -and $payload.details.reason) {
      $reason = $payload.details.reason
    }
    if ($payload.exitCode -ne $null) {
      $exitCode = $payload.exitCode
    } elseif ($payload.details -and $payload.details.exitCode -ne $null) {
      $exitCode = $payload.details.exitCode
    }
    if ($payload.serviceName) {
      $serviceName = $payload.serviceName
    }
  }

  return [PSCustomObject]@{
    type = $Event.type
    at = $Event.at
    pid = $Event.pid
    reason = $reason
    exitCode = $exitCode
    serviceName = $serviceName
  }
}

function Wait-ForLifecycleEvent {
  param([string]$LifecyclePath, [string]$EventType, [int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $event = @(Read-LifecycleEvents -LifecyclePath $LifecyclePath | Where-Object { $_.type -eq $EventType } | Select-Object -First 1)
    if ($event.Count -gt 0) {
      return $event[0]
    }
    Start-Sleep -Milliseconds 200
  }

  return $null
}

function Wait-ForSmokeResult {
  param([string]$ResultFile, [int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ((Test-Path -LiteralPath $ResultFile) -and (Get-Item -LiteralPath $ResultFile).Length -gt 0) {
      $line = Get-Content -LiteralPath $ResultFile |
        Where-Object { $_.StartsWith($ResultPrefix) } |
        Select-Object -Last 1
      if ($line) {
        try {
          return ($line.Substring($ResultPrefix.Length) | ConvertFrom-Json)
        } catch {
          Start-Sleep -Milliseconds 200
          continue
        }
      }
    }
    Start-Sleep -Milliseconds 200
  }

  return $null
}

function Get-ProcessTreeIds {
  param([int]$RootProcessId)

  $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
  $ids = New-Object System.Collections.Generic.List[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($RootProcessId)

  while ($queue.Count -gt 0) {
    $id = $queue.Dequeue()
    if ($ids.Contains($id)) {
      continue
    }
    $ids.Add($id) | Out-Null
    foreach ($child in @($processes | Where-Object { $_.ParentProcessId -eq $id })) {
      $queue.Enqueue([int]$child.ProcessId)
    }
  }

  return $ids.ToArray()
}

function Stop-SmokeProcessTree {
  param([int]$RootProcessId)

  $stopped = New-Object System.Collections.Generic.List[int]
  $ids = @(Get-ProcessTreeIds -RootProcessId $RootProcessId | Sort-Object -Descending)
  foreach ($id in $ids) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    if (-not $process) {
      continue
    }
    try {
      Stop-Process -Id $id -Force -ErrorAction Stop
      $stopped.Add($id) | Out-Null
    } catch {
      Write-Warning "Failed to stop SteamBridgeSmoke process PID ${id}: $($_.Exception.Message)"
    }
  }

  return $stopped.ToArray()
}

function Invoke-WithSmokeEnvironment {
  param($EnvMap, [scriptblock]$Body)

  $previous = @{}
  foreach ($key in $EnvMap.Keys) {
    $previous[$key] = [System.Environment]::GetEnvironmentVariable($key, "Process")
    [System.Environment]::SetEnvironmentVariable($key, [string]$EnvMap[$key], "Process")
  }

  try {
    & $Body
  } finally {
    foreach ($key in $EnvMap.Keys) {
      [System.Environment]::SetEnvironmentVariable($key, $previous[$key], "Process")
    }
  }
}

function New-SmokeEnvironment {
  param($Case, [string]$ResultFile, [string]$DiagnosticDir, [string]$ElectronLogFile)

  $envMap = [ordered]@{
    ELECTRON_LOG_FILE = $ElectronLogFile
    SteamAppId = "$AppId"
    SteamGameId = "$AppId"
    SteamOverlayGameId = "$AppId"
    STEAM_BRIDGE_APP_ID = "$AppId"
    STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE = $OverlayProfile
    STEAM_BRIDGE_ELECTRON_OVERLAY_IN_PROCESS_GPU = $Case.inProcessGpu
    STEAM_BRIDGE_SMOKE_AUTORUN = "1"
    STEAM_BRIDGE_SMOKE_AUTORUN_ACTION = "none"
    STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS = "$ResultDelayMs"
    STEAM_BRIDGE_SMOKE_RESULT_FILE = $ResultFile
    STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR = $DiagnosticDir
    STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT = "1"
    STEAM_BRIDGE_SMOKE_WINDOW_MODE = $WindowMode
  }

  if ($Case.disableDirectComposition) {
    $envMap["STEAM_BRIDGE_ELECTRON_OVERLAY_DISABLE_DIRECT_COMPOSITION"] = $Case.disableDirectComposition
  }

  return $envMap
}

function Invoke-RenderHealthCase {
  param($Case)

  $exe = Resolve-SmokeExe
  $caseDir = Join-Path $ArtifactRoot $Case.name
  $diagnosticDir = Join-Path $caseDir "diagnostics"
  $resultFile = Join-Path $caseDir "result.log"
  $electronLogFile = Join-Path $caseDir "electron-debug.log"
  $lifecyclePath = Join-Path $diagnosticDir "lifecycle.jsonl"
  $desktopScreenshotPath = Join-Path $caseDir "desktop.png"
  $clientScreenshotPath = Join-Path $caseDir "client.png"

  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
  Remove-Item -LiteralPath $diagnosticDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $resultFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $electronLogFile -Force -ErrorAction SilentlyContinue

  $process = $null
  $startedAt = (Get-Date).ToUniversalTime().ToString("o")
  $stoppedProcessIds = @()
  $launchError = $null

  try {
    $envMap = New-SmokeEnvironment `
      -Case $Case `
      -ResultFile $resultFile `
      -DiagnosticDir $diagnosticDir `
      -ElectronLogFile $electronLogFile
    $process = Invoke-WithSmokeEnvironment -EnvMap $envMap -Body {
      Start-Process -FilePath $exe -WorkingDirectory $AppDir -PassThru
    }

    $windowProcess = Wait-ForMainWindow -ProcessId $process.Id -TimeoutSeconds $FirstRenderTimeoutSeconds
    $firstRender = Wait-ForLifecycleEvent -LifecyclePath $lifecyclePath -EventType "window:first-render" -TimeoutSeconds $FirstRenderTimeoutSeconds
    $result = Wait-ForSmokeResult -ResultFile $resultFile -TimeoutSeconds $ResultTimeoutSeconds
    [void](Focus-MainWindow -Process $windowProcess)
    if ($ScreenshotSettleMs -gt 0) {
      Start-Sleep -Milliseconds $ScreenshotSettleMs
    }

    $clientBounds = Get-WindowClientBounds -Process $windowProcess
    $desktopScreenshot = Capture-DesktopScreenshot -Path $desktopScreenshotPath
    $clientScreenshot = Save-ClientScreenshot -DesktopPath $desktopScreenshotPath -ClientPath $clientScreenshotPath -ClientBounds $clientBounds
    $analysis = Analyze-ClientScreenshot -Path $clientScreenshot.path -Step $SampleStep
    if ($PostResultCrashWindowMs -gt 0) {
      Start-Sleep -Milliseconds $PostResultCrashWindowMs
    }
    $events = @(Read-LifecycleEvents -LifecyclePath $lifecyclePath)
    $fatalEvents = @($events | Where-Object { $FatalLifecycleEventTypes -contains $_.type })
    $liveProcesses = @(
      Get-Process SteamBridgeSmoke -ErrorAction SilentlyContinue |
        Select-Object ProcessName,Id,SessionId,Responding,MainWindowTitle,StartTime
    )

    $caseResult = [PSCustomObject]@{
      name = $Case.name
      inProcessGpu = $Case.inProcessGpu
      disableDirectComposition = $Case.disableDirectComposition
      startedAt = $startedAt
      startedPid = $process.Id
      firstRenderObserved = [bool]$firstRender
      firstRender = (Convert-LifecycleEventBrief -Event $firstRender)
      resultObserved = [bool]$result
      resultOk = if ($result) { $result.ok } else { $null }
      overlayInProcessGpu = if ($result) { $result.snapshot.app.overlayInProcessGpu } else { $null }
      overlayDisableDirectComposition = if ($result) { $result.snapshot.app.overlayDisableDirectComposition } else { $null }
      window = [PSCustomObject]@{
        title = if ($windowProcess) { $windowProcess.MainWindowTitle } else { $null }
        handle = if ($windowProcess) { [string]$windowProcess.MainWindowHandle } else { $null }
        clientBounds = $clientBounds
      }
      screenshots = [PSCustomObject]@{
        desktop = $desktopScreenshot
        client = $clientScreenshot
      }
      screenshotAnalysis = $analysis
      contentVisible = $analysis.contentVisible
      blankLike = $analysis.blankLike
      fatalLifecycleEventCount = $fatalEvents.Count
      fatalLifecycleEvents = @($fatalEvents | ForEach-Object { Convert-LifecycleEventBrief -Event $_ })
      lifecycleEventCount = $events.Count
      lifecyclePath = $lifecyclePath
      resultFile = $resultFile
      electronLogFile = $electronLogFile
      diagnosticDir = $diagnosticDir
      liveProcesses = @($liveProcesses | ForEach-Object {
        [PSCustomObject]@{
          processName = $_.ProcessName
          id = $_.Id
          sessionId = $_.SessionId
          responding = $_.Responding
          mainWindowTitle = $_.MainWindowTitle
        }
      })
      error = $null
    }
    Write-JsonFile -Path (Join-Path $caseDir "render-health-case.json") -Value $caseResult
    return $caseResult
  } catch {
    $launchError = $_.Exception.Message
    $caseResult = [PSCustomObject]@{
      name = $Case.name
      inProcessGpu = $Case.inProcessGpu
      disableDirectComposition = $Case.disableDirectComposition
      startedAt = $startedAt
      startedPid = if ($process) { $process.Id } else { $null }
      contentVisible = $false
      blankLike = $true
      fatalLifecycleEventCount = $null
      error = $launchError
      lifecyclePath = $lifecyclePath
      resultFile = $resultFile
      electronLogFile = $electronLogFile
      diagnosticDir = $diagnosticDir
    }
    Write-JsonFile -Path (Join-Path $caseDir "render-health-case.json") -Value $caseResult
    return $caseResult
  } finally {
    if ($process) {
      $stoppedProcessIds = @(Stop-SmokeProcessTree -RootProcessId $process.Id)
    }
    if ($stoppedProcessIds.Count -gt 0) {
      Write-Host ("Stopped SteamBridgeSmoke process tree for {0}: {1}" -f $Case.name, ($stoppedProcessIds -join ", "))
    }
  }
}

function New-RenderHealthSummary {
  param($Cases)

  $defaultCase = @($Cases | Where-Object { $_.name -eq "default" } | Select-Object -First 1)
  $baselineCase = @($Cases | Where-Object { $_.name -eq "in-process-gpu-off" } | Select-Object -First 1)
  $inProcessGpuCase = @($Cases | Where-Object { $_.name -eq "in-process-gpu-on" } | Select-Object -First 1)
  $compositionCase = @($Cases | Where-Object { $_.name -eq "in-process-gpu-on-disable-direct-composition" } | Select-Object -First 1)

  $defaultFatalCount = if ($defaultCase.Count -gt 0 -and $defaultCase[0].fatalLifecycleEventCount -ne $null) {
    [int]$defaultCase[0].fatalLifecycleEventCount
  } else {
    0
  }
  $compositionFatalCount = if ($compositionCase.Count -gt 0 -and $compositionCase[0].fatalLifecycleEventCount -ne $null) {
    [int]$compositionCase[0].fatalLifecycleEventCount
  } else {
    0
  }

  $defaultHealthy = (
    $defaultCase.Count -gt 0 -and
    $defaultCase[0].contentVisible -eq $true -and
    $defaultFatalCount -eq 0
  )
  $baselineVisible = ($baselineCase.Count -gt 0 -and $baselineCase[0].contentVisible -eq $true)
  $inProcessGpuVisible = ($inProcessGpuCase.Count -gt 0 -and $inProcessGpuCase[0].contentVisible -eq $true)
  $compositionVisible = ($compositionCase.Count -gt 0 -and $compositionCase[0].contentVisible -eq $true)
  $compositionFatal = ($compositionFatalCount -gt 0)

  $status = "unknown"
  $nextAction = "Inspect screenshots and lifecycle logs."
  if ($defaultHealthy) {
    $status = "default-render-health-ok"
    $nextAction = "The ordinary Windows render path is visually healthy enough for a focused Steam-launched overlay case."
  } elseif ($defaultCase.Count -gt 0 -and $defaultCase[0].blankLike -eq $true -and $baselineVisible) {
    if ($compositionVisible -and $compositionFatal) {
      $status = "default-blank-composition-visible-but-crashy"
      $nextAction = "Do not promote disable-direct-composition to a default; compare it only as an explicit diagnostic and investigate a safer presenter/graphics path."
    } elseif ($compositionVisible) {
      $status = "default-blank-composition-visible"
      $nextAction = "Run a focused Steam-launched comparison with disable-direct-composition and include Alt+Tab, close, and crash evidence before considering it."
    } else {
      $status = "default-blank-baseline-visible"
      $nextAction = "The app renders when in-process GPU is disabled, but that mode is not overlay proof; continue with a safer graphics/presenter investigation."
    }
  } elseif ($defaultCase.Count -gt 0 -and $defaultCase[0].blankLike -eq $true -and $compositionVisible) {
    if ($compositionFatal) {
      $status = "default-blank-baseline-blank-composition-visible-but-crashy"
      $nextAction = "The default and in-process-GPU-off renderer paths are blank; the composition fallback is visible but not stable enough to ship without focused crash, close, and Alt+Tab proof."
    } else {
      $status = "default-blank-baseline-blank-composition-visible"
      $nextAction = "The default and in-process-GPU-off renderer paths are blank; run only a focused disable-direct-composition comparison next, with crash, close, and Alt+Tab evidence."
    }
  }

  return [PSCustomObject]@{
    status = $status
    readyForSteamOverlayMatrix = $defaultHealthy
    defaultCaseHealthy = $defaultHealthy
    inProcessGpuOffVisible = $baselineVisible
    inProcessGpuOnVisible = $inProcessGpuVisible
    disableDirectCompositionVisible = $compositionVisible
    disableDirectCompositionFatal = $compositionFatal
    nextAction = $nextAction
  }
}

Assert-InteractiveDesktopSession
Initialize-ScreenshotApis
New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null

$cases = @(
  [PSCustomObject]@{
    name = "default"
    inProcessGpu = ""
    disableDirectComposition = ""
  },
  [PSCustomObject]@{
    name = "in-process-gpu-on"
    inProcessGpu = "1"
    disableDirectComposition = ""
  },
  [PSCustomObject]@{
    name = "in-process-gpu-off"
    inProcessGpu = "0"
    disableDirectComposition = ""
  },
  [PSCustomObject]@{
    name = "in-process-gpu-on-disable-direct-composition"
    inProcessGpu = "1"
    disableDirectComposition = "1"
  }
)

$caseResults = New-Object System.Collections.Generic.List[object]
foreach ($case in $cases) {
  Write-Host ("Running Windows render-health case: {0}" -f $case.name)
  $caseResults.Add((Invoke-RenderHealthCase -Case $case)) | Out-Null
}

$caseResultArray = @($caseResults | ForEach-Object { $_ })
$recommendation = New-RenderHealthSummary -Cases $caseResultArray
$summary = [PSCustomObject]@{
  kind = "steam-bridge-windows-render-health-probe"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  appDir = $AppDir
  appId = $AppId
  artifactRoot = $ArtifactRoot
  overlayProfile = $OverlayProfile
  windowMode = $WindowMode
  resultDelayMs = $ResultDelayMs
  postResultCrashWindowMs = $PostResultCrashWindowMs
  recommendation = $recommendation
  cases = @($caseResultArray)
}

$summaryPath = Join-Path $ArtifactRoot "render-health-summary.json"
Write-JsonFile -Path $summaryPath -Value $summary

Write-Host "Windows render-health summary:"
Write-Host ("  artifactRoot: {0}" -f $ArtifactRoot)
Write-Host ("  status: {0}" -f $recommendation.status)
Write-Host ("  readyForSteamOverlayMatrix: {0}" -f $recommendation.readyForSteamOverlayMatrix)
Write-Host ("  nextAction: {0}" -f $recommendation.nextAction)
Write-Host ("  summary: {0}" -f $summaryPath)

if ($FailOnUnhealthyDefault -and -not $recommendation.readyForSteamOverlayMatrix) {
  throw "Windows default render health is not ready for Steam-launched overlay matrix proof."
}
