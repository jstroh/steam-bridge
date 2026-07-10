param(
  [string]$AppDir = "",
  [string]$ArtifactRoot = "",
  [string[]]$MatrixArgs = @(),
  [string]$MatrixArgsFile = "",
  [string]$PrivateEnvFile = "",
  [string]$TaskNamePrefix = "SBOverlayMatrix",
  [ValidateSet("Limited", "Highest")]
  [string]$TaskRunLevel = "Limited",
  [int]$TimeoutSeconds = 1800,
  [int]$LogTailLines = 160,
  [switch]$KeepTask
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$Path)

  if (-not $Path) {
    return ""
  }
  return [System.IO.Path]::GetFullPath($Path)
}

function Invoke-CheckedNative {
  param([string]$FilePath, [string[]]$Arguments)

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath exited with code $LASTEXITCODE"
  }
}

function Invoke-NativeExitCode {
  param([string]$FilePath, [string[]]$Arguments)

  $result = [ordered]@{
    exitCodeCaptured = $false
    exitCode = $null
  }
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $global:LASTEXITCODE = $null
    & $FilePath @Arguments 1> $null 2> $null
    if ($null -ne $global:LASTEXITCODE) {
      $result.exitCodeCaptured = $true
      $result.exitCode = [int]$global:LASTEXITCODE
    }
  } catch {
    $result.exitCodeCaptured = $false
    $result.exitCode = $null
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  return [PSCustomObject]$result
}

function Split-MatrixArgumentNameValue {
  param([string]$Argument)

  $inline = [regex]::Match($Argument, "^(?<name>-[^:=\s]+)(?<separator>[:=])(?<value>.*)$")
  if ($inline.Success) {
    return [PSCustomObject]@{
      Name = $inline.Groups["name"].Value
      Separator = $inline.Groups["separator"].Value
      Value = $inline.Groups["value"].Value
      HasInlineValue = $true
    }
  }

  return [PSCustomObject]@{
    Name = $Argument
    Separator = ""
    Value = ""
    HasInlineValue = $false
  }
}

function Format-RedactedMatrixArgs {
  param([string[]]$Arguments)

  $sensitiveValueFlags = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase
  )
  foreach ($flag in @(
    "-AppId",
    "-CheckoutJsonFile",
    "-CheckoutReturnUrl",
    "-CheckoutTransactionId",
    "-CheckoutUrl",
    "-InitTxnApiKeyEnv",
    "-InitTxnEndpoint",
    "-InitTxnRequestFile",
    "-InitTxnResponseFile",
    "-JavaScriptRunnerExe",
    "-LaunchEnvFile",
    "-NativePath",
    "-ShortcutExe",
    "-ShortcutLaunchPrefix",
    "-ShortcutName",
    "-ShortcutsPath",
    "-ShortcutStartDir",
    "-SteamUserId",
    "-UserDialog",
    "-WebUrl"
  )) {
    [void]$sensitiveValueFlags.Add($flag)
  }

  $redacted = @()
  $redactNext = $false
  foreach ($argument in @($Arguments)) {
    if ($redactNext) {
      $redacted += "REDACTED"
      $redactNext = $false
      continue
    }

    $parts = Split-MatrixArgumentNameValue -Argument $argument
    if ($parts.HasInlineValue -and $sensitiveValueFlags.Contains($parts.Name)) {
      $redacted += ("{0}{1}REDACTED" -f $parts.Name, $parts.Separator)
      continue
    }

    $redacted += $argument
    if ($sensitiveValueFlags.Contains($parts.Name)) {
      $redactNext = $true
    }
  }

  return ($redacted -join " ")
}

function Read-MatrixArgsFile {
  param([string]$Path)

  if (-not $Path) {
    return @()
  }

  $resolvedPath = Resolve-FullPath $Path
  if (-not (Test-Path -LiteralPath $resolvedPath)) {
    throw "Matrix arguments file was not found."
  }

  try {
    $parsed = Get-Content -Raw -LiteralPath $resolvedPath | ConvertFrom-Json
  } catch {
    throw "Matrix arguments file must be JSON."
  }

  $values = if ($parsed -is [array]) {
    @($parsed)
  } elseif ($parsed -and $parsed.PSObject.Properties.Name -contains "matrixArgs") {
    @($parsed.matrixArgs)
  } else {
    throw "Matrix arguments file must contain a JSON array or an object with matrixArgs."
  }

  $arguments = @()
  foreach ($value in $values) {
    if ($null -eq $value) {
      throw "Matrix arguments file contains a null value."
    }
    $text = [string]$value
    if (-not $text) {
      throw "Matrix arguments file contains an empty value."
    }
    $arguments += $text
  }

  return $arguments
}

function Resolve-MatrixArgumentValue {
  param(
    [string[]]$Arguments,
    [string]$Name,
    $DefaultValue
  )

  $value = $DefaultValue
  for ($index = 0; $index -lt $Arguments.Count; $index += 1) {
    $argument = [string]$Arguments[$index]
    $parts = Split-MatrixArgumentNameValue -Argument $argument
    if ($parts.Name -ne $Name) {
      continue
    }
    if ($parts.HasInlineValue) {
      $value = $parts.Value
      continue
    }
    if ($index + 1 -lt $Arguments.Count) {
      $nextArgument = [string]$Arguments[$index + 1]
      if (-not $nextArgument.StartsWith("-")) {
        $value = $nextArgument
        continue
      }
    }
    $value = $true
  }
  return $value
}

