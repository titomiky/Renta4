Param()

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackDir = Join-Path $RootDir "back/r3f-virtual-girlfriend-backend"
$FrontDir = Join-Path $RootDir "front/r3f-virtual-girlfriend-frontend"

if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
    Write-Error "yarn no está instalado. Instalalo (npm i -g yarn) y reintenta."
}

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "pm2 no encontrado. Instalando globalmente..." -ForegroundColor Yellow
    npm install -g pm2 | Out-Null
}

Write-Host "Instalando dependencias del backend..."
Push-Location $BackDir
yarn install
Pop-Location

Write-Host "Instalando dependencias y construyendo el frontend..."
Push-Location $FrontDir
yarn install
yarn build
Pop-Location

Write-Host "Reiniciando servicio backend en pm2..."
pm2 delete renta4-back *>$null
pm2 start "index.js" --name renta4-back --cwd $BackDir *>$null

Write-Host "Reiniciando servicio frontend en pm2..."
pm2 delete renta4-front *>$null
pm2 serve "$FrontDir/dist" 5173 --name renta4-front --spa *>$null

pm2 save | Out-Null

Write-Host "Servicios levantados. Usa 'pm2 status' y 'pm2 logs <nombre>' para monitorear." -ForegroundColor Green
