[CmdletBinding()]
param(
  [ValidateSet("direct", "steam-launch", "steam-app", "verify", "preflight", "print-launch-options", "print-launch-env", "write-launch-env")]
  [string]$Mode = "direct",

  [string]$AppDir = "",
  [string]$ResultFile = "",
  [string]$DiagnosticDir = "",
  [string]$PreflightJsonFile = "",
  [string]$SmokeEnvFile = "",
  [int]$AppId = 480,
  [string]$NativePath = "",

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
    "presenter-profile-open-and-wait",
    "presenter-players",
    "presenter-players-open-and-wait",
    "presenter-community",
    "presenter-community-open-and-wait",
    "presenter-stats",
    "presenter-stats-open-and-wait",
    "presenter-achievements",
    "presenter-achievements-open-and-wait",
    "presenter-user",
    "presenter-user-native",
    "presenter-user-open-and-wait",
    "presenter-checkout",
    "presenter-shortcut",
    "presenter-shortcut-open-and-wait",
    "presenter-achievement-progress",
    "presenter-achievement-unlock"
  )]
  [string]$Action = "none",

  [string]$OverlayProfile = "diagnostic",
  [string]$OverlayInProcessGpu = "",
  [string]$OverlayDisableDirectComposition = "",
  [string]$OverlayScrubChildEnv = "",
  [string]$OverlayIsolateChildProcesses = "",
  [string]$WindowMode = "",
  [string]$WebUrl = "",
  [string]$WebModal = "",
  [ValidateSet("", "web", "native")]
  [string]$StoreRoute = "",
  [string]$CheckoutUrl = "",
  [string]$CheckoutTransactionId = "",
  [string]$CheckoutReturnUrl = "",
  [string]$CheckoutJsonFile = "",
  [string]$InitTxnRequestFile = "",
  [string]$InitTxnApiKeyEnv = "",
  [ValidateSet("", "sandbox", "production")]
  [string]$InitTxnEndpoint = "",
  [string]$Dialog = "",
  [string]$UserDialog = "",
  [string]$ShortcutTarget = "",
  [string]$PresenterMode = "",
  [ValidateSet("", "default", "opengl", "gl", "wgl", "windows-opengl", "d3d", "d3d11", "direct3d", "direct3d11", "dxgi", "windows-d3d11")]
  [string]$NativeHostBackend = "",
  [ValidateSet("", "default", "popup", "popup-layered", "control", "overlapped", "plain")]
  [string]$NativeHostStyle = "",
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
  [switch]$AllowSteamNotRunning,
  [switch]$AllowOverlayNotReady,
  [switch]$RequireOverlayActivated,
  [switch]$RequireNoOverlayActivation,
  [switch]$RequirePassiveNotification,
  [string]$RequireNativeHostBackend = "",
  [int]$RequireRestoreFocusDelayMs = -1,
  [switch]$RequireZeroManagedOverlayTiming,
  [switch]$RequireManagedOverlayComplete,
  [switch]$RequireMicroTxnCallback,
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
  if ($OverlayScrubChildEnv) {
    $args += "--steam-bridge-electron-overlay-scrub-child-env=$OverlayScrubChildEnv"
  }
  if ($OverlayIsolateChildProcesses) {
    $args += "--steam-bridge-electron-overlay-isolate-child-processes=$OverlayIsolateChildProcesses"
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
  if ($StoreRoute) {
    $args += "--steam-bridge-smoke-store-route=$StoreRoute"
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
  if ($CheckoutJsonFile) {
    $args += "--steam-bridge-smoke-checkout-json-file=$CheckoutJsonFile"
  }
  if ($InitTxnRequestFile) {
    $args += "--steam-bridge-smoke-init-txn-request-file=$InitTxnRequestFile"
  }
  if ($InitTxnApiKeyEnv) {
    $args += "--steam-bridge-smoke-init-txn-api-key-env=$InitTxnApiKeyEnv"
  }
  if ($InitTxnEndpoint) {
    $args += "--steam-bridge-smoke-init-txn-endpoint=$InitTxnEndpoint"
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
  if ($NativeHostBackend) {
    $args += "--steam-bridge-windows-native-host-backend=$NativeHostBackend"
  }
  if ($NativeHostStyle) {
    $args += "--steam-bridge-windows-native-host-style=$NativeHostStyle"
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

function Redact-SmokeLaunchArgument {
  param([string]$Argument)

  $sensitivePrefixes = @(
    "--steam-bridge-smoke-checkout-url=",
    "--steam-bridge-smoke-checkout-transaction-id=",
    "--steam-bridge-smoke-checkout-return-url=",
    "--steam-bridge-smoke-checkout-json-file=",
    "--steam-bridge-smoke-init-txn-request-file=",
    "--steam-bridge-smoke-init-txn-api-key-env="
  )
  foreach ($prefix in $sensitivePrefixes) {
    if ($Argument.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return ($prefix + "REDACTED")
    }
  }
  return $Argument
}

function Get-LaunchOptionsLine {
  param([string]$LogFile, [string]$SmokeAction)
  if ($SmokeEnvFile) {
    return (Join-LaunchOptions @("--steam-bridge-smoke-env-file=$SmokeEnvFile"))
  }
  return (Join-LaunchOptions (Get-SmokeArgs -LogFile $LogFile -SmokeAction $SmokeAction | ForEach-Object {
    Redact-SmokeLaunchArgument -Argument $_
  }))
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
  if ($NativePath) {
    $envMap.STEAM_BRIDGE_NATIVE_PATH = $NativePath
  }
  if ($OverlayDisableDirectComposition) {
    $envMap.STEAM_BRIDGE_ELECTRON_OVERLAY_DISABLE_DIRECT_COMPOSITION = $OverlayDisableDirectComposition
  }
  if ($OverlayInProcessGpu) {
    $envMap.STEAM_BRIDGE_ELECTRON_OVERLAY_IN_PROCESS_GPU = $OverlayInProcessGpu
  }
  if ($OverlayScrubChildEnv) {
    $envMap.STEAM_BRIDGE_ELECTRON_OVERLAY_SCRUB_CHILD_ENV = $OverlayScrubChildEnv
  }
  if ($OverlayIsolateChildProcesses) {
    $envMap.STEAM_BRIDGE_ELECTRON_OVERLAY_ISOLATE_CHILD_PROCESSES = $OverlayIsolateChildProcesses
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
  if ($StoreRoute) {
    $envMap.STEAM_BRIDGE_SMOKE_STORE_ROUTE = $StoreRoute
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
  if ($CheckoutJsonFile) {
    $envMap.STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE = $CheckoutJsonFile
  }
  if ($InitTxnRequestFile) {
    $envMap.STEAM_BRIDGE_SMOKE_INIT_TXN_REQUEST_FILE = $InitTxnRequestFile
  }
  if ($InitTxnApiKeyEnv) {
    $envMap.STEAM_BRIDGE_SMOKE_INIT_TXN_API_KEY_ENV = $InitTxnApiKeyEnv
    $apiKeyValue = [System.Environment]::GetEnvironmentVariable($InitTxnApiKeyEnv, "Process")
    if ($apiKeyValue) {
      $envMap[$InitTxnApiKeyEnv] = $apiKeyValue
    }
  }
  if ($InitTxnEndpoint) {
    $envMap.STEAM_BRIDGE_SMOKE_INIT_TXN_ENDPOINT = $InitTxnEndpoint
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
  if ($NativeHostBackend) {
    $envMap.STEAM_BRIDGE_WINDOWS_NATIVE_HOST_BACKEND = $NativeHostBackend
  }
  if ($NativeHostStyle) {
    $envMap.STEAM_BRIDGE_WINDOWS_NATIVE_HOST_STYLE = $NativeHostStyle
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
  param($EnvMap, [switch]$RedactSensitive)

  $lines = @(
    "# Steam Bridge Windows smoke launch state",
    "# Rewritten by windows-electron-smoke.ps1 before Steam launches the shortcut."
  )
  foreach ($key in $EnvMap.Keys) {
    $value = $EnvMap[$key]
    if ($RedactSensitive -and (
      @(
        "STEAM_BRIDGE_SMOKE_CHECKOUT_URL",
        "STEAM_BRIDGE_SMOKE_CHECKOUT_TRANSACTION_ID",
        "STEAM_BRIDGE_SMOKE_CHECKOUT_RETURN_URL",
        "STEAM_BRIDGE_SMOKE_CHECKOUT_JSON_FILE",
        "STEAM_BRIDGE_SMOKE_INIT_TXN_REQUEST_FILE",
        "STEAM_BRIDGE_SMOKE_INIT_TXN_API_KEY_ENV"
      ) -contains $key -or $key -match "(?i)(api[_-]?key|publisher[_-]?key|secret|token)"
    )) {
      $value = "REDACTED"
    }
    $lines += ("{0}={1}" -f $key, $value)
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
    ciToolOutputFormat = $ciTool.format
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
      format = $null
      timedOut = $false
      policies = @()
      enforcedPolicies = @()
      verifiedAndReputableEnforced = $false
    }
  }

  $result = Invoke-CiToolPolicyList -Path $ciTool.Source -TimeoutSeconds 10
  $output = @($result.output)
  $exitCode = $result.exitCode
  $errorMessage = $result.error

  $policies = if ($result.format -eq "json") {
    @(Convert-CiToolJsonPolicies -Text ($output -join [System.Environment]::NewLine))
  } else {
    @(Convert-CiToolPolicies -Lines $output)
  }
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
    format = $result.format
    timedOut = $result.timedOut
    policies = @($policies)
    enforcedPolicies = @($enforcedPolicies)
    verifiedAndReputableEnforced = $verifiedAndReputableEnforced
  }
}

function Invoke-CiToolPolicyList {
  param([string]$Path, [int]$TimeoutSeconds = 10)

  $job = $null

  try {
    $job = Start-Job -ScriptBlock {
      param([string]$CiToolPath)

      $output = @()
      $exitCode = 0
      $errorMessage = $null
      $format = "text"
      try {
        $output = @(& $CiToolPath -lp -json 2>&1 | ForEach-Object { [string]$_ })
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0 -or $output.Count -eq 0) {
          $output = @(& $CiToolPath -lp 2>&1 | ForEach-Object { [string]$_ })
          $exitCode = $LASTEXITCODE
        } else {
          $format = "json"
        }
      } catch {
        $errorMessage = $_.Exception.Message
        $exitCode = 1
      }

      [PSCustomObject]@{
        output = @($output)
        exitCode = $exitCode
        error = $errorMessage
        format = $format
      }
    } -ArgumentList $Path

    if (-not (Wait-Job -Job $job -Timeout $TimeoutSeconds)) {
      Stop-Job -Job $job -ErrorAction SilentlyContinue
      return [PSCustomObject]@{
        output = @()
        exitCode = $null
        error = "CiTool.exe -lp timed out after $TimeoutSeconds seconds."
        timedOut = $true
      }
    }

    $result = Receive-Job -Job $job
    $firstResult = @($result | Where-Object { $_ -ne $null } | Select-Object -First 1)
    if ($firstResult.Count -eq 0) {
      return [PSCustomObject]@{
        output = @()
        exitCode = 1
        error = "CiTool.exe -lp returned no job result."
        timedOut = $false
      }
    }

    return [PSCustomObject]@{
      output = @($firstResult[0].output)
      exitCode = $firstResult[0].exitCode
      error = $firstResult[0].error
      format = $firstResult[0].format
      timedOut = $false
    }
  } catch {
    return [PSCustomObject]@{
      output = @()
      exitCode = 1
      error = $_.Exception.Message
      timedOut = $false
    }
  } finally {
    if ($job) {
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    }
  }
}

function Convert-CiToolJsonPolicies {
  param([string]$Text)

  if (-not $Text) {
    return @()
  }

  try {
    $parsed = $Text | ConvertFrom-Json
  } catch {
    return @()
  }

  if (-not $parsed -or -not $parsed.Policies) {
    return @()
  }

  return @(
    @($parsed.Policies) |
      ForEach-Object {
        [PSCustomObject]@{
          policyId = $_.PolicyID
          basePolicyId = $_.BasePolicyID
          friendlyName = $_.FriendlyName
          version = $_.Version
          versionString = $_.VersionString
          platformPolicy = [bool]$_.IsSystemPolicy
          policySigned = [bool]$_.IsSignedPolicy
          hasFileOnDisk = [bool]$_.IsOnDisk
          enforced = [bool]$_.IsEnforced
          authorized = [bool]$_.IsAuthorized
          status = $null
          policyOptions = @($_.PolicyOptions)
        }
      }
  )
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
  $nativeOverride = if ($NativePath) { $NativePath } else { "" }
  $sessionSummary = Get-WindowsSessionSummary
  $steamProcess = @($sessionSummary.steamProcesses | Select-Object -First 1)
  $steamProcessId = $null
  if ($steamProcess) {
    $steamProcessId = $steamProcess.Id
  }
  $policy = Get-AppControlPolicySummary
  $exeSummary = Format-FileSignatureSummary -Path $exe
  $nativeSummary = Format-FileSignatureSummary -Path $nativeAddon
  $nativeOverrideSummary = if ($nativeOverride) {
    Format-FileSignatureSummary -Path $nativeOverride
  } else {
    $null
  }
  $codeIntegrityNeedles = @(
    "SteamBridgeSmoke",
    "steam_bridge_native",
    [System.IO.Path]::GetFileName($nativeAddon)
  )
  if ($nativeOverride) {
    $codeIntegrityNeedles += [System.IO.Path]::GetFileName($nativeOverride)
  }
  $events = Get-RecentCodeIntegrityEvents -Needles $codeIntegrityNeedles
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
  foreach ($summary in @($exeSummary, $nativeSummary, $nativeOverrideSummary)) {
    if (-not $summary) {
      continue
    }
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
  if ($nativeOverrideSummary) {
    $warnings += "STEAM_BRIDGE_NATIVE_PATH override is set for this diagnostic run; do not treat it as packaged native-addon proof."
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
      nativeOverride = $nativeOverrideSummary
    }
    nativePathOverride = [bool]$nativeOverride
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
      if ($CheckoutUrl -or $CheckoutTransactionId -or $CheckoutJsonFile) {
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

function Test-PassivePresenterSnapshot {
  param($Presenter, [string]$Label, [System.Collections.Generic.List[string]]$Failures)

  if (-not $Presenter) {
    $Failures.Add("$Label passive presenter snapshot available")
    return
  }
  if ($Presenter.mode -ne "passive") {
    $Failures.Add("$Label presenter mode is passive")
  }
  if ($Presenter.nativeHostOpen -ne $true) {
    $Failures.Add("$Label native host is open")
  }
  if ($Presenter.clickThrough -ne $true) {
    $Failures.Add("$Label presenter is click-through")
  }
  if ($Presenter.focusable -ne $false) {
    $Failures.Add("$Label presenter is not focusable")
  }
  if ($Presenter.overlayActive -ne $false) {
    $Failures.Add("$Label presenter overlay is inactive")
  }
}

function Test-ParkedPassivePresenterSnapshot {
  param($Presenter, [string]$Label, [System.Collections.Generic.List[string]]$Failures)

  Test-PassivePresenterSnapshot -Presenter $Presenter -Label $Label -Failures $Failures
  if (-not $Presenter) {
    return
  }
  if ($Presenter.transparent -ne $true) {
    $Failures.Add("$Label presenter is transparent after passive notification")
  }
  if ($Presenter.overlayNeedsPresent -ne $false) {
    $Failures.Add("$Label presenter no longer needs present after passive notification")
  }
  if ($Presenter.currentFps -ne 0) {
    $Failures.Add("$Label presenter current FPS is zero after passive notification")
  }
}

function Get-SmokeObjectProperty {
  param($Value, [string]$Name)

  if (-not $Value) {
    return $null
  }
  if ($Value -is [System.Collections.IDictionary]) {
    if ($Value.Contains($Name)) {
      return $Value[$Name]
    }
    return $null
  }

  $property = $Value.PSObject.Properties[$Name]
  if ($property) {
    return $property.Value
  }
  return $null
}

function Test-SmokeObjectHasProperty {
  param($Value, [string]$Name)

  if (-not $Value) {
    return $false
  }
  if ($Value -is [System.Collections.IDictionary]) {
    return $Value.Contains($Name)
  }
  return $null -ne $Value.PSObject.Properties[$Name]
}

function Get-MicroTxnPayload {
  param($Event)

  $payload = Get-SmokeObjectProperty -Value $Event -Name "payload"
  $indexedPayload = Get-SmokeObjectProperty -Value $payload -Name "0"
  if ($indexedPayload) {
    return $indexedPayload
  }
  return $payload
}

function Get-MicroTxnAppId {
  param($Event)

  $payload = Get-MicroTxnPayload -Event $Event
  foreach ($key in @("appId", "app_id", "m_unAppID", "m_nAppID")) {
    $value = Get-SmokeObjectProperty -Value $payload -Name $key
    if ($null -ne $value -and "$value" -ne "") {
      return [int]$value
    }
  }
  return $null
}

function Get-MicroTxnAuthorization {
  param($Event)

  $payload = Get-MicroTxnPayload -Event $Event
  foreach ($key in @("authorized", "m_bAuthorized")) {
    $value = Get-SmokeObjectProperty -Value $payload -Name $key
    if ($value -eq $true -or $value -eq 1 -or "$value" -eq "1" -or "$value" -eq "true") {
      return $true
    }
    if ($value -eq $false -or $value -eq 0 -or "$value" -eq "0" -or "$value" -eq "false") {
      return $false
    }
  }
  return $null
}

function Test-SanitizedValuePresent {
  param($Value)

  if ($null -eq $Value) {
    return $false
  }
  $present = Get-SmokeObjectProperty -Value $Value -Name "present"
  if ($null -ne $present) {
    return $present -eq $true
  }
  if ($Value -is [string]) {
    return $Value.Length -gt 0
  }
  return $true
}

function Test-MicroTxnOrderIdPresent {
  param($Event)

  $payload = Get-MicroTxnPayload -Event $Event
  foreach ($key in @("orderId", "orderID", "order_id", "orderid", "m_ulOrderID", "m_ulOrderId")) {
    if ((Test-SmokeObjectHasProperty -Value $payload -Name $key) -and (Test-SanitizedValuePresent -Value (Get-SmokeObjectProperty -Value $payload -Name $key))) {
      return $true
    }
  }
  return $false
}

function Test-MicroTxnPresenterSnapshot {
  param($Event)

  $payload = Get-MicroTxnPayload -Event $Event
  $presenter = Get-SmokeObjectProperty -Value $payload -Name "presenter"
  return ($presenter -and $presenter -isnot [string])
}

function Test-MicroTxnListenerRegistered {
  param($Events, [string]$CallbackName)

  foreach ($event in $Events) {
    if ($event.type -ne "callback:microtxn-listener-registered") {
      continue
    }
    $payload = Get-SmokeObjectProperty -Value $event -Name "payload"
    $callback = Get-SmokeObjectProperty -Value $payload -Name "callback"
    $registered = Get-SmokeObjectProperty -Value $payload -Name "registered"
    if ($callback -eq $CallbackName -and $registered -eq $true) {
      return $true
    }
  }
  return $false
}

function Assert-MicroTxnCallbackProof {
  param($Events, [string]$ActionName, [int]$ExpectedAppId, [System.Collections.Generic.List[string]]$Failures)

  if (-not (Test-MicroTxnListenerRegistered -Events $Events -CallbackName "MicroTxnAuthorizationResponse")) {
    $Failures.Add("MicroTxnAuthorizationResponse listener was registered before checkout proof")
  }
  if (-not (Test-MicroTxnListenerRegistered -Events $Events -CallbackName "LegacyMicroTxnAuthorizationResponse")) {
    $Failures.Add("LegacyMicroTxnAuthorizationResponse listener was registered before checkout proof")
  }

  $callbacks = @($Events | Where-Object { $_.type -eq "callback:microtxn" })
  if ($callbacks.Count -eq 0) {
    $Failures.Add("required MicroTxnAuthorizationResponse callback was recorded")
    return
  }

  $validCallbackIndexes = New-Object System.Collections.Generic.List[int]
  for ($index = 0; $index -lt $callbacks.Count; $index += 1) {
    $event = $callbacks[$index]
    $label = "microtxn callback {0}" -f ($index + 1)
    if (-not (Test-MicroTxnPresenterSnapshot -Event $event)) {
      $Failures.Add("$label included a presenter snapshot")
    }

    $appId = Get-MicroTxnAppId -Event $event
    if ($null -eq $appId) {
      $Failures.Add("$label included an app ID")
    } elseif ($appId -ne $ExpectedAppId) {
      $Failures.Add("$label app ID is $ExpectedAppId")
    }

    if ($null -eq (Get-MicroTxnAuthorization -Event $event)) {
      $Failures.Add("$label included an authorization result")
    }

    if (-not (Test-MicroTxnOrderIdPresent -Event $event)) {
      $Failures.Add("$label included an order ID presence marker")
    }
  }

  for ($eventIndex = 0; $eventIndex -lt $Events.Count; $eventIndex += 1) {
    if ($Events[$eventIndex].type -eq "callback:microtxn") {
      $validCallbackIndexes.Add($eventIndex)
    }
  }

  $openIndex = -1
  $closeIndex = -1
  if ($ActionName -eq "presenter-checkout") {
    for ($eventIndex = 0; $eventIndex -lt $Events.Count; $eventIndex += 1) {
      $event = $Events[$eventIndex]
      $payload = Get-SmokeObjectProperty -Value $event -Name "payload"
      if ($event.type -eq "overlay:presenter-open" -and (Get-SmokeObjectProperty -Value $payload -Name "target") -eq "checkout") {
        $openIndex = $eventIndex
        break
      }
    }
    for ($eventIndex = $openIndex + 1; $eventIndex -lt $Events.Count; $eventIndex += 1) {
      if ($Events[$eventIndex].type -eq "overlay:presenter-checkout-open-and-wait-complete") {
        $closeIndex = $eventIndex
        break
      }
    }
  } elseif ($ActionName -eq "presenter-shortcut" -or $ActionName -eq "presenter-shortcut-open-and-wait") {
    for ($eventIndex = 0; $eventIndex -lt $Events.Count; $eventIndex += 1) {
      $event = $Events[$eventIndex]
      $payload = Get-SmokeObjectProperty -Value $event -Name "payload"
      if ($event.type -eq "overlay:shortcut-open" -and (Get-SmokeObjectProperty -Value $payload -Name "target") -eq "checkout") {
        $openIndex = $eventIndex
        break
      }
    }
    for ($eventIndex = $openIndex + 1; $eventIndex -lt $Events.Count; $eventIndex += 1) {
      if ($Events[$eventIndex].type -eq "overlay:presenter-open-and-wait-complete" -or $Events[$eventIndex].type -eq "overlay:presenter-parked") {
        $closeIndex = $eventIndex
        break
      }
    }
  }

  if ($openIndex -lt 0) {
    $Failures.Add("required MicroTxn callback proof has a matching checkout open event")
    return
  }
  if ($closeIndex -lt 0) {
    $Failures.Add("required MicroTxn callback proof has a checkout wait completion event")
    return
  }

  $duringCheckout = $false
  foreach ($callbackIndex in $validCallbackIndexes) {
    if ($callbackIndex -gt $openIndex -and $callbackIndex -lt $closeIndex) {
      $duringCheckout = $true
      break
    }
  }
  if (-not $duringCheckout) {
    $Failures.Add("required MicroTxnAuthorizationResponse callback was recorded during the checkout wait lifecycle")
  }
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
  $nativeHostAvailability = Read-OkValue $overlay.nativeHostAvailability
  $electronOverlay = if ($nativePresenter) { $nativePresenter.electronOverlay } else { $null }
  $events = @($snapshot.events)
  $overlayActivated = @($events | Where-Object { Test-OverlayActiveEvent $_ }).Count -gt 0
  $overlayDeactivated = @($events | Where-Object { Test-OverlayInactiveEvent $_ }).Count -gt 0
  $managedOverlayClosedByWait = ($Result.wait -and $Result.wait.overlayClosed -eq $true)
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
  if (-not $AllowSteamNotRunning -and (Read-OkValue $steam.running) -ne $true) {
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
    $failures.Add("overlay activation callback active=true was emitted unexpectedly")
  }
  if ($RequirePassiveNotification) {
    $passiveEventType = ""
    if ($Action -eq "presenter-achievement-progress") {
      $passiveEventType = "achievement:progress"
    } elseif ($Action -eq "presenter-achievement-unlock") {
      $passiveEventType = "achievement:unlock"
    }

    if (-not $passiveEventType) {
      $failures.Add("passive notification action is supported")
    } else {
      $passiveEvent = @($events | Where-Object { $_.type -eq $passiveEventType } | Select-Object -First 1)
      if ($passiveEvent.Count -eq 0) {
        $failures.Add("passive notification event $passiveEventType emitted")
      } else {
        $passivePayload = $passiveEvent[0].payload
        if ($Action -eq "presenter-achievement-progress" -and $passivePayload.indicated -ne $true) {
          $failures.Add("passive achievement progress was accepted by Steam")
        }
        if ($Action -eq "presenter-achievement-unlock" -and $passivePayload.activated -ne $true) {
          $failures.Add("passive achievement unlock was accepted by Steam")
        }
        $eventPresenter = $passivePayload.presenter
        Test-PassivePresenterSnapshot -Presenter $eventPresenter -Label "passive notification event" -Failures $failures
      }
    }

    Test-ParkedPassivePresenterSnapshot -Presenter $nativePresenter -Label "final passive notification" -Failures $failures
  }
  if ($RequireNativeHostBackend) {
    if (-not $nativePresenter) {
      $failures.Add("native presenter snapshot available")
    } else {
      if ($nativePresenter.backend -ne $RequireNativeHostBackend) {
        $failures.Add("native presenter backend is $RequireNativeHostBackend")
      }
      $lazyPresenterReady = (
        $processInfo.platform -eq "win32" -and
        $Result.action.action -eq "presenter-ready" -and
        $nativeHostAvailability -and
        $nativeHostAvailability.available -eq $true
      )
      if (-not $lazyPresenterReady) {
        if ($nativePresenter.nativeHostOpen -ne $true) {
          $failures.Add("native presenter host is open")
        }
        if ($nativePresenter.attached -ne $true) {
          $failures.Add("native presenter is attached")
        }
      }
    }
  }
  if ($RequireManagedOverlayComplete) {
    if ($app.managedOverlayResultMode -ne "complete") {
      $failures.Add("managed overlay result mode is complete")
    }
    if (-not $overlayActivated) {
      $failures.Add("managed overlay emitted active=true before completion")
    }
    if (-not ($overlayDeactivated -or $managedOverlayClosedByWait)) {
      $failures.Add("managed overlay emitted active=false or completed the close wait before completion")
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
  if ($RequireMicroTxnCallback) {
    Assert-MicroTxnCallbackProof -Events $events -ActionName $Action -ExpectedAppId $AppId -Failures $failures
  }
  if (($Action -eq "presenter-shortcut" -or $Action -eq "presenter-shortcut-open-and-wait") -and $ShortcutTarget) {
    $configuredShortcutTarget = Get-SmokeObjectProperty -Value $app -Name "shortcutTarget"
    if ($configuredShortcutTarget -ne $ShortcutTarget) {
      $failures.Add("app shortcut target is $ShortcutTarget")
    }
    if (-not $electronOverlay) {
      $failures.Add("managed Electron overlay diagnostics available for shortcut target")
    } else {
      $overlayShortcut = Get-SmokeObjectProperty -Value $electronOverlay -Name "overlayShortcut"
      $targetType = Get-SmokeObjectProperty -Value $overlayShortcut -Name "targetType"
      $targetSnapshot = Get-SmokeObjectProperty -Value $overlayShortcut -Name "target"
      $targetSnapshotType = Get-SmokeObjectProperty -Value $targetSnapshot -Name "type"
      if ((Get-SmokeObjectProperty -Value $overlayShortcut -Name "enabled") -ne $true) {
        $failures.Add("managed Electron overlay shortcut is enabled")
      }
      if ($targetSnapshotType -and $targetType -ne $targetSnapshotType) {
        $failures.Add("managed Electron overlay shortcut target diagnostics are consistent")
      }
      if (-not (
        $targetType -eq $ShortcutTarget -or
        $targetSnapshotType -eq $ShortcutTarget -or
        ($targetType -eq "function" -and $configuredShortcutTarget -eq $ShortcutTarget)
      )) {
        $failures.Add("managed Electron overlay shortcut target is $ShortcutTarget")
      }
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
  $process = $null
  try {
    $process = Start-Process -FilePath $exe -WorkingDirectory $AppDir -PassThru
    Wait-ForResultFile -LogFile $ResultFile
    $result = Read-SmokeResult -LogFile $ResultFile
    Assert-SmokeResult $result
    Wait-ForSmokeProcessExit -Result $result
  } catch {
    if ($process -and -not $KeepOpenAfterResult) {
      try {
        $process.Refresh()
        if (-not $process.HasExited) {
          Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
      } catch {
        Write-Host ("Direct smoke cleanup warning: {0}" -f $_.Exception.Message)
      }
    }
    throw
  }
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

function Invoke-SteamAppSmoke {
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

  Start-Process "steam://rungameid/$AppId"
  Wait-ForResultFile -LogFile $ResultFile
  $result = Read-SmokeResult -LogFile $ResultFile
  Assert-SmokeResult $result
  Wait-ForSmokeProcessExit -Result $result
  Write-Host "Windows steam-app smoke completed."
}

switch ($Mode) {
  "print-launch-options" {
    Write-Host "Steam launch options:"
    Write-Host (Get-LaunchOptionsLine -LogFile $ResultFile -SmokeAction $Action)
    if ($ShortcutGameId) {
      Write-Host "Launch URL: steam://rungameid/$ShortcutGameId"
    } else {
      Write-Host "Launch URL: steam://rungameid/$AppId"
    }
  }
  "print-launch-env" {
    foreach ($line in (Format-SmokeEnvLines (Get-SmokeEnv -LogFile $ResultFile -SmokeAction $Action) -RedactSensitive)) {
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
  "steam-app" {
    Add-DefaultRequireEvents
    $RequireSteamLaunch = $true
    if (-not $AllowOverlayNotReady) {
      $RequireOverlayReady = $true
    }
    Invoke-SteamAppSmoke
  }
  "verify" {
    Assert-SmokeResult (Read-SmokeResult -LogFile $ResultFile)
  }
}