function Test-ByteArraysEqual {
  param([byte[]]$Expected, [byte[]]$Actual)

  if ($null -eq $Expected -or $null -eq $Actual -or $Expected.Length -ne $Actual.Length) {
    return $false
  }
  for ($index = 0; $index -lt $Expected.Length; $index += 1) {
    if ($Expected[$index] -ne $Actual[$index]) {
      return $false
    }
  }
  return $true
}

function New-TaskLaunchEnvGuard {
  param([bool]$Required, [string]$Path)

  return [PSCustomObject][ordered]@{
    required = $Required
    path = $Path
    backupPath = ""
    originalBytes = $null
    attempted = $false
    originalPresent = $null
    backupCreated = $null
  }
}

function Start-TaskLaunchEnvGuard {
  param($Guard)

  if (-not $Guard.required) {
    return
  }
  $Guard.attempted = $true
  $Guard.originalPresent = Test-Path -LiteralPath $Guard.path
  $Guard.backupCreated = $false
  if ($Guard.originalPresent) {
    $Guard.originalBytes = [System.IO.File]::ReadAllBytes($Guard.path)
    $Guard.backupPath = "{0}.steam-bridge-task-backup-{1}" -f $Guard.path, ([System.Guid]::NewGuid().ToString("N"))
    Move-Item -LiteralPath $Guard.path -Destination $Guard.backupPath -ErrorAction Stop
    $Guard.backupCreated = (
      (Test-Path -LiteralPath $Guard.backupPath) -and
      -not (Test-Path -LiteralPath $Guard.path)
    )
    if (-not $Guard.backupCreated) {
      throw "Could not establish the task launch-env rollback guard."
    }
  }
}

function Complete-TaskLaunchEnvGuard {
  param($Guard)

  $evidence = [ordered]@{
    required = [bool]$Guard.required
    attempted = [bool]$Guard.attempted
    originalPresent = if ($Guard.attempted) { [bool]$Guard.originalPresent } else { $null }
    backupCreated = if ($Guard.attempted) { [bool]$Guard.backupCreated } else { $null }
    generatedRemoved = $null
    originalRestored = $null
    restoredBytesMatch = $null
    backupRemoved = $null
    ok = $false
  }

  try {
    if (-not $Guard.required) {
      $evidence.ok = $true
      return [PSCustomObject]$evidence
    }
    if (-not $Guard.attempted) {
      return [PSCustomObject]$evidence
    }

    if (Test-Path -LiteralPath $Guard.path) {
      Remove-Item -LiteralPath $Guard.path -Force -ErrorAction Stop
    }
    $evidence.generatedRemoved = -not (Test-Path -LiteralPath $Guard.path)

    if ($Guard.originalPresent) {
      if (-not $Guard.backupPath -or -not (Test-Path -LiteralPath $Guard.backupPath)) {
        throw "Task launch-env rollback backup is missing."
      }
      Move-Item -LiteralPath $Guard.backupPath -Destination $Guard.path -ErrorAction Stop
      $evidence.originalRestored = Test-Path -LiteralPath $Guard.path
      $restoredBytes = if ($evidence.originalRestored) {
        [System.IO.File]::ReadAllBytes($Guard.path)
      } else {
        $null
      }
      $evidence.restoredBytesMatch = Test-ByteArraysEqual -Expected $Guard.originalBytes -Actual $restoredBytes
      $evidence.backupRemoved = -not (Test-Path -LiteralPath $Guard.backupPath)
    } else {
      $evidence.originalRestored = -not (Test-Path -LiteralPath $Guard.path)
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
    $evidence.ok = $false
  } finally {
    $Guard.originalBytes = $null
  }
  return [PSCustomObject]$evidence
}

function Get-TaskSmokePackageProcesses {
  param([string]$PackageAppDir)

  $trimChars = @([char]92, [char]47)
  $pathSeparator = [string][char]92
  $normalizedAppDir = ([System.IO.Path]::GetFullPath($PackageAppDir)).TrimEnd($trimChars).ToLowerInvariant()
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'SteamBridgeSmoke.exe'" -ErrorAction Stop)
  return @($processes | Where-Object {
    $executablePath = ([string]$_.ExecutablePath).ToLowerInvariant()
    $commandLine = ([string]$_.CommandLine).ToLowerInvariant()
    (
      ($executablePath -and $executablePath.StartsWith($normalizedAppDir + $pathSeparator)) -or
      ($commandLine -and $commandLine.Contains($normalizedAppDir + $pathSeparator))
    )
  })
}

function Get-ExactTaskRunnerProcesses {
  param([string]$RunnerPath)

  $normalizedRunner = ([System.IO.Path]::GetFullPath($RunnerPath)).ToLowerInvariant()
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction Stop)
  return @($processes | Where-Object {
    $commandLine = ([string]$_.CommandLine).ToLowerInvariant()
    $commandLine -and $commandLine.Contains($normalizedRunner)
  })
}

function Get-TaskProcessStartTicks {
  param($Process)

  if ($null -eq $Process -or $null -eq $Process.CreationDate) {
    return [int64]0
  }
  return ([DateTime]$Process.CreationDate).ToUniversalTime().Ticks
}

