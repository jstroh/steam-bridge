[CmdletBinding()]
param(
  [ValidateSet("direct", "steam-launch", "verify", "preflight", "print-launch-options", "print-launch-env", "write-launch-env")]
  [string]$Mode = "direct",

  [string]$AppDir = "",
  [string]$ResultFile = "",
  [string]$DiagnosticDir = "",
  [string]$PreflightJsonFile = "",
  [string]$SmokeEnvFile = "",
  [int]$AppId = 480,

  [ValidateSet(
    "none",
    "dialog",
    "friends",
    "store",
    "web",
    "native-probe",
    "native-dialog",
    "native-store",
    "native-web",
    "achievement-progress",
    "achievement-unlock",
    "presenter-ready",
    "presenter-dialog",
    "presenter-dialog-auto",
    "presenter-dialog-auto-open-and-wait",
    "presenter-store",
    "presenter-store-open-and-wait",
    "presenter-web",
    "presenter-web-open-and-wait",
    "presenter-duplicate-open-guard",
    "presenter-friends",
    "presenter-friends-open-and-wait",
    "presenter-profile",
    "presenter-players",
    "presenter-community",
    "presenter-stats",
    "presenter-achievements",
    "presenter-user",
    "presenter-checkout",
    "presenter-shortcut",
    "presenter-shortcut-open-and-wait",
    "presenter-achievement-progress",
    "presenter-achievement-unlock"
  )]
  [string]$Action = "none",

  [string]$OverlayProfile = "diagnostic",
  [string]$OverlayInProcessGpu = "1",
  [string]$OverlayDisableDirectComposition = "",
  [string]$WindowMode = "",
  [string]$WebUrl = "",
  [string]$WebModal = "",
  [string]$CheckoutUrl = "",
  [string]$CheckoutTransactionId = "",
  [string]$CheckoutReturnUrl = "",
  [string]$Dialog = "",
  [string]$UserDialog = "",
  [string]$ShortcutTarget = "",
  [string]$PresenterMode = "",
  [ValidateSet("shown", "complete")]
  [string]$ManagedOverlayResultMode = "shown",
  [string]$AchievementName = "",
  [string]$AchievementCurrent = "",
  [string]$AchievementMax = "",
  [int]$ResultDelayMs = 8000,
  [int]$TimeoutSeconds = 90,
  [string]$ShortcutGameId = "",
  [switch]$AllowStartSteamClient,
  [string[]]$RequireEvent = @(),
  [switch]$RequireSteamLaunch,
  [switch]$RequireOverlayReady,
  [switch]$AllowOverlayNotReady,
  [switch]$RequireOverlayActivated,
  [switch]$RequireNoOverlayActivation,
  [int]$RequireRestoreFocusDelayMs = -1,
  [switch]$RequireZeroManagedOverlayTiming,
  [switch]$RequireManagedOverlayComplete,
  [switch]$RequireNoCrashes,
  [string]$RequireActionErrorCode = "",
  [string]$RequireActionErrorReason = "",
  [string]$RequireNativeHostUnavailableReason = "",
  [switch]$KeepOpenAfterResult
)

$ErrorActionPreference = "Stop"
$ResultPrefix = "STEAM_BRIDGE_SMOKE_RESULT "

if (-not $AppDir) {
  $scriptDir = Split-Path -Parent $PSCommandPath
  if ($scriptDir -and (Test-Path -LiteralPath (Join-Path $scriptDir "SteamBridgeSmoke.exe"))) {
    $AppDir = $scriptDir
  } else {
    $AppDir = Join-Path (Get-Location) "dist\electron-smoke\x86_64-pc-windows-msvc\SteamBridgeSmoke-win32-x64"
  }
}

if (-not $ResultFile) {
  $ResultFile = Join-Path $env:TEMP "steam-bridge-smoke-windows-direct.log"
}

if (-not $DiagnosticDir) {
  $DiagnosticDir = Join-Path $env:TEMP "steam-bridge-smoke-windows-diagnostics"
}

function Resolve-SmokeExe {
  $exe = Join-Path $AppDir "SteamBridgeSmoke.exe"
  if (-not (Test-Path -LiteralPath $exe)) {
    throw "Missing SteamBridgeSmoke.exe at $exe"
  }
  return $exe
}

function Resolve-NativeAddon {
  return (Join-Path $AppDir "resources\app\node_modules\steam-bridge\steam_bridge_native.win32-x64-msvc.node")
}

