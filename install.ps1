$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

$owner = 'AIShivamRajput'
$repository = 'Maicer-v.1.0.0'
$apiUri = "https://api.github.com/repos/$owner/$repository/releases/latest"
$headers = @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'Maicer-Installer' }

function Get-InstalledMaicer {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    foreach ($key in Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue) {
      $entry = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ($entry.DisplayName -eq 'Maicer') { return $entry }
    }
  }
  return $null
}

function Test-MaicerVCRuntime {
  $registry = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
    [Microsoft.Win32.RegistryHive]::LocalMachine,
    [Microsoft.Win32.RegistryView]::Registry64
  )
  try {
    $runtime = $registry.OpenSubKey('SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64')
    if (-not $runtime) { return $false }
    try { return [int]$runtime.GetValue('Installed', 0) -eq 1 }
    finally { $runtime.Dispose() }
  }
  finally {
    $registry.Dispose()
  }
}

function Assert-FreeSpace([string]$path, [long]$requiredBytes, [string]$purpose) {
  $root = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($path))
  $drive = [System.IO.DriveInfo]::new($root)
  if (-not $drive.IsReady) { throw "The $purpose drive ($root) is not available." }
  if ($drive.AvailableFreeSpace -lt $requiredBytes) {
    $requiredGiB = [Math]::Ceiling($requiredBytes / 1GB)
    $availableGiB = [Math]::Floor($drive.AvailableFreeSpace / 1GB)
    throw "Not enough free space for $purpose on $root. Need about $requiredGiB GiB; only $availableGiB GiB is available."
  }
}

function Assert-GitHubAssetUri([string]$url, [string]$expectedPath) {
  $uri = [Uri]$url
  if ($uri.Scheme -cne 'https' -or $uri.Host -cne 'github.com' -or $uri.AbsolutePath -cne $expectedPath) {
    throw "GitHub returned an unexpected release asset URL: $url"
  }
}

