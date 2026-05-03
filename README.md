# KETANTECH VPN Store

Platform penjualan VPN berbasis web lengkap — dashboard user, panel admin, verifikasi WhatsApp, pembayaran QRIS otomatis, dan bot Telegram. Landing page menampilkan server yang tersedia (lokasi, protokol) tanpa harga — harga hanya terlihat setelah pengguna login.

---

## Fitur Unggulan

**Untuk Pengguna:**
- Registrasi dengan verifikasi WhatsApp (OTP via Fonnte); cek ketersediaan username real-time saat daftar
- Login menggunakan **username atau nomor WhatsApp** (terdeteksi otomatis)
- Lupa password? Reset via OTP WhatsApp langsung dari halaman login
- Beli VPN, perpanjang akun, kelola saldo
- Pembayaran QRIS otomatis (AutoGoPay) — akun VPN aktif langsung setelah bayar
- Notifikasi kedaluwarsa akun VPN via WhatsApp dan Telegram (H-3 dan H-1)
- **Program Referral** — bagikan kode referral, dapat bonus saldo setiap ada yang daftar dan beli via kode kamu
- **Program Reseller** — beli VPN dengan harga lebih murah (diskon khusus reseller), jual ke siapa saja dengan harga markup sendiri; bisa jadi reseller otomatis cukup dengan topup sekali
- **Sistem Poin / Loyalty** — kumpulkan poin dari setiap pembelian, tukarkan menjadi saldo atau diskon
- **Tiket Bantuan** — buka tiket dukungan langsung dari dashboard, admin membalas dari panel admin
- **Pengumuman Admin** — banner pengumuman penting muncul otomatis di dashboard saat ada info dari admin

**Untuk Admin:**
- Dashboard statistik lengkap (revenue harian/bulanan, pengguna, order, topup) dengan grafik
- Kelola pengguna, produk, server, order, topup, akun VPN
- **Aksi Massal (Bulk Actions)** — pilih banyak akun/user sekaligus untuk diproses sekaligus
- **Ekspor Laporan** — ekspor data order dan topup ke format CSV
- **Live Server Monitor** — pantau penggunaan CPU, RAM, dan disk setiap server VPN secara real-time
- **Auto-Disable Server** — server otomatis nonaktif dari pilihan pembelian jika akun aktif sudah mencapai batas kapasitas (`maxAccounts`)
- **Sistem Tiket Bantuan** — balas tiket user langsung dari panel admin
- **Sistem Voucher / Kode Promo** — buat kode diskon dengan batas kuota dan waktu berlaku
- **Sistem Poin** — atur konversi poin dan tukar poin user menjadi saldo
- **Pengumuman** — buat pengumuman yang muncul otomatis sebagai banner di dashboard user
- Konfigurasi payment gateway (AutoGoPay QRIS), WhatsApp OTP (Fonnte), Telegram bot
- **Program Referral** — aktifkan/nonaktifkan, atur nominal bonus referral
- **Program Reseller** — atur diskon harga beli, target penjualan bulanan, banner promosi di panel user, auto-upgrade reseller via topup otomatis
- Notifikasi kedaluwarsa VPN otomatis (WhatsApp + Telegram, jam kirim bisa diatur)
- Broadcast pesan ke semua pengguna yang sudah sambungkan Telegram
- Backup & restore database otomatis via Telegram

---

## Panduan Instalasi di VPS (Ubuntu/Debian)

> Panduan ini ditulis untuk pemula. Ikuti setiap langkah secara berurutan dan jangan ada yang dilewati.

---

### Langkah 1 — Siapkan Server

Pastikan VPS kamu menggunakan Ubuntu 20.04 / 22.04 atau Debian 11/12. Login sebagai `root` via SSH.

Update sistem dulu:

```bash
apt update && apt upgrade -y
```

---

### Langkah 2 — Install Node.js

