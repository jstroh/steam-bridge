[CmdletBinding()]
param(
  [ValidateSet("baseline", "managed", "full", "preflight", "shortcut")]
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
  [int]$TimeoutSeconds = 120,
  [switch]$SkipNativeLoadGate
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

  $steamPath = ""
  $steamRegistry = Get-ItemProperty -Path "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue
  if ($steamRegistry -and $steamRegistry.SteamPath) {
    $steamPath = $steamRegistry.SteamPath
  }
  if (-not $steamPath) {
    $steamPath = Join-Path ${env:ProgramFiles(x86)} "Steam"
  }

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

function Test-NativeLoadGate {
  param([string]$PreflightDir)

  if ($SkipNativeLoadGate) {
    return
  }

  $nativeAddon = Resolve-NativeAddon
  if (-not (Test-Path -LiteralPath $nativeAddon)) {
    throw "Missing native addon at $nativeAddon"
  }

  $policyState = Get-AppControlPolicyState
  $signature = Get-AuthenticodeSignature -LiteralPath $nativeAddon

  if ($policyState -eq 1) {
    Write-Host "Windows Smart App Control/App Control is enabled; running a native-load gate because Authenticode status alone is not enough proof."
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
      "On Smart App Control/App Control machines, a local self-signed Authenticode result can still fail this gate. " +
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
    webModal = $WebModal
    dialog = $DialogOverride
    shortcutTarget = $ShortcutTargetOverride
    checkoutTransactionId = $CheckoutTransactionIdOverride
    resultDelayMs = $ResultDelayMs
  }
}

function Get-MatrixCases {
  $baseline = @(
    New-Case -Id "00-none" -Action "none" -RequireNoOverlayActivation -ResultDelayMs 1200
    New-Case -Id "01-web" -Action "web" -RequireEvent @("overlay:web") -RequireOverlayActivated -WebModal "true"
    New-Case -Id "02-store" -Action "store" -RequireEvent @("overlay:store") -RequireOverlayActivated
    New-Case -Id "03-friends-dialog" -Action "friends" -RequireEvent @("overlay:dialog") -RequireOverlayActivated -DialogOverride "Friends"
    New-Case -Id "04-achievement-progress" -Action "achievement-progress" -RequireEvent @("achievement:progress") -RequireNoOverlayActivation -ResultDelayMs 2500
    New-Case -Id "05-achievement-unlock" -Action "achievement-unlock" -RequireEvent @("achievement:unlock") -RequireNoOverlayActivation -ResultDelayMs 2500
  )

  $managed = @(
    New-Case -Id "10-presenter-ready" -Action "presenter-ready" -RequireEvent @("overlay:presenter-ready") -RequireNoOverlayActivation -ResultDelayMs 1200
    New-Case -Id "11-managed-web-open-and-wait" -Action "presenter-web-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated -WebModal "true"
    New-Case -Id "12-managed-store-open-and-wait" -Action "presenter-store-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated
    New-Case -Id "13-managed-friends-open-and-wait" -Action "presenter-friends-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated
    New-Case -Id "14-managed-dialog-open-and-wait" -Action "presenter-dialog-auto-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated -DialogOverride "Friends"
    New-Case -Id "15-managed-shortcut" -Action "presenter-shortcut-open-and-wait" -RequireEvent @("overlay:presenter-open-and-wait-start") -RequireOverlayActivated -ShortcutTargetOverride $ShortcutTarget
    New-Case -Id "16-managed-checkout-route" -Action "presenter-checkout" -RequireEvent @("overlay:presenter-open") -RequireOverlayActivated -CheckoutTransactionIdOverride $CheckoutTransactionId
  )

  switch ($Suite) {
    "baseline" { return $baseline }
    "managed" { return $managed }
    "full" { return @($baseline + $managed) }
    "preflight" { return @() }
    "shortcut" { return @() }
  }
}

function Invoke-Helper {
  param([string[]]$Arguments, [string]$LogFile)

  $helper = Resolve-HelperPath
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $helper @Arguments *>&1 |
      Tee-Object -FilePath $LogFile
    if ($LASTEXITCODE -ne 0) {
      throw "windows-electron-smoke.ps1 exited with code $LASTEXITCODE"
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

  Invoke-Helper -Arguments @(
    "-Mode", "preflight",
    "-AppDir", $AppDir,
    "-AppId", "$AppId",
    "-PreflightJsonFile", $preflightJson
  ) -LogFile $preflightLog

  Test-NativeLoadGate -PreflightDir $preflightDir
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
  if ($Case.requireOverlayActivated) {
    $args += "-RequireOverlayActivated"
  }
  if ($Case.requireNoOverlayActivation) {
    $args += "-RequireNoOverlayActivation"
  }
  foreach ($event in $Case.requireEvent) {
    $args += @("-RequireEvent", $event)
  }
  if ($Case.action -like "presenter-*") {
    $args += "-RequireZeroManagedOverlayTiming"
  }

  Write-Host ("Running Windows overlay case {0}: {1}" -f $Case.id, $Case.action)
  Invoke-Helper -Arguments $args -LogFile $helperLog
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
Write-Host ("  disableDirectComposition: {0}" -f $OverlayDisableDirectComposition)
if ($LaunchMode -eq "steam-launch") {
  Write-Host ("  launchEnvFile: {0}" -f $LaunchEnvFile)
  Write-Host ("  installShortcut: {0}" -f $InstallShortcut)
}

Invoke-Preflight

if ($LaunchMode -eq "steam-launch" -and $Suite -ne "preflight") {
  Ensure-SteamShortcut
  if ($Suite -eq "shortcut") {
    Write-Host ("Windows overlay matrix shortcut setup passed. Launch URL: steam://rungameid/{0}" -f $ShortcutGameId)
    Write-Host ("Artifacts: {0}" -f $ArtifactRoot)
    exit 0
  }
}

foreach ($case in Get-MatrixCases) {
  Invoke-MatrixCase -Case $case
}

Write-Host ("Windows overlay matrix passed. Artifacts: {0}" -f $ArtifactRoot)