function Install-MaicerLauncher([string]$executable) {
  $binDirectory = Join-Path $env:LOCALAPPDATA 'Maicer\bin'
  New-Item -ItemType Directory -Path $binDirectory -Force | Out-Null
  $launcher = Join-Path $binDirectory 'maicer.cmd'
  $contents = "@echo off`r`nif not exist `"$executable`" (`r`n  echo Maicer was not found. Run the installation command again.`r`n  exit /b 1`r`n)`r`nstart `"`" `"$executable`"`r`n"
  [IO.File]::WriteAllText($launcher, $contents, [Text.Encoding]::ASCII)

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @()
  if (-not [string]::IsNullOrWhiteSpace($userPath)) { $parts = @($userPath -split ';') }
  $alreadyPresent = @($parts | Where-Object { $_.Trim().Trim('"').TrimEnd('\') -ieq $binDirectory.TrimEnd('\') }).Count -gt 0
  if (-not $alreadyPresent) {
    [Environment]::SetEnvironmentVariable('Path', (@($parts + $binDirectory) -join ';'), 'User')
    if (-not ('MaicerEnvironmentNotification' -as [type])) {
      Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MaicerEnvironmentNotification {
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = false)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint message, UIntPtr wParam, string lParam, uint flags, uint timeout, out IntPtr result);
}
'@
    }
    $result = [IntPtr]::Zero
    [void][MaicerEnvironmentNotification]::SendMessageTimeout([IntPtr](-1), 0x001A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
  }
  if (($env:Path -split ';' | Where-Object { $_.Trim().Trim('"').TrimEnd('\') -ieq $binDirectory.TrimEnd('\') }).Count -eq 0) {
    $env:Path = "$binDirectory;$env:Path"
  }
}

if (-not [Environment]::Is64BitOperatingSystem) {
  throw 'Maicer requires 64-bit Windows. No files have been installed.'
}

$osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
if ($osInfo.ProductType -ne 1) {
  throw 'Maicer supports Windows desktop editions, not Windows Server.'
}

$registry = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
  [Microsoft.Win32.RegistryHive]::LocalMachine,
  [Microsoft.Win32.RegistryView]::Registry64
)
try {
  $currentVersion = $registry.OpenSubKey('SOFTWARE\Microsoft\Windows NT\CurrentVersion')
  if (-not $currentVersion) { throw 'Could not identify the Windows version.' }
  $build = [int]$currentVersion.GetValue('CurrentBuildNumber', 0)
  $currentVersion.Dispose()
}
finally {
  $registry.Dispose()
}

if ($build -ge 22000) {
  $windowsName = 'Windows 11'
}
elseif ($build -ge 19045) {
  $windowsName = 'Windows 10 22H2'
}
else {
  throw "Unsupported Windows build $build. Maicer requires Windows 10 22H2 or later, or Windows 11."
}

Write-Host "Detected $windowsName, 64-bit."
Write-Host 'Maicer includes its Electron/Node.js runtime; a separate Node.js or npm installation is not needed.'

$installed = Get-InstalledMaicer
$defaultInstallRoot = Join-Path $env:LOCALAPPDATA 'Programs\Maicer'
$installRoot = if ($installed.InstallLocation) { $installed.InstallLocation.TrimEnd('\') } else { $defaultInstallRoot }
$appExecutable = Join-Path $installRoot 'Maicer.exe'
$engineRoot = Join-Path $installRoot 'resources\engine'
$requiredInstalledFiles = @(
  $appExecutable,
  (Join-Path $engineRoot 'whisper\whisper-cli.exe'),
  (Join-Path $engineRoot 'llama\llama-server.exe'),
  (Join-Path $engineRoot 'models\speech.bin'),
  (Join-Path $engineRoot 'models\writer.gguf')
)
$installationComplete = (@($requiredInstalledFiles | Where-Object { Test-Path -LiteralPath $_ }).Count -eq $requiredInstalledFiles.Count) -and (Test-MaicerVCRuntime)

try {
  $release = Invoke-RestMethod -Uri $apiUri -Headers $headers -TimeoutSec 30
}
catch {
  $status = 0
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
    $status = [int]$_.Exception.Response.StatusCode
  }
  if ($status -eq 404) {
    throw "No Maicer GitHub Release has been published yet. The installer cannot download or verify an unpublished application. Publish the first verified release, then run this command again."
  }
  throw "Could not check the latest Maicer release at GitHub: $($_.Exception.Message)"
}

if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v(?<version>\d+\.\d+\.\d+)$') {
  throw 'The latest GitHub release is not a stable, versioned Maicer release.'
}

$tag = $release.tag_name
$releaseVersion = [version]$Matches.version
if ($installed -and (Test-Path -LiteralPath $appExecutable) -and
    $installed.DisplayVersion -match '^\d+\.\d+\.\d+$') {
  $installedVersion = [version]$installed.DisplayVersion
  if ($installedVersion -gt $releaseVersion) {
    if (-not $installationComplete) {
      throw "Maicer $($installed.DisplayVersion) is newer than the latest published release $tag, but its installation is incomplete. Refusing to downgrade it; install a matching or newer verified release to repair it."
    }
    else {
      Write-Host "Maicer $($installed.DisplayVersion) is newer than the latest published release $tag. No downgrade or download will be performed."
    }
    Install-MaicerLauncher $appExecutable
    Start-Process -FilePath $appExecutable
    Write-Host "Start Maicer again any time by running: maicer"
    return
  }
  if ($installedVersion -eq $releaseVersion -and $installationComplete) {
      Write-Host "Maicer $tag is already installed. No application, engine, or model download is needed."
    Install-MaicerLauncher $appExecutable
    Start-Process -FilePath $appExecutable
    Write-Host "Start Maicer again any time by running: maicer"
    return
  }
  if ($installedVersion -eq $releaseVersion) {
    Write-Host "Maicer $tag is incomplete. Downloading its verified installer to repair it."
  }
}

$installerName = "Maicer-Setup-$tag.exe"
$checksumName = "$installerName.sha256"
$asset = @($release.assets | Where-Object { $_.name -ceq $installerName }) | Select-Object -First 1
$checksumAsset = @($release.assets | Where-Object { $_.name -ceq $checksumName }) | Select-Object -First 1
if (-not $asset -or -not $checksumAsset -or $asset.size -le 0) {
  throw "Release $tag is missing its installer or SHA-256 file. Refusing to install an unverifiable release."
}

$installerPath = "/$owner/$repository/releases/download/$tag/$installerName"
$checksumPath = "/$owner/$repository/releases/download/$tag/$checksumName"
Assert-GitHubAssetUri $asset.browser_download_url $installerPath
Assert-GitHubAssetUri $checksumAsset.browser_download_url $checksumPath

$workDirectory = Join-Path ([IO.Path]::GetTempPath()) 'Maicer-Install'
New-Item -ItemType Directory -Path $workDirectory -Force | Out-Null
$stagedInstaller = Join-Path $workDirectory $installerName
$partialInstaller = "$stagedInstaller.download"
$stagedChecksum = Join-Path $workDirectory $checksumName
$partialChecksum = "$stagedChecksum.download"
$tempDrive = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($workDirectory))
$installDrive = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($defaultInstallRoot))
$stagingRequired = [long]$asset.size
$installationRequired = [long]$asset.size
if ($tempDrive -ieq $installDrive) { $installationRequired += [long]$asset.size }
Assert-FreeSpace $workDirectory $stagingRequired 'installer download'
Assert-FreeSpace $defaultInstallRoot $installationRequired 'Maicer installation'

Write-Host "Checking the SHA-256 manifest for Maicer $tag..."
try {
  if (Test-Path -LiteralPath $partialChecksum) { Remove-Item -LiteralPath $partialChecksum -Force }
  Invoke-WebRequest -Uri $checksumAsset.browser_download_url -Headers $headers -OutFile $partialChecksum -UseBasicParsing -TimeoutSec 0
  Move-Item -LiteralPath $partialChecksum -Destination $stagedChecksum -Force
}
catch {
  if (Test-Path -LiteralPath $partialChecksum) { Remove-Item -LiteralPath $partialChecksum -Force }
  throw "Could not download the release checksum file. No installer was run. $($_.Exception.Message)"
}

$checksumLine = ([IO.File]::ReadAllText($stagedChecksum)).Trim()
if ($checksumLine -notmatch '^(?<hash>[0-9A-Fa-f]{64})\s+\*?(?<file>.+)$' -or $Matches.file -cne $installerName) {
  throw "The release checksum file is malformed or names a different installer. Refusing to install."
}
$expectedHash = $Matches.hash.ToLowerInvariant()

$verified = $false
if (Test-Path -LiteralPath $stagedInstaller) {
  $existing = Get-Item -LiteralPath $stagedInstaller
  if ($existing.Length -eq [long]$asset.size) {
    $verified = (Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $expectedHash
  }
  if (-not $verified) { Remove-Item -LiteralPath $stagedInstaller -Force }
}

if (-not $verified) {
  if (Test-Path -LiteralPath $partialInstaller) { Remove-Item -LiteralPath $partialInstaller -Force }
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    Write-Host "Downloading Maicer $tag installer (attempt $attempt of 3)..."
    try {
      Invoke-WebRequest -Uri $asset.browser_download_url -Headers $headers -OutFile $partialInstaller -UseBasicParsing -TimeoutSec 0
      Move-Item -LiteralPath $partialInstaller -Destination $stagedInstaller -Force
      break
    }
    catch {
      if (Test-Path -LiteralPath $partialInstaller) { Remove-Item -LiteralPath $partialInstaller -Force }
      if ($attempt -eq 3) {
        throw "The installer download failed after three attempts. Run the installation command again to retry. $($_.Exception.Message)"
      }
      Start-Sleep -Seconds $attempt
    }
  }
}

if (-not (Test-Path -LiteralPath $stagedInstaller) -or
    (Get-Item -LiteralPath $stagedInstaller).Length -ne [long]$asset.size) {
  if (Test-Path -LiteralPath $stagedInstaller) { Remove-Item -LiteralPath $stagedInstaller -Force }
  throw 'The downloaded installer size does not match the GitHub release metadata. Refusing to run it.'
}
$actualHash = (Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -cne $expectedHash) {
  Remove-Item -LiteralPath $stagedInstaller -Force
  throw "Installer SHA-256 verification failed. Expected $expectedHash, got $actualHash. The file was not run."
}

Write-Host "Verified Maicer $tag installer SHA-256: $actualHash"
Write-Host 'Installing Maicer. The bundled engines and models are installed without Node.js, npm, or Git.'
$process = Start-Process -FilePath $stagedInstaller -ArgumentList '/S' -WorkingDirectory $workDirectory -Wait -PassThru
if ($process.ExitCode -ne 0) {
  throw "The Maicer setup program exited with code $($process.ExitCode). The verified installer is retained at $stagedInstaller so you can retry safely."
}
if (-not (Test-Path -LiteralPath $appExecutable)) {
  throw "Setup exited successfully, but Maicer.exe was not found at $appExecutable. Check the Windows installer and try again."
}

Install-MaicerLauncher $appExecutable
Remove-Item -LiteralPath $stagedInstaller -Force
Remove-Item -LiteralPath $stagedChecksum -Force -ErrorAction SilentlyContinue
Write-Host "Maicer $tag is installed. A Start Menu shortcut and the 'maicer' command are ready."
Write-Host 'Run "maicer" to start Maicer again. Existing terminals may need to be reopened to see the new PATH entry.'
Start-Process -FilePath $appExecutable
