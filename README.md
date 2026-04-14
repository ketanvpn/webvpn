# 🌐 KETANTECH VPN Store

Platform penjualan VPN berbasis web yang lengkap — dengan dashboard user, panel admin, verifikasi WhatsApp, dan integrasi bot Telegram.

---

## ✨ Fitur Lengkap

### Untuk Pengguna (Customer)
- **Registrasi dengan verifikasi WhatsApp** — OTP dikirim via WhatsApp (menggunakan Fonnte)
- **Dashboard** — Ringkasan saldo, akun VPN aktif, dan riwayat order
- **Beli VPN** — Pilih produk, bayar pakai saldo atau **QRIS langsung** (AutoGoPay) — akun VPN aktif otomatis setelah bayar
- **Kelola Akun VPN** — Lihat detail akun, perpanjang masa aktif
- **Top Up Saldo** — Via QRIS otomatis (AutoGoPay) atau manual
- **Riwayat Saldo** — Log semua perubahan saldo
- **Edit Profil** — Ubah nama, email, dan password
- **Link Akun Telegram** — Untuk notifikasi langsung via Telegram

### Untuk Admin
- **Dashboard Admin** — Statistik: total revenue, pengguna, akun aktif, topup pending
- **Manajemen Pengguna** — Lihat, cari, filter, suspend, ubah role, sesuaikan saldo, dan **buat pengguna baru manual**
- **Manajemen Produk** — Tambah/edit/hapus produk VPN (SSH, VMess, VLess, Trojan, Shadowsocks)
- **Manajemen Server** — Tambah/edit/hapus server VPN
- **Manajemen Order** — Konfirmasi order, buat akun VPN otomatis via panel
- **Manajemen Topup** — Konfirmasi/tolak topup manual, preview QRIS
- **Manajemen Akun VPN** — Perpanjang, aktif/nonaktif, hapus akun
- **Pengaturan Payment** — Konfigurasi AutoGoPay untuk QRIS otomatis
- **Pengaturan WhatsApp OTP** — Konfigurasi token Fonnte, test kirim OTP
- **Pengaturan Telegram Bot** — Konfigurasi bot untuk notifikasi
- **Broadcast** — Kirim pesan massal ke semua user yang sudah link Telegram

### Fitur Teknis
- Auto-seed admin default saat pertama kali install
- Mobile-responsive — termasuk panel admin dengan header navigasi mobile
- Auto-refresh data setiap 30 detik (dashboard, orders, topups)
- Export data ke CSV (orders & topups)
- **QRIS order otomatis:** webhook AutoGoPay langsung proses order & aktifkan akun VPN tanpa campur tangan admin
- **Auto-polling frontend:** halaman order QRIS pending auto-update setiap 5 detik hingga pembayaran terkonfirmasi

---

## 📋 Yang Kamu Butuhkan Sebelum Mulai

Sebelum instalasi, pastikan VPS kamu sudah memiliki:

| Kebutuhan | Versi Minimal | Cara Cek |
|---|---|---|
| Node.js | v20 atau lebih baru | `node --version` |
| pnpm | v8 atau lebih baru | `pnpm --version` |
| PostgreSQL | v14 atau lebih baru | `psql --version` |
| Git | Bebas | `git --version` |

> 💡 **Catatan:** Tutorial ini menggunakan Ubuntu 22.04. Perintahnya kurang lebih sama untuk Debian.

---

## 🚀 Tutorial Instalasi di VPS

### Langkah 1 — Install Node.js

```bash
# Download dan jalankan script installer Node.js versi 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt-get install -y nodejs

# Cek versi (pastikan muncul v20.x.x atau lebih baru)
node --version
```

### Langkah 2 — Install pnpm

```bash
# Install pnpm secara global
npm install -g pnpm

# Cek versi
pnpm --version
```

### Langkah 3 — Install PostgreSQL

```bash
# Update daftar paket
sudo apt update

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Jalankan PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Buat database dan user PostgreSQL:**

```bash
# Masuk ke mode PostgreSQL
sudo -u postgres psql