function New-TaskRunnerTreeState {
  param([string]$RunnerPath)

  return [PSCustomObject]@{
    runnerPath = $RunnerPath
    captureAttempted = $false
    captureSucceeded = $false
    captureWaitMilliseconds = 0
    rootIdentities = @{}
    observedIdentities = @{}
    trackingAttemptCount = 0
    trackingFailureCount = 0
    observedTreeProcessCount = 0
  }
}

function Add-TaskRunnerTreeIdentity {
  param($State, $Process, [bool]$Root)

  $processId = [int]$Process.ProcessId
  if ($processId -le 0) {
    return
  }
  $key = [string]$processId
  $identity = [PSCustomObject]@{
    processId = $processId
    parentProcessId = [int]$Process.ParentProcessId
    startTicks = Get-TaskProcessStartTicks -Process $Process
  }
  $State.observedIdentities[$key] = $identity
  if ($Root) {
    $State.rootIdentities[$key] = $identity
  }
  $State.observedTreeProcessCount = [Math]::Max(
    [int]$State.observedTreeProcessCount,
    [int]$State.observedIdentities.Count
  )
}

function Test-TaskRunnerTreeIdentity {
  param($Process, $Identity)

  return (
    $null -ne $Process -and
    [int]$Process.ProcessId -eq [int]$Identity.processId -and
    (Get-TaskProcessStartTicks -Process $Process) -eq [int64]$Identity.startTicks
  )
}

function Update-TaskRunnerTreeState {
  param($State)

  $State.trackingAttemptCount += 1
  try {
    $processes = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    $byPid = @{}
    foreach ($process in $processes) {
      $byPid[[string][int]$process.ProcessId] = $process
    }

    $activeTree = @{}
    foreach ($identity in @($State.observedIdentities.Values)) {
      $key = [string][int]$identity.processId
      $process = $byPid[$key]
      if (Test-TaskRunnerTreeIdentity -Process $process -Identity $identity) {
        $activeTree[$key] = $process
      }
    }

    $changed = $true
    while ($changed) {
      $changed = $false
      foreach ($process in $processes) {
        $key = [string][int]$process.ProcessId
        $parentKey = [string][int]$process.ParentProcessId
        if (-not $activeTree.ContainsKey($key) -and $activeTree.ContainsKey($parentKey)) {
          Add-TaskRunnerTreeIdentity -State $State -Process $process -Root $false
          $activeTree[$key] = $process
          $changed = $true
        }
      }
    }
    return @($activeTree.Values)
  } catch {
    $State.trackingFailureCount += 1
    throw
  }
}

function Wait-TaskRunnerTreeCapture {
  param($State, [int]$WaitSeconds)

  $State.captureAttempted = $true
  $startedAt = Get-Date
  $deadline = $startedAt.AddSeconds([Math]::Max(1, $WaitSeconds))
  while ((Get-Date) -lt $deadline) {
    try {
      $matches = @(Get-ExactTaskRunnerProcesses -RunnerPath $State.runnerPath)
      if ($matches.Count -gt 0) {
        foreach ($process in $matches) {
          Add-TaskRunnerTreeIdentity -State $State -Process $process -Root $true
        }
        $State.captureSucceeded = $true
        [void](Update-TaskRunnerTreeState -State $State)
        break
      }
    } catch {
      $State.trackingFailureCount += 1
    }
    Start-Sleep -Milliseconds 100
  }
  $State.captureWaitMilliseconds = [int]((Get-Date) - $startedAt).TotalMilliseconds
  return [bool]$State.captureSucceeded
}

function Start-TaskRunnerTreeGuard {
  param($State, [bool]$Required, [bool]$TerminateTree, [bool]$Completed)

  $evidence = [ordered]@{
    required = $Required
    attempted = $false
    completedMarkerObserved = $Completed
    captureAttempted = [bool]$State.captureAttempted
    captureSucceeded = [bool]$State.captureSucceeded
    captureWaitMilliseconds = [int]$State.captureWaitMilliseconds
    capturedRootCount = [int]$State.rootIdentities.Count
    capturedTreeProcessCount = [int]$State.observedTreeProcessCount
    trackingAttemptCount = [int]$State.trackingAttemptCount
    trackingFailureCount = [int]$State.trackingFailureCount
    treeTerminationRequired = $TerminateTree
    enumerationSucceeded = $null
    processesBeforeCount = $null
    taskkillAttemptCount = 0
    taskkillFailureCount = 0
    fallbackStopAttemptCount = 0
    fallbackStopFailureCount = 0
    processesAfterCount = $null
    emptyVerificationScanCount = 0
    verifiedEmpty = $null
    ok = $false
  }
  if (-not $Required) {
    $evidence.ok = $true
    return [PSCustomObject]$evidence
  }

  $evidence.attempted = $true
  try {
    $currentTree = @(Update-TaskRunnerTreeState -State $State)
    $evidence.enumerationSucceeded = $true
    $evidence.processesBeforeCount = $currentTree.Count
    $evidence.capturedTreeProcessCount = [int]$State.observedTreeProcessCount
    $evidence.trackingAttemptCount = [int]$State.trackingAttemptCount
    $evidence.trackingFailureCount = [int]$State.trackingFailureCount
    if ($TerminateTree) {
      foreach ($rootIdentity in @($State.rootIdentities.Values)) {
        $rootProcess = @($currentTree | Where-Object {
          Test-TaskRunnerTreeIdentity -Process $_ -Identity $rootIdentity
        } | Select-Object -First 1)
        if ($rootProcess.Count -eq 0) {
          continue
        }
        $evidence.taskkillAttemptCount += 1
        $rootProcessIdText = [string][int]$rootIdentity.processId
        & taskkill.exe /PID $rootProcessIdText /T /F *> $null
        if ($LASTEXITCODE -ne 0) {
          $evidence.taskkillFailureCount += 1
        }
      }
    }
  } catch {
    $evidence.enumerationSucceeded = $false
  }
  return [PSCustomObject]$evidence
}

