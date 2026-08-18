param(
    [Parameter(Mandatory = $true)]
    [string]$StandardUser,
    [string]$PortalUrl = 'https://study.vuminh90.click',
    [string]$SourceExe = (Join-Path $PSScriptRoot 'KidsKiosk.exe')
)

$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run PowerShell as Administrator.'
}

$user = Get-LocalUser -Name $StandardUser -ErrorAction Stop
if (-not $user.Enabled) { throw "Account '$StandardUser' is disabled." }
if (-not (Test-Path $SourceExe)) { throw "KidsKiosk.exe was not found at $SourceExe" }

$installDir = Join-Path $env:ProgramFiles 'KidsKiosk'
$installExe = Join-Path $installDir 'KidsKiosk.exe'
$taskName = 'KidsKiosk - Standard User'
$account = "$env:COMPUTERNAME\$StandardUser"

New-Item -ItemType Directory -Force $installDir | Out-Null
Copy-Item $SourceExe $installExe -Force
& icacls $installDir /inheritance:e /grant '*S-1-5-32-545:(OI)(CI)RX' /T | Out-Null

$arguments = "--app-origin `"$PortalUrl`" --api-origin `"$PortalUrl`""
$action = New-ScheduledTaskAction -Execute $installExe -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $account
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Description 'Start Kids Kiosk when the learning account signs in.' -Force | Out-Null

Write-Host "KidsKiosk installed for account: $account" -ForegroundColor Green
Write-Host 'Remove the old Windows Assigned Access configuration, then sign out and sign in to the Standard account.' -ForegroundColor Yellow