# Jalankan perintah ini satu per satu di dalam psql:
CREATE USER ketantech WITH PASSWORD 'password_kamu_yang_aman';
CREATE DATABASE ketantech_db OWNER ketantech;
GRANT ALL PRIVILEGES ON DATABASE ketantech_db TO ketantech;
\q
```

> ⚠️ Ganti `password_kamu_yang_aman` dengan password yang kuat dan unik!

### Langkah 4 — Clone Project

```bash
# Masuk ke direktori yang kamu inginkan (misalnya /var/www)
cd /var/www

# Clone repository
git clone https://github.com/ketanvpn/webvpn.git ketantech-vpn

# Masuk ke folder project
cd ketantech-vpn
```

### Langkah 5 — Install Semua Dependensi

```bash
pnpm install
```

> Proses ini mungkin memakan waktu 1-3 menit. Tunggu hingga selesai.

### Langkah 6 — Buat File Konfigurasi (.env)

Buat file `.env` di root project:

```bash
nano .env
```

Isi dengan konfigurasi berikut (sesuaikan dengan data kamu):

```env
# URL koneksi database PostgreSQL
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://ketantech:password_kamu_yang_aman@localhost:5432/ketantech_db

# Kunci rahasia untuk JWT (token login) — buat string acak yang panjang
JWT_SECRET=ganti_dengan_string_acak_panjang_dan_aman_minimal_32_karakter

# Mode environment
NODE_ENV=production

# Port API server (jangan diubah kecuali perlu)
PORT=8080
```

> 💡 Untuk membuat `JWT_SECRET` yang aman, jalankan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Simpan file dengan **Ctrl+X**, lalu **Y**, lalu **Enter**.

### Langkah 7 — Setup Database

Perintah ini akan membuat semua tabel yang dibutuhkan di database:

```bash
pnpm --filter @workspace/db run push
```

Kalau berhasil, akan muncul: `✓ Changes applied`

### Langkah 8 — Build Aplikasi

```bash
# Build API server
pnpm --filter @workspace/api-server run build

# Build frontend (website)
pnpm --filter @workspace/vpn-web run build
```

### Langkah 9 — Coba Jalankan (Test)

```bash
# Jalankan API server untuk test
PORT=8080 node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Kalau muncul:
```
INFO: Server listening port: 8080
INFO: Default admin created — username: admin, password: admin123
```

Berarti berhasil! Tekan **Ctrl+C** untuk hentikan dulu, lalu lanjut ke langkah berikutnya.

---

## 🔄 Langkah 10 — Jalankan dengan PM2 (Agar Selalu Online)

PM2 adalah tools yang menjaga aplikasi tetap berjalan bahkan setelah server restart.

```bash
# Install PM2
npm install -g pm2

# Jalankan API server dengan PM2
PORT=8080 pm2 start "node --enable-source-maps artifacts/api-server/dist/index.mjs" --name ketantech-api

# Simpan konfigurasi PM2 agar otomatis jalan saat server restart
pm2 save
pm2 startup
```

Ikuti instruksi yang muncul setelah `pm2 startup`.

**Cek status:**
```bash
pm2 status
pm2 logs ketantech-api
```

---

## 🌍 Langkah 11 — Setup Nginx (Agar Bisa Diakses dari Internet)

Install Nginx sebagai reverse proxy:

```bash
sudo apt install -y nginx
```

Buat konfigurasi Nginx:

```bash
sudo nano /etc/nginx/sites-available/ketantech
```

Isi dengan (ganti `domain-kamu.com` dengan domain atau IP VPS kamu):

```nginx
server {
    listen 80;
    server_name domain-kamu.com;

    # Frontend (website)
    location / {
        root /var/www/ketantech-vpn/artifacts/vpn-web/dist/public;
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi:

```bash
# Buat symlink untuk mengaktifkan site
sudo ln -s /etc/nginx/sites-available/ketantech /etc/nginx/sites-enabled/

# Hapus konfigurasi default (opsional)
sudo rm /etc/nginx/sites-enabled/default

# Test konfigurasi Nginx
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔐 Langkah 12 — SSL / HTTPS (Opsional tapi Sangat Dianjurkan)

