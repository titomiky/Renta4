Param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $RootDir "web"
$AppName = "renta4-web"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node no está instalado."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm no está instalado."
}

$Pm2 = "pm2"
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "pm2 no encontrado. Instalando globalmente..." -ForegroundColor Yellow
    npm install -g pm2 | Out-Null
}

Write-Host "Reiniciando servicio web en pm2..."
pm2 delete $AppName *>$null
pm2 serve $WebDir $Port --name $AppName --spa *>$null
pm2 save | Out-Null

Write-Host "Web app sirviéndose en http://localhost:$Port (proceso pm2: $AppName)." -ForegroundColor Green