> Project ini membutuhkan **Node.js versi 22 ke atas**. Jangan gunakan versi lama seperti v18 atau v20 karena bisa menyebabkan error.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
```

Cek apakah berhasil (harus muncul angka `v22.x.x` atau lebih):

```bash
node --version
```

---

### Langkah 3 — Install pnpm

```bash
npm install -g pnpm
```

Cek versi:

```bash
pnpm --version
```

---

### Langkah 4 — Install PostgreSQL

```bash
apt install -y postgresql postgresql-contrib postgresql-client
systemctl start postgresql
systemctl enable postgresql
```

Cek apakah PostgreSQL sudah berjalan (harus muncul `active (running)`):

```bash
systemctl status postgresql
```

Tekan `Q` untuk keluar dari tampilan status.

---

### Langkah 5 — Buat Database dan User PostgreSQL

Masuk ke PostgreSQL sebagai user postgres:

```bash
sudo -u postgres psql
```

Kamu akan masuk ke mode PostgreSQL yang ditandai dengan prompt `postgres=#`.

Jalankan perintah-perintah berikut **satu per satu**, ganti `PASSWORD_KAMU` dengan password yang kuat:

```sql
CREATE USER ketantech WITH PASSWORD 'PASSWORD_KAMU';
CREATE DATABASE ketantech_db OWNER ketantech;
GRANT ALL PRIVILEGES ON DATABASE ketantech_db TO ketantech;
\q
```

Tanda `\q` untuk keluar dari PostgreSQL. Kamu akan kembali ke terminal biasa.

> **Catat baik-baik:** username (`ketantech`), password, dan nama database (`ketantech_db`) — akan digunakan di langkah berikutnya.

---

### Langkah 6 — Install PM2

PM2 adalah aplikasi yang menjaga server tetap berjalan meskipun terminal ditutup atau VPS restart.

```bash
npm install -g pm2
```

---

### Langkah 7 — Download Project

> **Ganti URL di bawah** dengan URL repository GitHub project kamu yang sesungguhnya. Buka GitHub-mu, klik tombol hijau "Code", salin HTTPS URL-nya, lalu tempelkan di sini.

```bash
cd /var/www
git clone https://github.com/USERNAME_KAMU/NAMA_REPO_KAMU.git ketantech-vpn
cd ketantech-vpn
```

---

### Langkah 8 — Install Semua Dependensi Project

```bash
pnpm install
```

Proses ini bisa memakan waktu 2-5 menit. Tunggu sampai selesai dan kembali ke prompt normal.

---

### Langkah 9 — Buat File Konfigurasi (.env)

File `.env` berisi semua pengaturan penting aplikasi. Buat file ini dengan perintah:

```bash
nano /var/www/ketantech-vpn/.env
```

Salin dan tempelkan isi berikut ke dalam editor (tekan klik kanan untuk paste di terminal):

```
DATABASE_URL=postgresql://ketantech:PASSWORD_KAMU@localhost:5432/ketantech_db
SESSION_SECRET=GANTI_DENGAN_STRING_ACAK_PANJANG
NODE_ENV=production
PORT=8080
TURNSTILE_SECRET_KEY=ISI_DARI_CLOUDFLARE
TURNSTILE_FAIL_OPEN=false
```

**Ganti dua bagian ini:**

- `PASSWORD_KAMU` → password PostgreSQL yang kamu buat di Langkah 5
- `GANTI_DENGAN_STRING_ACAK_PANJANG` → buat string acak dengan perintah ini (buka terminal baru, jalankan, lalu salin hasilnya):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Contoh hasil yang benar (angka/huruf acak sepanjang ini):

