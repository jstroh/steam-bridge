[CmdletBinding()]
param(
  [ValidateSet("baseline", "managed", "managed-routes", "shortcut-routes", "checkout", "full", "preflight", "readiness", "shortcut")]
  [string]$Suite = "baseline",

  [ValidateSet("steam-launch", "steam-app", "direct")]
  [string]$LaunchMode = "steam-launch",

  [string]$AppDir = "",
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
  [string]$OverlayIsolateChildProcesses = ""
)

$ErrorActionPreference = "Stop"

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
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-overlay-matrix-$timestamp"
}

if (-not $LaunchEnvFile) {
  $LaunchEnvFile = Join-Path $env:LOCALAPPDATA "SteamBridgeSmoke\steam-bridge-windows-smoke.env"
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

function Resolve-NativeAddon {
  return Join-Path $AppDir "resources\app\node_modules\steam-bridge\steam_bridge_native.win32-x64-msvc.node"
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
    try {
      Stop-Process -Id $helper.processId -Force -ErrorAction Stop
      $results += [PSCustomObject]@{
        processId = $helper.processId
        targetPid = $helper.targetPid
        steamPid = $helper.steamPid
        status = "stopped"
      }
    } catch {
      $results += [PSCustomObject]@{
        processId = $helper.processId
        targetPid = $helper.targetPid
        steamPid = $helper.steamPid
        status = "failed"
        error = $_.Exception.Message
      }
    }
  }

  Write-MatrixJsonFile -Path $DestinationFile -Value ([PSCustomObject]@{
    kind = "steam-bridge-windows-stale-overlay-helper-cleanup"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    staleOverlayHelpersBeforeCleanup = @($staleHelpers)
    cleanupResults = @($results)
    overlayHelpersAfterCleanup = @(Get-OverlayHelperDiagnostics)
  }) -Depth 8
  Write-Host ("Stale Steam overlay helper cleanup checked {0} helper(s), stopped {1}. Details: {2}" -f $helpers.Count, ($results | Where-Object { $_.status -eq "stopped" }).Count, $DestinationFile)
}

