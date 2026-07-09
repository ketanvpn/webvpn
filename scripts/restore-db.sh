#!/usr/bin/env bash
# ============================================================
# restore-db.sh — Restore database dari file .sql.gz
# Usage: restore-db.sh <file.sql.gz|URL> [DATABASE_URL]
#   DATABASE_URL opsional; kalo gak di-set, dibaca dari .env lalu prompt.
# Otomatis bikin safety backup (pre-restore-*.sql.gz) sebelum restore.
# ============================================================
set -euo pipefail

log()  { echo -e "\033[1;32m[restore]\033[0m $*"; }
warn() { echo -e "\033[1;33m[restore]\033[0m $*"; }
die()  { echo -e "\033[1;31m[restore]\033[0m $*" >&2; exit 1; }

FILE="${1:-}"
[[ -n "$FILE" ]] || die "Usage: $0 <file.sql.gz|URL> [DATABASE_URL]"

# Resolve file: download jika URL
WORK_FILE="$FILE"
if [[ "$FILE" == http* ]]; then
  log "download dari URL: $FILE"
  WORK_FILE="$(mktemp)"
  curl -fsSL "$FILE" -o "$WORK_FILE"
fi
[[ -f "$WORK_FILE" ]] || die "file tidak ditemukan: $WORK_FILE"

# Resolve DATABASE_URL: arg > .env > prompt
DATABASE_URL="${2:-}"
if [[ -z "$DATABASE_URL" ]] && [[ -f .env ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '\"' || true)"
fi
if [[ -z "$DATABASE_URL" ]]; then
  read -rp "DATABASE_URL: " DATABASE_URL
fi
[[ -n "$DATABASE_URL" ]] || die "DATABASE_URL kosong"

command -v psql >/dev/null   || die "psql tidak ditemukan (install postgresql-client)"
command -v pg_dump >/dev/null || die "pg_dump tidak ditemukan (install postgresql-client)"

# Safety backup kondisi DB saat ini
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
SAFETY="$BACKUP_DIR/pre-restore-$STAMP.sql.gz"
log "safety backup -> $SAFETY"
if ! pg_dump --clean --if-exists "$DATABASE_URL" | gzip > "$SAFETY"; then
  warn "safety backup gagal. Restore tetap lanjut?"
  read -rp "lanjut restore? [y/N] " ANS
  [[ "$ANS" =~ ^[Yy]$ ]] || die "dibatalkan"
fi

# Restore
log "restore $WORK_FILE -> DB ..."
if gunzip -c "$WORK_FILE" | psql "$DATABASE_URL"; then
  log "sukses. Safety backup: $SAFETY"
else
  die "restore gagal"
fi
