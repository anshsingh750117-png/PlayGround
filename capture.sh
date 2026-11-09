#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ -z "${CAPTURE_URL:-}" || -z "${CAPTURE_DIR:-}" ]]; then
  echo "Set CAPTURE_URL and CAPTURE_DIR." >&2
  exit 1
fi
if [[ -z "${RUNTIME_DIR:-}" || ! -f "$RUNTIME_DIR/scripts/default-capture.mjs" ]]; then
  echo "RUNTIME_DIR must contain scripts/default-capture.mjs." >&2
  exit 1
fi

# Treat uncaught page errors and failed same-origin resources as render defects.
export CAPTURE_STRICT="${CAPTURE_STRICT:-1}"
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
