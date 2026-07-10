[CmdletBinding()]
param(
  [ValidateSet("build", "direct", "steam-launch", "shortcut", "print-launch-options")]
  [string]$Mode = "direct",

  [string]$AppDir = "",
  [string]$ControlDir = "",
  [string]$ArtifactRoot = "",
  [string]$ResultFile = "",
  [int]$AppId = 480,

  [ValidateSet("none", "web", "store", "friends", "dialog", "user")]
  [string]$Action = "user",

  [string]$Url = "",
  [string]$Dialog = "Friends",
  [string]$UserDialog = "steamid",
  [int]$ObserveSeconds = 18,
  [int]$TimeoutSeconds = 90,
  [string]$NativeEnvFile = "",
  [string]$ShortcutName = "Steam Bridge Native Overlay Control",
  [string]$ShortcutGameId = "",
  [switch]$InstallShortcut,
  [switch]$AssumeShortcutConfigured,
  [switch]$AllowShortcutUpdateWhileSteamRunning,
  [string]$SteamUserId = "",
  [string]$ShortcutsPath = ""
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

if (-not $ControlDir) {
  $ControlDir = Join-Path $AppDir "native-overlay-control"
}

if (-not $ArtifactRoot) {
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-native-overlay-control-$timestamp"
}

if (-not $ResultFile) {
  $ResultFile = Join-Path $ArtifactRoot "result.json"
}

if (-not $NativeEnvFile) {
  $NativeEnvFile = Join-Path $env:LOCALAPPDATA "SteamBridgeNativeOverlayControl\native-overlay-control.env"
}

if (-not $Url) {
  $Url = "https://steamcommunity.com/app/$AppId"
}

function Write-ControlJsonFile {
  param([string]$Path, $Value, [int]$Depth = 8)

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

function Resolve-ControlSource {
  $scriptDir = Split-Path -Parent $PSCommandPath
  $candidates = @(
    (Join-Path $scriptDir "windows-native-overlay-control\SteamBridgeNativeOverlayControl.cs"),
    (Join-Path (Get-Location) "scripts\windows-native-overlay-control\SteamBridgeNativeOverlayControl.cs")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }
  throw "Missing SteamBridgeNativeOverlayControl.cs. Checked: $($candidates -join ', ')"
}

function Resolve-SteamApiDll {
  $requiredFiles = @(
    "steam_bridge_native.win32-x64-msvc.node",
    "steam_api64.dll",
    "sdkencryptedappticket64.dll"
  )
  $runtimeCandidates = @(
    (Join-Path $AppDir "resources\app.asar.unpacked\node_modules\steam-bridge"),
    (Join-Path $AppDir "resources\app\node_modules\steam-bridge")
  )
  $complete = @()
  foreach ($candidate in $runtimeCandidates) {
    $present = @($requiredFiles | Where-Object { Test-Path -LiteralPath (Join-Path $candidate $_) })
    if ($present.Count -gt 0 -and $present.Count -ne $requiredFiles.Count) {
      throw "Incomplete Steam Bridge Windows runtime at $candidate. Found: $($present -join ', ')."
    }
    if ($present.Count -eq $requiredFiles.Count) {
      $complete += $candidate
    }
  }
  if ($complete.Count -gt 1) {
    throw "Ambiguous Steam Bridge Windows runtime layout: $($complete -join ', ')."
  }
  if ($complete.Count -eq 1) {
    if ((Test-Path -LiteralPath (Join-Path $AppDir "resources\app.asar")) -and $complete[0] -ne $runtimeCandidates[0]) {
      throw "An ASAR app must keep the Steam Bridge addon and both runtime DLLs under resources\app.asar.unpacked."
    }
    return (Join-Path $complete[0] "steam_api64.dll")
  }

  $candidates = @(
    (Join-Path $AppDir "steam_api64.dll"),
    (Join-Path (Get-Location) "packages\steam-bridge\steam_api64.dll")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }
  throw "Missing steam_api64.dll. Checked: $($candidates -join ', ')"
}

function Resolve-ControlExe {
  return Join-Path $ControlDir "SteamBridgeNativeOverlayControl.exe"
}

function Build-ControlExe {
  New-Item -ItemType Directory -Force -Path $ControlDir | Out-Null
  $source = Resolve-ControlSource
  $exe = Resolve-ControlExe
  $dll = Resolve-SteamApiDll
  Copy-Item -LiteralPath $dll -Destination (Join-Path $ControlDir "steam_api64.dll") -Force
  Add-Type `
    -Path $source `
    -ReferencedAssemblies @("System.Windows.Forms", "System.Drawing") `
    -OutputAssembly $exe `
    -OutputType WindowsApplication
  Write-Host "Built native overlay control: $exe"
  return $exe
}

function Resolve-BuiltControlExe {
  $exe = Resolve-ControlExe
  if (-not (Test-Path -LiteralPath $exe)) {
    return Build-ControlExe
  }
  $dll = Join-Path $ControlDir "steam_api64.dll"
  if (-not (Test-Path -LiteralPath $dll)) {
    Copy-Item -LiteralPath (Resolve-SteamApiDll) -Destination $dll -Force
  }
  return $exe
}

function ConvertTo-CmdArgument {
  param([string]$Value)

  if ($null -eq $Value) {
    return '""'
  }
  return '"' + ([string]$Value -replace '"', '\"') + '"'
}

function Join-LaunchOptions {
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

function Get-ControlArgs {
  param([string]$Result, [string]$Screenshots)

  return @(
    "--app-id=$AppId",
    "--action=$Action",
    "--dialog=$Dialog",
    "--user-dialog=$UserDialog",
    "--url=$Url",
    "--observe-seconds=$ObserveSeconds",
    "--result-file=$Result",
    "--screenshot-dir=$Screenshots"
  )
}

function Get-LaunchOptionsLine {
  return (Join-LaunchOptions @("--env-file=$NativeEnvFile"))
}

function Write-ControlEnvFile {
  $parent = Split-Path -Parent $NativeEnvFile
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  $lines = @(
    "STEAM_BRIDGE_NATIVE_OVERLAY_APP_ID=$AppId",
    "STEAM_BRIDGE_NATIVE_OVERLAY_ACTION=$Action",
    "STEAM_BRIDGE_NATIVE_OVERLAY_URL=$Url",
    "STEAM_BRIDGE_NATIVE_OVERLAY_DIALOG=$Dialog",
    "STEAM_BRIDGE_NATIVE_OVERLAY_USER_DIALOG=$UserDialog",
    "STEAM_BRIDGE_NATIVE_OVERLAY_OBSERVE_SECONDS=$ObserveSeconds",
    "STEAM_BRIDGE_NATIVE_OVERLAY_RESULT_FILE=$ResultFile",
    ("STEAM_BRIDGE_NATIVE_OVERLAY_SCREENSHOT_DIR={0}" -f (Join-Path $ArtifactRoot "screenshots")),
    "STEAM_BRIDGE_NATIVE_OVERLAY_TITLE=Steam Bridge Native Overlay Control"
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($NativeEnvFile, (($lines -join [System.Environment]::NewLine) + [System.Environment]::NewLine), $utf8NoBom)
}

function Resolve-SteamInstallPath {
  $steamRegistry = Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue
  if ($steamRegistry -and $steamRegistry.SteamPath) {
    return $steamRegistry.SteamPath
  }
  return Join-Path ${env:ProgramFiles(x86)} "Steam"
}

function Resolve-ShortcutsPath {
  if ($ShortcutsPath) {
    return $ShortcutsPath
  }

  $userdata = Join-Path (Resolve-SteamInstallPath) "userdata"
  if (-not (Test-Path -LiteralPath $userdata)) {
    throw "Steam userdata directory was not found at $userdata."
  }

  if ($SteamUserId) {
    return Join-Path (Join-Path $userdata $SteamUserId) "config\shortcuts.vdf"
  }

  $candidates = @(Get-ChildItem -LiteralPath $userdata -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "config\shortcuts.vdf" } |
    Where-Object { Test-Path -LiteralPath $_ })
  if ($candidates.Count -eq 1) {
    return $candidates[0]
  }
  if ($candidates.Count -gt 1) {
    return $candidates[0]
  }
  throw "No Steam shortcuts.vdf file found under $userdata."
}

function Resolve-UpsertShortcutPath {
  $candidates = @(
    (Join-Path $AppDir "upsert-steam-shortcut.cjs"),
    (Join-Path (Get-Location) "scripts\upsert-steam-shortcut.cjs")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }
  throw "Missing upsert-steam-shortcut.cjs. Checked: $($candidates -join ', ')"
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe. It is needed only as the Electron-as-Node shortcut editor fallback."
  }
  return $exe
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
    return @(& cmd.exe /d /s /c $cmdLine 2>&1 | ForEach-Object { [string]$_ })
  }
  return @(& $Runner.Command @Arguments 2>&1 | ForEach-Object { [string]$_ })
}

function Install-ControlShortcut {
  param([string]$Exe)

  $shortcuts = Resolve-ShortcutsPath
  $upsert = Resolve-UpsertShortcutPath
  $runner = Resolve-JavaScriptRunner
  $launchOptions = Get-LaunchOptionsLine
  $args = @(
    $upsert,
    "--shortcuts", $shortcuts,
    "--app-name", $ShortcutName,
    "--exe", $Exe,
    "--start-dir", (Split-Path -Parent $Exe),
    "--launch-options", $launchOptions,
    "--json"
  )
  $output = @(Invoke-JavaScriptRunner -Runner $runner -Arguments $args)
  $output | ForEach-Object { Write-Host $_ }
  $jsonLine = @($output | Where-Object { $_ -match '^STEAM_SHORTCUT_RESULT ' } | Select-Object -Last 1)
  if (-not $jsonLine) {
    throw "Shortcut updater did not write STEAM_SHORTCUT_RESULT."
  }
  $json = ($jsonLine -replace '^STEAM_SHORTCUT_RESULT ', '') | ConvertFrom-Json
  $steamRunning = [bool](Get-Process steam -ErrorAction SilentlyContinue)
  if ($json.changed -and $steamRunning -and -not $AllowShortcutUpdateWhileSteamRunning) {
    throw "The native control shortcut changed while Steam is running. Restart Steam once, then rerun with -ShortcutGameId $($json.gameId) -AssumeShortcutConfigured."
  }
  return $json
}

function Wait-ForResultFile {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $ResultFile) {
      return
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Timed out waiting for native control result: $ResultFile"
}

function Get-CodeIntegrityEventsSince {
  param([datetime]$Since)

  try {
    return @(
      Get-WinEvent -FilterHashtable @{
        LogName = "Microsoft-Windows-CodeIntegrity/Operational"
        StartTime = $Since.AddSeconds(-2)
      } -ErrorAction SilentlyContinue |
        Where-Object { $_.Message -match "SteamBridgeNativeOverlayControl|steam-bridge-smoke-control|native-overlay-control" } |
        Select-Object -First 40 TimeCreated, Id, ProviderName, Message
    )
  } catch {
    return @(
      [PSCustomObject]@{
        TimeCreated = (Get-Date)
        Id = 0
        ProviderName = "steam-bridge"
        Message = "Failed to read Code Integrity events: $($_.Exception.Message)"
      }
    )
  }
}

function Write-SteamLaunchBlocker {
  param([datetime]$StartedAt, [string]$Message)

  Write-ControlJsonFile -Path (Join-Path $ArtifactRoot "steam-launch-blocker.json") -Value ([ordered]@{
    kind = "steam-bridge-windows-native-overlay-control-blocker"
    generatedAt = (Get-Date).ToString("o")
    blockerCode = "windows-native-control-steam-launch-no-result"
    message = $Message
    appId = $AppId
    action = $Action
    shortcutGameId = $ShortcutGameId
    nativeEnvFile = $NativeEnvFile
    resultFile = $ResultFile
    codeIntegrityEvents = @(Get-CodeIntegrityEventsSince -Since $StartedAt)
    processes = @(Get-Process steam,SteamBridgeNativeOverlayControl,gameoverlayui64 -ErrorAction SilentlyContinue |
      Select-Object Id, ProcessName, MainWindowTitle, Path)
  }) -Depth 8
}

function Write-RunManifest {
  param($Shortcut)

  Write-ControlJsonFile -Path (Join-Path $ArtifactRoot "run-manifest.json") -Value ([ordered]@{
    kind = "steam-bridge-windows-native-overlay-control-run"
    generatedAt = (Get-Date).ToString("o")
    mode = $Mode
    appId = $AppId
    action = $Action
    url = $Url
    dialog = $Dialog
    userDialog = $UserDialog
    observeSeconds = $ObserveSeconds
    nativeEnvFile = $NativeEnvFile
    resultFile = $ResultFile
    screenshotDir = (Join-Path $ArtifactRoot "screenshots")
    shortcut = $Shortcut
  }) -Depth 8
}

New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null

if ($Mode -eq "print-launch-options") {
  Write-Host (Get-LaunchOptionsLine)
  return
}

$controlExe = if ($Mode -eq "build") {
  Build-ControlExe
} else {
  Resolve-BuiltControlExe
}

if ($Mode -eq "build") {
  return
}

if (Test-Path -LiteralPath $ResultFile) {
  Remove-Item -LiteralPath $ResultFile -Force
}

if ($Mode -eq "shortcut") {
  Write-ControlEnvFile
  $shortcut = Install-ControlShortcut -Exe $controlExe
  Write-RunManifest -Shortcut $shortcut
  return
}

if ($Mode -eq "direct") {
  Write-RunManifest -Shortcut $null
  $args = Get-ControlArgs -Result $ResultFile -Screenshots (Join-Path $ArtifactRoot "screenshots")
  $process = Start-Process -FilePath $controlExe -ArgumentList $args -WorkingDirectory (Split-Path -Parent $controlExe) -PassThru
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
    throw "Timed out waiting for native control PID $($process.Id)."
  }
  Wait-ForResultFile
  Write-Host "Native control result: $ResultFile"
  return
}

if ($Mode -eq "steam-launch") {
  Write-ControlEnvFile
  $shortcut = $null
  if ($InstallShortcut) {
    $shortcut = Install-ControlShortcut -Exe $controlExe
    if (-not $ShortcutGameId) {
      $ShortcutGameId = [string]$shortcut.gameId
    }
  } elseif (-not $AssumeShortcutConfigured -and -not $ShortcutGameId) {
    throw "Pass -InstallShortcut or provide -ShortcutGameId/-AssumeShortcutConfigured for steam-launch."
  }

  if (-not $ShortcutGameId) {
    throw "Missing shortcut game ID."
  }
  Write-RunManifest -Shortcut $shortcut
  $launchStartedAt = Get-Date
  Start-Process "steam://rungameid/$ShortcutGameId"
  try {
    Wait-ForResultFile
  } catch {
    Write-SteamLaunchBlocker -StartedAt $launchStartedAt -Message $_.Exception.Message
    throw
  }
  Write-Host "Native control result: $ResultFile"
  return
}