```
a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

Setelah selesai mengisi, simpan file dengan menekan:
- **Ctrl + X**
- Lalu tekan **Y**
- Lalu tekan **Enter**

Verifikasi isi file sudah benar:

```bash
cat /var/www/ketantech-vpn/.env
```

Pastikan `DATABASE_URL` sudah berisi password yang benar dan `SESSION_SECRET` sudah terisi string panjang (bukan kata `GANTI_DENGAN_STRING_ACAK_PANJANG`).

Untuk keamanan login anti-bot (Cloudflare Turnstile):
- `TURNSTILE_SECRET_KEY` → diambil dari Cloudflare Dashboard > Turnstile (bagian Secret Key)
- `TURNSTILE_FAIL_OPEN=false` → mode paling aman (jika Turnstile tidak bisa diverifikasi, login ditolak)

---

### Langkah 10 — Setup Database (Buat Tabel)

> **PENTING:** Langkah ini wajib dilakukan setelah file `.env` sudah benar. Perintah di bawah menyertakan DATABASE_URL secara eksplisit agar tidak bergantung pada cara shell membaca `.env`.

Masuk ke folder project terlebih dahulu:

```bash
cd /var/www/ketantech-vpn
```

Ganti `PASSWORD_KAMU` dan `ketantech_db` sesuai yang kamu set di Langkah 5, lalu jalankan:

```bash
DATABASE_URL="postgresql://ketantech:PASSWORD_KAMU@localhost:5432/ketantech_db" pnpm --filter @workspace/db run push
```

**Contoh nyata** (dengan password `maduTJ150` dan database `ketantech_db`):

```bash
DATABASE_URL="postgresql://ketantech:maduTJ150@localhost:5432/ketantech_db" pnpm --filter @workspace/db run push
```

Kalau berhasil, akan muncul pesan seperti ini:

```
Reading config file '...'
Using 'pg' driver for database querying
[✓] Changes applied
```

Kalau masih ada error, baca bagian **Troubleshooting** di bawah.

---

### Langkah 11 — Build Aplikasi

Pastikan kamu berada di folder project:

```bash
cd /var/www/ketantech-vpn
```

Build backend API:

```bash
pnpm --filter @workspace/api-server run build
```

Build frontend website:

```bash
pnpm --filter @workspace/vpn-web run build
```

Kedua proses ini akan memakan waktu 1-3 menit. Tunggu sampai kembali ke prompt `#` sebelum melanjutkan.

---

### Langkah 12 — Jalankan Aplikasi dengan PM2

**Pertama, buat SESSION_SECRET** (string acak untuk keamanan sesi login). Jalankan perintah ini dan **catat hasilnya**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Contoh output (punya kamu akan berbeda, itu normal):
```
a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
```

Salin string panjang itu, lalu buat file konfigurasi PM2:

```bash
nano /var/www/ketantech-vpn/ecosystem.config.cjs
```

Tempelkan isi berikut ke dalam editor. **Ganti tiga bagian ini sebelum menyimpan:**
- `PASSWORD_KAMU` → password PostgreSQL dari Langkah 5
- `ketantech_db` → nama database dari Langkah 5 (jika kamu tidak mengubahnya, biarkan `ketantech_db`)
- `SESSION_SECRET_KAMU` → string panjang acak yang baru saja kamu catat

```javascript
module.exports = {
  apps: [
    {
      name: "ketantech-api",
      script: "node",
      args: "--enable-source-maps artifacts/api-server/dist/index.mjs",
      cwd: "/var/www/ketantech-vpn",
      env: {
        NODE_ENV: "production",
        PORT: "8080",
        DATABASE_URL: "postgresql://ketantech:PASSWORD_KAMU@localhost:5432/ketantech_db",
        SESSION_SECRET: "SESSION_SECRET_KAMU",
        CORS_ORIGIN: "https://DOMAIN_ATAU_IP",
        TRUSTED_PROXIES: "127.0.0.1,::1",
        TURNSTILE_SECRET_KEY: "ISI_DARI_CLOUDFLARE",
        TURNSTILE_FAIL_OPEN: "false"
      }
    }
  ]
}
```

> **Ganti `DOMAIN_ATAU_IP`** dengan domain atau IP VPS kamu, contoh: `https://vpn.ketanx.com` atau `http://68.183.230.134`. Ini untuk keamanan agar API hanya bisa diakses dari website kamu sendiri.
>
> **Catatan `TRUSTED_PROXIES`:**
> - Jika API di belakang Nginx pada server yang sama, gunakan `127.0.0.1,::1`.
> - Jangan set ke nilai longgar seperti `true` karena rawan spoofing `X-Forwarded-For`.

### Konfigurasi Frontend untuk Turnstile

Tambahkan Site Key Turnstile ke frontend (`artifacts/vpn-web/.env.production`):

```bash
nano /var/www/ketantech-vpn/artifacts/vpn-web/.env.production
```

Isi file:

```env
VITE_TURNSTILE_SITE_KEY=ISI_SITE_KEY_DARI_CLOUDFLARE
```

Lalu build ulang frontend:

```bash
cd /var/www/ketantech-vpn
pnpm --filter @workspace/vpn-web run build
```

Simpan dengan **Ctrl+X**, lalu **Y**, lalu **Enter**.

Verifikasi isinya sudah benar (pastikan tidak ada tulisan `PASSWORD_KAMU` atau `SESSION_SECRET_KAMU` yang belum diganti):

```bash
cat /var/www/ketantech-vpn/ecosystem.config.cjs
```

Jalankan aplikasi:

```bash
cd /var/www/ketantech-vpn
pm2 start ecosystem.config.cjs
pm2 save
```

Simpan agar otomatis jalan saat VPS restart:

```bash
pm2 startup
```

Perintah `pm2 startup` akan menampilkan sebuah perintah panjang yang harus kamu **salin dan jalankan**. Contohnya:

```
[PM2] To setup the startup script, copy/paste the following command:
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root
```

Salin seluruh baris `sudo env ...` tersebut dan jalankan.

---

### Langkah 13 — Cek Apakah Server Berjalan

```bash
pm2 status
```

Harus muncul tabel dengan `ketantech-api` berstatus `online`.

Lihat log untuk memastikan tidak ada error:

```bash
pm2 logs ketantech-api --lines 30
```

> **Catatan penting:** Perintah `pm2 logs` menampilkan log lama dan log baru secara bersamaan. **Perhatikan baris paling bawah** — itulah kondisi terkini. Abaikan error yang muncul di baris atas jika baris bawah sudah menunjukkan sukses.

Kalau berhasil, baris-baris **paling bawah** akan terlihat seperti ini:

```
[CONFIG] Semua konfigurasi kritis tersedia.
Server listening port: 8080
Default admin created — username: admin, password: admin123
Scheduler notifikasi kedaluwarsa aktif (cek setiap jam)
Scheduler auto-backup aktif (cek setiap jam)
```

> Jika muncul baris `[CONFIG] WARN` — baca pesan peringatannya. Biasanya karena `SESSION_SECRET` belum diset atau terlalu pendek, atau `CORS_ORIGIN` belum diisi di production. Perbaiki di `ecosystem.config.cjs` lalu jalankan `pm2 restart ketantech-api`.

Tekan **Ctrl+C** untuk keluar dari tampilan log.

Kalau baris paling bawah masih menampilkan error `relation "users" does not exist` → berarti Langkah 10 (setup database) belum berhasil. Ulangi Langkah 10 lalu jalankan `pm2 restart ketantech-api`.

---

### Langkah 14 — Install dan Konfigurasi Nginx

Nginx bertugas meneruskan request dari browser ke aplikasi kamu.

```bash
apt install -y nginx
```

Hapus konfigurasi default:

```bash
rm /etc/nginx/sites-enabled/default
```

Buat konfigurasi baru. Sebelum menjalankan perintah ini, tentukan dulu apakah kamu memakai **domain** atau **IP langsung**:

- Jika pakai domain: ganti `DOMAIN_ATAU_IP` dengan domain kamu, contoh: `vpn.ketanx.com`
- Jika belum punya domain: ganti `DOMAIN_ATAU_IP` dengan IP VPS kamu, contoh: `68.183.230.134`

```bash
nano /etc/nginx/sites-available/ketantech
```

Salin dan tempelkan isi berikut, **ganti `DOMAIN_ATAU_IP`** sebelum menyimpan:

```nginx
server {
    listen 80;
    server_name DOMAIN_ATAU_IP;

    # Ukuran upload file maksimal (untuk fitur restore database)
    client_max_body_size 100M;

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
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Simpan dengan **Ctrl+X**, **Y**, **Enter**.

Aktifkan konfigurasi dan restart Nginx:

```bash
ln -s /etc/nginx/sites-available/ketantech /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Perintah `nginx -t` harus menampilkan `syntax is ok` dan `test is successful`. Kalau ada error, periksa kembali isi file konfigurasi.

---

### Langkah 15 — Buka Firewall