function Get-SmokePackageProcesses {
  $trimChars = @([char]92, [char]47)
  $pathSeparator = [string][char]92
  $normalizedAppDir = ([System.IO.Path]::GetFullPath($AppDir)).TrimEnd($trimChars).ToLowerInvariant()
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'SteamBridgeSmoke.exe'" -ErrorAction SilentlyContinue)
  $matched = @()

  foreach ($process in $processes) {
    $executablePath = [string]$process.ExecutablePath
    $commandLine = [string]$process.CommandLine
    $executablePathLower = $executablePath.ToLowerInvariant()
    $commandLineLower = $commandLine.ToLowerInvariant()
    $belongsToPackage = (
      ($executablePathLower -and $executablePathLower.StartsWith($normalizedAppDir + $pathSeparator)) -or
      ($commandLineLower -and $commandLineLower.Contains($normalizedAppDir))
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
    try {
      Stop-Process -Id $process.processId -Force -ErrorAction Stop
      $results += [PSCustomObject]@{
        processId = $process.processId
        status = "stopped"
      }
    } catch {
      $results += [PSCustomObject]@{
        processId = $process.processId
        status = "failed"
        error = $_.Exception.Message
      }
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
    packageAppDir = [System.IO.Path]::GetFullPath($AppDir)
    processesBeforeCleanup = @($before)
    cleanupResults = @($results)
    processesAfterCleanup = @($after)
  }
  Write-MatrixJsonFile -Path $DestinationFile -Value $cleanup -Depth 8

  if ($before.Count -gt 0) {
    Write-Host ("Stopped {0} leftover SteamBridgeSmoke package process(es) for {1}. Details: {2}" -f $before.Count, $Phase, $DestinationFile)
  }
  if ($after.Count -gt 0) {
    throw "Found $($after.Count) leftover SteamBridgeSmoke package process(es) after cleanup. See $DestinationFile."
  }
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
  $packageValidator = Join-Path $AppDir "resources\app\node_modules\steam-bridge\bin\validate-checkout-target.cjs"
  if (Test-Path -LiteralPath $packageValidator) {
    return $packageValidator
  }

  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir) {
    $repoRoot = Split-Path -Parent $scriptDir
    $repoValidator = Join-Path $repoRoot "packages\steam-bridge\bin\validate-checkout-target.cjs"
    if (Test-Path -LiteralPath $repoValidator) {
      return $repoValidator
    }
  }

  throw "Missing Steam checkout target validator. Expected it in the package or repo checkout."
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

function Test-MatrixCloseProbeRequirements {
  param([object[]]$Cases)

  $shortcutToggleCases = @($Cases | Where-Object { $_.shortcutToggleProbe })
  if ($shortcutToggleCases.Count -gt 0 -and -not $CloseProbe) {
    $caseIds = (($shortcutToggleCases | ForEach-Object { $_.id }) -join ", ")
    throw "Selected Windows shortcut toggle probe case(s) require -CloseProbe so the matrix can send Shift+Tab and capture close/back-to-app proof: $caseIds"
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
  $backup = Join-Path $ArtifactRoot "windows-shortcuts.vdf.bak"
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

  if (-not $InstallShortcut) {
    if ($AssumeShortcutConfigured) {
      $assumedShortcutPath = Join-Path (Join-Path $ArtifactRoot "00-preflight") "assumed-shortcut.json"
      $assumedShortcut = [PSCustomObject]@{
        ok = -not [bool]$dryResult.changed
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        shortcutName = $ShortcutName
        requestedShortcutGameId = $ShortcutGameId
        expectedShortcutGameId = [string]$dryResult.gameId
        changed = [bool]$dryResult.changed
        action = $dryResult.action
        existingMatches = [bool]$dryResult.existingMatches
        result = $dryResult
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
  $output | Write-Host
  $result = Read-PrefixedJson -Text ($output -join "`n") -Prefix "STEAM_SHORTCUT_RESULT "
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
    [string]$ManagedOverlayResultMode = "",
    [string]$WebModal = "",
    [string]$StoreRouteOverride = "",
    [string]$DialogOverride = "",
    [string]$UserDialogOverride = "",
    [string]$ShortcutTargetOverride = "",
    [string]$CheckoutTransactionIdOverride = "",
    [string]$CheckoutJsonFileOverride = "",
    [string]$InitTxnRequestFileOverride = "",
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
    managedOverlayResultMode = $ManagedOverlayResultMode
    webModal = $WebModal
    storeRoute = $StoreRouteOverride
    dialog = $DialogOverride
    userDialog = $UserDialogOverride
    shortcutTarget = $ShortcutTargetOverride
    checkoutTransactionId = $CheckoutTransactionIdOverride
    checkoutJsonFile = $CheckoutJsonFileOverride
    initTxnRequestFile = $InitTxnRequestFileOverride
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
    [string]$StoreRouteOverride = ""
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
      -StoreRouteOverride $storeRouteOverride
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
    New-ManagedOpenAndWaitCase -Id "11-managed-web-open-and-wait" -Action "presenter-web-open-and-wait" -WebModal "true"
    New-Case `
      -Id "11b-managed-duplicate-open-guard" `
      -Action "presenter-duplicate-open-guard" `
      -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-duplicate-open-guard", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") `
      -RequireOverlayActivated `
      -RequireManagedOverlayComplete `
      -ManagedOverlayResultMode "complete" `
      -WebModal "true"
    New-ManagedOpenAndWaitCase -Id "12-managed-store-open-and-wait" -Action "presenter-store-open-and-wait" -StoreRouteOverride $StoreRoute
    New-ManagedOpenAndWaitCase -Id "13-managed-friends-open-and-wait" -Action "presenter-friends-open-and-wait"
    New-ManagedOpenAndWaitCase -Id "14-managed-dialog-open-and-wait" -Action "presenter-dialog-auto-open-and-wait" -DialogOverride $Dialog
    New-ShortcutOpenAndWaitCase -Id "15-managed-shortcut" -ShortcutTargetOverride $ShortcutTarget -CheckoutTransactionIdOverride $shortcutCheckoutTransactionIdForCase -CheckoutJsonFileOverride $shortcutCheckoutJsonFileForCase -InitTxnRequestFileOverride $shortcutCheckoutInitTxnRequestFileForCase
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
      -ResultDelayMs 30000
    New-Case -Id "16-managed-checkout-route" -Action "presenter-checkout" -RequireEvent @("overlay:presenter-open", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-checkout-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete" -CheckoutTransactionIdOverride $checkoutTransactionIdForCase -CheckoutJsonFileOverride $checkoutJsonFileForCase -InitTxnRequestFileOverride $checkoutInitTxnRequestFileForCase -RequireMicroTxnCallback:$RequireMicroTxnCallback
    New-ManagedOpenAndWaitCase -Id "17-managed-profile-open-and-wait" -Action "presenter-profile-open-and-wait"
    New-ManagedOpenAndWaitCase -Id "18-managed-players-open-and-wait" -Action "presenter-players-open-and-wait"
    New-ManagedOpenAndWaitCase -Id "19-managed-community-open-and-wait" -Action "presenter-community-open-and-wait"
    New-ManagedOpenAndWaitCase -Id "20-managed-stats-open-and-wait" -Action "presenter-stats-open-and-wait"
    New-ManagedOpenAndWaitCase -Id "21-managed-achievements-open-and-wait" -Action "presenter-achievements-open-and-wait"
    New-ManagedOpenAndWaitCase -Id "22-managed-user-open-and-wait" -Action "presenter-user-open-and-wait"
    New-Case -Id "23-raw-native-dialog-open-observe" -Action "presenter-dialog" -RequireEvent @("overlay:presenter-open") -RequireOverlayActivated -DialogOverride $Dialog -CloseProbeOnActivation -ResultDelayMs 12000
    New-Case -Id "24-raw-native-user-open-observe" -Action "presenter-user-native" -RequireEvent @("overlay:presenter-open") -RequireOverlayActivated -UserDialogOverride $UserDialog -CloseProbeOnActivation -ResultDelayMs 12000
    New-Case -Id "25-managed-achievement-progress" -Action "presenter-achievement-progress" -RequireEvent @("overlay:presenter-attach", "achievement:progress", "overlay:passive-notification-parked") -RequireNoOverlayActivation -AllowOverlayNotReady -RequirePassiveNotification -ResultDelayMs 10000
    New-Case -Id "26-managed-achievement-unlock" -Action "presenter-achievement-unlock" -RequireEvent @("overlay:presenter-attach", "achievement:unlock", "overlay:passive-notification-parked") -RequireNoOverlayActivation -AllowOverlayNotReady -RequirePassiveNotification -ResultDelayMs 10000
  )

  $shortcutRoutes = @(New-PublicShortcutRouteCases)

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
      -RequireMicroTxnCallback:$RequireMicroTxnCallback
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
      -InitTxnRequestFileOverride $checkoutInitTxnRequestFileForCase
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
    shortcutName = $ShortcutName
    shortcutExe = $ShortcutExe
    shortcutStartDir = $ShortcutStartDir
    shortcutLaunchPrefix = $ShortcutLaunchPrefix
    javaScriptRunnerExe = $JavaScriptRunnerExe
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
    closeProbeEvidenceSchema = 1
    skipNativeLoadGate = [bool]$SkipNativeLoadGate
    skipRenderHealthGate = [bool]$SkipRenderHealthGate
    allowUnhealthyDefaultRender = [bool]$AllowUnhealthyDefaultRender
    requireMicroTxnCallback = [bool]$RequireMicroTxnCallback
    initTxnCapture = [PSCustomObject]@{
      hasRequestFile = [bool]$InitTxnRequestFile
      captureInApp = [bool]$InitTxnRequestFile
      apiKeyEnvProvided = [bool]$InitTxnApiKeyEnv
      endpointOption = $InitTxnEndpoint
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

function Start-WindowsOverlayCloseProbe {
  param($Case, [string]$CaseDir, [string]$DiagnosticDir)

  $shortcutToggleProbe = [bool]$Case.shortcutToggleProbe
  if (-not $CloseProbe -or (-not $Case.requireManagedOverlayComplete -and -not $Case.closeProbeOnActivation -and -not $shortcutToggleProbe)) {
    return $null
  }

  $lifecycleLog = Join-Path $DiagnosticDir "lifecycle.jsonl"
  $probeLog = Join-Path $CaseDir "close-probe.log"
  $input = Resolve-CloseProbeInputForCase -Case $Case
  $settleMs = [Math]::Max(0, $CloseProbeSettleMs)
  $timeoutSeconds = [Math]::Max(1, $CloseProbeTimeoutSeconds)
  New-Item -ItemType Directory -Force -Path $CaseDir | Out-Null

  $probeScript = @"
`$ErrorActionPreference = "Continue"
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

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

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

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

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);

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

  public static uint SendMouseClick(int x, int y, out int lastError) {
    if (!SetCursorPos(x, y)) {
      lastError = Marshal.GetLastWin32Error();
      return 0;
    }

    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
    lastError = 0;
    return 3;
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
  `$method = "sendinput"
  if (`$sent -ne 3) {
    `$fallbackLastError = 0
    `$fallbackSent = [SteamBridgeWindowsProbe]::SendMouseClick(`$X, `$Y, [ref]`$fallbackLastError)
    `$sent = `$fallbackSent
    `$lastError = `$fallbackLastError
    `$method = "cursor-mouse-event-fallback"
  }

  return [PSCustomObject]@{
    sent = `$sent
    expected = 3
    lastError = `$lastError
    method = `$method
    x = `$X
    y = `$Y
  }
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

  [PSCustomObject]@{
    hwnd = ("0x{0:X}" -f `$handle.ToInt64())
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
  param([datetime]`$Deadline)

  `$readyDeadline = (Get-Date).AddSeconds([Math]::Min(8, [Math]::Max(1, (`$Deadline - (Get-Date)).TotalSeconds)))
  `$attempt = 0
  `$lastTarget = `$null
  while ((Get-Date) -lt `$readyDeadline) {
    `$attempt += 1
    `$foreground = Get-ForegroundProbeSnapshot
    `$screenshot = Capture-ProbeScreen ("web-close-ready-{0:D2}" -f `$attempt)
    `$target = Get-WebCloseClickTarget -Foreground `$foreground -Screenshot `$screenshot
    if (`$target) {
      `$lastTarget = `$target
    }
    `$analysis = Test-WebClosePanelScreenshot -Screenshot `$screenshot -Foreground `$foreground
    if (`$analysis.ready) {
      Write-ProbeEvent "probe:web-close-ready" ([PSCustomObject]@{
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
  `$screenshot = Capture-ProbeScreen "web-close-ready-timeout"
  `$analysis = Test-WebClosePanelScreenshot -Screenshot `$screenshot -Foreground `$foreground
  if (-not `$analysis.target -and `$lastTarget) {
    `$analysis | Add-Member -NotePropertyName target -NotePropertyValue `$lastTarget -Force
  }
  Write-ProbeEvent "probe:web-close-ready-timeout" ([PSCustomObject]@{
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

function Focus-LifecycleNativePresenterForCloseInput {
  `$script:LifecycleNativePresenterCloseHandle = [IntPtr]::Zero
  `$geometry = Get-LifecyclePresenterGeometry
  `$handleText = if (`$geometry) { [string]`$geometry.hwnd } else { "" }
  `$evidence = [ordered]@{
    source = "lifecycle-native-host"
    attempted = `$false
    handlePresent = -not [string]::IsNullOrWhiteSpace(`$handleText)
    handleFormatValid = `$false
    windowValid = `$false
    wasForeground = `$false
    setForegroundResult = `$false
    focused = `$false
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

  `$evidence.wasForeground = ([SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle)
  `$evidence.attempted = `$true
  `$evidence.setForegroundResult = [SteamBridgeWindowsProbe]::SetForegroundWindow(`$handle)
  `$evidence.focused = ([SteamBridgeWindowsProbe]::GetForegroundWindow() -eq `$handle)
  if (`$evidence.focused) {
    `$evidence.reason = if (`$evidence.wasForeground) { "already-foreground" } else { "focused" }
  } else {
    `$evidence.reason = "set-foreground-not-observed"
  }

  return [PSCustomObject]`$evidence
}

function Confirm-LifecycleNativePresenterForegroundForCloseInput {
  `$handle = `$script:LifecycleNativePresenterCloseHandle
  `$evidence = [ordered]@{
    source = "lifecycle-native-host"
    handlePresent = (`$handle -and `$handle -ne [IntPtr]::Zero)
    windowValid = `$false
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
  dpiAwareness = `$script:ProbeDpiAwareness
  shortcutToggleProbe = [bool]::Parse('$shortcutToggleProbe')
  settleMs = $settleMs
  timeoutSeconds = $timeoutSeconds
})

`$shortcutToggleProbe = [bool]::Parse('$shortcutToggleProbe')
`$deadline = (Get-Date).AddSeconds($timeoutSeconds)
`$openSent = `$false
`$sent = `$false
while ((Get-Date) -lt `$deadline -and -not `$sent) {
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
    if (`$text -match 'overlay:presenter-wait-shown' -or (`$text -match 'callback:overlay-activated' -and `$text -match '"active":true')) {
      `$detectedForeground = Get-ForegroundProbeSnapshot
      Write-ProbeEvent "probe:detected" ([PSCustomObject]@{
        foreground = `$detectedForeground
        screenshot = Capture-ProbeScreen "detected"
        processes = Get-ProbeProcessSnapshot
      })
      `$foregroundClear = Clear-BlockingForegroundWindow `$detectedForeground
      if (`$foregroundClear.attempted) {
        Write-ProbeEvent "probe:foreground-clear" `$foregroundClear
      }
      if ($settleMs -gt 0) {
        Start-Sleep -Milliseconds $settleMs
      }
      `$webCloseReadiness = `$null
      if ('$input' -eq 'web-close-click-sendinput') {
        `$webCloseReadiness = Wait-WebClosePanelReady -Deadline `$deadline
      }
      Write-ProbeEvent "probe:before-send" ([PSCustomObject]@{
        foreground = Get-ForegroundProbeSnapshot
        screenshot = Capture-ProbeScreen "before-send"
        webCloseReadiness = `$webCloseReadiness
        processes = Get-ProbeProcessSnapshot
      })
      `$nativePresenterFocus = Focus-LifecycleNativePresenterForCloseInput
      Write-ProbeEvent "probe:native-presenter-focus" `$nativePresenterFocus
      if (-not `$nativePresenterFocus.focused) {
        Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
          reason = "native-presenter-focus-not-confirmed"
          focus = `$nativePresenterFocus
        })
        `$sent = `$true
        continue
      }
      `$nativeInputSent = `$null
      `$nativePointerSent = `$null
      `$shell = `$null
      `$target = `$null
      if ('$input' -eq 'escape' -or '$input' -eq 'close-tab' -or '$input' -eq 'toggle') {
        `$shell = New-Object -ComObject WScript.Shell
      } elseif ('$input' -eq 'web-close-click-sendinput') {
        `$foreground = Get-ForegroundProbeSnapshot
        if (`$webCloseReadiness -and `$webCloseReadiness.target) {
          `$target = `$webCloseReadiness.target
        }
        if (-not `$target) {
          `$target = Get-WebCloseClickTarget `$foreground
        }
        Write-ProbeEvent "probe:web-close-click-target" ([PSCustomObject]@{
          target = `$target
          foreground = `$foreground
        })
      }
      `$nativePresenterPreDispatch = Confirm-LifecycleNativePresenterForegroundForCloseInput
      if (-not `$nativePresenterPreDispatch.focused) {
        Write-ProbeEvent "probe:close-input-skipped" ([PSCustomObject]@{
          reason = "native-presenter-focus-lost-before-dispatch"
          focus = `$nativePresenterFocus
          preDispatch = `$nativePresenterPreDispatch
        })
        `$sent = `$true
        continue
      }
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
        input = '$input'
        nativePresenterPreDispatch = `$nativePresenterPreDispatch
        nativeInputSent = `$nativeInputSent
        nativePointerSent = `$nativePointerSent
        foreground = Get-ForegroundProbeSnapshot
        processes = Get-ProbeProcessSnapshot
      })
      Start-Sleep -Milliseconds 250
      Write-ProbeEvent "probe:after-send" ([PSCustomObject]@{
        input = '$input'
        foreground = Get-ForegroundProbeSnapshot
        screenshot = Capture-ProbeScreen "after-send"
        processes = Get-ProbeProcessSnapshot
      })
      `$sent = `$true
    }
  }
  if (-not `$sent) {
    Start-Sleep -Milliseconds 250
  }
}

if (-not `$sent) {
  Write-ProbeEvent "probe:timeout" ([PSCustomObject]@{
    shortcutToggleProbe = `$shortcutToggleProbe
    openSent = `$openSent
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
      Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {
    Write-Host ("Windows close probe cleanup warning: {0}" -f $_.Exception.Message)
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

function Write-CaseLaunchEnv {
  param($Case, [string]$ResultFile, [string]$DiagnosticDir)

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
    "-TimeoutSeconds", "$TimeoutSeconds"
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

function Invoke-MatrixCase {
  param($Case)

  $caseDir = Join-Path $ArtifactRoot $Case.id
  $resultFile = Join-Path $caseDir "result.log"
  $diagnosticDir = Join-Path $caseDir "diagnostics"
  $helperLog = Join-Path $caseDir "helper.log"
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null

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
    "-TimeoutSeconds", "$TimeoutSeconds",
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
  if ($Case.allowOverlayNotReady) {
    $args += "-AllowOverlayNotReady"
  }

  if ($LaunchMode -in @("steam-launch", "steam-app")) {
    Write-CaseLaunchEnv -Case $Case -ResultFile $resultFile -DiagnosticDir $diagnosticDir
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
  $closeProbeProcess = Start-WindowsOverlayCloseProbe -Case $Case -CaseDir $caseDir -DiagnosticDir $diagnosticDir
  $caseStartedAt = Get-Date
  try {
    Invoke-Helper -Arguments $args -LogFile $helperLog
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
    Collect-SteamClientDiagnostics -DestinationDir (Join-Path $caseDir "steam-client") -Phase ("case-{0}" -f $Case.id)
  }
}

Resolve-SmokeExe | Out-Null
New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null
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
  Write-Host ("  launchEnvFile: {0}" -f $LaunchEnvFile)
  if ($LaunchMode -eq "steam-launch") {
    Write-Host ("  installShortcut: {0}" -f $InstallShortcut)
    if ($ShortcutExe) {
      Write-Host ("  shortcutExe: {0}" -f $ShortcutExe)
    }
    if ($ShortcutStartDir) {
      Write-Host ("  shortcutStartDir: {0}" -f $ShortcutStartDir)
    }
    if ($ShortcutLaunchPrefix) {
      Write-Host ("  shortcutLaunchPrefix: {0}" -f $ShortcutLaunchPrefix)
    }
    if ($JavaScriptRunnerExe) {
      Write-Host ("  javaScriptRunnerExe: {0}" -f $JavaScriptRunnerExe)
    }
  } else {
    Write-Host "  realSteamAppLaunchOptions: --steam-bridge-smoke-env-file=<launchEnvFile>"
  }
}

Write-MatrixManifest -Cases $selectedMatrixCases

if ($CleanStaleOverlayHelpers) {
  Stop-StaleSteamOverlayHelpers -DestinationFile (Join-Path $ArtifactRoot "stale-overlay-helper-cleanup.json")
}
if (Test-IsLiveSteamLaunchSuite) {
  Stop-SmokePackageProcesses -DestinationFile (Join-Path $ArtifactRoot "smoke-process-cleanup-before-run.json") -Phase "before-run"
}

Invoke-Preflight

if ($LaunchMode -eq "steam-launch" -and $Suite -eq "shortcut") {
  Ensure-SteamShortcut
  Write-Host ("Windows overlay matrix shortcut setup passed. Launch URL: steam://rungameid/{0}" -f $ShortcutGameId)
  Write-Host ("Artifacts: {0}" -f $ArtifactRoot)
  exit 0
}

if ((Test-IsLiveSteamLaunchSuite) -and $LaunchMode -eq "steam-launch") {
  Ensure-SteamShortcut
}

if ($Suite -eq "readiness") {
  Write-Host ("Windows overlay matrix readiness passed. Artifacts: {0}" -f $ArtifactRoot)
  exit 0
}

foreach ($case in $selectedMatrixCases) {
  Invoke-MatrixCase -Case $case
}

if (Test-IsLiveSteamLaunchSuite) {
  Stop-SmokePackageProcesses -DestinationFile (Join-Path $ArtifactRoot "smoke-process-cleanup-after-cases.json") -Phase "after-cases"
}

Write-Host ("Windows overlay matrix passed. Artifacts: {0}" -f $ArtifactRoot)