function Get-SmokeArgs {
  param([string]$LogFile, [string]$SmokeAction)

  $args = @(
    "--steam-bridge-app-id=$AppId",
    "--steam-bridge-electron-overlay-profile=$OverlayProfile",
    "--steam-bridge-smoke-autorun",
    "--steam-bridge-smoke-autorun-action=$SmokeAction",
    "--steam-bridge-smoke-autorun-result-delay-ms=$ResultDelayMs",
    "--steam-bridge-smoke-result-file=$LogFile",
    "--steam-bridge-smoke-diagnostic-dir=$DiagnosticDir"
  )

  if ($KeepOpenAfterResult) {
    $args += "--steam-bridge-smoke-keep-open-after-result"
  }
  if ($OverlayDisableDirectComposition) {
    $args += "--steam-bridge-electron-overlay-disable-direct-composition=$OverlayDisableDirectComposition"
  }
  if ($OverlayInProcessGpu) {
    $args += "--steam-bridge-electron-overlay-in-process-gpu=$OverlayInProcessGpu"
  }
  if ($WindowMode) {
    $args += "--steam-bridge-smoke-window-mode=$WindowMode"
  }
  if ($WebUrl) {
    $args += "--steam-bridge-smoke-web-url=$WebUrl"
  }
  if ($WebModal) {
    $args += "--steam-bridge-smoke-web-modal=$WebModal"
  }
  if ($CheckoutUrl) {
    $args += "--steam-bridge-smoke-checkout-url=$CheckoutUrl"
  }
  if ($CheckoutTransactionId) {
    $args += "--steam-bridge-smoke-checkout-transaction-id=$CheckoutTransactionId"
  }
  if ($CheckoutReturnUrl) {
    $args += "--steam-bridge-smoke-checkout-return-url=$CheckoutReturnUrl"
  }
  if ($Dialog) {
    $args += "--steam-bridge-smoke-overlay-dialog=$Dialog"
  }
  if ($UserDialog) {
    $args += "--steam-bridge-smoke-user-dialog=$UserDialog"
  }
  if ($ShortcutTarget) {
    $args += "--steam-bridge-smoke-shortcut-target=$ShortcutTarget"
  }
  if ($PresenterMode) {
    $args += "--steam-bridge-smoke-presenter-mode=$PresenterMode"
  }
  if ($ManagedOverlayResultMode) {
    $args += "--steam-bridge-smoke-managed-overlay-result-mode=$ManagedOverlayResultMode"
  }
  if ($AchievementName) {
    $args += "--steam-bridge-smoke-achievement-name=$AchievementName"
  }
  if ($AchievementCurrent) {
    $args += "--steam-bridge-smoke-achievement-current=$AchievementCurrent"
  }
  if ($AchievementMax) {
    $args += "--steam-bridge-smoke-achievement-max=$AchievementMax"
  }

  return $args
}

