#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
PORT="${PORT:-8080}"
APP_NAME="renta4-web"

command -v node >/dev/null 2>&1 || { echo "node no está instalado."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm no está instalado."; exit 1; }

# pm2 check
PM2_BIN="pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no encontrado. Instalándolo localmente..."
  (cd "$ROOT_DIR" && npm i pm2)
  PM2_BIN="npx pm2"
fi

echo "Reiniciando servicio web en pm2..."
$PM2_BIN delete "$APP_NAME" >/dev/null 2>&1 || true
$PM2_BIN serve "$WEB_DIR" "$PORT" --name "$APP_NAME" --spa
$PM2_BIN save

echo "Web app sirviéndose en http://localhost:$PORT (pm2 proceso: $APP_NAME)."
