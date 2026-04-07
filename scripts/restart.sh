#!/bin/bash
# Ravenclaw server restart script
# Usage: ./scripts/restart.sh [api|web|all]

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"

red() { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

check_db() {
  node -e "const net=require('net');const s=net.connect(5432,'localhost',()=>{console.log('ok');s.end()});s.on('error',()=>{console.log('down');process.exit(1)})" 2>/dev/null
}

start_api() {
  # Kill existing
  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  # Check DB
  if [ "$(check_db)" != "ok" ]; then
    yellow "PostgreSQL is down. Starting docker-compose..."
    docker-compose -f "$ROOT/docker-compose.yml" up -d
    sleep 3
    if [ "$(check_db)" != "ok" ]; then
      red "PostgreSQL failed to start"
      exit 1
    fi
  fi

  # Load env
  if [ -f "$ROOT/.env" ]; then
    set -a; source "$ROOT/.env"; set +a
  fi
  DATABASE_URL="${DATABASE_URL:-postgresql://ravenclaw:ravenclaw@localhost:5432/ravenclaw}"

  # Start API
  DATABASE_URL="$DATABASE_URL" PORT=3000 HOST=0.0.0.0 \
    node "$ROOT/packages/api/dist/index.js" >> /tmp/ravenclaw-api.log 2>&1 &

  sleep 2
  if curl -s http://localhost:3000/api/v1/health | grep -q '"ok"'; then
    green "API server started (PID: $(lsof -ti:3000))"
  else
    red "API server failed to start. Check /tmp/ravenclaw-api.log"
    exit 1
  fi
}

start_web() {
  lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1
  cd "$ROOT/packages/web" && pnpm dev >> /tmp/ravenclaw-web.log 2>&1 &
  sleep 3
  if lsof -ti:5173 >/dev/null 2>&1; then
    green "Web dev server started (PID: $(lsof -ti:5173))"
  else
    red "Web server failed to start. Check /tmp/ravenclaw-web.log"
    exit 1
  fi
}

status() {
  echo "=== Ravenclaw Status ==="
  # DB
  if [ "$(check_db)" = "ok" ]; then
    green "PostgreSQL: running"
  else
    red "PostgreSQL: down"
  fi
  # API
  if curl -s http://localhost:3000/api/v1/health | grep -q '"ok"' 2>/dev/null; then
    green "API server: running (port 3000)"
  else
    red "API server: down"
  fi
  # Web
  if lsof -ti:5173 >/dev/null 2>&1; then
    green "Web server: running (port 5173)"
  else
    yellow "Web server: not running"
  fi
}

case "$TARGET" in
  api)
    echo "Restarting API server..."
    start_api
    ;;
  web)
    echo "Restarting Web server..."
    start_web
    ;;
  all)
    echo "Restarting all services..."
    start_api
    start_web
    ;;
  status)
    status
    ;;
  stop)
    echo "Stopping all services..."
    lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null && green "API stopped" || yellow "API was not running"
    lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null && green "Web stopped" || yellow "Web was not running"
    ;;
  *)
    echo "Usage: $0 [api|web|all|status|stop]"
    echo "  api    - Restart API server only"
    echo "  web    - Restart web dev server only"
    echo "  all    - Restart everything (default)"
    echo "  status - Check service status"
    echo "  stop   - Stop all services"
    exit 1
    ;;
esac
