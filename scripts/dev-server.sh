#!/usr/bin/env bash
# Serve il sito localmente (senza estensioni VS Code / percorsi WSL)
# Uso: bash scripts/dev-server.sh [porta]
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8000}"
echo "WooDreads local server on http://localhost:${PORT}"
echo "Apri: http://localhost:${PORT}/index.html"
echo "Admin: http://localhost:${PORT}/admin.html"
python3 -m http.server "$PORT"