> ⚠️ **PERINGATAN PENTING — Baca dulu sebelum menjalankan perintah ini!**
>
> Kesalahan di langkah ini adalah **penyebab VPS tidak bisa diakses via SSH**. Wajib dijalankan **berurutan** — jangan langsung `ufw enable` tanpa membuka port SSH terlebih dahulu.
>
> Beberapa provider VPS (Hetzner, Hostinger, dll.) sudah memiliki firewall tersendiri di panel kontrol. Cek panel kontrol provider-mu terlebih dahulu dan pastikan port 22, 80, 443 sudah dibuka di sana sebelum mengaktifkan UFW.

Cek apakah UFW sudah aktif sebelumnya:

```bash
ufw status
```

Kalau statusnya `Status: inactive`, lanjutkan ke perintah di bawah. Kalau sudah `active`, skip perintah `ufw enable`.

**Jalankan perintah berikut SATU PER SATU — jangan digabung:**

```bash
ufw allow 22
```

```bash
ufw allow 80
```

```bash
ufw allow 443
```

Pastikan ketiga perintah di atas berhasil (muncul `Rules updated`) **sebelum** menjalankan yang ini:

```bash
ufw enable
```

Ketik `y` dan Enter ketika diminta konfirmasi.

Cek hasilnya:

```bash
ufw status
```

Harus muncul:
```
To          Action      From
--          ------      ----
22          ALLOW       Anywhere
80          ALLOW       Anywhere
443         ALLOW       Anywhere
```

> **Jika VPS terkunci (tidak bisa SSH setelah `ufw enable`):** Gunakan fitur **Console/VNC** dari panel kontrol provider VPS-mu (Hetzner Cloud Console, DigitalOcean Console, Vultr Console, dll.) untuk masuk tanpa SSH. Setelah masuk via console, jalankan: `ufw disable` untuk menonaktifkan firewall sementara, lalu pastikan `ufw allow 22` sudah dijalankan sebelum `ufw enable` lagi.

---

### Langkah 16 — SSL / HTTPS (Jika Punya Domain)

> Langkah ini hanya bisa dilakukan jika kamu **sudah punya domain** dan DNS-nya sudah diarahkan ke IP VPS. Jika belum, lewati langkah ini.

Sebelum menjalankan certbot, pastikan domain kamu sudah bisa diakses (cek dengan `ping namadomain-kamu.com` — harus muncul IP VPS kamu).

Ganti `namadomain-kamu.com` di bawah dengan **domain kamu yang sesungguhnya** (contoh: `vpn.ketanx.com`):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d namadomain-kamu.com
```

Ikuti instruksi yang muncul (isi email, setujui syarat). Certbot akan otomatis mengurus sertifikat SSL.

---

### Selesai! Cara Login Pertama Kali

Buka browser dan akses:

```
http://DOMAIN_ATAU_IP_VPS
```

**Akun admin bawaan:**

| Username | Password |
|---|---|
| admin | admin123 |

**WAJIB:** Segera ganti password admin setelah login pertama! Masuk ke menu **Profil** untuk menggantinya.

---

## Konfigurasi Setelah Install

Login sebagai admin dan lakukan pengaturan berikut:

### Tambah Server VPN
Menu: **Admin → Server → Tambah Server**
- Isi URL API panel VPN (contoh: `http://152.42.xxx.xxx`)
- Isi Bearer token dari panel VPN

### Tambah Produk VPN
Menu: **Admin → Produk → Tambah Produk**
- Pilih server, protokol (SSH/VMess/VLess/Trojan/Shadowsocks), durasi, harga
- Isi **Stok** — jumlah maksimal akun VPN yang bisa aktif bersamaan untuk produk ini
- Jika stok habis, tombol beli di halaman user otomatis disabled dan tampil "Stok Habis"

