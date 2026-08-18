$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectRoot 'backend\venv\Scripts\python.exe'

if (-not (Test-Path $Python)) {
    throw "Python virtualenv was not found at $Python"
}

& $Python -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --noconsole `
    --name KidsKiosk `
    --distpath (Join-Path $ProjectRoot 'kiosk_dist') `
    --workpath (Join-Path $ProjectRoot 'kiosk_build') `
    (Join-Path $ProjectRoot 'kiosk_controller.py')

Write-Host "Created: $(Join-Path $ProjectRoot 'kiosk_dist\KidsKiosk.exe')" -ForegroundColor Green
