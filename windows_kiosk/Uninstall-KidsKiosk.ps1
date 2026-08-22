$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run PowerShell as Administrator.'
}

Unregister-ScheduledTask -TaskName 'KidsKiosk - Standard User' -Confirm:$false -ErrorAction SilentlyContinue
Get-Process -Name KidsKiosk -ErrorAction SilentlyContinue | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like '*KidsLearningKiosk*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host 'KidsKiosk autostart was removed. You can delete C:\Program Files\KidsKiosk when it is no longer needed.' -ForegroundColor Green
