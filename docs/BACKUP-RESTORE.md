# Backup & Restore — KETANTECH VPN Store

Panduan lengkap untuk backup, restore, dan migrasi VPS.

---

## Daftar Isi

1. [Sistem Backup](#sistem-backup)
2. [Setup Enkripsi](#setup-enkripsi)
3. [Cara Backup](#cara-backup)
4. [Cara Restore](#cara-restore)
5. [Migrasi VPS (Pindah Server)](#migrasi-vps-pindah-server)
6. [Troubleshooting](#troubleshooting)

---

## Sistem Backup

### Jenis Backup

| Jenis | Isi | Ukuran | Cocok Untuk |
|-------|-----|--------|-------------|
| **Database Backup** | PostgreSQL dump saja | Kecil | Backup rutin harian |
| **Full Backup** | Database + .env + config + bot | Besar | Migrasi VPS |

### Format File

| Ekstensi | Arti |
|----------|------|
| `.sql.gz` | Database backup, tidak terenkripsi |
| `.sql.gz.enc` | Database backup, terenkripsi AES-256-GCM |
| `.bundle.gz` | Full backup, tidak terenkripsi |
| `.bundle.gz.enc` | Full backup, terenkripsi AES-256-GCM |

### Penyimpanan

- Lokasi: `./backups/` di folder project
- Maksimal: 10 file terbaru (otomatis dihapus yang lama)
- Telegram: Otomatis dikirim ke grup/channel yang dikonfigurasi

### Auto-Backup

- Dikonfigurasi via **Panel Admin → Settings → Backup**
- Interval: 1–168 jam (default 24 jam)
- Scheduler cek setiap 1 jam
- Jika gagal: otomatis retry 3x (30 detik, 2 menit, 5 menit)
- Jika semua retry gagal: kirim alert ke Telegram

---

## Setup Enkripsi

Enkripsi melindungi data backup agar tidak bisa dibaca orang lain.

### Langkah 1: Generate Key

Jalankan di terminal (VPS atau komputer lokal):

```bash
# Option A: Menggunakan openssl
openssl rand -hex 32

# Option B: Menggunakan node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Contoh output: `a1b2c3d4e5f6...` (64 karakter hex)

### Langkah 2: Simpan ke .env

Edit file `.env` di server:

```bash
nano .env
```

Tambahkan baris:

```
BACKUP_ENCRYPTION_KEY=a1b2c3d4e5f6...ganti_dengan_key_anda
```

### Langkah 3: Restart Server

```bash
pm2 restart ketantech-api
```

### Langkah 4: Simpan Key di Password Manager

> **PENTING**: Simpan `BACKUP_ENCRYPTION_KEY` di:
> - Password manager (Bitwarden, 1Password, dll)
> - Catatan terenkripsi
> - TIDAK di repo git atau file backup itu sendiri
>
> Jika key hilang, file backup tidak bisa di-restore!

---

## Cara Backup

### Via Panel Admin (Direkomendasikan)

1. Login sebagai admin
2. Buka **Settings → Backup**
3. Klik salah satu tombol:
   - **"Backup Sekarang"** → Database saja
   - **"Full Backup"** → Database + config files

4. Tunggu hingga muncul notifikasi sukses
5. File otomatis dikirim ke Telegram

### Via API (untuk Automation)

```bash
# Database backup
curl -X POST https://domain-anda.com/api/admin/backup/now \
  -H "Cookie: token=<jwt_admin_token>"

# Full backup
curl -X POST https://domain-anda.com/api/admin/backup/full \
  -H "Cookie: token=<jwt_admin_token>"
```

### Via Terminal di VPS

```bash
cd /var/www/ketantech-vpn

# Jalankan backup via API lokal
curl -X POST http://localhost:5000/api/admin/backup/full \
  -H "Authorization: Bearer <token>"
```

---

## Cara Restore

### Via Panel Admin (Direkomendasikan)

1. Login sebagai admin
2. Buka **Settings → Backup**
3. Scroll ke bagian **Restore**
4. Klik area upload atau drag & drop file backup
   - Format didukung: `.sql.gz`, `.sql.gz.enc`, `.bundle.gz`, `.bundle.gz.enc`
5. Klik **"Ya, Restore"** di dialog konfirmasi
6. Tunggu proses selesai

> **Catatan**: 
> - Sistem otomatis membuat **safety backup** sebelum restore
> - Jika safety backup gagal, restore dibatalkan
> - File `.enc` akan otomatis di-decrypt jika `BACKUP_ENCRYPTION_KEY` sudah di-set

### Via CLI (untuk file .sql.gz tanpa enkripsi)

```bash
cd /var/www/ketantech-vpn

# Restore dari file lokal
bash scripts/restore-db.sh backups/ketantech-backup-20260731-1400.sql.gz

# Restore dari URL
bash scripts/restore-db.sh https://example.com/backup.sql.gz

# Dengan DATABASE_URL eksplisit
bash scripts/restore-db.sh backup.sql.gz "postgresql://user:pass@localhost:5432/dbname"
```

> **Batasan**: `restore-db.sh` saat ini belum mendukung file terenkripsi `.enc`. Untuk file terenkripsi, gunakan panel admin.

---

## Migrasi VPS (Pindah Server)

Panduan lengkap untuk pindah dari VPS lama ke VPS baru.

### Prasyarat

- VPS baru: Ubuntu 22.04 atau Debian 12
- Akses root ke VPS baru
- Domain sudah pointing ke IP VPS baru (atau gunakan IP langsung)
- File backup sudah didownload/diketahui lokasinya

---

### Langkah 1: Backup di VPS Lama

#### Option A: Via Panel Admin (Mudah)

1. Login ke **Panel Admin** di VPS lama
2. Buka **Settings → Backup**
3. Klik tombol **"Full Backup"**
4. Tunggu hingga sukses
5. Download file dari Telegram atau via tombol **"Download"**

#### Option B: Via Terminal

```bash
ssh root@vps-lama-ip

cd /var/www/ketantech-vpn

# Backup database + config
curl -X POST http://localhost:5000/api/admin/backup/full \
  -H "Authorization: Bearer <admin-token>"

# File tersimpan di ./backups/
ls -la backups/
```

### Langkah 2: Catat Data Penting

Sebelum pindah, catat data berikut:

```bash
# Di VPS lama
cat .env | grep BACKUP_ENCRYPTION_KEY
cat .env | grep DATABASE_URL
cat .env | grep SESSION_SECRET

# Catat juga:
# - Password PostgreSQL
# - Bot API Key
# - Turnstile keys dari Cloudflare
```

Simpan di password manager atau catatan aman.

### Langkah 3: Transfer File Backup ke VPS Baru

#### Option A: Via SCP

```bash
# Di komputer lokal, setelah download dari Telegram
scp ketantech-backup-*.bundle.gz.enc root@vps-baru-ip:/root/
```

#### Option B: Langsung VPS ke VPS

```bash
# Di VPS lama
scp /var/www/ketantech-vpn/backups/ketantech-backup-*.bundle.gz.enc \
    root@vps-baru-ip:/root/
```

### Langkah 4: Jalankan Migrasi di VPS Baru

#### Langkah 4a: Login ke VPS Baru

```bash
ssh root@vps-baru-ip
```

#### Langkah 4b: Clone Repository

```bash
# Install git jika belum ada
apt update && apt install -y git

# Clone repo
git clone https://github.com/ketanvpn/webvpn.git /var/www/ketantech-vpn

cd /var/www/ketantech-vpn
```

#### Langkah 4c: Jalankan Script Migrasi

**Untuk file backup database saja (`.sql.gz` atau `.sql.gz.enc`):**

```bash
BACKUP_FILE=/root/ketantech-backup-20260731.sql.gz.enc \
  bash scripts/migrate-server.sh
```

**Untuk file backup tanpa data (fresh install):**

```bash
bash scripts/migrate-server.sh
```

Script akan menanyakan:
1. **Domain atau IP publik** — mis. `vpn.ketanx.com` atau `123.45.67.89`
2. **Password PostgreSQL** — kosongkan untuk auto-generate
3. **Turnstile Secret Key** — bisa kosong, isi nanti
4. **Turnstile Site Key** — bisa kosong
5. **Bot API Key** — bisa kosong
6. **NadiaVPN API Token** — bisa kosong

Script otomatis:
- Install Node.js 22, pnpm, PM2, PostgreSQL, Nginx
- Setup database
- Generate `.env` dan `ecosystem.config.cjs`
- Restore database dari backup
- Build frontend & backend
- Start PM2
- Setup Nginx + SSL (Certbot)
- Setup firewall (UFW)

### Langkah 5: Setup Enkripsi di VPS Baru

Jika backup terenkripsi, tambahkan key ke `.env`:

```bash
cd /var/www/ketantech-vpn

# Edit .env
nano .env

# Tambahkan baris (paste key dari catatan):
BACKUP_ENCRYPTION_KEY=a1b2c3d4e5f6...key_anda

# Restart PM2
pm2 restart ketantech-api
```

### Langkah 6: Restore Full Bundle (Jika Pakai Full Backup)

> **Catatan**: Full bundle (`.bundle.gz.enc`) saat ini hanya bisa di-restore via panel admin.

Jika menggunakan full bundle:

1. Selesaikan migrasi dengan script di atas (ini akan setup server)
2. Login ke panel admin di VPS baru
3. Buka **Settings → Backup → Restore**
4. Upload file `.bundle.gz.enc`
5. Klik **"Ya, Restore"**

File konfigurasi akan di-restore otomatis.

### Langkah 7: Verifikasi

Buka browser dan akses:
- `https://domain-anda.com` — halaman utama
- `https://domain-anda.com/admin` — panel admin

Test:
- [ ] Login admin berhasil
- [ ] Data pelanggan terlihat
- [ ] Data transaksi lengkap
- [ ] Akun VPN ada
- [ ] Telegram bot aktif (cek group)
- [ ] Auto-backup enabled

### Langkah 8: Update DNS

Jika menggunakan domain:

1. Update A record di DNS registrar ke IP VPS baru
2. Tunggu propagasi (5 menit - 24 jam)
3. Test dengan `dig domain-anda.com`

### Langkah 9: Matikan VPS Lama

**Tunggu 24-48 jam** setelah DNS update sebelum mematikan VPS lama.

---

## Migrasi Manual (Step-by-Step)

Jika script otomatis tidak berhasil, ikuti langkah manual berikut.

### 1. Install Prerequisites

```bash
apt update && apt install -y curl git nginx certbot python3-certbot-nginx ufw

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install pnpm dan PM2
npm install -g pnpm pm2

# Install PostgreSQL
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### 2. Setup PostgreSQL

```bash
# Buat user
sudo -u postgres psql -c "CREATE USER ketantech WITH PASSWORD 'password-aman-anda';"

# Buat database
sudo -u postgres psql -c "CREATE DATABASE ketantech_db OWNER ketantech;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ketantech_db TO ketantech;"
```

### 3. Clone Repository

```bash
git clone https://github.com/ketanvpn/webvpn.git /var/www/ketantech-vpn
cd /var/www/ketantech-vpn
pnpm install
```

### 4. Buat File .env

```bash
nano .env
```

Isi dengan (ganti nilai sesuai server Anda):

```bash
# Dibuat manual untuk migrasi
DATABASE_URL=postgresql://ketantech:password-aman-anda@localhost:5432/ketantech_db
SESSION_SECRET=<generate_dengan_openssl_rand_hex_32>
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://domain-anda.com
TRUSTED_PROXIES=127.0.0.1,::1
TURNSTILE_SECRET_KEY=<dari_cloudflare>
TURNSTILE_FAIL_OPEN=false
LOG_LEVEL=info
PM2_APP_NAME=ketantech-api
SITE_URL=https://domain-anda.com
BOT_API_KEY=<dari_botfather>
NADIAVPN_API_TOKEN=<jika_ada>
BACKUP_ENCRYPTION_KEY=<key_dari_vps_lama>
```

Generate SESSION_SECRET:

```bash
openssl rand -hex 32
```

### 5. Buat ecosystem.config.cjs

```bash
nano ecosystem.config.cjs
```

Isi dengan:

```javascript
module.exports = {
  apps: [{
    name: "ketantech-api",
    script: "node",
    args: "--enable-source-maps artifacts/api-server/dist/index.mjs",
    cwd: "/var/www/ketantech-vpn",
    env: {
      NODE_ENV: "production",
      PORT: "5000",
      DATABASE_URL: "postgresql://ketantech:password@localhost:5432/ketantech_db",
      SESSION_SECRET: "<session-secret-anda>",
      CORS_ORIGIN: "https://domain-anda.com",
      TRUSTED_PROXIES: "127.0.0.1,::1",
      TURNSTILE_SECRET_KEY: "<turnstile-secret>",
      TURNSTILE_FAIL_OPEN: "false",
      LOG_LEVEL: "info",
      PM2_APP_NAME: "ketantech-api",
      SITE_URL: "https://domain-anda.com",
      BOT_API_KEY: "<bot-key>",
      NADIAVPN_API_TOKEN: "",
      BACKUP_ENCRYPTION_KEY: "<encryption-key>"
    }
  }]
}
```

### 6. Restore Database

```bash
# Untuk file tidak terenkripsi
gunzip -c backup.sql.gz | psql "$DATABASE_URL"

# Untuk file terenkripsi, gunakan panel admin setelah server berjalan
```

### 7. Build dan Start

```bash
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 8. Setup Nginx

Buat config:

```bash
nano /etc/nginx/sites-available/ketantech
```

Isi dengan:

```nginx
server {
    listen 80;
    server_name domain-anda.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:

```bash
ln -s /etc/nginx/sites-available/ketantech /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 9. Setup SSL

```bash
certbot --nginx -d domain-anda.com
```

### 10. Setup Firewall

```bash
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable
```

---

## Troubleshooting

### Error: "File backup tidak ditemukan"

**Penyebab**: File backup sudah dihapus oleh retention policy (maks 10 file).

**Solusi**: Jalankan backup baru.

---

### Error: "Cannot decrypt backup"

**Penyebab**: `BACKUP_ENCRYPTION_KEY` salah atau tidak di-set.

**Solusi**:
1. Pastikan key sama persis dengan saat backup dibuat
2. Key harus 64 karakter hex (huruf kecil)
3. Tidak ada spasi atau newline di awal/akhir

```bash
# Cek key di .env
cat .env | grep BACKUP_ENCRYPTION_KEY

# Pastikan tidak ada spasi
BACKUP_ENCRYPTION_KEY=a1b2c3d4e5f6...
# BUKAN
BACKUP_ENCRYPTION_KEY= a1b2c3d4e5f6...
```

---

### Error: "Restore gagal"

**Penyebab**: SQL tidak valid atau database corrupt.

**Solusi**:
1. Cek apakah file backup corrupt dengan download ulang
2. Cek checksum di caption Telegram vs yang ditampilkan di panel
3. Jika checksum beda, jalankan backup baru

---

### Telegram tidak menerima file

**Penyebab**: Bot token salah atau chat ID tidak dikonfigurasi.

**Solusi**:
1. Cek `.env` ada `BOT_API_KEY` dan `TELEGRAM_CHAT_ID`
2. Test bot dengan kirim pesan manual
3. Pastikan bot sudah ditambahkan ke group/channel

---

### Full Backup gagal dengan "ENOENT: no such file or directory"

**Penyebab**: Working directory PM2 bukan project root.

**Solusi**:
```bash
# Restart PM2 dari project root
cd /var/www/ketantech-vpn
pm2 restart ketantech-api
```

---

### Setelah restore, data tidak muncul

**Penyebab**: Database tidak ter-restore dengan benar.

**Solusi**:
1. Cek log PM2: `pm2 logs ketantech-api`
2. Cek koneksi database: `psql "$DATABASE_URL" -c "\dt"`
3. Jalankan restore ulang via panel admin

---

## Checklist Pre-Migrasi

Simpan data berikut sebelum migrasi:

```bash
# Di VPS lama, jalankan dan simpan output:

echo "=== DATABASE_URL ==="
cat .env | grep DATABASE_URL

echo "=== SESSION_SECRET ==="
cat .env | grep SESSION_SECRET

echo "=== BACKUP_ENCRYPTION_KEY ==="
cat .env | grep BACKUP_ENCRYPTION_KEY

echo "=== PostgreSQL Password ==="
sudo -u postgres psql -c "\password ketantech"

echo "=== Domain ==="
cat .env | grep CORS_ORIGIN

echo "=== Bot API Key ==="
cat .env | grep BOT_API_KEY

echo "=== Turnstile Keys ==="
cat .env | grep TURNSTILE
cat artifacts/vpn-web/.env.production
```

Simpan output di password manager.

---

## FAQ

### Q: Apakah perlu backup file .env secara terpisah?

**A**: Full Backup sudah mencakup `.env`. Namun disarankan tetap simpan copy terpisah di password manager.

---

### Q: Berapa lama waktu backup?

**A**: 
- Database backup: 1-5 menit (tergantung ukuran DB)
- Full backup: 2-10 menit (tergantung ukuran bot DB)

---

### Q: Apakah aman mengirim backup ke Telegram?

**A**: Jika backup terenkripsi, ya. File `.enc` tidak bisa dibaca tanpa key. Tanpa enkripsi, siapapun dengan akses ke file bisa membaca data.

---

### Q: Bagaimana jika VPS crash dan tidak bisa diakses?

**A**: Pastikan:
1. Auto-backup aktif
2. Backup terkirim ke Telegram
3. `BACKUP_ENCRYPTION_KEY` tersimpan di password manager

Dengan 3 hal di atas, Anda bisa restore ke VPS baru kapan saja.

---

### Q: Bisakah restore ke versi aplikasi berbeda?

**A**: Restore ke versi yang sama atau lebih baru direkomendasikan. Restore ke versi lebih lama bisa menyebabkan masalah jika ada perubahan schema database.

---

## Support

Jika mengalami masalah:

1. Cek log: `pm2 logs ketantech-api`
2. Cek dokumentasi ini
3. Hubungi developer dengan menyertakan:
   - Error message lengkap
   - Screenshot panel admin
   - Log PM2
