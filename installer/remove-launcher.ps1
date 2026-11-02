$ErrorActionPreference = 'Stop'

$binDirectory = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Maicer\bin')).TrimEnd('\')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not [string]::IsNullOrWhiteSpace($userPath)) {
  $remaining = @($userPath -split ';' | Where-Object {
    $_.Trim().Trim('"').TrimEnd('\') -ine $binDirectory
  })
  [Environment]::SetEnvironmentVariable('Path', ($remaining -join ';'), 'User')
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MaicerEnvironmentNotification {
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = false)]
  public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint message, UIntPtr wParam, string lParam, uint flags, uint timeout, out IntPtr result);
}
'@
  $result = [IntPtr]::Zero
  [void][MaicerEnvironmentNotification]::SendMessageTimeout([IntPtr](-1), 0x001A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
}

$launcher = Join-Path $binDirectory 'maicer.cmd'
if (Test-Path -LiteralPath $launcher) {
  Remove-Item -LiteralPath $launcher -Force
}
if ((Test-Path -LiteralPath $binDirectory) -and
    @(Get-ChildItem -LiteralPath $binDirectory -Force).Count -eq 0) {
  Remove-Item -LiteralPath $binDirectory -Force
}