function Get-LaunchOptionsLine {
  param([string]$LogFile, [string]$SmokeAction)
  if ($SmokeEnvFile) {
    return (Join-LaunchOptions @("--steam-bridge-smoke-env-file=$SmokeEnvFile"))
  }
  return (Join-LaunchOptions (Get-SmokeArgs -LogFile $LogFile -SmokeAction $SmokeAction))
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

function Get-SmokeEnv {
  param([string]$LogFile, [string]$SmokeAction)

  $envMap = [ordered]@{
    SteamAppId = "$AppId"
    SteamGameId = "$AppId"
    SteamOverlayGameId = "$AppId"
    STEAM_BRIDGE_APP_ID = "$AppId"
    STEAM_BRIDGE_ELECTRON_OVERLAY_PROFILE = $OverlayProfile
    STEAM_BRIDGE_SMOKE_AUTORUN = "1"
    STEAM_BRIDGE_SMOKE_AUTORUN_ACTION = $SmokeAction
    STEAM_BRIDGE_SMOKE_AUTORUN_RESULT_DELAY_MS = "$ResultDelayMs"
    STEAM_BRIDGE_SMOKE_RESULT_FILE = $LogFile
    STEAM_BRIDGE_SMOKE_DIAGNOSTIC_DIR = $DiagnosticDir
  }

  if ($KeepOpenAfterResult) {
    $envMap.STEAM_BRIDGE_SMOKE_KEEP_OPEN_AFTER_RESULT = "1"
  }
  if ($OverlayDisableDirectComposition) {
    $envMap.STEAM_BRIDGE_ELECTRON_OVERLAY_DISABLE_DIRECT_COMPOSITION = $OverlayDisableDirectComposition
  }
  if ($OverlayInProcessGpu) {
    $envMap.STEAM_BRIDGE_ELECTRON_OVERLAY_IN_PROCESS_GPU = $OverlayInProcessGpu
  }
  if ($WindowMode) {
    $envMap.STEAM_BRIDGE_SMOKE_WINDOW_MODE = $WindowMode
  }
  if ($WebUrl) {
    $envMap.STEAM_BRIDGE_SMOKE_WEB_URL = $WebUrl
  }
  if ($WebModal) {
    $envMap.STEAM_BRIDGE_SMOKE_WEB_MODAL = $WebModal
  }
  if ($CheckoutUrl) {
    $envMap.STEAM_BRIDGE_SMOKE_CHECKOUT_URL = $CheckoutUrl
  }
  if ($CheckoutTransactionId) {
    $envMap.STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID = $CheckoutTransactionId
  }
  if ($CheckoutReturnUrl) {
    $envMap.STEAM_BRIDGE_SMOKE_CHECKOUT_RETURN_URL = $CheckoutReturnUrl
  }
  if ($Dialog) {
    $envMap.STEAM_BRIDGE_SMOKE_OVERLAY_DIALOG = $Dialog
  }
  if ($UserDialog) {
    $envMap.STEAM_BRIDGE_SMOKE_USER_DIALOG = $UserDialog
  }
  if ($ShortcutTarget) {
    $envMap.STEAM_BRIDGE_SMOKE_SHORTCUT_TARGET = $ShortcutTarget
  }
  if ($PresenterMode) {
    $envMap.STEAM_BRIDGE_SMOKE_PRESENTER_MODE = $PresenterMode
  }
  if ($ManagedOverlayResultMode) {
    $envMap.STEAM_BRIDGE_SMOKE_MANAGED_OVERLAY_RESULT_MODE = $ManagedOverlayResultMode
  }
  if ($AchievementName) {
    $envMap.STEAM_BRIDGE_SMOKE_ACHIEVEMENT_NAME = $AchievementName
  }
  if ($AchievementCurrent) {
    $envMap.STEAM_BRIDGE_SMOKE_ACHIEVEMENT_CURRENT = $AchievementCurrent
  }
  if ($AchievementMax) {
    $envMap.STEAM_BRIDGE_SMOKE_ACHIEVEMENT_MAX = $AchievementMax
  }

  return $envMap
}

function Format-SmokeEnvLines {
  param($EnvMap)

  $lines = @(
    "# Steam Bridge Windows smoke launch state",
    "# Rewritten by windows-electron-smoke.ps1 before Steam launches the shortcut."
  )
  foreach ($key in $EnvMap.Keys) {
    $lines += ("{0}={1}" -f $key, $EnvMap[$key])
  }
  return $lines
}

function Write-SmokeEnvFile {
  param([string]$LogFile, [string]$SmokeAction)

  if (-not $SmokeEnvFile) {
    throw "Missing -SmokeEnvFile for $Mode mode."
  }
  $parent = Split-Path -Parent $SmokeEnvFile
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $lines = Format-SmokeEnvLines (Get-SmokeEnv -LogFile $LogFile -SmokeAction $SmokeAction)
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText(
    $SmokeEnvFile,
    (($lines -join [System.Environment]::NewLine) + [System.Environment]::NewLine),
    $utf8NoBom
  )
}

function Set-SmokeProcessEnv {
  param($EnvMap)

  foreach ($key in $EnvMap.Keys) {
    [System.Environment]::SetEnvironmentVariable($key, [string]$EnvMap[$key], "Process")
  }
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
  $steamProcesses = @(Get-Process steam -ErrorAction SilentlyContinue |
    Select-Object ProcessName,Id,SessionId,StartTime,Responding,MainWindowTitle,Path)

  return [PSCustomObject]@{
    currentSessionId = $currentSessionId
    interactiveSessionIds = @($interactiveSessionIds)
    currentSessionInteractive = ($interactiveSessionIds -contains $currentSessionId)
    steamProcesses = @($steamProcesses)
  }
}

function Format-SessionIdList {
  param([object[]]$SessionIds)

  if (-not $SessionIds -or $SessionIds.Count -eq 0) {
    return "none"
  }
  return ((@($SessionIds) | ForEach-Object { [string]$_ }) -join ", ")
}

function Assert-InteractiveWindowsSessionForSteamLaunch {
  $summary = Get-WindowsSessionSummary
  if (-not $summary.currentSessionInteractive) {
    throw (
      "Windows steam-launch smoke must run from the interactive desktop session. " +
      "Current PowerShell SessionId=$($summary.currentSessionId); " +
      "interactive explorer SessionId(s)=$(Format-SessionIdList $summary.interactiveSessionIds). " +
      "Run from the Parsec/local desktop session or an /IT scheduled task. SSH Session 0 can produce " +
      "DXGI_ERROR_NOT_CURRENTLY_AVAILABLE / 0x887A0022 swap-chain failures that are not Steam Bridge overlay bugs."
    )
  }

  $foreignSteam = @($summary.steamProcesses | Where-Object { $_.SessionId -ne $summary.currentSessionId })
  if ($foreignSteam.Count -gt 0) {
    $steamSessionIds = @($summary.steamProcesses | Select-Object -ExpandProperty SessionId -Unique | Sort-Object)
    throw (
      "Steam is running in a different Windows session. " +
      "Current PowerShell SessionId=$($summary.currentSessionId); Steam SessionId(s)=$(Format-SessionIdList $steamSessionIds). " +
      "Fully quit Steam in the other session, then start Steam from the interactive desktop session before live overlay proof."
    )
  }

  return $summary
}

function Write-JsonFile {
  param([string]$Path, $Value)

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
    (($Value | ConvertTo-Json -Depth 8) + [System.Environment]::NewLine),
    $utf8NoBom
  )
}

function Format-FileSignatureSummary {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return [PSCustomObject]@{
      path = $Path
      exists = $false
      length = $null
      authenticodeStatus = "Missing"
      signerSubject = $null
      signerThumbprint = $null
      zoneIdentifier = $false
    }
  }

  $item = Get-Item -LiteralPath $Path
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  $zone = Get-Item -LiteralPath $Path -Stream Zone.Identifier -ErrorAction SilentlyContinue
  $signer = $signature.SignerCertificate

  return [PSCustomObject]@{
    path = $Path
    exists = $true
    length = $item.Length
    authenticodeStatus = [string]$signature.Status
    signerSubject = if ($signer) { $signer.Subject } else { $null }
    signerThumbprint = if ($signer) { $signer.Thumbprint } else { $null }
    zoneIdentifier = [bool]$zone
  }
}

