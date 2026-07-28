@echo off
:: OrderRail QZ Tray Trusted Certificate Deployment Launcher
:: Automatically requests Administrator privileges and runs deploy-qz-trust.ps1

title OrderRail QZ Tray Trust Provisioner

net session >nul 2>&1
if %errorLevel% == 0 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-qz-trust.ps1"
) else (
    echo Requesting Administrator privileges to provision QZ Tray Certificate...
    powershell.exe -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0deploy-qz-trust.ps1""' -Verb RunAs"
)
pause
