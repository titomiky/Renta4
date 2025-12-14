#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v pm2 >/dev/null 2>&1 || { echo "pm2 no está instalado."; exit 1; }

echo "Deteniendo procesos pm2..."
pm2 delete all >/dev/null 2>&1 || true
pm2 kill >/dev/null 2>&1 || true

echo "Arrancando backend..."
bash "$ROOT_DIR/startAvatar.sh"

echo "Arrancando web..."
bash "$ROOT_DIR/startWebApp.sh"

echo "Guardando procesos..."
pm2 save

echo "PM2 reiniciado con backend y web en ejecución."
