#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web"

# Chequear dependencias
command -v node >/dev/null 2>&1 || { echo "node no está instalado."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm no está instalado."; exit 1; }

# Verificar que http-server esté disponible o instalarlo localmente
HTTP_SERVER_BIN="npx http-server"
if command -v http-server >/dev/null 2>&1; then
  HTTP_SERVER_BIN="http-server"
fi

PORT="${PORT:-8080}"

echo "Iniciando servidor web en http://localhost:$PORT..."
cd "$WEB_DIR"
$HTTP_SERVER_BIN -p "$PORT"