### WhatsApp OTP (Fonnte)
Menu: **Admin → WhatsApp OTP**
- Daftar di [fonnte.com](https://fonnte.com), hubungkan nomor WhatsApp
- Salin token API dan isi di form

### Payment QRIS (AutoGoPay) — Opsional
Menu: **Admin → Payment Gateway**
- Isi API URL dan Secret Key dari AutoGoPay
- Daftarkan webhook di dashboard AutoGoPay:
  ```
  https://domain-kamu.com/api/webhooks/autogopay
  ```

### Telegram Bot — Opsional
Menu: **Admin → Notifikasi Telegram**
- Buat bot via [@BotFather](https://t.me/BotFather)
- Isi token bot dan Chat ID admin

### Notifikasi Kedaluwarsa Akun VPN
Menu: **Admin → Notifikasi Kedaluwarsa**
- Aktifkan notif H-3 dan/atau H-1 sebelum akun VPN habis
- Pilih jam pengiriman notifikasi — **sistem menggunakan WIB (Waktu Indonesia Barat)**
- Jika kamu tinggal di zona waktu berbeda, sesuaikan:
  - **WIT (Waktu Indonesia Timur)** → pilih jam dikurangi 2 (contoh: mau kirim jam 09.00 WIT, pilih 07.00 WIB)
  - **WITA (Waktu Indonesia Tengah)** → pilih jam dikurangi 1

### Program Referral — Opsional
Menu: **Admin → Program Referral**
- Aktifkan toggle "Program Referral Aktif"
- Atur nominal bonus saldo yang diterima referrer saat referral-nya pertama kali beli
- Setiap user punya kode referral unik di halaman Profil mereka
- Kode referral bisa diisi saat registrasi di kolom "Kode Referral" (opsional)

### Program Reseller — Opsional
Menu: **Admin → Program Reseller**
- Aktifkan toggle "Sistem Reseller Aktif" dan atur **% diskon** harga beli reseller
- **Target Penjualan Bulanan** *(opsional)*: aktifkan dan atur nominal minimum penjualan per bulan — reseller yang tidak capai target di evaluasi tiap tanggal 1 akan otomatis diturunkan
- **Auto-Upgrade via Topup** *(opsional)*: user biasa yang topup sekali dengan nominal ≥ minimum langsung otomatis jadi reseller, tanpa perlu ajukan manual
- **Promosi di Panel User** *(opsional)*: aktifkan banner promosi di dashboard dan profil user biasa — tampilkan keuntungan, syarat masuk, dan syarat aktif secara transparan; user bisa klik ajukan langsung dari panel

> **Catatan:** Semua fitur reseller bersifat opsional dan bisa diaktifkan/nonaktifkan secara terpisah sesuai kebutuhan bisnis kamu.

### Sistem Poin / Loyalty — Opsional
Menu: **Admin → Pengaturan Poin**
- Aktifkan sistem poin dan atur berapa poin yang didapat per Rp 1.000 pembelian
- Atur nilai tukar: berapa poin setara Rp 1 saldo
- User bisa tukar poin menjadi saldo langsung dari menu **Poin** di dashboard mereka

### Voucher / Kode Promo — Opsional
Menu: **Admin → Voucher** *(dikelola langsung dari panel admin)*
- Buat kode promo dengan nominal diskon (Rp atau %) dan batas kuota pemakaian
- User bisa memasukkan kode voucher saat checkout untuk mendapatkan diskon
- Cocok untuk campaign marketing musiman (Lebaran, Tahun Baru, dll.)

### Pengumuman ke User
Menu: **Admin → Pengumuman**
- Buat pengumuman yang tampil sebagai banner di dashboard semua user
- Bisa dinonaktifkan kapan saja tanpa menghapusnya

### Tiket Bantuan
Sistem tiket aktif otomatis — tidak ada konfigurasi khusus yang diperlukan.
- User bisa buka tiket dari menu **Tiket** di dashboard mereka
- Admin membalas dari menu **Admin → Tiket**
- Notifikasi balasan admin bisa dikirim via Telegram jika bot sudah dikonfigurasi

### Backup Database Otomatis
Menu: **Admin → Backup & Restore DB**
- Aktifkan auto backup dan pilih interval (6/12/24 jam)
- Backup otomatis dikirim ke Telegram admin
- **Safety backup otomatis sebelum restore** — setiap kali kamu menekan Restore, sistem akan otomatis backup kondisi database saat itu terlebih dahulu (disimpan dengan nama `pre-restore-TANGGAL-JAM.sql.gz` dan dikirim ke Telegram). Jika backup pengaman ini gagal, proses restore dibatalkan otomatis untuk melindungi data.
- Pastikan bot Telegram sudah dikonfigurasi agar backup tersimpan secara permanen — file di server akan hilang jika server restart/redeploy

---

## Perintah Berguna Sehari-hari

```bash
# Lihat status semua proses
pm2 status

# Lihat log real-time
pm2 logs ketantech-api

# Restart aplikasi (misalnya setelah update)
pm2 restart ketantech-api

# Update aplikasi dari GitHub (command lengkap — wajib urut seperti ini)
cd /var/www/ketantech-vpn && git pull origin main && pnpm install && DATABASE_URL="postgresql://ketantech:PASSWORD_KAMU@localhost:5432/ketantech_db" pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/vpn-web run build && pm2 restart ketantech-api
```

---

## Troubleshooting (Solusi Masalah Umum)

**Error: `database "nama_database" does not exist`**
> Kamu menggunakan nama `nama_database` secara harfiah. Ganti dengan nama database yang benar, yaitu `ketantech_db` (atau nama yang kamu buat di Langkah 5).

**Error: `DATABASE_URL, ensure the database is provisioned`**
> Drizzle Kit tidak membaca file `.env` secara otomatis. Solusi: tambahkan DATABASE_URL secara eksplisit di depan perintah:
> ```bash
> DATABASE_URL="postgresql://ketantech:PASSWORD_KAMU@localhost:5432/ketantech_db" pnpm --filter @workspace/db run push
> ```
> Gunakan juga command deploy lengkap yang sudah menyertakan DATABASE_URL (lihat bagian Perintah Berguna Sehari-hari).

**Error: `relation "users" does not exist`**
> Tabel database belum dibuat. Jalankan Langkah 10 (Setup Database) dengan benar, pastikan tidak ada error, lalu restart PM2 dengan `pm2 restart ketantech-api`.

**Error: `password authentication failed for user "ketantech"`**
> Password di `DATABASE_URL` salah. Periksa isi file `.env` dan `ecosystem.config.cjs`. Pastikan password sama dengan yang dibuat di Langkah 5.

**Error: `ECONNREFUSED 127.0.0.1:5432`**
> PostgreSQL tidak berjalan. Jalankan: `systemctl start postgresql`

**Website tidak bisa diakses dari browser**
> 1. Cek Nginx: `systemctl status nginx`
> 2. Cek PM2: `pm2 status`
> 3. Cek firewall: `ufw status`
> 4. Pastikan nama domain/IP di konfigurasi Nginx sudah benar

**Login admin gagal terus**
> Cek log PM2 dengan `pm2 logs ketantech-api`. Kalau ada error database, selesaikan masalah database terlebih dahulu.

**Lupa password admin**
> Gunakan fitur "Lupa Password" di halaman login — masukkan nomor WhatsApp yang terdaftar untuk menerima OTP reset password. Pastikan token Fonnte sudah diisi di menu Admin → WhatsApp OTP agar OTP bisa terkirim.

**OTP WhatsApp tidak terkirim**
> Pastikan token Fonnte sudah diisi di menu Admin → WhatsApp OTP. Tanpa token, OTP hanya tampil di layar (mode simulasi).

**QRIS dibayar tapi order tidak terkonfirmasi otomatis**
> Webhook URL belum didaftarkan di AutoGoPay. Daftarkan:
> `https://domain-kamu.com/api/webhooks/autogopay`

---

## Struktur Folder

```
ketantech-vpn/
├── artifacts/
│   ├── api-server/       → Backend API (Express + Node.js)
│   └── vpn-web/          → Frontend website (React + Vite)
│       └── dist/public/  → Hasil build frontend (diserve Nginx)
├── lib/
│   ├── db/               → Skema database (Drizzle ORM)
│   ├── api-spec/         → Definisi API (OpenAPI)
│   └── api-client-react/ → Hooks React untuk API
├── ecosystem.config.cjs  → Konfigurasi PM2
└── .env                  → Variabel konfigurasi (jangan di-upload ke GitHub!)
```

---

*KETANTECH VPN Store — Platform VPN Store Indonesia*
