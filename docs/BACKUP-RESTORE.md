# Backup & Restore — KETANTECH VPN Store

## Sistem Backup

### Backup Database (standar)
- Endpoint: `POST /api/admin/backup/now`
- Isi: PostgreSQL dump (`pg_dump --clean --if-exists`)
- Format output: `.sql.gz` (plain) atau `.sql.gz.enc` (terenkripsi AES-256-GCM)
- Otomatis dikirim ke Telegram jika bot token dikonfigurasi
- File disimpan di `./backups/` (maks 10 file terbaru)

### Full Backup Bundle
- Endpoint: `POST /api/admin/backup/full`
- Isi: SQL dump + `.env` + `ecosystem.config.cjs` + `sellvpn.db` + `.vars.json` + `.env.production`
- Format: `KTBUNDLE1` binary → gzip → encrypt (jika key ada)
- Output: `.bundle.gz` atau `.bundle.gz.enc`

### Auto-Backup
- Dikonfigurasi via panel admin (Settings → Backup)
- Interval: 1–168 jam (default 24 jam)
- Scheduler cek setiap 1 jam, pertama kali 1 menit setelah server start
- Gagal → retry 3x (30 detik, 2 menit, 5 menit) → alert Telegram

### Integritas & Keamanan
- **Checksum**: SHA-256 dihitung setelah gzip, ditampilkan di panel admin dan caption Telegram
- **Enkripsi**: AES-256-GCM dengan `BACKUP_ENCRYPTION_KEY` env var
- **Backward compatible**: file tanpa header `KTENC1` di-treat sebagai plaintext

---

## Enkripsi

### Setup
Generate key 32-byte (64 karakter hex):
```bash
openssl rand -hex 32
```

Tambahkan ke `.env`:
```
BACKUP_ENCRYPTION_KEY=<64_karakter_hex>
```

Restart server. Backup berikutnya otomatis terenkripsi.

### Tanpa Key
Jika `BACKUP_ENCRYPTION_KEY` tidak di-set atau format salah, backup tetap jalan **tanpa enkripsi** (behavior lama).

### Penting
> **Simpan `BACKUP_ENCRYPTION_KEY` di luar server** (password manager, catatan terenkripsi).
> Full backup bundle berisi `.env`, tapi butuh key ini untuk mendekripsi bundle tersebut.

---

## Restore

### Via Panel Admin
1. Buka Settings → Backup → Restore
2. Upload file `.sql.gz` atau `.sql.gz.enc`
3. Konfirmasi dialog
4. Sistem otomatis: decrypt (jika `.enc`) → gunzip → validasi format → safety backup → restore via `psql`

### Via CLI
```bash
# Restore dari file lokal
bash scripts/restore-db.sh backups/ketantech-backup-20260731-1400.sql.gz

# Restore dari URL
bash scripts/restore-db.sh https://example.com/backup.sql.gz

# Dengan DATABASE_URL eksplisit
bash scripts/restore-db.sh backup.sql.gz "postgresql://user:pass@localhost:5432/ketantech_db"
```

> **Catatan**: `restore-db.sh` belum mendukung file `.enc`. Untuk file terenkripsi, gunakan panel admin atau dekripsi manual dulu.

### Safety Backup
Sebelum restore, sistem **wajib** membuat backup kondisi DB saat ini (`pre-restore-*.sql.gz`). Jika safety backup gagal:
- **Panel admin**: restore dibatalkan total
- **CLI**: prompt konfirmasi lanjut/batal

---

## Migrasi VPS

### Persiapan di VPS Lama
1. Buat full backup via panel admin (tombol "Full Backup") atau:
   ```bash
   curl -X POST https://domain-lama.com/api/admin/backup/full \
     -H "Cookie: token=<jwt>" -o fullbackup.bundle.gz.enc
   ```
2. **Catat** `BACKUP_ENCRYPTION_KEY` dari `.env` — akan dibutuhkan di VPS baru
3. Download backup file dari Telegram atau via panel admin

### Migrasi Otomatis
Di VPS baru (sebagai root):
```bash
# Clone repo
git clone https://github.com/ketanvpn/webvpn.git /var/www/ketantech-vpn
cd /var/www/ketantech-vpn

# Jalankan migration script
BACKUP_FILE=/path/to/backup.sql.gz bash scripts/migrate-server.sh
```

Script `migrate-server.sh` melakukan 7 fase:
1. Install runtime (Node 22, pnpm, PostgreSQL)
2. Setup PostgreSQL (buat DB + user)
3. Clone repo + install dependencies
4. Generate `.env` dan `ecosystem.config.cjs` (interaktif)
5. Restore database dari backup
6. Build frontend + backend
7. Setup PM2, Nginx, SSL (Certbot), UFW firewall

### Migrasi Manual (step-by-step)
Jika `migrate-server.sh` tidak cocok:

```bash
# 1. Install prerequisites
apt update && apt install -y nodejs postgresql postgresql-client nginx certbot
npm install -g pnpm pm2

# 2. Setup PostgreSQL
sudo -u postgres createuser ketantech
sudo -u postgres createdb ketantech_db -O ketantech
sudo -u postgres psql -c "ALTER USER ketantech PASSWORD 'password-aman';"

# 3. Clone & install
git clone <repo> /var/www/ketantech-vpn && cd /var/www/ketantech-vpn
pnpm install

# 4. Buat .env (WAJIB sebelum restore jika backup terenkripsi)
cat > .env << 'EOF'
DATABASE_URL=postgresql://ketantech:password-aman@localhost:5432/ketantech_db
BACKUP_ENCRYPTION_KEY=<key_dari_vps_lama>
JWT_SECRET=<generate_baru_atau_pakai_lama>
# ... variabel lain
EOF

# 5. Restore database
gunzip -c backup.sql.gz | psql "$DATABASE_URL"
# atau via script:
bash scripts/restore-db.sh backup.sql.gz

# 6. Build & start
pnpm build
pm2 start ecosystem.config.cjs

# 7. Nginx + SSL
# Copy/adapt nginx config, lalu:
certbot --nginx -d domain-baru.com
```

### Restore Full Bundle (Manual)
Full bundle (`.bundle.gz` / `.bundle.gz.enc`) saat ini hanya bisa di-restore via panel admin. Untuk restore manual, perlu restore database-only dulu, lalu copy file konfigurasi satu per satu dari bundle.

### Checklist Setelah Migrasi
- [ ] Website accessible via HTTPS
- [ ] Login admin berfungsi
- [ ] Data pelanggan, transaksi, akun VPN terlihat lengkap
- [ ] Telegram bot aktif (`botvpn-fixed/`)
- [ ] Auto-backup enabled di panel admin
- [ ] Test backup manual → cek Telegram terkirim
- [ ] Update DNS ke IP VPS baru
- [ ] Matikan VPS lama setelah DNS propagated (24-48 jam)