function Get-AppControlPolicySummary {
  $policy = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" -ErrorAction SilentlyContinue
  $ciTool = Get-CiToolPolicyInventory

  return [PSCustomObject]@{
    verifiedAndReputablePolicyState = if ($policy) { $policy.VerifiedAndReputablePolicyState } else { $null }
    ciToolPath = $ciTool.ciToolPath
    ciToolAvailable = $ciTool.available
    ciToolExitCode = $ciTool.exitCode
    ciToolError = $ciTool.error
    policies = @($ciTool.policies)
    enforcedPolicies = @($ciTool.enforcedPolicies)
    verifiedAndReputableEnforced = $ciTool.verifiedAndReputableEnforced
  }
}

function Get-CiToolPolicyInventory {
  $ciTool = Get-Command CiTool.exe -ErrorAction SilentlyContinue
  if (-not $ciTool) {
    return [PSCustomObject]@{
      ciToolPath = $null
      available = $false
      exitCode = $null
      error = $null
      policies = @()
      enforcedPolicies = @()
      verifiedAndReputableEnforced = $false
    }
  }

  $output = @()
  $exitCode = 0
  $errorMessage = $null
  try {
    $output = @(& $ciTool.Source -lp 2>&1 | ForEach-Object { [string]$_ })
    $exitCode = $LASTEXITCODE
  } catch {
    $errorMessage = $_.Exception.Message
    $exitCode = 1
  }

  $policies = @(Convert-CiToolPolicies -Lines $output)
  $enforcedPolicies = @(
    $policies |
      Where-Object { $_.enforced -eq $true } |
      Select-Object policyId, basePolicyId, friendlyName, version, platformPolicy, policySigned, hasFileOnDisk, authorized, status
  )
  $verifiedAndReputableEnforced = @(
    $enforcedPolicies |
      Where-Object { $_.friendlyName -like "VerifiedAndReputableDesktop*" }
  ).Count -gt 0

  return [PSCustomObject]@{
    ciToolPath = $ciTool.Source
    available = $true
    exitCode = $exitCode
    error = $errorMessage
    policies = @($policies)
    enforcedPolicies = @($enforcedPolicies)
    verifiedAndReputableEnforced = $verifiedAndReputableEnforced
  }
}

function Convert-CiToolPolicies {
  param([string[]]$Lines)

  $policies = New-Object System.Collections.Generic.List[object]
  $current = $null

  foreach ($rawLine in $Lines) {
    $line = [string]$rawLine
    if ($line -match '^\s*Policy:\s*$') {
      if ($current) {
        $policies.Add([PSCustomObject]$current) | Out-Null
      }
      $current = [ordered]@{}
      continue
    }

    if (-not $current) {
      continue
    }

    if ($line -match '^\s*([^:]+):\s*(.*)$') {
      $name = Convert-CiToolPolicyKey -Key $matches[1]
      if (-not $name) {
        continue
      }
      $current[$name] = Convert-CiToolPolicyValue -Key $name -Value $matches[2]
    }
  }

  if ($current) {
    $policies.Add([PSCustomObject]$current) | Out-Null
  }

  return $policies.ToArray()
}

function Convert-CiToolPolicyKey {
  param([string]$Key)

  switch ($Key.Trim()) {
    "Policy ID" { return "policyId" }
    "Base Policy ID" { return "basePolicyId" }
    "Friendly Name" { return "friendlyName" }
    "Version" { return "version" }
    "Platform Policy" { return "platformPolicy" }
    "Policy is Signed" { return "policySigned" }
    "Has File on Disk" { return "hasFileOnDisk" }
    "Is Currently Enforced" { return "enforced" }
    "Is Authorized" { return "authorized" }
    "Status" { return "status" }
  }

  return $null
}

function Convert-CiToolPolicyValue {
  param([string]$Key, [string]$Value)

  $trimmed = $Value.Trim()
  if ($Key -in @("platformPolicy", "policySigned", "hasFileOnDisk", "enforced", "authorized")) {
    if ($trimmed -eq "true") {
      return $true
    }
    if ($trimmed -eq "false") {
      return $false
    }
  }

  return $trimmed
}

function Get-RecentCodeIntegrityEvents {
  param([string[]]$Needles)

  $events = Get-WinEvent -FilterHashtable @{
    LogName = "Microsoft-Windows-CodeIntegrity/Operational"
    StartTime = (Get-Date).AddHours(-24)
  } -MaxEvents 80 -ErrorAction SilentlyContinue

  if (-not $events) {
    return @()
  }

  $matches = @()
  foreach ($event in $events) {
    foreach ($needle in $Needles) {
      if ($needle -and $event.Message -like "*$needle*") {
        $matches += [PSCustomObject]@{
          timeCreated = $event.TimeCreated
          id = $event.Id
          message = (($event.Message -replace "\r?\n", " ") -replace "\s+", " ").Trim()
        }
        break
      }
    }
  }

  return @($matches | Select-Object -First 8)
}

