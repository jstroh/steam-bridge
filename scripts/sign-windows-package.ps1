[CmdletBinding()]
param(
  [string]$AppDir = "",
  [string]$CertificateThumbprint = "",
  [string]$CertificateSubject = "",
  [string]$PfxPath = "",
  [string]$PfxPasswordEnvVar = "STEAM_BRIDGE_WINDOWS_PFX_PASSWORD",
  [string]$TimestampServer = "http://timestamp.digicert.com",
  [ValidateSet("SHA256", "SHA384", "SHA512")]
  [string]$DigestAlgorithm = "SHA256",
  [switch]$VerifyOnly,
  [switch]$AllowUnsigned,
  [switch]$ForceResign
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

function Resolve-Certificate {
  if ($VerifyOnly) {
    return $null
  }

  if ($PfxPath) {
    if (-not (Test-Path -LiteralPath $PfxPath)) {
      throw "Missing PFX file at $PfxPath"
    }

    $passwordText = [Environment]::GetEnvironmentVariable($PfxPasswordEnvVar)
    if (-not $passwordText) {
      throw "Set $PfxPasswordEnvVar to the PFX password before importing the signing certificate."
    }

    $securePassword = ConvertTo-SecureString -String $passwordText -AsPlainText -Force
    $imported = Import-PfxCertificate `
      -FilePath $PfxPath `
      -CertStoreLocation "Cert:\CurrentUser\My" `
      -Password $securePassword

    if (-not $imported) {
      throw "PFX import did not return a certificate."
    }

    return $imported | Select-Object -First 1
  }

  $certificates = @()
  foreach ($store in @("Cert:\CurrentUser\My", "Cert:\LocalMachine\My")) {
    if (Test-Path $store) {
      $certificates += @(Get-ChildItem $store | Where-Object { $_.HasPrivateKey })
    }
  }

  if ($CertificateThumbprint) {
    $needle = Normalize-Thumbprint $CertificateThumbprint
    $matches = @($certificates | Where-Object { (Normalize-Thumbprint $_.Thumbprint) -eq $needle })
    if ($matches.Count -eq 1) {
      return $matches[0]
    }
    if ($matches.Count -gt 1) {
      throw "Multiple certificates matched thumbprint $CertificateThumbprint."
    }
    throw "No private-key certificate matched thumbprint $CertificateThumbprint."
  }

  if ($CertificateSubject) {
    $matches = @($certificates | Where-Object { $_.Subject -like "*$CertificateSubject*" })
    if ($matches.Count -eq 1) {
      return $matches[0]
    }
    if ($matches.Count -gt 1) {
      throw "Multiple private-key certificates matched subject fragment $CertificateSubject. Use -CertificateThumbprint."
    }
    throw "No private-key certificate matched subject fragment $CertificateSubject."
  }

  throw "Provide -CertificateThumbprint, -CertificateSubject, or -PfxPath. Use -VerifyOnly to audit without signing."
}

function Normalize-Thumbprint {
  param([string]$Value)
  return (($Value -replace "\s", "") -replace "[^0-9A-Fa-f]", "").ToUpperInvariant()
}

function Get-SignableFiles {
  if (-not (Test-Path -LiteralPath $AppDir)) {
    throw "Missing Windows package directory at $AppDir"
  }

  $extensions = @(".exe", ".dll", ".node")

  return @(
    Get-ChildItem -LiteralPath $AppDir -Recurse -File |
      Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() } |
      Sort-Object FullName
  )
}

function Get-SignatureSummary {
  param([System.IO.FileInfo]$File)

  $signature = Get-AuthenticodeSignature -LiteralPath $File.FullName
  $signer = $signature.SignerCertificate

  return [PSCustomObject]@{
    path = $File.FullName
    status = [string]$signature.Status
    signerSubject = if ($signer) { $signer.Subject } else { $null }
    signerThumbprint = if ($signer) { $signer.Thumbprint } else { $null }
  }
}

function Write-Summary {
  param($Summary)

  Write-Host ("  {0}" -f $Summary.path)
  Write-Host ("    status: {0}" -f $Summary.status)
  Write-Host ("    signerSubject: {0}" -f $Summary.signerSubject)
  Write-Host ("    signerThumbprint: {0}" -f $Summary.signerThumbprint)
}

$certificate = Resolve-Certificate
$files = Get-SignableFiles
if ($files.Count -eq 0) {
  throw "No .exe, .dll, or .node files found under $AppDir."
}

Write-Host "Windows package signing audit:"
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  files: {0}" -f $files.Count)
if ($certificate) {
  Write-Host ("  certificate: {0}" -f $certificate.Subject)
  Write-Host ("  thumbprint: {0}" -f $certificate.Thumbprint)
  Write-Host ("  timestampServer: {0}" -f $TimestampServer)
}

$summaries = New-Object System.Collections.Generic.List[object]
foreach ($file in $files) {
  $before = Get-SignatureSummary -File $file

  if (-not $VerifyOnly) {
    $shouldSign = $ForceResign -or $before.status -eq "NotSigned"
    if (-not $shouldSign -and $before.status -ne "Valid") {
      throw "Refusing to sign over $($before.status) signature on $($file.FullName). Use -ForceResign if this is intentional."
    }

    if ($shouldSign) {
      $arguments = @{
        FilePath = $file.FullName
        Certificate = $certificate
        HashAlgorithm = $DigestAlgorithm
      }
      if ($TimestampServer) {
        $arguments.TimestampServer = $TimestampServer
      }

      $signed = Set-AuthenticodeSignature @arguments
      if ($signed.Status -ne "Valid") {
        throw "Signing $($file.FullName) returned status $($signed.Status): $($signed.StatusMessage)"
      }
    }
  }

  $summary = Get-SignatureSummary -File $file
  $summaries.Add($summary) | Out-Null
  Write-Summary -Summary $summary
}

$unsigned = @($summaries | Where-Object { $_.status -eq "NotSigned" })
$invalid = @($summaries | Where-Object { $_.status -ne "Valid" -and $_.status -ne "NotSigned" })

if ($invalid.Count -gt 0) {
  throw "Windows package contains $($invalid.Count) file(s) with invalid Authenticode status."
}

if ($unsigned.Count -gt 0 -and -not $AllowUnsigned) {
  throw "Windows package contains $($unsigned.Count) unsigned executable file(s). Use -AllowUnsigned for audit-only reports."
}

Write-Host ("Windows package signing audit passed: valid={0} unsigned={1}" -f `
  @($summaries | Where-Object { $_.status -eq "Valid" }).Count,
  $unsigned.Count)
