#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Starting The Far Backrooms at http://localhost:8000"
(command -v xdg-open >/dev/null && xdg-open http://localhost:8000 >/dev/null 2>&1 &) || true
exec node server.js 8000