function Invoke-Preflight {
  $exe = Resolve-SmokeExe
  $nativeAddon = Resolve-NativeAddon
  $sessionSummary = Get-WindowsSessionSummary
  $steamProcess = @($sessionSummary.steamProcesses | Select-Object -First 1)
  $steamProcessId = $null
  if ($steamProcess) {
    $steamProcessId = $steamProcess.Id
  }
  $policy = Get-AppControlPolicySummary
  $exeSummary = Format-FileSignatureSummary -Path $exe
  $nativeSummary = Format-FileSignatureSummary -Path $nativeAddon
  $events = Get-RecentCodeIntegrityEvents -Needles @(
    "SteamBridgeSmoke",
    "steam_bridge_native",
    [System.IO.Path]::GetFileName($nativeAddon)
  )
  $warnings = @()

  Write-Host "Windows smoke preflight:"
  Write-Host ("  appDir: {0}" -f $AppDir)
  Write-Host ("  powershell: {0}" -f $PSVersionTable.PSVersion)
  Write-Host ("  currentSessionId: {0}" -f $sessionSummary.currentSessionId)
  Write-Host ("  interactiveSessionIds: {0}" -f (Format-SessionIdList $sessionSummary.interactiveSessionIds))
  Write-Host ("  verifiedAndReputablePolicyState: {0}" -f $policy.verifiedAndReputablePolicyState)
  Write-Host ("  ciTool: {0}" -f $policy.ciToolPath)
  Write-Host ("  verifiedAndReputableEnforced: {0}" -f $policy.verifiedAndReputableEnforced)
  if (@($policy.enforcedPolicies).Count -gt 0) {
    Write-Host "  enforcedAppControlPolicies:"
    foreach ($enforcedPolicy in $policy.enforcedPolicies) {
      Write-Host ("    {0} ({1})" -f $enforcedPolicy.friendlyName, $enforcedPolicy.policyId)
    }
  }
  foreach ($summary in @($exeSummary, $nativeSummary)) {
    Write-Host ("  file: {0}" -f $summary.path)
    Write-Host ("    exists: {0}" -f $summary.exists)
    Write-Host ("    length: {0}" -f $summary.length)
    Write-Host ("    authenticodeStatus: {0}" -f $summary.authenticodeStatus)
    Write-Host ("    signerSubject: {0}" -f $summary.signerSubject)
    Write-Host ("    signerThumbprint: {0}" -f $summary.signerThumbprint)
    Write-Host ("    zoneIdentifier: {0}" -f $summary.zoneIdentifier)
  }

  if ($policy.verifiedAndReputableEnforced -and $nativeSummary.authenticodeStatus -ne "Valid") {
    $warnings += "Windows Smart App Control/App Control VerifiedAndReputable policy is enforced and the native addon is not Authenticode-valid."
    $warnings += "SteamAPI_Init smoke runs are expected to fail before overlay testing on this machine."
  } elseif ($policy.verifiedAndReputableEnforced) {
    $warnings += "Windows Smart App Control/App Control VerifiedAndReputable policy is enforced; local or unreputable signatures can still be blocked."
  } elseif ($policy.verifiedAndReputablePolicyState -eq 1) {
    $warnings += "Windows Smart App Control/App Control appears enabled; local or unreputable signatures can still be blocked."
  }

  foreach ($warning in $warnings) {
    Write-Host ("  warning: {0}" -f $warning)
  }

  if ($events.Count -gt 0) {
    Write-Host "  recentCodeIntegrityEvents:"
    foreach ($event in $events) {
      Write-Host ("    [{0}] id={1} {2}" -f $event.timeCreated, $event.id, $event.message)
    }
  } else {
    Write-Host "  recentCodeIntegrityEvents: none"
  }

  Write-JsonFile -Path $PreflightJsonFile -Value ([PSCustomObject]@{
    kind = "steam-bridge-windows-preflight"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    appDir = $AppDir
    appId = $AppId
    powershell = [string]$PSVersionTable.PSVersion
    steam = [PSCustomObject]@{
      running = [bool]$steamProcess
      pid = $steamProcessId
      sessionId = if ($steamProcess) { $steamProcess.SessionId } else { $null }
    }
    windowsSession = $sessionSummary
    appControl = $policy
    files = [PSCustomObject]@{
      executable = $exeSummary
      nativeAddon = $nativeSummary
    }
    warnings = @($warnings)
    recentCodeIntegrityEvents = @($events)
  })
}

function Add-DefaultRequireEvents {
  if ($RequireEvent.Count -ne 0) {
    return
  }

  switch ($Action) {
    "dialog" {
      $script:RequireEvent = @("overlay:dialog")
      break
    }
    "presenter-ready" {
      $script:RequireEvent = @("overlay:presenter-ready")
      break
    }
    "presenter-duplicate-open-guard" {
      $script:RequireEvent = @("overlay:presenter-open-and-wait-start", "overlay:presenter-duplicate-open-guard")
      break
    }
    "presenter-shortcut" {
      $script:RequireEvent = @("overlay:presenter-shortcut-ready")
      break
    }
    "presenter-checkout" {
      if ($CheckoutUrl -or $CheckoutTransactionId) {
        $script:RequireEvent = @("overlay:presenter-open")
      } else {
        $script:RequireEvent = @("overlay:presenter-checkout-ready")
      }
      break
    }
    "presenter-achievement-progress" {
      $script:RequireEvent = @("overlay:presenter-attach", "achievement:progress")
      break
    }
    "presenter-achievement-unlock" {
      $script:RequireEvent = @("overlay:presenter-attach", "achievement:unlock")
      break
    }
    "achievement-progress" {
      $script:RequireEvent = @("achievement:progress")
      break
    }
    "achievement-unlock" {
      $script:RequireEvent = @("achievement:unlock")
      break
    }
    { $_ -like "*-open-and-wait" } {
      $script:RequireEvent = @("overlay:presenter-open-and-wait-start")
      break
    }
    { $_ -like "presenter-*" } {
      $script:RequireEvent = @("overlay:presenter-open")
      break
    }
  }
}

