#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$ROOT_DIR/back/r3f-virtual-girlfriend-backend"
FRONT_DIR="$ROOT_DIR/front/r3f-virtual-girlfriend-frontend"

command -v yarn >/dev/null 2>&1 || {
  echo "yarn no está instalado. Instalalo antes de continuar." >&2
  exit 1
}

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no encontrado. Instalando globalmente..."
  npm install -g pm2
fi

echo "Instalando dependencias del backend..."
(cd "$BACK_DIR" && yarn install --production=false)

echo "Instalando dependencias y construyendo el frontend..."
(cd "$FRONT_DIR" && yarn install && yarn build)

echo "Reiniciando servicio backend en pm2..."
pm2 delete renta4-back >/dev/null 2>&1 || true
pm2 start yarn --name renta4-back --cwd "$BACK_DIR" -- start

echo "Reiniciando servicio frontend en pm2..."
pm2 delete renta4-front >/dev/null 2>&1 || true
pm2 serve "$FRONT_DIR/dist" 4173 --name renta4-front --spa

echo "Guardando procesos en pm2..."
pm2 save

echo "Servicios levantados. Para ver el estado usa: pm2 status"
