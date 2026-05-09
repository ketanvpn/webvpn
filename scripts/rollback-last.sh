#!/usr/bin/env bash
set -euo pipefail

TARGET_COMMIT="${1:-}"
APP_DIR="${APP_DIR:-/var/www/ketantech-vpn}"
PM2_APP="${PM2_APP:-ketantech-api}"

if [[ -z "$TARGET_COMMIT" ]]; then
  echo "Usage: $0 <commit-hash>"
  exit 1
fi

cd "$APP_DIR"

git fetch origin
git reset --hard "$TARGET_COMMIT"
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/vpn-web run build
pm2 restart "$PM2_APP"

echo "[rollback] success to $TARGET_COMMIT"
