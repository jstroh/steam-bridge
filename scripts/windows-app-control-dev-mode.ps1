param(
  [ValidateSet("report", "set")]
  [string]$Mode = "report",

  [ValidateSet("Off", "Enforce", "Evaluation")]
  [string]$State = "Off",

  [string]$OutputJsonFile = "",

  [switch]$NoRefresh
)

$ErrorActionPreference = "Stop"

$PolicyRegistryPath = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"
$PolicyRegistryName = "VerifiedAndReputablePolicyState"

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]$identity
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Convert-StateNameToValue([string]$stateName) {
  switch ($stateName) {
    "Off" { return 0 }
    "Enforce" { return 1 }
    "Evaluation" { return 2 }
    default { throw "Unsupported App Control state: $stateName" }
  }
}

function Convert-StateValueToName($stateValue) {
  switch ([int]$stateValue) {
    0 { return "Off" }
    1 { return "Enforce" }
    2 { return "Evaluation" }
    default { return "Unknown($stateValue)" }
  }
}

function Get-VerifiedAndReputablePolicyState {
  $value = $null
  try {
    $item = Get-ItemProperty -Path $PolicyRegistryPath -Name $PolicyRegistryName -ErrorAction Stop
    $value = $item.$PolicyRegistryName
  } catch {
    $value = $null
  }

  if ($null -eq $value) {
    return [ordered]@{
      value = $null
      name = "Unavailable"
      registryPath = $PolicyRegistryPath
      registryName = $PolicyRegistryName
    }
  }

  return [ordered]@{
    value = [int]$value
    name = Convert-StateValueToName $value
    registryPath = $PolicyRegistryPath
    registryName = $PolicyRegistryName
  }
}

function Invoke-CiToolJson([string[]]$arguments) {
  $command = Get-Command "CiTool.exe" -ErrorAction SilentlyContinue
  if (-not $command) {
    return [ordered]@{
      available = $false
      ok = $false
      exitCode = $null
      output = @("CiTool.exe was not found on PATH.")
    }
  }

  $output = @(& $command.Source @arguments --json 2>&1)
  $exitCode = $LASTEXITCODE
  $parsed = $null
  $text = ($output | Out-String).Trim()
  if ($text) {
    try {
      $parsed = $text | ConvertFrom-Json
    } catch {
      $parsed = $null
    }
  }

  return [ordered]@{
    available = $true
    path = $command.Source
    ok = ($exitCode -eq 0)
    exitCode = $exitCode
    parsed = $parsed
    output = @($output)
  }
}

function Write-JsonReport($report, [string]$filePath) {
  if (-not $filePath) {
    return
  }

  $directory = Split-Path -Parent $filePath
  if ($directory) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $filePath -Encoding UTF8
}

$before = Get-VerifiedAndReputablePolicyState
$policyListBefore = Invoke-CiToolJson @("-lp")
$changed = $false
$refresh = $null

if ($Mode -eq "set") {
  if (-not (Test-IsAdministrator)) {
    throw "Setting Windows Smart App Control/App Control development state requires an elevated PowerShell session."
  }

  $targetValue = Convert-StateNameToValue $State
  New-Item -Path $PolicyRegistryPath -Force | Out-Null
  Set-ItemProperty -Path $PolicyRegistryPath -Name $PolicyRegistryName -Type DWord -Value $targetValue
  $changed = $true

  if (-not $NoRefresh) {
    $refresh = Invoke-CiToolJson @("-r")
    if (-not $refresh.ok) {
      throw "CiTool.exe failed to refresh App Control policies after setting $PolicyRegistryName=$targetValue."
    }
  }
}

$after = Get-VerifiedAndReputablePolicyState
$policyListAfter = Invoke-CiToolJson @("-lp")

$report = [ordered]@{
  schema = "steam-bridge-windows-app-control-dev-mode"
  mode = $Mode
  requestedState = $(if ($Mode -eq "set") { $State } else { $null })
  changed = $changed
  noRefresh = [bool]$NoRefresh
  administrator = Test-IsAdministrator
  before = $before
  after = $after
  refresh = $refresh
  policyListBefore = $policyListBefore
  policyListAfter = $policyListAfter
  notes = @(
    "Use this helper only on disposable or dedicated Windows development machines.",
    "It toggles the machine-wide Smart App Control/App Control VerifiedAndReputable state; it is not a per-app allowlist.",
    "Microsoft documents that Smart App Control has no per-app bypass. Prefer trusted/reputable publisher signing for release proof."
  )
}

Write-JsonReport $report $OutputJsonFile

if ($OutputJsonFile) {
  Write-Host "Wrote App Control development-mode report to $OutputJsonFile"
}

$report | ConvertTo-Json -Depth 8
