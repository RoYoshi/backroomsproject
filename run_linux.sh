#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then
  echo "Install Node.js 18 or later, then run this launcher again."
  exit 1
fi
exec node server.js 8000 --open
