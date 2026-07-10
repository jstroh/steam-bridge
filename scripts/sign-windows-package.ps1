[CmdletBinding()]
param(
  [string]$AppDir = "",
  [string]$CertificateThumbprint = "",
  [string]$CertificateSubject = "",
  [string]$PfxPath = "",
  [string]$PfxPasswordEnvVar = "STEAM_BRIDGE_WINDOWS_PFX_PASSWORD",
  [string]$ExpectedPublisherThumbprint = "",
  [string]$ExpectedPublisherSubject = "",
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

function Get-SteamBridgeRuntimeFiles {
  $requiredNames = @(
    "steam_bridge_native.win32-x64-msvc.node",
    "steam_api64.dll",
    "sdkencryptedappticket64.dll"
  )
  $runtimeDirectories = @(
    (Join-Path $AppDir "resources\app.asar.unpacked\node_modules\steam-bridge"),
    (Join-Path $AppDir "resources\app\node_modules\steam-bridge")
  )
  $complete = @()

  foreach ($directory in $runtimeDirectories) {
    $present = @($requiredNames | Where-Object { Test-Path -LiteralPath (Join-Path $directory $_) })
    if ($present.Count -gt 0 -and $present.Count -ne $requiredNames.Count) {
      throw "Incomplete Steam Bridge Windows runtime at $directory. Found: $($present -join ', ')."
    }
    if ($present.Count -eq $requiredNames.Count) {
      $complete += $directory
    }
  }

  if ($complete.Count -eq 0) {
    throw "No complete Steam Bridge Windows runtime found under $AppDir."
  }
  if ($complete.Count -gt 1) {
    throw "Ambiguous Steam Bridge Windows runtime layout: $($complete -join ', ')."
  }
  if ((Test-Path -LiteralPath (Join-Path $AppDir "resources\app.asar")) -and $complete[0] -ne $runtimeDirectories[0]) {
    throw "An ASAR app must keep the Steam Bridge addon and both runtime DLLs under resources\app.asar.unpacked."
  }

  return @($requiredNames | ForEach-Object { Get-Item -LiteralPath (Join-Path $complete[0] $_) })
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
$runtimeFiles = @(Get-SteamBridgeRuntimeFiles)
$files = @(Get-SignableFiles)
if ($files.Count -eq 0) {
  throw "No .exe, .dll, or .node files found under $AppDir."
}
foreach ($runtimeFile in $runtimeFiles) {
  $matched = @($files | Where-Object { $_.FullName -eq $runtimeFile.FullName })
  if ($matched.Count -ne 1) {
    throw "Steam Bridge runtime file was not discovered exactly once for signing: $($runtimeFile.FullName)"
  }
}
$publisherFiles = @(
  @($runtimeFiles | Where-Object { $_.Extension.ToLowerInvariant() -eq ".node" }) +
  @(Get-ChildItem -LiteralPath $AppDir -File | Where-Object { $_.Extension.ToLowerInvariant() -eq ".exe" })
)
$publisherFilePaths = @($publisherFiles | ForEach-Object { $_.FullName })
$expectedThumbprint = if ($ExpectedPublisherThumbprint) {
  Normalize-Thumbprint $ExpectedPublisherThumbprint
} elseif ($certificate) {
  Normalize-Thumbprint $certificate.Thumbprint
} else {
  ""
}
$expectedSubject = if ($ExpectedPublisherSubject) {
  $ExpectedPublisherSubject
} elseif ($certificate) {
  $certificate.Subject
} else {
  ""
}
if ($ExpectedPublisherThumbprint -and $expectedThumbprint.Length -ne 40) {
  throw "-ExpectedPublisherThumbprint must contain exactly 40 hexadecimal characters."
}

Write-Host "Windows package signing audit:"
Write-Host ("  appDir: {0}" -f $AppDir)
Write-Host ("  files: {0}" -f $files.Count)
Write-Host ("  steamBridgeRuntimeFiles: {0}" -f $runtimeFiles.Count)
if ($certificate) {
  Write-Host ("  certificate: {0}" -f $certificate.Subject)
  Write-Host ("  thumbprint: {0}" -f $certificate.Thumbprint)
  Write-Host ("  timestampServer: {0}" -f $TimestampServer)
}

$summaries = New-Object System.Collections.Generic.List[object]
foreach ($file in $files) {
  $before = Get-SignatureSummary -File $file
  $isPublisherFile = $publisherFilePaths -contains $file.FullName

  if (-not $VerifyOnly) {
    if (
      $isPublisherFile -and
      $before.status -eq "Valid" -and
      (Normalize-Thumbprint $before.signerThumbprint) -ne (Normalize-Thumbprint $certificate.Thumbprint) -and
      -not $ForceResign
    ) {
      throw "Refusing to replace a valid unrelated signature on app-owned file $($file.FullName). Use -ForceResign if this is intentional."
    }
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
$publisherSummaries = @($summaries | Where-Object { $publisherFilePaths -contains $_.path })

if ($invalid.Count -gt 0) {
  throw "Windows package contains $($invalid.Count) file(s) with invalid Authenticode status."
}

if ($unsigned.Count -gt 0 -and -not $AllowUnsigned) {
  throw "Windows package contains $($unsigned.Count) unsigned executable file(s). Use -AllowUnsigned for audit-only reports."
}
if ($expectedThumbprint -or $expectedSubject) {
  foreach ($summary in $publisherSummaries) {
    if ($summary.status -ne "Valid") {
      throw "App-owned publisher file is not Authenticode-valid: $($summary.path)"
    }
    if ($expectedThumbprint -and (Normalize-Thumbprint $summary.signerThumbprint) -ne $expectedThumbprint) {
      throw "App-owned publisher file signer thumbprint does not match the expected publisher: $($summary.path)"
    }
    if (
      $expectedSubject -and
      ([string]$summary.signerSubject).IndexOf($expectedSubject, [System.StringComparison]::OrdinalIgnoreCase) -lt 0
    ) {
      throw "App-owned publisher file signer subject does not match the expected publisher: $($summary.path)"
    }
  }
}

Write-Host ("Windows package signing audit passed: valid={0} unsigned={1}" -f `
  @($summaries | Where-Object { $_.status -eq "Valid" }).Count,
  $unsigned.Count)