function Complete-TaskRunnerTreeGuard {
  param($State, $Evidence, [bool]$Completed)

  if (-not $Evidence.required) {
    return $Evidence
  }
  try {
    $graceMilliseconds = if ($Completed) { 1500 } else { 500 }
    Start-Sleep -Milliseconds $graceMilliseconds
    $remaining = @(Update-TaskRunnerTreeState -State $State)
    foreach ($process in $remaining) {
      $evidence.fallbackStopAttemptCount += 1
      try {
        Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction Stop
      } catch {
        $evidence.fallbackStopFailureCount += 1
      }
    }

    $deadline = (Get-Date).AddSeconds(5)
    $consecutiveEmptyScans = 0
    while ((Get-Date) -lt $deadline -and $consecutiveEmptyScans -lt 2) {
      $matches = @(Update-TaskRunnerTreeState -State $State)
      $evidence.processesAfterCount = $matches.Count
      if ($matches.Count -eq 0) {
        $consecutiveEmptyScans += 1
      } else {
        $consecutiveEmptyScans = 0
        foreach ($process in $matches) {
          $evidence.fallbackStopAttemptCount += 1
          try {
            Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction Stop
          } catch {
            $evidence.fallbackStopFailureCount += 1
          }
        }
      }
      if ($consecutiveEmptyScans -lt 2) {
        Start-Sleep -Milliseconds 250
      }
    }
    $finalMatches = @(Update-TaskRunnerTreeState -State $State)
    $evidence.processesAfterCount = $finalMatches.Count
    $evidence.emptyVerificationScanCount = $consecutiveEmptyScans
    $evidence.verifiedEmpty = ($finalMatches.Count -eq 0 -and $consecutiveEmptyScans -ge 2)
    $evidence.captureAttempted = [bool]$State.captureAttempted
    $evidence.captureSucceeded = [bool]$State.captureSucceeded
    $evidence.capturedRootCount = [int]$State.rootIdentities.Count
    $evidence.capturedTreeProcessCount = [int]$State.observedTreeProcessCount
    $evidence.trackingAttemptCount = [int]$State.trackingAttemptCount
    $evidence.trackingFailureCount = [int]$State.trackingFailureCount
    $evidence.ok = (
      $evidence.captureSucceeded -and
      $evidence.enumerationSucceeded -eq $true -and
      $evidence.verifiedEmpty
    )
  } catch {
    $evidence.verifiedEmpty = $false
    $evidence.ok = $false
  }
  return $Evidence
}

function Stop-AndVerifyTaskSmokePackageProcesses {
  param([bool]$Required, [string]$PackageAppDir)

  $evidence = [ordered]@{
    required = $Required
    attempted = $false
    enumerationSucceeded = $null
    processesBeforeCount = $null
    stopAttemptCount = 0
    stopFailureCount = 0
    processesAfterCount = $null
    emptyVerificationScanCount = 0
    verifiedEmpty = $null
    ok = $false
  }
  if (-not $Required) {
    $evidence.ok = $true
    return [PSCustomObject]$evidence
  }

  $evidence.attempted = $true
  try {
    $deadline = (Get-Date).AddSeconds(5)
    $firstScan = $true
    $consecutiveEmptyScans = 0
    while ((Get-Date) -lt $deadline -and $consecutiveEmptyScans -lt 2) {
      $matches = @(Get-TaskSmokePackageProcesses -PackageAppDir $PackageAppDir)
      $evidence.enumerationSucceeded = $true
      if ($firstScan) {
        $evidence.processesBeforeCount = $matches.Count
        $firstScan = $false
      }
      $evidence.processesAfterCount = $matches.Count
      if ($matches.Count -eq 0) {
        $consecutiveEmptyScans += 1
      } else {
        $consecutiveEmptyScans = 0
        foreach ($process in $matches) {
          $evidence.stopAttemptCount += 1
          try {
            Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction Stop
          } catch {
            $evidence.stopFailureCount += 1
          }
        }
      }
      if ($consecutiveEmptyScans -lt 2) {
        Start-Sleep -Milliseconds 250
      }
    }
    $finalMatches = @(Get-TaskSmokePackageProcesses -PackageAppDir $PackageAppDir)
    $evidence.processesAfterCount = $finalMatches.Count
    $evidence.emptyVerificationScanCount = $consecutiveEmptyScans
    $evidence.verifiedEmpty = ($finalMatches.Count -eq 0 -and $consecutiveEmptyScans -ge 2)
    $evidence.ok = ($evidence.enumerationSucceeded -eq $true -and $evidence.verifiedEmpty)
  } catch {
    $evidence.enumerationSucceeded = $false
    $evidence.verifiedEmpty = $false
    $evidence.ok = $false
  }
  return [PSCustomObject]$evidence
}

