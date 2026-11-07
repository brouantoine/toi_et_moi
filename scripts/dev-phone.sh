#!/usr/bin/env bash
# Try the app on a phone with Expo Go (same Wi-Fi as this computer), without Docker.
# Usage: bash scripts/dev-phone.sh [api_port]      (default port: 8010)
# Ctrl+C stops everything.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8010}"
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -z "$IP" ]; then
  echo "Impossible de trouver l'adresse IP de ce PC sur le réseau local." >&2
  exit 1
fi
API_URL="http://$IP:$PORT"

# The phone must reach the API port: offer to open it in ufw if active.
if systemctl is-active --quiet ufw 2>/dev/null; then
  echo "Le pare-feu (ufw) est actif : le téléphone doit pouvoir joindre le port $PORT."
  read -r -p "Ouvrir le port $PORT/tcp maintenant ? (mot de passe demandé) [o/N] " answer
  if [[ "$answer" =~ ^[oOyY]$ ]]; then
    sudo ufw allow "$PORT/tcp"
    echo "Pour le refermer plus tard : sudo ufw delete allow $PORT/tcp"
  fi
fi

cd "$ROOT/backend"
if [ ! -x .venv/bin/python ]; then
  echo "Préparation de l'environnement Python (une seule fois)…"
  python3.12 -m venv .venv
  .venv/bin/pip install -q -r requirements/dev.txt
fi
export DJANGO_SETTINGS_MODULE=config.settings.dev DJANGO_LOCAL_LITE=1
.venv/bin/python manage.py migrate --noinput >/dev/null

echo "Serveur : $API_URL"
.venv/bin/python manage.py runserver "0.0.0.0:$PORT" >"$ROOT/backend/dev-server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  echo
  echo "Arrêt du serveur…"
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  if curl -s -o /dev/null "$API_URL/api/v1/health/"; then break; fi
  sleep 1
done
if ! curl -s -o /dev/null "$API_URL/api/v1/health/"; then
  echo "Le serveur ne répond pas : voir backend/dev-server.log" >&2
  exit 1
fi
echo "Serveur prêt (journal : backend/dev-server.log)."

cd "$ROOT/mobile"
[ -d node_modules ] || npm install
echo "Scanne le QR code avec Expo Go (Android) ou l'appareil photo (iPhone)."
EXPO_PUBLIC_API_URL="$API_URL" REACT_NATIVE_PACKAGER_HOSTNAME="$IP" \
  npx expo start --lan --go --clear
