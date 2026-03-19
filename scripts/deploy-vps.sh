#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:?APP_DIR is required}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
VERIFY_API_URL="${VERIFY_API_URL:-http://localhost:3069}"
VERIFY_FRONTEND_URL="${VERIFY_FRONTEND_URL:-http://localhost:3069}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on the VPS"
  exit 1
fi

cd "$APP_DIR"

git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

docker compose -f "$COMPOSE_FILE" build --pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

API_URL="$VERIFY_API_URL" FRONTEND_URL="$VERIFY_FRONTEND_URL" ./scripts/verify-deployment.sh
