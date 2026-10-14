#!/usr/bin/env bash
# Serve il sito localmente (senza Live Server / percorsi WSL)
# Uso: bash scripts/dev-server.sh [porta]
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8000}"
echo "WooDreads local server on http://localhost:${PORT}"
echo "Apri: http://localhost:${PORT}/index.html"
echo "Admin: http://localhost:${PORT}/admin.html"
exec python3 - "$PORT" <<'PY'
import http.server, socketserver, sys
port = int(sys.argv[1])
class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), NoCacheHandler) as httpd:
    print('Serving with no-cache headers')
    httpd.serve_forever()
PY