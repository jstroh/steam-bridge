[CmdletBinding()]
param(
  [ValidateSet("baseline", "managed", "full", "preflight", "readiness", "shortcut")]
  [string]$Suite = "baseline",

  [ValidateSet("steam-launch", "direct")]
  [string]$LaunchMode = "steam-launch",

  [string]$AppDir = "",
  [string]$ArtifactRoot = "",
  [int]$AppId = 480,
  [string]$ShortcutGameId = "",
  [switch]$InstallShortcut,
  [switch]$AssumeShortcutConfigured,
  [string]$SteamUserId = "",
  [string]$ShortcutsPath = "",
  [string]$ShortcutName = "Steam Bridge Smoke",
  [string]$LaunchEnvFile = "",
  [switch]$AllowShortcutUpdateWhileSteamRunning,
  [string]$OverlayProfile = "diagnostic",
  [string]$OverlayDisableDirectComposition = "",
  [string]$WindowMode = "windowed",
  [string]$WebUrl = "",
  [string]$Dialog = "Friends",
  [string]$ShortcutTarget = "friends",
  [string]$CheckoutTransactionId = "123456789",
  [string]$OnlyCase = "",
  [int]$TimeoutSeconds = 120,
  [switch]$SkipNativeLoadGate,
  [switch]$CleanStaleOverlayHelpers,
  [switch]$AllowUnhealthySteamClientLogs,
  [int]$SteamClientHealthRecentMinutes = 30,
  [string]$OverlayInProcessGpu = "1"
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

if ($Suite -eq "readiness" -and $LaunchMode -ne "steam-launch") {
  throw "-Suite readiness checks live Steam-launched readiness and requires -LaunchMode steam-launch."
}

function Resolve-HelperPath {
  $helper = Join-Path $AppDir "windows-electron-smoke.ps1"
  if (-not (Test-Path -LiteralPath $helper)) {
    throw "Missing windows-electron-smoke.ps1 at $helper"
  }
  return $helper
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe"
  }
  return $exe
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
  $steamPath = Resolve-SteamInstallPath
  $logs = Join-Path $steamPath "logs"
  $generatedAt = (Get-Date).ToUniversalTime()
  $cutoff = $generatedAt.AddMinutes(-1 * [math]::Max(1, $SteamClientHealthRecentMinutes))
  $signals = @()
  $warnings = @()

  $patterns = @(
    @{ code = "steam-cef-dxgi-not-currently-available"; pattern = "(?i)(0x887A0022|887a0022|DXGI_ERROR_NOT_CURRENTLY_AVAILABLE)" },
    @{ code = "steam-cef-angle-context-lost"; pattern = "(?i)(context lost|EGL_CONTEXT_LOST|display had a context loss|Could not create additional swap chains|Device lost in SwapChain11)" },
    @{ code = "steam-cef-gpu-process-crash"; pattern = "(?i)(Exiting GPU process because|GPU process exited unexpectedly|GPU process has crashed)" },
    @{ code = "steam-overlay-swapchain-failure"; pattern = "(?i)(CreateSwapChainForHWND failed|g_IDXGIFactory2_CreateSwapChainForHWND failed)" },
    @{ code = "steam-overlay-resource-failure"; pattern = "(?i)(CreateProcess failed\. Error: 1455|Failed creating file mapping|Failed creating CEF paint event)" }
  )

  if (-not (Test-Path -LiteralPath $logs)) {
    return [PSCustomObject]@{
      kind = "steam-bridge-windows-steam-client-rendering-health"
      generatedAt = $generatedAt.ToString("o")
      status = "unknown"
      healthy = $false
      recentWindowMinutes = $SteamClientHealthRecentMinutes
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
        foreach ($pattern in $patterns) {
          if ($line -notmatch $pattern.pattern) {
            continue
          }

          $timestampUtc = ConvertTo-SteamLogTimestampUtc -Line $line
          $isRecent = if ($timestampUtc) {
            $timestampUtc -ge $cutoff
          } else {
            $file.LastWriteTimeUtc -ge $cutoff
          }
          $signals += [PSCustomObject]@{
            code = $pattern.code
            logFile = $name
            tailLine = ($index + 1)
            timestampUtc = if ($timestampUtc) { $timestampUtc.ToString("o") } else { $null }
            recent = [bool]$isRecent
            line = Limit-DiagnosticLine -Line $line
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

function Test-NeedsWindowsLiveRunReadiness {
  return ($LaunchMode -eq "steam-launch" -and $Suite -ne "preflight" -and $Suite -ne "shortcut")
}

function Test-IsLiveSteamLaunchSuite {
  $needsReadiness = Test-NeedsWindowsLiveRunReadiness
  return ($needsReadiness -and $Suite -ne "readiness")
}

function Test-WindowsLiveRunReadiness {
  param([string]$DestinationFile)

  $steamProcesses = @(Get-Process steam -ErrorAction SilentlyContinue |
    Select-Object ProcessName,Id,StartTime,Responding,MainWindowTitle,Path)
  $overlayHelpers = @(Get-OverlayHelperDiagnostics)
  $staleOverlayHelpers = @($overlayHelpers | Where-Object { $_.orphaned })
  $resourceSnapshot = Get-WindowsResourceSnapshot
  $renderingHealth = Get-SteamClientRenderingHealth
  $warnings = @()
  $errors = @()

  if ($steamProcesses.Count -eq 0) {
    $errors += (
      "Steam is not running. Start Steam once in the interactive Windows desktop session, " +
      "wait for the client UI to render normally, then rerun the matrix. The matrix will not silently start Steam for live overlay proof."
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
    $processes = @(Get-Process steam,steamwebhelper,gameoverlayui,gameoverlayui64,SteamBridgeSmoke -ErrorAction SilentlyContinue |
      Select-Object ProcessName,Id,StartTime,Responding,MainWindowTitle,Path)
    $overlayHelpers = @(Get-OverlayHelperDiagnostics)
    $resourceSnapshot = Get-WindowsResourceSnapshot
    $renderingHealth = Get-SteamClientRenderingHealth
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

function Resolve-JavaScriptRunner {
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

function Invoke-JavaScriptRunner {
  param(
    [Parameter(Mandatory = $true)]
    $Runner,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  if ($Runner.UseElectronRunAsNode) {
    $cmdLine =
      "set ELECTRON_RUN_AS_NODE=1&& " +
      (ConvertTo-CmdArgument $Runner.Command) +
      " " +
      (($Arguments | ForEach-Object { ConvertTo-CmdArgument $_ }) -join " ")
    $output = & cmd.exe /d /s /c $cmdLine
  } else {
    $output = & $Runner.Command @Arguments
  }
  if ($LASTEXITCODE -ne 0) {
    throw "JavaScript runner failed with exit code $LASTEXITCODE."
  }
  return $output
}

function ConvertTo-CmdArgument {
  param([string]$Value)

  if ($null -eq $Value) {
    return '""'
  }
  $escaped = $Value -replace '(\\*)"', '$1$1\"'
  $escaped = $escaped -replace '(\\+)$', '$1$1'
  return '"' + $escaped + '"'
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

function Test-NativeLoadGate {
  param([string]$PreflightDir, [string]$PreflightJson)

  if ($SkipNativeLoadGate) {
    return
  }

  $nativeAddon = Resolve-NativeAddon
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

  $gateDir = Join-Path $PreflightDir "native-load-gate"
  $gateLog = Join-Path $gateDir "helper.log"
  $resultFile = Join-Path $gateDir "result.log"
  $diagnosticDir = Join-Path $gateDir "diagnostics"
  $gateTimeoutSeconds = if ($TimeoutSeconds -lt 30) { $TimeoutSeconds } else { 30 }

  Write-Host "Running Windows native-load gate with the packaged app."
  $gateArgs = @(
    "-Mode", "direct",
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-Action", "none",
    "-ResultFile", $resultFile,
    "-DiagnosticDir", $diagnosticDir,
    "-OverlayProfile", $OverlayProfile,
    "-WindowMode", $WindowMode,
    "-ResultDelayMs", "1000",
    "-TimeoutSeconds", "$gateTimeoutSeconds",
    "-RequireNoOverlayActivation",
    "-RequireNoCrashes"
  )
  if ($OverlayInProcessGpu) {
    $gateArgs += @("-OverlayInProcessGpu", $OverlayInProcessGpu)
  }
  if ($OverlayDisableDirectComposition) {
    $gateArgs += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }

  try {
    Invoke-Helper -Arguments $gateArgs -LogFile $gateLog
  } catch {
    $postGatePreflightLog = Join-Path $gateDir "post-gate-preflight.log"
    try {
      Invoke-Helper -Arguments @(
        "-Mode", "preflight",
        "-AppDir", $AppDir,
        "-AppId", "$AppId",
        "-PreflightJsonFile", (Join-Path $gateDir "post-gate-preflight.json")
      ) -LogFile $postGatePreflightLog
    } catch {
      Write-Host ("Post-gate preflight failed; continuing with original native-load gate failure. Output path: {0}" -f $postGatePreflightLog)
    }
    throw (
      "Windows native-load gate failed before live overlay cases. " +
      "The exact packaged app could not initialize Steam cleanly; see $gateLog, $postGatePreflightLog, post-gate-preflight.json, and $diagnosticDir. " +
      "On Smart App Control/App Control machines, a local self-signed Authenticode result can still fail this gate, especially when VerifiedAndReputableDesktop policies are enforced. " +
      "Use a trusted/reputable publisher-signed package or explicitly disable SAC on this development machine before live overlay proof. " +
      "Original error: $($_.Exception.Message)"
    )
  }
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
  $helper = Resolve-HelperPath
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $helper `
    -Mode print-launch-options `
    -AppDir $AppDir `
    -AppId $AppId `
    -SmokeEnvFile $LaunchEnvFile
  $line = @($output | Where-Object { $_ -and $_ -notlike "Steam shortcut launch options:*" } | Select-Object -First 1)
  if (-not $line) {
    throw "Could not compute stable Windows shortcut launch options."
  }
  return [string]$line
}

function Ensure-SteamShortcut {
  if (-not $InstallShortcut) {
    if ($AssumeShortcutConfigured) {
      return
    }
    throw "Steam-launched Windows matrix runs require -InstallShortcut or -AssumeShortcutConfigured so the shortcut uses -LaunchEnvFile."
  }

  $shortcuts = Resolve-ShortcutsPath
  $upsert = Resolve-UpsertShortcutPath
  $runner = Resolve-JavaScriptRunner
  $exe = Resolve-SmokeExe
  $launchOptions = Get-StableShortcutLaunchOptions
  $backup = Join-Path $ArtifactRoot "windows-shortcuts.vdf.bak"
  $baseArgs = @(
    $upsert,
    "--shortcuts", $shortcuts,
    "--backup", $backup,
    "--app-name", $ShortcutName,
    "--exe", $exe,
    "--start-dir", $AppDir,
    "--launch-options", $launchOptions,
    "--json"
  )

  $dryOutput = Invoke-JavaScriptRunner -Runner $runner -Arguments @($baseArgs + "--dry-run")
  $dryResult = Read-PrefixedJson -Text ($dryOutput -join "`n") -Prefix "STEAM_SHORTCUT_RESULT "
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
    [switch]$RequireManagedOverlayComplete,
    [string]$ManagedOverlayResultMode = "",
    [string]$WebModal = "",
    [string]$DialogOverride = "",
    [string]$ShortcutTargetOverride = "",
    [string]$CheckoutTransactionIdOverride = "",
    [int]$ResultDelayMs = 8000
  )

  return [PSCustomObject]@{
    id = $Id
    action = $Action
    requireEvent = $RequireEvent
    requireOverlayActivated = [bool]$RequireOverlayActivated
    requireNoOverlayActivation = [bool]$RequireNoOverlayActivation
    allowOverlayNotReady = [bool]$AllowOverlayNotReady
    requireManagedOverlayComplete = [bool]$RequireManagedOverlayComplete
    managedOverlayResultMode = $ManagedOverlayResultMode
    webModal = $WebModal
    dialog = $DialogOverride
    shortcutTarget = $ShortcutTargetOverride
    checkoutTransactionId = $CheckoutTransactionIdOverride
    resultDelayMs = $ResultDelayMs
  }
}

function Get-MatrixCases {
  $baseline = @(
    New-Case -Id "01-web" -Action "web" -RequireEvent @("overlay:web") -RequireOverlayActivated -WebModal "true"
    New-Case -Id "02-store" -Action "store" -RequireEvent @("overlay:store") -RequireOverlayActivated
    New-Case -Id "03-friends-dialog" -Action "friends" -RequireEvent @("overlay:dialog") -RequireOverlayActivated -DialogOverride "Friends"
    New-Case -Id "04-achievement-progress" -Action "achievement-progress" -RequireEvent @("achievement:progress") -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 2500
    New-Case -Id "05-achievement-unlock" -Action "achievement-unlock" -RequireEvent @("achievement:unlock") -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 2500
    New-Case -Id "99-none" -Action "none" -RequireNoOverlayActivation -AllowOverlayNotReady -ResultDelayMs 1200
  )

  $managed = @(
    New-Case -Id "10-presenter-ready" -Action "presenter-ready" -RequireEvent @("overlay:presenter-ready") -RequireNoOverlayActivation -ResultDelayMs 1200
    New-Case -Id "11-managed-web-open-and-wait" -Action "presenter-web-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete" -WebModal "true"
    New-Case -Id "12-managed-store-open-and-wait" -Action "presenter-store-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete"
    New-Case -Id "13-managed-friends-open-and-wait" -Action "presenter-friends-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete"
    New-Case -Id "14-managed-dialog-open-and-wait" -Action "presenter-dialog-auto-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete" -DialogOverride "Friends"
    New-Case -Id "15-managed-shortcut" -Action "presenter-shortcut-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete" -ShortcutTargetOverride $ShortcutTarget
    New-Case -Id "16-managed-checkout-route" -Action "presenter-checkout" -RequireEvent @("overlay:presenter-open", "overlay:presenter-wait-closed", "overlay:presenter-parked", "overlay:presenter-checkout-open-and-wait-complete") -RequireOverlayActivated -RequireManagedOverlayComplete -ManagedOverlayResultMode "complete" -CheckoutTransactionIdOverride $CheckoutTransactionId
  )

  switch ($Suite) {
    "baseline" { return $baseline }
    "managed" { return $managed }
    "full" { return @($baseline + $managed) }
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
        $_ -and ([string]$_).StartsWith("Windows steam-launch smoke completed.")
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

function Invoke-Preflight {
  $preflightDir = Join-Path $ArtifactRoot "00-preflight"
  New-Item -ItemType Directory -Force -Path $preflightDir | Out-Null
  $preflightLog = Join-Path $preflightDir "preflight.log"
  $preflightJson = Join-Path $preflightDir "preflight.json"

  try {
    Invoke-Helper -Arguments @(
      "-Mode", "preflight",
      "-AppDir", $AppDir,
      "-AppId", "$AppId",
      "-PreflightJsonFile", $preflightJson
    ) -LogFile $preflightLog
  } finally {
    Collect-SteamClientDiagnostics -DestinationDir (Join-Path $preflightDir "steam-client") -Phase "preflight"
  }

  if (Test-NeedsWindowsLiveRunReadiness) {
    Test-WindowsLiveRunReadiness -DestinationFile (Join-Path $preflightDir "live-run-readiness.json")
  }

  if ($Suite -ne "preflight" -and $Suite -ne "readiness") {
    Test-NativeLoadGate -PreflightDir $preflightDir -PreflightJson $preflightJson
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
  if ($Case.webModal) {
    $args += @("-WebModal", $Case.webModal)
  }
  if ($Case.dialog) {
    $args += @("-Dialog", $Case.dialog)
  } elseif ($Dialog) {
    $args += @("-Dialog", $Dialog)
  }
  if ($Case.shortcutTarget) {
    $args += @("-ShortcutTarget", $Case.shortcutTarget)
  }
  if ($Case.checkoutTransactionId) {
    $args += @("-CheckoutTransactionId", $Case.checkoutTransactionId)
  }
  if ($Case.managedOverlayResultMode) {
    $args += @("-ManagedOverlayResultMode", $Case.managedOverlayResultMode)
  }

  $launchEnvLog = Join-Path (Split-Path -Parent $ResultFile) "launch-env.log"
  Invoke-Helper -Arguments $args -LogFile $launchEnvLog
}

function Invoke-MatrixCase {
  param($Case)

  $caseDir = Join-Path $ArtifactRoot $Case.id
  $resultFile = Join-Path $caseDir "result.log"
  $diagnosticDir = Join-Path $caseDir "diagnostics"
  $helperLog = Join-Path $caseDir "helper.log"
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null

  $mode = if ($LaunchMode -eq "steam-launch") { "steam-launch" } else { "direct" }
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
  if ($Case.allowOverlayNotReady) {
    $args += "-AllowOverlayNotReady"
  }

  if ($LaunchMode -eq "steam-launch") {
    if (-not $ShortcutGameId) {
      throw "Missing -ShortcutGameId for steam-launch matrix mode."
    }
    Write-CaseLaunchEnv -Case $Case -ResultFile $resultFile -DiagnosticDir $diagnosticDir
    $args += @("-ShortcutGameId", $ShortcutGameId, "-RequireSteamLaunch")
  }
  if ($OverlayDisableDirectComposition) {
    $args += @("-OverlayDisableDirectComposition", $OverlayDisableDirectComposition)
  }
  if ($Case.webModal) {
    $args += @("-WebModal", $Case.webModal)
  }
  if ($Case.dialog) {
    $args += @("-Dialog", $Case.dialog)
  } elseif ($Dialog) {
    $args += @("-Dialog", $Dialog)
  }
  if ($Case.shortcutTarget) {
    $args += @("-ShortcutTarget", $Case.shortcutTarget)
  }
  if ($Case.checkoutTransactionId) {
    $args += @("-CheckoutTransactionId", $Case.checkoutTransactionId)
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
  if ($Case.requireManagedOverlayComplete) {
    $args += "-RequireManagedOverlayComplete"
  }
  foreach ($event in $Case.requireEvent) {
    $args += @("-RequireEvent", $event)
  }
  if ($Case.action -like "presenter-*") {
    $args += "-RequireZeroManagedOverlayTiming"
  }

  Write-Host ("Running Windows overlay case {0}: {1}" -f $Case.id, $Case.action)
  try {
    Invoke-Helper -Arguments $args -LogFile $helperLog
  } finally {
    Collect-SteamClientDiagnostics -DestinationDir (Join-Path $caseDir "steam-client") -Phase ("case-{0}" -f $Case.id)
  }
}

Resolve-SmokeExe | Out-Null
New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null

Write-Host "Windows overlay matrix:"
Write-Host ("  suite: {0}" -f $Suite)
Write-Host ("  launchMode: {0}" -f $LaunchMode)
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  artifactRoot: {0}" -f $ArtifactRoot)
Write-Host ("  appId: {0}" -f $AppId)
Write-Host ("  overlayProfile: {0}" -f $OverlayProfile)
Write-Host ("  inProcessGpu: {0}" -f $OverlayInProcessGpu)
Write-Host ("  disableDirectComposition: {0}" -f $OverlayDisableDirectComposition)
Write-Host ("  cleanStaleOverlayHelpers: {0}" -f $CleanStaleOverlayHelpers)
if ($OnlyCase) {
  Write-Host ("  onlyCase: {0}" -f $OnlyCase)
}
if ($LaunchMode -eq "steam-launch") {
  Write-Host ("  launchEnvFile: {0}" -f $LaunchEnvFile)
  Write-Host ("  installShortcut: {0}" -f $InstallShortcut)
}

if ($CleanStaleOverlayHelpers) {
  Stop-StaleSteamOverlayHelpers -DestinationFile (Join-Path $ArtifactRoot "stale-overlay-helper-cleanup.json")
}

Invoke-Preflight

if ($LaunchMode -eq "steam-launch" -and $Suite -eq "shortcut") {
  Ensure-SteamShortcut
  Write-Host ("Windows overlay matrix shortcut setup passed. Launch URL: steam://rungameid/{0}" -f $ShortcutGameId)
  Write-Host ("Artifacts: {0}" -f $ArtifactRoot)
  exit 0
}

if (Test-IsLiveSteamLaunchSuite) {
  Ensure-SteamShortcut
}

if ($Suite -eq "readiness") {
  Write-Host ("Windows overlay matrix readiness passed. Artifacts: {0}" -f $ArtifactRoot)
  exit 0
}

foreach ($case in Get-SelectedMatrixCases) {
  Invoke-MatrixCase -Case $case
}

Write-Host ("Windows overlay matrix passed. Artifacts: {0}" -f $ArtifactRoot)
