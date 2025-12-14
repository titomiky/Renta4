Param(
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebDir = Join-Path $RootDir "web"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node no está instalado."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm no está instalado."
}

$HttpServer = "npx http-server"
if (Get-Command http-server -ErrorAction SilentlyContinue) {
    $HttpServer = "http-server"
}

Write-Host "Iniciando servidor web en http://localhost:$Port..."
Push-Location $WebDir
Invoke-Expression "$HttpServer -p $Port"
Pop-Location
