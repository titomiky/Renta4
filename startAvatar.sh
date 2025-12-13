#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$ROOT_DIR/back/r3f-virtual-girlfriend-backend"
FRONT_DIR="$ROOT_DIR/front/r3f-virtual-girlfriend-frontend"

# --- Checks ---
command -v yarn >/dev/null 2>&1 || {
  echo "yarn no está instalado. Instálalo antes de continuar." >&2
  exit 1
}

command -v node >/dev/null 2>&1 || { echo "node no está instalado." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm no está instalado." >&2; exit 1; }

# --- pm2: prefer global if exists; otherwise install locally and use npx ---
PM2_BIN="pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no encontrado. Instalando localmente en el proyecto (sin sudo)..."
  (cd "$ROOT_DIR" && npm i pm2)
  PM2_BIN="npx pm2"
fi

# --- Yarn install flags: handle Yarn classic vs Berry ---
YARN_VER="$(yarn -v | cut -d. -f1 || true)"

echo "Instalando dependencias del backend..."
if [[ "$YARN_VER" == "1" ]]; then
  # Yarn classic: allow dev deps (production=false)
  (cd "$BACK_DIR" && yarn install --production=false)
else
  # Yarn Berry: no --production=false; default installs dev deps
  # Use --immutable if you want strict lockfile usage
  (cd "$BACK_DIR" && yarn install)
fi

echo "Instalando dependencias y construyendo el frontend..."
if [[ "$YARN_VER" == "1" ]]; then
  (cd "$FRONT_DIR" && yarn install --production=false && yarn build)
else
  (cd "$FRONT_DIR" && yarn install && yarn build)
fi

echo "Reiniciando servicio backend en pm2..."
$PM2_BIN delete renta4-back >/dev/null 2>&1 || true
$PM2_BIN start index.js --name renta4-back --cwd "$BACK_DIR"

echo "Reiniciando servicio frontend en pm2..."
$PM2_BIN delete renta4-front >/dev/null 2>&1 || true
$PM2_BIN serve "$FRONT_DIR/dist" 5173 --name renta4-front --spa

echo "Guardando procesos en pm2..."
$PM2_BIN save

echo "Servicios levantados. Para ver el estado usa: $PM2_BIN status"
