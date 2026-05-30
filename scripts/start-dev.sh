#!/usr/bin/env bash
set -euo pipefail

OPEN_BROWSER=0
SKIP_INSTALL=0

for arg in "$@"; do
  case "$arg" in
    --open)
      OPEN_BROWSER=1
      ;;
    --skip-install)
      SKIP_INSTALL=1
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: bash scripts/start-dev.sh [--open] [--skip-install]" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"

cd "$ROOT_DIR"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "Shutting down..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    echo "Stopped backend (PID $BACKEND_PID)"
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    echo "Stopped frontend (PID $FRONTEND_PID)"
  fi
}

trap cleanup EXIT INT TERM

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 not found. Please install it and try again." >&2
    exit 1
  fi
}

is_port_listening() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

require_command npm
require_command python3

if [ ! -d "$ROOT_DIR/node_modules" ] && [ "$SKIP_INSTALL" -eq 0 ]; then
  if [ -f "$ROOT_DIR/package-lock.json" ]; then
    echo "Installing frontend dependencies with npm ci..."
    npm ci
  else
    echo "Installing frontend dependencies with npm install..."
    npm install
  fi
fi

if [ ! -x "$ROOT_DIR/backend/.venv/bin/python" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$ROOT_DIR/backend/.venv"
fi

if [ "$SKIP_INSTALL" -eq 0 ]; then
  echo "Installing backend dependencies..."
  "$ROOT_DIR/backend/.venv/bin/python" -m pip install -r "$ROOT_DIR/backend/requirements.txt"
fi

if is_port_listening 8000; then
  echo "Backend already running: http://localhost:8000"
else
  : > "$RUN_DIR/backend.out.log"
  : > "$RUN_DIR/backend.err.log"
  "$ROOT_DIR/backend/.venv/bin/python" "$ROOT_DIR/backend/main.py" > "$RUN_DIR/backend.out.log" 2> "$RUN_DIR/backend.err.log" &
  BACKEND_PID="$!"
  echo "Started backend: http://localhost:8000 (PID $BACKEND_PID)"
fi

if is_port_listening 3000; then
  echo "Frontend already running: http://localhost:3000"
else
  : > "$RUN_DIR/frontend.out.log"
  : > "$RUN_DIR/frontend.err.log"
  npm run dev > "$RUN_DIR/frontend.out.log" 2> "$RUN_DIR/frontend.err.log" &
  FRONTEND_PID="$!"
  echo "Started frontend: http://localhost:3000 (PID $FRONTEND_PID)"
fi

echo
echo "========================================"
echo "  FundScope Dev Server"
echo "========================================"
echo
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo
echo "  Logs: $RUN_DIR"
echo
echo "  Press Ctrl+C to stop services started by this script."
echo "========================================"

if [ "$OPEN_BROWSER" -eq 1 ]; then
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:3000"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  fi
fi

while true; do
  sleep 1
  if [ -n "$BACKEND_PID" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Backend process exited unexpectedly. Check .run/backend.err.log." >&2
    exit 1
  fi
  if [ -n "$FRONTEND_PID" ] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "Frontend process exited unexpectedly. Check .run/frontend.err.log." >&2
    exit 1
  fi
done
