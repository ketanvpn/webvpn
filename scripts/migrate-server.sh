#!/usr/bin/env bash
# ============================================================
# migrate-server.sh — Bootstrap VPS baru + restore data (Strategi B)
# Full bootstrap: install runtime, clone, config, (restore DB), build, start, nginx, SSL.
# Interactive prompt untuk domain, password DB, Turnstile, dll.
#
# Usage (di VPS baru, sebagai root):
#   BACKUP_FILE=/path/atau/url/backup.sql.gz bash migrate-server.sh
#   BACKUP_FILE boleh kosong → skema baru (tanpa data lama).
#
# Variabel (opsional, lewat env): APP_DIR, REPO_URL, BRANCH,
#   BACKUP_FILE, DOMAIN, DB_NAME, DB_USER
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/ketantech-vpn}"
REPO_URL="${REPO_URL:-https://github.com/ketanvpn/webvpn.git}"
BRANCH="${BRANCH:-main}"
BACKUP_FILE="${BACKUP_FILE:-}"
DOMAIN="${DOMAIN:-}"
DB_NAME="${DB_NAME:-ketantech_db}"
DB_USER="${DB_USER:-ketantech}"

log()  { echo -e "\033[1;32m[migrate]\033[0m $*"; }
warn() { echo -e "\033[1;33m[migrate]\033[0m $*"; }
err()  { echo -e "\033[1;31m[migrate]\033[0m $*" >&2; }
die()  { err "$*"; exit 1; }

ensure() { command -v "$1" >/dev/null 2>&1; }

# ── Preflight ───────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Jalan sebagai root: sudo bash $0"
if [[ -f /etc/debian_version ]]; then
  log "OS terdeteksi: Debian/Ubuntu (OK)"
else
  . /etc/os-release 2>/dev/null || die "OS tidak dikenali (butuh /etc/os-release)"
  warn "OS: $ID — script diuji untuk Debian/Ubuntu. Lanjut?"
  read -r ANS; [[ "$ANS" =~ ^[Yy]$ ]] || die "dibatalkan"
fi

# ── Phase 1: install runtime (idempotent) ───────────────────
log "Phase 1: install runtime (skip yg sudah ada)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y

node_major() { node -v 2>/dev/null | cut -dv -f2 | cut -d. -f1 || echo 0; }
if ! ensure node || [[ "$(node_major)" -lt 22 ]]; then
  log "install Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
ensure pnpm || npm install -g pnpm
ensure pm2  || npm install -g pm2
if ! ensure psql; then
  apt-get install -y postgresql postgresql-contrib postgresql-client
fi
systemctl start postgresql 2>/dev/null || true
systemctl enable postgresql 2>/dev/null || true
ensure nginx || apt-get install -y nginx
ensure certbot || apt-get install -y certbot python3-certbot-nginx
ensure ufw || apt-get install -y ufw

log "versi: $(node -v) / pnpm $(pnpm -v) / $(psql --version 2>/dev/null || echo 'psql?')"

# ── Phase 2: PostgreSQL user + database ─────────────────────
log "Phase 2: setup PostgreSQL"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1; then
  read -rsp "Password untuk user PG '$DB_USER' (kosongkan = auto-generate): " DB_PASS_INPUT; echo
  if [[ -z "$DB_PASS_INPUT" ]]; then
    DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    warn "password dibuat otomatis: $DB_PASS  (CATAT BAIK-BAIK!)"
  else
    DB_PASS="$DB_PASS_INPUT"
  fi
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
else
  warn "user '$DB_USER' sudah ada."
  read -rsp "Password eksisting untuk '$DB_USER': " DB_PASS; echo
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
else
  warn "database '$DB_NAME' sudah ada."
fi

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# ── Phase 3: clone repo + install deps ──────────────────────
log "Phase 3: clone repo + install deps"
if [[ -d "$APP_DIR/.git" ]]; then
  warn "$APP_DIR sudah ada → skip clone, git pull"
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null || true
  git pull --ff-only origin "$BRANCH" || warn "git pull non-fatal, lanjut"
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
pnpm install --frozen-lockfile || pnpm install

# ── Phase 4: prompt interaktif → generate config ────────────
log "Phase 4: generate .env + ecosystem.config.cjs + frontend env"
[[ -z "$DOMAIN" ]] && read -rp "Domain atau IP publik (mis. vpn.ketanx.com): " DOMAIN
[[ -z "$DOMAIN" ]] && die "Domain/IP wajib"

if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SCHEME="http";  CORS_ORIGIN="http://$DOMAIN"
else
  SCHEME="https"; CORS_ORIGIN="https://$DOMAIN"
fi

read -rp "Cloudflare Turnstile SECRET key (boleh kosong, isi nanti): " TURNSTILE_SECRET
read -rp "Cloudflare Turnstile SITE key frontend (boleh kosong): " TURNSTILE_SITE
SESSION_SECRET="$(openssl rand -hex 32)"
read -rp "BOT_API_KEY (shared dgn BotVPN, boleh kosong): " BOT_API_KEY
read -rp "NADIAVPN_API_TOKEN (boleh kosong): " NADIA_TOKEN