function Wait-ForResultFile {
  param([string]$LogFile)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if ((Test-Path -LiteralPath $LogFile) -and (Get-Item -LiteralPath $LogFile).Length -gt 0) {
      try {
        [void](Read-SmokeResult -LogFile $LogFile)
        return
      } catch {
        Start-Sleep -Milliseconds 200
        continue
      }
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for smoke result file $LogFile"
}

function Read-SmokeResult {
  param([string]$LogFile)

  if (-not (Test-Path -LiteralPath $LogFile)) {
    throw "Missing smoke result file $LogFile"
  }

  $line = Get-Content -LiteralPath $LogFile |
    Where-Object { $_.StartsWith($ResultPrefix) } |
    Select-Object -Last 1

  if (-not $line) {
    throw "Missing $($ResultPrefix.Trim()) line in $LogFile"
  }

  return ($line.Substring($ResultPrefix.Length) | ConvertFrom-Json)
}

function Wait-ForSmokeProcessExit {
  param($Result)

  if ($KeepOpenAfterResult) {
    return
  }

  $pidValue = $null
  if ($Result -and $Result.snapshot -and $Result.snapshot.process -and $Result.snapshot.process.pid) {
    $pidValue = [int]$Result.snapshot.process.pid
  }
  if (-not $pidValue) {
    return
  }

  if (-not (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
    return
  }

  $timeout = [Math]::Max(1, [Math]::Min($TimeoutSeconds, 30))
  try {
    Wait-Process -Id $pidValue -Timeout $timeout -ErrorAction Stop
  } catch {
    if (Get-Process -Id $pidValue -ErrorAction SilentlyContinue) {
      throw "Timed out waiting for SteamBridgeSmoke.exe PID $pidValue to exit."
    }
  }
}

function Read-OkValue {
  param($Entry)
  if ($Entry -and $Entry.ok -eq $true) {
    return $Entry.value
  }
  return $null
}

function Test-OverlayActiveEvent {
  param($Event)

  if (-not $Event -or $Event.type -ne "callback:overlay-activated") {
    return $false
  }

  $payload = $Event.payload
  if ($payload -eq $true -or $payload -eq 1) {
    return $true
  }
  if (-not $payload) {
    return $false
  }

  $activePayload = $payload
  if ($payload.PSObject.Properties.Name -contains "0" -and $payload."0") {
    $activePayload = $payload."0"
  }

  return (
    $activePayload.active -eq $true -or
    $activePayload.active -eq 1 -or
    $activePayload.m_bActive -eq $true -or
    $activePayload.m_bActive -eq 1
  )
}

function Test-OverlayInactiveEvent {
  param($Event)

  if (-not $Event -or $Event.type -ne "callback:overlay-activated") {
    return $false
  }

  $payload = $Event.payload
  if ($payload -eq $false -or $payload -eq 0) {
    return $true
  }
  if (-not $payload) {
    return $false
  }

  $activePayload = $payload
  if ($payload.PSObject.Properties.Name -contains "0" -and $payload."0") {
    $activePayload = $payload."0"
  }

  return (
    $activePayload.active -eq $false -or
    $activePayload.active -eq 0 -or
    $activePayload.m_bActive -eq $false -or
    $activePayload.m_bActive -eq 0
  )
}

function Assert-SmokeResult {
  param($Result)

  $failures = New-Object System.Collections.Generic.List[string]
  $snapshot = $Result.snapshot
  $steam = $snapshot.steam
  $app = $snapshot.app
  $launch = $snapshot.launch
  $processInfo = $snapshot.process
  $overlay = $snapshot.overlay
  $crashDiagnostics = $snapshot.crashDiagnostics
  $nativePresenter = Read-OkValue $overlay.nativePresenter
  $electronOverlay = if ($nativePresenter) { $nativePresenter.electronOverlay } else { $null }
  $events = @($snapshot.events)
  $overlayActivated = @($events | Where-Object { Test-OverlayActiveEvent $_ }).Count -gt 0
  $overlayDeactivated = @($events | Where-Object { Test-OverlayInactiveEvent $_ }).Count -gt 0
  $expectedActionError = ($RequireActionErrorCode -or $RequireActionErrorReason)

  if ($expectedActionError) {
    if ($Result.ok -ne $false) {
      $failures.Add("smoke result failed with expected action error")
    }
  } elseif ($Result.ok -ne $true) {
    $failures.Add("smoke result ok")
  }
  if ($steam.initialized -ne $true) {
    $failures.Add("Steam initialized")
  }
  if ((Read-OkValue $steam.running) -ne $true) {
    $failures.Add("Steam running")
  }
  if ((Read-OkValue $steam.appId) -ne $app.appId) {
    $failures.Add("Steam App ID matches app config")
  }
  if ($app.appId -ne $AppId) {
    $failures.Add("app ID is $AppId")
  }
  if ($processInfo.platform -ne "win32") {
    $failures.Add("platform is win32")
  }
  if ($processInfo.arch -ne "x64") {
    $failures.Add("arch is x64")
  }
  if ($Result.action.action -ne $Action) {
    $failures.Add("autorun action is $Action")
  }
  if ($expectedActionError) {
    if ($Result.action.ok -ne $false) {
      $failures.Add("autorun action $Action failed with expected error")
    }
    if (-not $Result.action.error) {
      $failures.Add("autorun action error is serialized")
    } else {
      if ($RequireActionErrorCode -and $Result.action.error.code -ne $RequireActionErrorCode) {
        $failures.Add("autorun action error code is $RequireActionErrorCode")
      }
      if ($RequireActionErrorReason -and $Result.action.error.reason -ne $RequireActionErrorReason) {
        $failures.Add("autorun action error reason is $RequireActionErrorReason")
      }
    }
  } elseif ($Result.action.ok -ne $true) {
    $failures.Add("autorun action $Action succeeded")
  }
  if ($RequireNativeHostUnavailableReason) {
    if (-not $nativePresenter) {
      $failures.Add("native presenter snapshot available")
    } else {
      if ($nativePresenter.nativeHostUnavailableReason -ne $RequireNativeHostUnavailableReason) {
        $failures.Add("native host unavailable reason is $RequireNativeHostUnavailableReason")
      }
      if ($nativePresenter.attached -ne $false) {
        $failures.Add("native presenter is not attached while host is unavailable")
      }
      if ($nativePresenter.nativeHostOpen -ne $false) {
        $failures.Add("native presenter host is closed while unavailable")
      }
      if ($nativePresenter.currentFps -ne 0) {
        $failures.Add("native presenter current FPS is zero while unavailable")
      }
      $environmentMatches = $true
      if ($RequireNativeHostUnavailableReason -eq "macos-screen-locked") {
        $environmentMatches = $nativePresenter.macOverlayEnvironment.screenLocked -eq $true
      } elseif ($RequireNativeHostUnavailableReason -eq "macos-display-asleep") {
        $environmentMatches = (
          $nativePresenter.macOverlayEnvironment.screenLocked -eq $false -and
          $nativePresenter.macOverlayEnvironment.displayAsleep -eq $true
        )
      }
      if (-not $environmentMatches) {
        $failures.Add("mac overlay environment matches $RequireNativeHostUnavailableReason")
      }
    }
  }
  if ($RequireRestoreFocusDelayMs -ge 0) {
    if (-not $electronOverlay) {
      $failures.Add("managed Electron overlay diagnostics available")
    } elseif ($electronOverlay.restoreFocusDelayMs -ne $RequireRestoreFocusDelayMs) {
      $failures.Add("managed Electron overlay restore focus delay is ${RequireRestoreFocusDelayMs}ms")
    }
  }
  if ($RequireZeroManagedOverlayTiming) {
    if (-not $electronOverlay) {
      $failures.Add("managed Electron overlay diagnostics available")
    } else {
      if ($electronOverlay.restoreFocusDelayMs -ne 0) {
        $failures.Add("managed Electron overlay restore focus delay is zero")
      }
      if ($electronOverlay.activationBoostMs -ne 0) {
        $failures.Add("managed Electron overlay activation boost is zero")
      }
      if ($electronOverlay.activeGraceMs -ne 0) {
        $failures.Add("managed Electron overlay active grace is zero")
      }
    }
  }
  if ($RequireSteamLaunch -and $launch.steamLaunch -ne $true) {
    $failures.Add("Steam launch marker detected")
  }
  if ($RequireOverlayReady) {
    if ((Read-OkValue $steam.overlayEnabled) -ne $true -and -not $overlayActivated) {
      $failures.Add("overlay enabled or emitted active overlay callback")
    }
    if ((Read-OkValue $steam.overlayNeedsPresent) -ne $false -and -not $overlayActivated) {
      $failures.Add("overlay does not need present or emitted active overlay callback")
    }
  }
  if ($RequireOverlayActivated -and -not $overlayActivated) {
    $failures.Add("overlay activation callback active=true emitted")
  }
  if ($RequireNoOverlayActivation -and $overlayActivated) {
    $failures.Add("overlay activation callback active=true was not emitted")
  }
  if ($RequireManagedOverlayComplete) {
    if ($app.managedOverlayResultMode -ne "complete") {
      $failures.Add("managed overlay result mode is complete")
    }
    if (-not $overlayActivated) {
      $failures.Add("managed overlay emitted active=true before completion")
    }
    if (-not $overlayDeactivated) {
      $failures.Add("managed overlay emitted active=false before completion")
    }
    if (-not $Result.wait -or $Result.wait.overlayClosed -ne $true) {
      $failures.Add("managed overlay close wait completed")
    }
    if (-not $Result.wait -or $Result.wait.overlayParked -ne $true) {
      $failures.Add("managed overlay park wait completed")
    }
    if (-not $Result.wait -or $Result.wait.overlayComplete -ne $true) {
      $failures.Add("managed overlay open-and-wait completion resolved")
    }
  }
  foreach ($eventType in $RequireEvent) {
    if (-not ($events | Where-Object { $_.type -eq $eventType } | Select-Object -First 1)) {
      $failures.Add("event $eventType emitted")
    }
  }
  if ($RequireNoCrashes) {
    if (-not $crashDiagnostics) {
      $failures.Add("crash diagnostics available")
    } else {
      $crashDumps = if ($crashDiagnostics.crashDumps) { @($crashDiagnostics.crashDumps) } else { @() }
      $fatalLifecycleEvents = if ($crashDiagnostics.fatalLifecycleEvents) { @($crashDiagnostics.fatalLifecycleEvents) } else { @() }
      if ($crashDiagnostics.available -ne $true) {
        $failures.Add("crash diagnostics available")
      }
      if ($crashDiagnostics.ok -ne $true) {
        $failures.Add("no crash diagnostics reported")
      }
      if ($crashDumps.Count -ne 0) {
        $failures.Add("no crash dumps found")
      }
      if ($fatalLifecycleEvents.Count -ne 0) {
        $failures.Add("no fatal lifecycle events recorded")
      }
    }
  }

  if ($failures.Count -gt 0) {
    if ($steam.initError -and $steam.initError.message) {
      Write-Host "Steam init error:"
      Write-Host $steam.initError.message
    }
    if ($Result.action -and $Result.action.error -and $Result.action.error.message) {
      Write-Host "Autorun action error:"
      Write-Host $Result.action.error.message
    }
    if ($RequireNoCrashes -and $crashDiagnostics) {
      Write-Host "Crash diagnostics:"
      Write-Host ($crashDiagnostics | ConvertTo-Json -Depth 8)
    }
    foreach ($failure in $failures) {
      Write-Host "Smoke result failed: $failure"
    }
    throw "Smoke verification failed."
  }

  Write-Host ("Electron smoke result verified appId={0} platform={1}/{2} overlayEnabled={3} overlayNeedsPresent={4} steamLaunch={5} action={6}" -f `
    $app.appId,
    $processInfo.platform,
    $processInfo.arch,
    (Read-OkValue $steam.overlayEnabled),
    (Read-OkValue $steam.overlayNeedsPresent),
    $launch.steamLaunch,
    $Result.action.action)
}

function Invoke-DirectSmoke {
  $exe = Resolve-SmokeExe
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ResultFile) | Out-Null
  Remove-Item -LiteralPath $ResultFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $DiagnosticDir -Recurse -Force -ErrorAction SilentlyContinue

  Set-SmokeProcessEnv (Get-SmokeEnv -LogFile $ResultFile -SmokeAction $Action)
  $process = Start-Process -FilePath $exe -WorkingDirectory $AppDir -PassThru
  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Timed out waiting for SteamBridgeSmoke.exe to exit."
  }

  Wait-ForResultFile -LogFile $ResultFile
  Assert-SmokeResult (Read-SmokeResult -LogFile $ResultFile)
}

function Invoke-SteamLaunchSmoke {
  if (-not $ShortcutGameId) {
    throw "Missing -ShortcutGameId for steam-launch mode."
  }
  Assert-InteractiveWindowsSessionForSteamLaunch | Out-Null
  if (-not $AllowStartSteamClient -and -not (Get-Process steam -ErrorAction SilentlyContinue)) {
    throw (
      "Steam is not running. Start Steam once in the interactive Windows desktop session, " +
      "wait for the client UI to render normally, then rerun the helper. " +
      "Pass -AllowStartSteamClient only when you intentionally want this helper to start Steam via steam://rungameid."
    )
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ResultFile) | Out-Null
  Remove-Item -LiteralPath $ResultFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $DiagnosticDir -Recurse -Force -ErrorAction SilentlyContinue

  Start-Process "steam://rungameid/$ShortcutGameId"
  Wait-ForResultFile -LogFile $ResultFile
  $result = Read-SmokeResult -LogFile $ResultFile
  Assert-SmokeResult $result
  Wait-ForSmokeProcessExit -Result $result
  Write-Host "Windows steam-launch smoke completed."
}

switch ($Mode) {
  "print-launch-options" {
    Write-Host "Steam shortcut launch options:"
    Write-Host (Get-LaunchOptionsLine -LogFile $ResultFile -SmokeAction $Action)
    if ($ShortcutGameId) {
      Write-Host "Launch URL: steam://rungameid/$ShortcutGameId"
    }
  }
  "print-launch-env" {
    foreach ($line in (Format-SmokeEnvLines (Get-SmokeEnv -LogFile $ResultFile -SmokeAction $Action))) {
      Write-Host $line
    }
  }
  "write-launch-env" {
    Write-SmokeEnvFile -LogFile $ResultFile -SmokeAction $Action
    Write-Host "Wrote Steam Bridge smoke env file: $SmokeEnvFile"
  }
  "preflight" {
    Invoke-Preflight
  }
  "direct" {
    Invoke-DirectSmoke
  }
  "steam-launch" {
    Add-DefaultRequireEvents
    $RequireSteamLaunch = $true
    if (-not $AllowOverlayNotReady) {
      $RequireOverlayReady = $true
    }
    Invoke-SteamLaunchSmoke
  }
  "verify" {
    Assert-SmokeResult (Read-SmokeResult -LogFile $ResultFile)
  }
}
