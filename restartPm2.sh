#!/usr/bin/env bash
set -euo pipefail

command -v pm2 >/dev/null 2>&1 || { echo "pm2 no está instalado."; exit 1; }

pm2 save >/dev/null 2>&1 || true
pm2 resurrect >/dev/null 2>&1 || true
pm2 restart all
pm2 save

echo "Procesos pm2 reiniciados."