function Remove-AndVerifyTaskFiles {
  param([bool]$Required, [string]$RunDirectory)

  $evidence = [ordered]@{
    required = $Required
    attempted = $false
    directoryPresentBefore = $null
    entryCountBefore = $null
    directoryRemoved = $null
    verifiedAbsent = $null
    ok = $false
  }
  if (-not $Required) {
    $evidence.ok = $true
    return [PSCustomObject]$evidence
  }

  $evidence.attempted = $true
  try {
    $evidence.directoryPresentBefore = Test-Path -LiteralPath $RunDirectory
    $evidence.entryCountBefore = if ($evidence.directoryPresentBefore) {
      @(Get-ChildItem -LiteralPath $RunDirectory -Force -Recurse -ErrorAction Stop).Count
    } else {
      0
    }
    if ($evidence.directoryPresentBefore) {
      Remove-Item -LiteralPath $RunDirectory -Force -Recurse -ErrorAction Stop
    }
    $evidence.directoryRemoved = -not (Test-Path -LiteralPath $RunDirectory)
    $evidence.verifiedAbsent = -not (Test-Path -LiteralPath $RunDirectory)
    $evidence.ok = ($evidence.directoryRemoved -and $evidence.verifiedAbsent)
  } catch {
    $evidence.directoryRemoved = $false
    $evidence.verifiedAbsent = $false
    $evidence.ok = $false
  }
  return [PSCustomObject]$evidence
}

$runId = "{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), ([System.Guid]::NewGuid().ToString("N").Substring(0, 8))
if (-not $AppDir) {
  $AppDir = Split-Path -Parent $PSCommandPath
}
$AppDir = Resolve-FullPath $AppDir
$matrixScript = Join-Path $AppDir "windows-overlay-matrix.ps1"
if (-not (Test-Path -LiteralPath $matrixScript)) {
  throw "Missing windows-overlay-matrix.ps1 beside AppDir: $matrixScript"
}

if (-not $ArtifactRoot) {
  $ArtifactRoot = Join-Path $env:TEMP "steam-bridge-windows-overlay-task-$runId"
}
$ArtifactRoot = Resolve-FullPath $ArtifactRoot

if ($PrivateEnvFile) {
  $PrivateEnvFile = Resolve-FullPath $PrivateEnvFile
  if (-not (Test-Path -LiteralPath $PrivateEnvFile)) {
    throw "Private environment file was not found."
  }
}

$matrixArgsFromFile = @()
if ($MatrixArgsFile) {
  $MatrixArgsFile = Resolve-FullPath $MatrixArgsFile
  $matrixArgsFromFile = @(Read-MatrixArgsFile -Path $MatrixArgsFile)
}
$resolvedMatrixArgs = @($matrixArgsFromFile) + @($MatrixArgs)
$resolvedSuite = [string](Resolve-MatrixArgumentValue `
  -Arguments $resolvedMatrixArgs `
  -Name "-Suite" `
  -DefaultValue "baseline")
$resolvedLaunchMode = [string](Resolve-MatrixArgumentValue `
  -Arguments $resolvedMatrixArgs `
  -Name "-LaunchMode" `
  -DefaultValue "steam-launch")
