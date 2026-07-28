# OrderRail QZ Tray Trust Removal Script
# Removes override.crt from QZ directories

$ErrorActionPreference = "Continue"
Write-Host "Removing OrderRail QZ Tray Certificate Provisioning..." -ForegroundColor Yellow

$UserOverridePath = "$env:APPDATA\qz\override.crt"
if (Test-Path $UserOverridePath) {
    Remove-Item -Path $UserOverridePath -Force
    Write-Host "Removed $UserOverridePath" -ForegroundColor Green
}

$ProgramDirs = @("C:\Program Files\QZ Tray\override.crt", "C:\Program Files (x86)\QZ Tray\override.crt")
foreach ($sysPath in $ProgramDirs) {
    if (Test-Path $sysPath) {
        Remove-Item -Path $sysPath -Force
        Write-Host "Removed $sysPath" -ForegroundColor Green
    }
}

Write-Host "Removal complete. Restart QZ Tray." -ForegroundColor Green