Jika kamu punya domain, aktifkan HTTPS gratis dengan Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-kamu.com
```

Ikuti instruksi yang muncul. Certbot akan otomatis mengurus konfigurasi SSL.

---

## 🎉 Selesai! Login Pertama Kali

Buka browser dan akses:
- **Website:** `http://domain-kamu.com` atau `http://ip-vps-kamu`
- **Login Admin:** `http://domain-kamu.com/admin`

**Kredensial default:**
| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |

> ⚠️ **WAJIB:** Segera ganti password admin setelah login pertama! Masuk ke menu Profil untuk menggantinya.

---

## ⚙️ Konfigurasi Setelah Install

Setelah login sebagai admin, lakukan konfigurasi berikut:

### 1. Tambah Server VPN
- Masuk ke **Admin → Server**
- Klik **Tambah Server**
- Isi URL API panel VPN dan token

### 2. Tambah Produk VPN
- Masuk ke **Admin → Produk**
- Klik **Tambah Produk**
- Pilih server, protokol, durasi, harga, dan kuota

### 3. Konfigurasi WhatsApp OTP (Fonnte)
- Masuk ke **Admin → WhatsApp OTP**
- Daftar di [fonnte.com](https://fonnte.com), hubungkan nomor WA, salin token API
- Isi token di form dan klik Simpan

### 4. Konfigurasi Payment QRIS (AutoGoPay) — Opsional
- Masuk ke **Admin → Payment Gateway**
- Isi API URL dan Secret Key dari AutoGoPay, lalu set gateway ke **AutoGoPay**
- Setelah dikonfigurasi: topup saldo **dan** pembelian VPN langsung via QRIS akan dikonfirmasi otomatis melalui webhook

### 5. Konfigurasi Telegram Bot — Opsional
- Masuk ke **Admin → Notifikasi Telegram**
- Buat bot via [@BotFather](https://t.me/BotFather), isi token dan Chat ID admin

---

## 🔧 Perintah Berguna

```bash
# Lihat log aplikasi
pm2 logs ketantech-api

# Restart aplikasi (setelah update)
pm2 restart ketantech-api

# Update aplikasi dari GitHub
git pull origin main
pnpm install
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/vpn-web run build
pm2 restart ketantech-api

# Cek status PM2
pm2 status
```

---

## ❓ Troubleshooting (Solusi Masalah Umum)

**Q: Muncul error "DATABASE_URL not found"**
> Pastikan file `.env` sudah dibuat dan isinya benar. Coba jalankan `cat .env` untuk memeriksanya.

**Q: Tidak bisa konek ke database PostgreSQL**
> Cek apakah PostgreSQL sedang berjalan: `sudo systemctl status postgresql`
> Pastikan username, password, dan nama database di `.env` sudah benar.

**Q: Website tidak bisa diakses dari browser**
> Cek apakah Nginx sudah jalan: `sudo systemctl status nginx`
> Cek apakah port 80/443 sudah dibuka di firewall VPS.

**Q: Login admin gagal terus**
> Mungkin tabel users kosong. Restart API server, lalu coba login lagi — admin default akan dibuat otomatis.

**Q: OTP WhatsApp tidak terkirim**
> Pastikan token Fonnte sudah diisi di pengaturan admin. Kalau token kosong, OTP hanya tampil di layar (mode simulasi/testing).

---

## 📁 Struktur Folder

```
ketantech-vpn/
├── artifacts/
│   ├── api-server/     → Backend API (Express + Node.js)
│   └── vpn-web/        → Frontend website (React + Vite)
├── lib/
│   ├── db/             → Schema database (Drizzle ORM)
│   ├── api-spec/       → Definisi API (OpenAPI)
│   └── api-client-react/ → Hooks React untuk API
└── botvpn-fixed/       → Bot Telegram (terpisah)
```

---

## 📞 Butuh Bantuan?

Jika ada kendala dalam instalasi atau penggunaan, silakan buka issue di GitHub atau hubungi tim KETANTECH.

---

*Dibuat dengan ❤️ oleh KETANTECH — Platform VPN Store Indonesia*