$isLiveMatrixSuite = (
  $resolvedLaunchMode -in @("steam-launch", "steam-app") -and
  $resolvedSuite -notin @("preflight", "readiness", "shortcut")
)
$resolvedLaunchEnvFile = ""
if ($isLiveMatrixSuite) {
  $launchEnvArgument = Resolve-MatrixArgumentValue `
    -Arguments $resolvedMatrixArgs `
    -Name "-LaunchEnvFile" `
    -DefaultValue ""
  if ($launchEnvArgument -is [bool] -or [string]::IsNullOrWhiteSpace([string]$launchEnvArgument)) {
    $launchEnvArgument = Join-Path $env:LOCALAPPDATA "SteamBridgeSmoke\steam-bridge-windows-smoke.env"
  }
  $resolvedLaunchEnvFile = Resolve-FullPath ([string]$launchEnvArgument)
}

$taskPrefix = if ($TaskNamePrefix) { $TaskNamePrefix } else { "SBOverlayMatrix" }
$taskPrefix = ($taskPrefix -replace "[^A-Za-z0-9_.-]", "-").Trim("-")
if (-not $taskPrefix) {
  $taskPrefix = "SBOverlayMatrix"
}
$taskName = "$taskPrefix-$runId"
if ($taskName.Length -gt 200) {
  $taskName = $taskName.Substring(0, 200)
}

$runRoot = Join-Path $env:SystemDrive "sb"
$runDir = Join-Path $runRoot $runId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$runner = Join-Path $runDir "run.ps1"
$configPath = Join-Path $runDir "config.json"
$donePath = Join-Path $runDir "done.json"
$logPath = Join-Path $runDir "task-output.log"

$arguments = @("-AppDir", $AppDir, "-ArtifactRoot", $ArtifactRoot) + @($resolvedMatrixArgs)
if (-not $KeepTask) {
  $arguments += "-TaskCleanupExpected"
}
if ($isLiveMatrixSuite) {
  $arguments += @("-LaunchEnvFile", $resolvedLaunchEnvFile)
}
$config = [PSCustomObject]@{
  matrixScript = $matrixScript
  arguments = @($arguments)
  privateEnvFile = $PrivateEnvFile
  donePath = $donePath
  logPath = $logPath
}
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8

$runnerContent = @'
$ErrorActionPreference = "Stop"

function Import-PrivateEnvFile {
  param([string]$Path)

  if (-not $Path) {
    return
  }
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Private environment file was not found."
  }

  $count = 0
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }
    $equalsIndex = $trimmed.IndexOf("=")
    if ($equalsIndex -lt 1) {
      throw "Private environment file contains a line without NAME=VALUE syntax."
    }
    $name = $trimmed.Substring(0, $equalsIndex).Trim()
    $value = $trimmed.Substring($equalsIndex + 1)
    if ($name -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      throw "Private environment file contains an invalid environment variable name."
    }
    Set-Item -Path ("Env:{0}" -f $name) -Value $value
    $count += 1
  }
  Write-Host ("Imported private environment values: count={0}" -f $count)
}

function Convert-MatrixArgsToSplat {
  param([string[]]$Arguments)

  $splat = @{}
  for ($index = 0; $index -lt $Arguments.Count; $index += 1) {
    $argument = [string]$Arguments[$index]
    if (-not $argument.StartsWith("-")) {
      throw "Matrix arguments must use named PowerShell parameters."
    }

    $inline = [regex]::Match($argument, "^(?<name>-[^:=\s]+)(?<separator>[:=])(?<value>.*)$")
    $inlineValue = $false
    if ($inline.Success) {
      $name = $inline.Groups["name"].Value.TrimStart("-")
      $value = $inline.Groups["value"].Value
      $inlineValue = $true
    } else {
      $name = $argument.TrimStart("-")
      $value = $true
    }

    if (-not $name) {
      throw "Matrix arguments contain an empty parameter name."
    }

    if (-not $inlineValue -and $index + 1 -lt $Arguments.Count) {
      $nextArgument = [string]$Arguments[$index + 1]
      if (-not $nextArgument.StartsWith("-")) {
        $value = $nextArgument
        $index += 1
      }
    }

    $splat[$name] = $value
  }

  return $splat
}

$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$exitCode = 0
$failureStage = "success"
$errorKind = "none"
$errorPresent = $false
$currentStage = "private-env-import"

Start-Transcript -LiteralPath ([string]$config.logPath) -Force | Out-Null
try {
  Import-PrivateEnvFile -Path ([string]$config.privateEnvFile)
  $currentStage = "matrix-argument-binding"
  $matrixArguments = @($config.arguments | ForEach-Object { [string]$_ })
  $matrixSplat = Convert-MatrixArgsToSplat -Arguments $matrixArguments
  $currentStage = "matrix-invocation"
  & ([string]$config.matrixScript) @matrixSplat
  if ($LASTEXITCODE -ne $null) {
    $exitCode = [int]$LASTEXITCODE
  }
  if ($exitCode -ne 0) {
    $failureStage = "matrix-exit"
    $errorKind = "matrix-nonzero-exit"
    $errorPresent = $true
  }
} catch {
  $exitCode = 1
  $errorPresent = $true
  switch ($currentStage) {
    "private-env-import" {
      $failureStage = "private-env-import"
      $errorKind = "private-env-error"
    }
    "matrix-argument-binding" {
      $failureStage = "matrix-argument-binding"
      $errorKind = "matrix-argument-error"
    }
    default {
      $failureStage = "matrix-invocation"
      $errorKind = "matrix-invocation-error"
    }
  }
} finally {
  [PSCustomObject]@{
    exitCode = $exitCode
    artifactRootPresent = ($config.arguments.Count -ge 4 -and -not [string]::IsNullOrWhiteSpace([string]$config.arguments[3]))
    finishedAt = (Get-Date).ToString("o")
    failureStage = $failureStage
    errorKind = $errorKind
    errorPresent = $errorPresent
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath ([string]$config.donePath) -Encoding UTF8
  Stop-Transcript | Out-Null
}

exit $exitCode
'@
Set-Content -LiteralPath $runner -Value $runnerContent -Encoding UTF8

$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $runner"
Write-Host "Windows overlay interactive task:"
Write-Host ("  taskName: {0}" -f $taskName)
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  artifactRoot: {0}" -f $ArtifactRoot)
Write-Host ("  privateEnvFile: {0}" -f $(if ($PrivateEnvFile) { "present" } else { "" }))
Write-Host ("  matrixArgsFile: {0}" -f $(if ($MatrixArgsFile) { "present" } else { "" }))
Write-Host ("  matrixArgs: {0}" -f (Format-RedactedMatrixArgs $resolvedMatrixArgs))
Write-Host ("  taskRunLevel: {0}" -f $TaskRunLevel)
if ($KeepTask) {
  Write-Host ("  taskFiles: {0}" -f $runDir)
} else {
  Write-Host "  taskFiles: configured"
}

$exitCode = 0
$timedOut = $false
$taskCreated = $false
$taskRunRequested = $false
$runnerTerminatedWithoutDone = $false
$taskFailureStage = "wrapper-setup"
$taskErrorKind = "wrapper-error"
$taskErrorPresent = $true
$runnerTreeState = New-TaskRunnerTreeState -RunnerPath $runner
$launchEnvGuard = New-TaskLaunchEnvGuard `
  -Required $isLiveMatrixSuite `
  -Path $resolvedLaunchEnvFile
try {
  Invoke-CheckedNative schtasks.exe @("/Create", "/TN", $taskName, "/TR", $taskCommand, "/SC", "ONCE", "/ST", "23:59", "/F", "/RL", $TaskRunLevel.ToUpperInvariant(), "/IT")
  $taskCreated = $true
  Start-TaskLaunchEnvGuard -Guard $launchEnvGuard
  $taskRunRequested = $true
  Invoke-CheckedNative schtasks.exe @("/Run", "/TN", $taskName)
  if (-not (Wait-TaskRunnerTreeCapture -State $runnerTreeState -WaitSeconds 10)) {
    throw "Could not capture the exact scheduled task runner process."
  }

  $deadline = (Get-Date).AddSeconds([Math]::Max(1, $TimeoutSeconds))
  $nextTreeSample = Get-Date
  while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $donePath)) {
    if ((Get-Date) -ge $nextTreeSample) {
      try {
        $activeRunnerTree = @(Update-TaskRunnerTreeState -State $runnerTreeState)
        if ($activeRunnerTree.Count -eq 0) {
          Start-Sleep -Milliseconds 250
          $confirmedRunnerTree = @(Update-TaskRunnerTreeState -State $runnerTreeState)
          if ($confirmedRunnerTree.Count -eq 0 -and -not (Test-Path -LiteralPath $donePath)) {
            $runnerTerminatedWithoutDone = $true
            break
          }
        }
      } catch {}
      $nextTreeSample = (Get-Date).AddSeconds(2)
    }
    Start-Sleep -Milliseconds 250
  }

  if ($runnerTerminatedWithoutDone) {
    $exitCode = 1
    $taskFailureStage = "runner-termination"
    $taskErrorKind = "done-missing"
    $taskErrorPresent = $true
    Write-Host "DONE_JSON_BEGIN"
    [PSCustomObject]@{
      exitCode = $exitCode
      artifactRootPresent = -not [string]::IsNullOrWhiteSpace($ArtifactRoot)
      finishedAtPresent = $false
      failureStage = $taskFailureStage
      errorKind = $taskErrorKind
      errorPresent = $taskErrorPresent
    } | ConvertTo-Json -Compress | Write-Host
    Write-Host "DONE_JSON_END"
  } elseif (-not (Test-Path -LiteralPath $donePath)) {
    $timedOut = $true
    $exitCode = 124
    $taskFailureStage = "runner-timeout"
    $taskErrorKind = "deadline-exceeded"
    $taskErrorPresent = $true
    Write-Host "DONE_JSON_BEGIN"
    [PSCustomObject]@{
      exitCode = $exitCode
      artifactRootPresent = -not [string]::IsNullOrWhiteSpace($ArtifactRoot)
      finishedAtPresent = $false
      failureStage = $taskFailureStage
      errorKind = $taskErrorKind
      errorPresent = $taskErrorPresent
    } | ConvertTo-Json -Compress | Write-Host
    Write-Host "DONE_JSON_END"
  } else {
    Write-Host "DONE_JSON_BEGIN"
    $doneJson = Get-Content -Raw -LiteralPath $donePath
    $done = $doneJson | ConvertFrom-Json
    $doneFailureContracts = @{
      "success" = "none"
      "private-env-import" = "private-env-error"
      "matrix-argument-binding" = "matrix-argument-error"
      "matrix-invocation" = "matrix-invocation-error"
      "matrix-exit" = "matrix-nonzero-exit"
    }
    $doneFailureStage = [string]$done.failureStage
    $doneErrorKind = [string]$done.errorKind
    $doneErrorPresent = ($done.errorPresent -eq $true)
    $doneExitCode = [int]$done.exitCode
    if (
      -not $doneFailureContracts.ContainsKey($doneFailureStage) -or
      $doneFailureContracts[$doneFailureStage] -ne $doneErrorKind -or
      $doneErrorPresent -ne ($doneFailureStage -ne "success") -or
      (($doneFailureStage -eq "success") -ne ($doneExitCode -eq 0))
    ) {
      throw "Scheduled task done status did not match the sanitized failure contract."
    }
    $taskFailureStage = $doneFailureStage
    $taskErrorKind = $doneErrorKind
    $taskErrorPresent = $doneErrorPresent
    [PSCustomObject]@{
      exitCode = $doneExitCode
      artifactRootPresent = ($done.artifactRootPresent -eq $true)
      finishedAtPresent = -not [string]::IsNullOrWhiteSpace([string]$done.finishedAt)
      failureStage = $doneFailureStage
      errorKind = $doneErrorKind
      errorPresent = $doneErrorPresent
    } | ConvertTo-Json -Compress | Write-Host
    Write-Host "DONE_JSON_END"
    $exitCode = $doneExitCode
  }

  Write-Host ("TASK_LOG_PRESENT={0}" -f (Test-Path -LiteralPath $logPath))
  Write-Host ("TASK_LOG_RETAINED={0}" -f [bool]$KeepTask)
} finally {
  $completedMarkerObserved = Test-Path -LiteralPath $donePath
  $taskNeedsEnd = ($taskRunRequested -and -not $completedMarkerObserved)
  $cleanup = [ordered]@{
    kind = "steam-bridge-windows-overlay-task-cleanup"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    timedOut = $timedOut
    runnerTerminatedWithoutDone = $runnerTerminatedWithoutDone
    failureStage = $taskFailureStage
    errorKind = $taskErrorKind
    errorPresent = $taskErrorPresent
    endAttempted = $false
    endExitCodeCaptured = $false
    endExitCode = $null
    keepTask = [bool]$KeepTask
    deleteAttempted = $false
    deleteExitCodeCaptured = $false
    deleteExitCode = $null
    queryExitCodeCaptured = $false
    queryExitCode = $null
    deletionVerified = $false
    cleanupPhaseErrorCount = 0
    runnerProcessGuard = $null
    launchEnvGuard = $null
    packageProcessGuard = $null
    taskFileGuard = $null
    ok = $false
  }

  $runnerProcessGuard = $null
  $packageProcessGuard = $null
  $launchEnvGuardEvidence = $null
  $taskFileGuard = $null
  try {
    $runnerProcessGuard = Start-TaskRunnerTreeGuard `
      -State $runnerTreeState `
      -Required $taskRunRequested `
      -TerminateTree $taskNeedsEnd `
      -Completed $completedMarkerObserved
  } catch {
    $cleanup.cleanupPhaseErrorCount += 1
  }

  if ($taskNeedsEnd -and $taskCreated) {
    $cleanup.endAttempted = $true
    try {
      $endResult = Invoke-NativeExitCode `
        -FilePath "schtasks.exe" `
        -Arguments @("/End", "/TN", $taskName)
      $cleanup.endExitCodeCaptured = ($endResult.exitCodeCaptured -eq $true)
      $cleanup.endExitCode = $endResult.exitCode
    } catch {
      $cleanup.cleanupPhaseErrorCount += 1
    }
  }

  try {
    $runnerProcessGuard = Complete-TaskRunnerTreeGuard `
      -State $runnerTreeState `
      -Evidence $runnerProcessGuard `
      -Completed $completedMarkerObserved
  } catch {
    $cleanup.cleanupPhaseErrorCount += 1
  }

  if ($KeepTask) {
    $cleanup.deletionVerified = $true
  } elseif (-not $taskCreated) {
    $cleanup.deletionVerified = $true
  } else {
    $cleanup.deleteAttempted = $true
    try {
      $deleteResult = Invoke-NativeExitCode `
        -FilePath "schtasks.exe" `
        -Arguments @("/Delete", "/TN", $taskName, "/F")
      $cleanup.deleteExitCodeCaptured = ($deleteResult.exitCodeCaptured -eq $true)
      $cleanup.deleteExitCode = $deleteResult.exitCode
      $queryResult = Invoke-NativeExitCode `
        -FilePath "schtasks.exe" `
        -Arguments @("/Query", "/TN", $taskName)
      $cleanup.queryExitCodeCaptured = ($queryResult.exitCodeCaptured -eq $true)
      $cleanup.queryExitCode = $queryResult.exitCode
      $cleanup.deletionVerified = (
        $cleanup.deleteExitCodeCaptured -and
        $cleanup.deleteExitCode -eq 0 -and
        $cleanup.queryExitCodeCaptured -and
        $cleanup.queryExitCode -eq 1
      )
    } catch {
      $cleanup.cleanupPhaseErrorCount += 1
    }
  }

  try {
    $packageProcessGuard = Stop-AndVerifyTaskSmokePackageProcesses `
      -Required:([bool](-not $KeepTask -or $taskNeedsEnd)) `
      -PackageAppDir $AppDir
  } catch {
    $cleanup.cleanupPhaseErrorCount += 1
  }
  try {
    $launchEnvGuardEvidence = Complete-TaskLaunchEnvGuard -Guard $launchEnvGuard
  } catch {
    $cleanup.cleanupPhaseErrorCount += 1
  }
  try {
    $taskFileGuard = Remove-AndVerifyTaskFiles `
      -Required:([bool](-not $KeepTask)) `
      -RunDirectory $runDir
  } catch {
    $cleanup.cleanupPhaseErrorCount += 1
  }
  $cleanup.runnerProcessGuard = $runnerProcessGuard
  $cleanup.packageProcessGuard = $packageProcessGuard
  $cleanup.launchEnvGuard = $launchEnvGuardEvidence
  $cleanup.taskFileGuard = $taskFileGuard

  $cleanup.ok = (
    $cleanup.cleanupPhaseErrorCount -eq 0 -and
    $cleanup.deletionVerified -and
    (-not $taskNeedsEnd -or -not $taskCreated -or $cleanup.endAttempted) -and
    $cleanup.runnerProcessGuard.ok -eq $true -and
    $cleanup.packageProcessGuard.ok -eq $true -and
    $cleanup.launchEnvGuard.ok -eq $true -and
    $cleanup.taskFileGuard.ok -eq $true
  )
  New-Item -ItemType Directory -Force -Path $ArtifactRoot | Out-Null
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText(
    (Join-Path $ArtifactRoot "task-cleanup.json"),
    (([PSCustomObject]$cleanup | ConvertTo-Json -Depth 5) + [System.Environment]::NewLine),
    $utf8NoBom
  )
  if (-not $cleanup.ok -and $exitCode -eq 0) {
    $exitCode = 1
  }
}

exit $exitCode
