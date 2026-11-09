#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "PORT must be an integer between 1 and 65535." >&2
  exit 1
fi
if [[ -z "${OPENCODE_WEB_DIR:-}" ]]; then
  echo "OPENCODE_WEB_DIR must point to the worker metadata directory." >&2
  exit 1
fi

if [[ -f package-lock.json ]]; then
  /usr/bin/time -p npm ci --no-audit --no-fund
else
  /usr/bin/time -p npm install --no-audit --no-fund
fi
/usr/bin/time -p npm run build
/usr/bin/time -p test -f "$PROJECT_DIR/dist/index.html"
/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
/usr/bin/time -p node -e 'const fs=require("node:fs"); const path=require("node:path"); const project=process.cwd(); const directory=path.resolve(project,"dist"); fs.writeFileSync(path.join(process.env.OPENCODE_WEB_DIR,"deployment-output.json"), JSON.stringify({project,directory}));'
/usr/bin/time -p npm run preview -- --host 0.0.0.0 --port "$PORT" --strictPort
