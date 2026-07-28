# OrderRail Trusted Printing QZ Tray Provisioning Script for Windows
# Configures override.crt and Certificate Store trust for QZ Tray 2.2.6

$ErrorActionPreference = "Stop"
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "   OrderRail QZ Tray 2.2.6 Trusted Certificate Provisioner      " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$CertPath = Join-Path $ScriptDir "orderrail-ca.crt"

if (-not (Test-Path $CertPath)) {
    Write-Error "Certificate file 'orderrail-ca.crt' not found in $ScriptDir"
}

Write-Host "[1/4] Found OrderRail Public Certificate: $CertPath" -ForegroundColor Green

# 1. Provision User-Level QZ Tray override.crt
$UserDataDir = "$env:APPDATA\qz"
if (-not (Test-Path $UserDataDir)) {
    New-Item -ItemType Directory -Path $UserDataDir -Force | Out-Null
}
$UserOverridePath = Join-Path $UserDataDir "override.crt"
Copy-Item -Path $CertPath -Destination $UserOverridePath -Force
Write-Host "[2/4] Provisioned User override.crt -> $UserOverridePath" -ForegroundColor Green

# 2. Provision System-Level QZ Tray override.crt (if QZ Tray program folder exists)
$ProgramDirs = @("C:\Program Files\QZ Tray", "C:\Program Files (x86)\QZ Tray")
foreach ($pDir in $ProgramDirs) {
    if (Test-Path $pDir) {
        $SysOverridePath = Join-Path $pDir "override.crt"
        try {
            Copy-Item -Path $CertPath -Destination $SysOverridePath -Force
            Write-Host "[2/4] Provisioned System override.crt -> $SysOverridePath" -ForegroundColor Green
        } catch {
            Write-Host "[!] Note: Admin rights needed for system folder $pDir (User AppData override active)" -ForegroundColor Yellow
        }
    }
}

# 3. Import Certificate into Windows Certificate Store (Trusted Root Certification Authorities)
try {
    Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
    Write-Host "[3/4] Imported into Windows CurrentUser Trusted Root Store" -ForegroundColor Green
} catch {
    Write-Host "[!] CurrentUser store import notice: $_" -ForegroundColor Yellow
}

try {
    Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
    Write-Host "[3/4] Imported into Windows LocalMachine Trusted Root Store" -ForegroundColor Green
} catch {
    Write-Host "[!] LocalMachine store import requires Admin privileges (CurrentUser store active)" -ForegroundColor Yellow
}

# 4. Restart QZ Tray to reload override.crt
$qzProc = Get-Process -Name "qz-tray" -ErrorAction SilentlyContinue
if ($qzProc) {
    Write-Host "[4/4] Restarting QZ Tray service to reload override.crt..." -ForegroundColor Yellow
    Stop-Process -Name "qz-tray" -Force
    Start-Sleep -Seconds 2

    # Attempt to locate qz-tray executable to restart
    $qzExe = "C:\Program Files\QZ Tray\qz-tray.exe"
    if (-not (Test-Path $qzExe)) {
        $qzExe = "C:\Program Files (x86)\QZ Tray\qz-tray.exe"
    }
    if (Test-Path $qzExe) {
        Start-Process -FilePath $qzExe
        Write-Host "[4/4] QZ Tray restarted successfully." -ForegroundColor Green
    } else {
        Write-Host "[4/4] Please manually launch QZ Tray from Start Menu." -ForegroundColor Yellow
    }
} else {
    Write-Host "[4/4] QZ Tray is not running. Next time QZ Tray launches, override.crt will be loaded automatically." -ForegroundColor Green
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " SUCCESS: OrderRail Certificate provisioned as TRUSTED!" -ForegroundColor Green
Write-Host " QZ Tray will now report: Trusted: Trusted website" -ForegroundColor Green
Write-Host " Approval dialogs for OrderRail thermal printing are eliminated." -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
