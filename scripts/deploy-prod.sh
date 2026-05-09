#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ketantech-vpn}"
BRANCH="${BRANCH:-main}"
PM2_APP="${PM2_APP:-ketantech-api}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL belum diset"
  exit 1
fi

cd "$APP_DIR"

PREV_COMMIT="$(git rev-parse --short HEAD)"
echo "[deploy] previous commit: $PREV_COMMIT"

git fetch origin
git pull --ff-only origin "$BRANCH"

NEW_COMMIT="$(git rev-parse --short HEAD)"
echo "[deploy] new commit: $NEW_COMMIT"

pnpm install --frozen-lockfile
DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/vpn-web run build
pm2 restart "$PM2_APP"

echo "[deploy] success"
echo "[deploy] rollback command: APP_DIR=$APP_DIR PM2_APP=$PM2_APP /var/www/ketantech-vpn/scripts/rollback-last.sh $PREV_COMMIT"
