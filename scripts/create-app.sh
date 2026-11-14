#!/usr/bin/env bash
# Corre `npm create vite@latest` para generar la SPA en app/, si todavía no
# existe. El template no impone framework — Vite pregunta interactivamente
# (React, Vue, Svelte, vanilla, con o sin TypeScript, etc.).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/app"

if [[ -f "$APP_DIR/package.json" ]]; then
  echo "app/ ya existe (package.json encontrado) — no se vuelve a generar."
  echo "Si querés empezar de cero: rm -rf app && $0"
  exit 0
fi

node_ok=$(node -e 'const [a,b]=process.versions.node.split(".").map(Number);console.log((a===20&&b>=19)||(a===22&&b>=12)||a>22?1:0)' 2>/dev/null || echo 0)
if [[ "$node_ok" != "1" ]]; then
  echo "Error: Vite requiere Node >= 20.19 (o >= 22.12). Tienes: $(node -v 2>/dev/null || echo 'ninguno')"
  echo "Con nvm: nvm install 22 && nvm use 22"
  exit 1
fi

rm -f "$APP_DIR/.gitkeep"

echo "Generando la SPA en app/ con 'npm create vite@latest'..."
npm create vite@latest app

echo ""
echo "Listo. Próximos pasos:"
echo "  cd app && npm install && npm run dev"