# .env
cat > "$APP_DIR/.env" <<EOF
# Dibuat oleh migrate-server.sh pada $(date)
DATABASE_URL=$DATABASE_URL
SESSION_SECRET=$SESSION_SECRET
NODE_ENV=production
PORT=5000
CORS_ORIGIN=$CORS_ORIGIN
TRUSTED_PROXIES=127.0.0.1,::1
TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET
TURNSTILE_FAIL_OPEN=false
LOG_LEVEL=info
PM2_APP_NAME=ketantech-api
SITE_URL=$CORS_ORIGIN
BOT_API_KEY=$BOT_API_KEY
NADIAVPN_API_TOKEN=$NADIA_TOKEN
EOF
chmod 600 "$APP_DIR/.env"

# ecosystem.config.cjs
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "ketantech-api",
      script: "node",
      args: "--enable-source-maps artifacts/api-server/dist/index.mjs",
      cwd: "$APP_DIR",
      env: {
        NODE_ENV: "production",
        PORT: "5000",
        DATABASE_URL: "$DATABASE_URL",
        SESSION_SECRET: "$SESSION_SECRET",
        CORS_ORIGIN: "$CORS_ORIGIN",
        TRUSTED_PROXIES: "127.0.0.1,::1",
        TURNSTILE_SECRET_KEY: "$TURNSTILE_SECRET",
        TURNSTILE_FAIL_OPEN: "false",
        LOG_LEVEL: "info",
        PM2_APP_NAME: "ketantech-api",
        SITE_URL: "$CORS_ORIGIN",
        BOT_API_KEY: "$BOT_API_KEY",
        NADIAVPN_API_TOKEN: "$NADIA_TOKEN"
      }
    }
  ]
}
EOF

# frontend env
mkdir -p "$APP_DIR/artifacts/vpn-web"
cat > "$APP_DIR/artifacts/vpn-web/.env.production" <<EOF
VITE_TURNSTILE_SITE_KEY=$TURNSTILE_SITE
EOF

# ── Phase 5: data database ──────────────────────────────────
log "Phase 5: data database"
if [[ -n "$BACKUP_FILE" ]]; then
  log "restore dari backup: $BACKUP_FILE"
  bash "$APP_DIR/scripts/restore-db.sh" "$BACKUP_FILE" "$DATABASE_URL"
else
  log "skema baru (drizzle push), tanpa restore data lama"
  DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push
fi

# ── Phase 6: build + start ───────────────────────────────────
log "Phase 6: build + start PM2"
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/vpn-web run build

pm2 delete ketantech-api 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

log "setup PM2 startup (auto-start saat VPS reboot)..."
pm2 startup systemd 2>/dev/null || warn "jalankan 'pm2 startup' manual"

sleep 4
if curl -fsS --max-time 5 "http://127.0.0.1:5000/healthz" >/dev/null 2>&1; then
  log "health check OK (port 5000)"
else
  warn "health check gagal — cek: pm2 logs ketantech-api --lines 50"
fi

# ── Phase 7: nginx + SSL + firewall ─────────────────────────
log "Phase 7: nginx + SSL + firewall"
NGINX_FILE="/etc/nginx/sites-available/ketantech"
cat > "$NGINX_FILE" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 100M;

    location / {
        root $APP_DIR/artifacts/vpn-web/dist/public;
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf "$NGINX_FILE" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx || systemctl restart nginx

if [[ "$SCHEME" == "https" ]]; then
  log "request SSL cert (certbot) untuk $DOMAIN..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" --redirect \
    || warn "certbot gagal/skip — jalankan manual: certbot --nginx -d $DOMAIN"
fi

log "setup UFW (pastikan SSH tetap kebuka)"
ufw allow OpenSSH 2>/dev/null || ufw allow 22 2>/dev/null || true
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true
read -rp "Aktifkan UFW sekarang? [y/N] " UFW_ANS
if [[ "$UFW_ANS" =~ ^[Yy]$ ]]; then
  yes | ufw enable || warn "UFW enable bermasalah — cek manual"
else
  warn "UFW dilewati. Aktifkan manual nanti setelah pastikan allow 22/80/443."
fi

# ── Phase 8: summary ────────────────────────────────────────
echo
log "============================================================"
log "SELESAI"
log "URL      : $CORS_ORIGIN"
log "App dir  : $APP_DIR"
log "DB       : $DATABASE_URL"
[[ -n "$BACKUP_FILE" ]] && log "Data     : terestore dari $BACKUP_FILE"
echo
warn "ADMIN DEFAULT: admin / admin123 — GANTI SEGERA via dashboard!"
warn "BotVPN (botvpn-fixed): copy sellvpn.db + .vars.json manual terpisah."
warn "Jika 'pm2 startup' di atas minta command, jalankan lalu 'pm2 save'."
log "Update berikutnya: bash $APP_DIR/scripts/deploy-prod.sh"
log "============================================================"
