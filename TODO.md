# 📋 KETANTECH VPN - Rencana Pengembangan (TODO)

Daftar fitur *"Next-Level"* yang akan dikembangkan untuk meningkatkan otomatisasi dan mempermudah layanan kepada pelanggan.

- [x] **1. Auto-Cleanup Topup Menggantung (Maintenance)**
  Sistem otomatis untuk membatalkan topup manual (Bank/E-Wallet) yang berstatus *pending* lebih dari 24 jam agar database dan antrean panel Admin tetap bersih.
  *Tingkat Risiko: Sangat Rendah*

- [~] **2. Alarm "Saldo Sekarat" untuk Reseller** *(Dibatalkan)*
  Robot pengingat otomatis via Telegram/WA untuk menyenggol Reseller jika saldo mereka berada di bawah batas kritis (misal: Rp 20.000).
  *Tingkat Risiko: Rendah*

- [x] **3. Menu "Tiket Support" Interaktif di Telegram**
  Antarmuka tombol (Inline Menu) di Telegram `/admin` untuk melihat daftar keluhan (tiket) berstatus "Open" dan membalasnya secara langsung (tanpa perlu mengetik `/reply_ID` secara manual).
  *Tingkat Risiko: Menengah*

- [x] **4. Fitur Trial 1 Jam (Marketing)**
  Fitur khusus agar pengguna baru bisa membuat akun VPN uji coba gratis dengan durasi 1 Jam (dibatasi 1 user = 1 trial) untuk meyakinkan calon pelanggan.
  *Tingkat Risiko: Menengah - Tinggi (Membutuhkan perubahan logika provisioning)*

- [x] **5. Kompensasi Saldo (Gift Balance) via Telegram**
  Fitur untuk menambahkan saldo secara manual ke pengguna sebagai bentuk kompensasi (misal karena komplain). Admin mengetik perintah `/gift <username> <nominal>` di bot Telegram.
  *Tingkat Risiko: Sangat Rendah*

- [x] **6. Kompensasi Waktu Massal (Extend Server) via Telegram**
  Fitur cerdas untuk menambah masa aktif seluruh akun VPN aktif di sebuah server yang bermasalah. Termasuk proteksi *anti-spam* panel dan pelaporan via telegram background-job.
  *Tingkat Risiko: Menengah*

- [x] **13. System Diagnostics (Menu Admin Telegram)** ✅
  Menu **🔧 System Test** di bot Telegram `/admin` untuk mengecek kesehatan semua integrasi dengan 1 klik: Database, Telegram Bot, WhatsApp (Fonnte), Payment Gateway (AutoGoPay), dan semua VPN Panel Server.
  *Tingkat Risiko: Sangat Rendah*
  *✅ Selesai — 1 Mei 2026. Tes berjalan paralel, laporan real-time, tombol tes ulang. Merchant ID dihapus dari pengecekan (tidak dipakai di flow webhook).*

- [x] **14. VPS Resource Monitor (Menu Admin Telegram)** ✅
  Menu **📊 VPS Monitor** di bot Telegram `/admin` untuk memantau resource VPS secara real-time: CPU Load & Usage, RAM, Disk, Uptime (VPS & App), dan Node.js Memory. Termasuk visual progress bar dan threshold warning (🟢/🟡/🔴).
  *Tingkat Risiko: Sangat Rendah (read-only, tidak mengubah apa pun)*
  *✅ Selesai — 1 Mei 2026.*

- [x] **15. Alert Otomatis (Proactive Monitoring)** ✅
  Bot **otomatis kirim pesan** ke admin Telegram setiap 15 menit jika terdeteksi: RAM/CPU/Disk > threshold, Fonnte disconnect, atau VPN Panel down. Termasuk cooldown 30 menit agar tidak spam.
  *Tingkat Risiko: Sangat Rendah (read-only monitoring)*
  *✅ Selesai — 1 Mei 2026.*

- [x] **16. Laporan Harian Otomatis** ✅
  Bot otomatis kirim ringkasan harian ke admin Telegram setiap jam **08.00 WIB**: revenue kemarin, user baru, total user, akun VPN aktif, akun expired hari ini & 3 hari ke depan, topup pending.
  *Tingkat Risiko: Sangat Rendah (read-only, otomatis)*
  *✅ Selesai — 1 Mei 2026.*

## 🛠️ Fase Pembersihan Kode (Technical Debt & Refactoring)

Penyelesaian *error* TypeScript yang menumpuk agar performa dan stabilitas aplikasi lebih terjaga untuk pengembangan ke depan.

- [x] **1. Frontend: Perbaikan React Query (v5 Migration)**
  Memperbaiki semua rute pemanggilan API di *frontend* yang mengalami *error* `Property 'queryKey' is missing` akibat ketidakcocokan tipe parameter di React Query.

- [x] **2. Frontend: Perbaikan Animasi Framer Motion**
  Memperbaiki *error* tipe data pada konfigurasi `ease` di komponen *Home* (Sultan Glassmorphism).

- [x] **3. Backend: Perbaikan Tipe Data Query Parameter**
  Memperbaiki penanganan `string | string[]` dari Express query/params parameter agar aman dari potensi *crash* (di rute tickets, vouchers, accounts, dsb).

- [x] **4. Backend: Perbaikan Tipe Objek Telegram Admin**
  Menghapus/menyesuaikan *property* `uuid` yang menyebabkan *error* TypeScript pada fungsi sinkronisasi *server* VPN di `/admin`.

- [x] **5. Backend: Penyelesaian "Implicit Any"**
  Menambahkan tipe eksplisit pada *handler request/reply* dan variabel yang saat ini masih `any` di rute-rute *backend*.

---

## 🚀 Fase 3: Fitur Lanjutan & Peningkatan Layanan

Fitur-fitur baru untuk meningkatkan kualitas produk, akuisisi user, dan keamanan sistem.

### 🔴 Prioritas Tinggi

- [x] **7. Redesign Landing Page & SEO** ✅
  Upgrade tampilan halaman depan agar lebih menarik untuk akuisisi user baru. Optimasi meta tags, heading structure, dan performa loading.
  *Tingkat Risiko: Rendah*
  *✅ Selesai — SEO: lang="id", title deskriptif, JSON-LD structured data, hapus font duplikat. Landing: +4 section baru (Statistik, Paket Populer, Cara Kerja, FAQ) + Footer 3 kolom.*

- [ ] **8. Notifikasi Email (Transaksional)**
  Konfirmasi topup, order selesai, dan akun VPN siap dikirim via email. Untuk user yang belum link Telegram/WA.
  *Tingkat Risiko: Rendah - Menengah*
  *⚠️ Kendala:*
  - *Butuh layanan SMTP (misal: Resend, Brevo, atau Gmail SMTP). Ada biaya jika volume tinggi.*
  - *Perlu penambahan kolom `emailVerified` di tabel users jika belum ada.*
  - *Rate-limiting SMTP agar tidak kena blacklist.*

### 🟡 Prioritas Sedang

- [ ] **9. Riwayat Login & Keamanan Akun**
  Log IP login terakhir, deteksi login dari perangkat/lokasi baru, dan opsional 2FA (TOTP via Google Authenticator).
  *Tingkat Risiko: Menengah*
  *⚠️ Kendala:*
  - *Butuh tabel baru `login_logs` di database → perlu `drizzle-kit push`.*
  - *2FA (TOTP) memerlukan library tambahan (`otplib` / `speakeasy`) dan UI scan QR code di frontend.*
  - *Harus diuji menyeluruh agar user tidak terkunci dari akunnya sendiri.*

- [ ] **10. Dashboard Analytics Lanjutan**
  Grafik retensi user, churn rate, revenue forecast, dan breakdown penjualan per produk/server.
  *Tingkat Risiko: Rendah*
  *⚠️ Kendala:*
  - *Query SQL yang kompleks bisa lambat jika data membesar → perlu indexing yang tepat.*
  - *Library charting di frontend (sudah pakai apa? Perlu cek kompatibilitas).*

### 🟢 Prioritas Rendah

- [ ] **11. Sistem Kupon/Promo Terjadwal**
  Diskon otomatis yang aktif di hari/jam tertentu (misal: weekend sale, flash sale malam). Admin set jadwal lewat panel.
  *Tingkat Risiko: Rendah*
  *⚠️ Kendala:*
  - *Logika timezone (WIB) di scheduler harus akurat agar promo tidak nyala di waktu yang salah.*
  - *Perlu validasi agar tidak bentrok dengan voucher yang sudah ada.*

- [ ] **12. Multi-bahasa (i18n)**
  Dukungan English & Bahasa Indonesia di seluruh frontend.
  *Tingkat Risiko: Rendah - Menengah*
  *⚠️ Kendala:*
  - *Effort besar: semua string hardcoded di frontend harus diekstrak ke file terjemahan.*
  - *Library i18n (react-i18next) perlu setup context provider di root app.*
  - *Sebaiknya dikerjakan terakhir setelah fitur lain stabil, agar tidak double-work.*

---

### 📌 Catatan Umum Sebelum Eksekusi

> **Database Migration:** Setiap fitur yang butuh tabel/kolom baru harus melalui `drizzle-kit push` di VPS. Selalu backup database dulu via fitur Backup Telegram sebelum push schema baru.

### 🗺️ Roadmap Eksekusi (Urutan yang Disepakati)

| Urutan | Fitur | Estimasi | Butuh DB Migration? | Prasyarat |
|:------:|-------|----------|:-------------------:|-----------|
| ~~①~~ | ~~**#7 Redesign Landing Page & SEO**~~ | ~~1-2 sesi~~ | ❌ | ✅ Selesai |
| ② | **#8 Notifikasi Email** | 2-3 sesi | ✅ (kolom `emailVerified`) | Pilih SMTP provider dulu (Resend/Brevo/Gmail) |
| ③ | **#10 Dashboard Analytics** | 1-2 sesi | ❌ | Cek library chart yang sudah dipakai di frontend |
| ④ | **#9 Login Security & 2FA** | 2-3 sesi | ✅ (tabel `login_logs`, kolom `totpSecret`) | Install `otplib`, siapkan UI QR code |
| ⑤ | **#11 Promo Terjadwal** | 1-2 sesi | ✅ (kolom jadwal di `vouchers`) | Pastikan scheduler timezone WIB sudah stabil |
| ⑥ | **#12 Multi-bahasa (i18n)** | 3-4 sesi | ❌ | Semua fitur lain harus stabil dulu |

> **Langkah selanjutnya:** Mulai **#8 Notifikasi Email** — pilih SMTP provider terlebih dahulu.

---

## 📝 Log Sesi Kerja

### 🗓️ 1 Mei 2026 (Sore)

**Yang dikerjakan:**

1. ✅ **#13 System Diagnostics — Menu Admin Telegram**
   - Menambahkan tombol **🔧 System Test** di menu `/admin`
   - Mengecek 5 integrasi secara paralel: Database, Telegram Bot, WhatsApp (Fonnte), Payment Gateway (AutoGoPay), VPN Panel (semua server)
   - Laporan lengkap dengan status (✅/⚠️/❌), latency, dan detail error
   - Tombol **🔄 Tes Ulang** untuk re-check tanpa ketik `/admin` lagi
   - File: `artifacts/api-server/src/lib/telegram-admin.ts`

2. ✅ **Fix: Hapus Pengecekan Merchant ID di Diagnostik**
   - `autoGopayMerchantId` adalah dead config — tidak dipakai di flow webhook AutoGoPay
   - Diagnostik sekarang hanya cek **API URL** + **Secret Key** (yang memang dipakai)
   - Admin panel UI juga memang tidak punya field Merchant ID

3. 🎨 **Eksplorasi Logo Bot Telegram**
   - Generate beberapa opsi logo (shield, globe, monogram KT)
   - Diskusi prinsip logo permanen: simpel, timeless, scalable, unik
   - Rekomendasi: **Monogram KT flat** sebagai identitas jangka panjang
   - Belum final — user masih memilih

### 🗓️ 1 Mei 2026 (Malam)

**Yang dikerjakan:**

4. ✅ **#14 VPS Resource Monitor — Menu Admin Telegram**
   - Tombol **📊 VPS Monitor** di menu `/admin`
   - Info CPU (load average, cores, model, usage %), RAM, Disk, Uptime VPS & App, Node.js heap
   - Visual progress bar (`████████░░░░`) + threshold warning (🟢 Normal / 🟡 Warning / 🔴 Kritis)
   - Tombol **🔄 Refresh** untuk update real-time
   - Menggunakan Node.js `os` module + `child_process` (read-only, tanpa library tambahan)
   - File: `artifacts/api-server/src/lib/telegram-admin.ts`

5. ✅ **#15 Alert Otomatis (Proactive Monitoring)**
   - Scheduler berjalan setiap **15 menit**, cek: RAM, CPU, Disk, Fonnte, semua VPN Panel
   - Otomatis kirim 🚨 alert ke admin Telegram jika ada masalah
   - Threshold: 🟢 < 80% → 🟡 80-90% → 🔴 > 90%
   - Cooldown 30 menit per alert agar tidak spam
   - File: `artifacts/api-server/src/lib/scheduler.ts`

6. ✅ **#16 Laporan Harian Otomatis**
   - Otomatis kirim setiap **jam 08.00 WIB** ke admin Telegram
   - Isi: revenue kemarin, user baru, total user, akun VPN aktif, expired hari ini & 3 hari, topup pending
   - Perlindungan anti kirim ganda (1x per hari)
   - File: `artifacts/api-server/src/lib/scheduler.ts`

---

## 🔍 Catatan Audit Keamanan (2 Mei 2026)

### A. Auth (sudah diaudit)

- [x] **[Critical]** Endpoint `POST /admin/telegram/register-webhook` sudah diganti dari `requireAuth` ke `requireAdmin`.
  - Dampak: user login biasa bisa trigger aksi admin Telegram webhook.
  - File: `artifacts/api-server/src/routes/telegram-bot.ts`

- [x] **[High]** Token JWT sudah pakai mekanisme revocation berbasis `sessionVersion` user.
  - Dampak: token lama tetap valid sampai expiry meskipun user logout, password direset, atau akun diubah status.
  - File: `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/routes/auth.ts`

- [x] **[High]** `requireAuth` sudah validasi `isActive` user ke database.
  - Dampak: user suspended yang masih pegang token bisa tetap akses endpoint protected sampai token expired.
  - File: `artifacts/api-server/src/lib/auth.ts`

- [x] **[Medium]** Endpoint reset password OTP sudah diberi limiter khusus.
  - Dampak: memperbesar ruang brute-force OTP / abuse reset endpoint.
  - File: `artifacts/api-server/src/routes/auth.ts`

- [x] **[Medium]** Production sekarang fail-fast jika `SESSION_SECRET` kosong atau kurang dari 32 karakter.
  - Dampak: jika env production misconfigured, JWT secret bisa lemah/prediktabel.
  - File: `artifacts/api-server/src/lib/auth.ts`, `artifacts/api-server/src/index.ts`

### B. Payment/Webhook (audit berjalan)

- [x] **[High]** Verifikasi signature webhook AutoGoPay sudah fail-closed (secret/signature wajib ada dan valid).
  - Dampak: webhook bisa tetap diproses tanpa autentikasi kriptografis pada kondisi salah konfigurasi.
  - File: `artifacts/api-server/src/routes/webhook.ts`

- [x] **[Medium]** Sudah ada verifikasi nilai `amount` payload webhook terhadap nominal topup/order di DB.
  - Dampak: potensi mismatch nominal tidak terdeteksi (terutama jika provider kirim data tidak konsisten).
  - File: `artifacts/api-server/src/routes/webhook.ts`

- [x] **[Medium]** Sudah ditambah proteksi replay in-memory (TTL) berbasis kombinasi transaction/event/status/signature.
  - Catatan: sebagian idempotency sudah ditangani lewat lock status `pending -> confirmed/processing`, tapi replay event tetap bisa membebani sistem/log.
  - File: `artifacts/api-server/src/routes/webhook.ts`

- [x] **[Medium]** Logging webhook sudah diringkas (event, transactionId, status, amount), tidak lagi full payload object.
  - Dampak: meningkatkan risiko data leakage di log jika payload berubah berisi data sensitif.
  - File: `artifacts/api-server/src/routes/webhook.ts`

- **[Positif]** Sudah ada idempotency/anti-race condition yang baik untuk topup dan order (`where status = pending`, lock `processing`, fallback release lock).
  - File: `artifacts/api-server/src/routes/webhook.ts`, `artifacts/api-server/src/routes/orders.ts`

---

## 🔍 Roadmap Audit Berikutnya (29 Juni 2026)

> Disusun setelah implementasi fitur registrasi anti-spam (Fonnte webhook) dan auto-markup harga VPN dinamik.

### 🔴 Prioritas Tinggi (Keamanan & Keuangan)

- [x] **A1. Port 8080 Terbuka ke Semua Endpoint** ✅
  ~~Saat ini port 8080 (Express langsung) terbuka ke internet via `ufw allow 8080` agar webhook Fonnte bisa masuk.~~
  ✅ **Selesai — 5 Juli 2026.**
  - Express pindah ke port internal `5000` (tidak terpapar ke internet)
  - Semua akses dari luar melewati Nginx (port 80/443)
  - Port 8080 ditutup di UFW (`ufw deny 8080`)
  - Ditambah middleware `webhookGuard` (defense in depth) — blokir akses langsung ke non-webhook endpoint di production
  - Fonnte webhook URL diubah ke `http://IP/api/webhooks/fonnte` (via Nginx port 80)
  - File: `artifacts/api-server/src/middlewares/webhook-guard.ts`, `artifacts/api-server/src/app.ts`, `README.md`

- [x] **A2. Race Condition Saldo (Double-Spend)** ✅
  ~~Cek apakah ada kemungkinan 2 order bersamaan dengan saldo pas-pasan bisa lolos keduanya.~~
  ✅ **Selesai — 5 Juli 2026.**
  Audit 5 flow yang mengubah saldo:
  - `orders.ts` → `fulfillOrder()` — ✅ sudah aman (`WHERE balance >= amount` di transaction)
  - `dynamic-vpn.ts` → `fulfillDynamicOrder()` — ✅ sudah aman (`WHERE balance >= amount` atomic)
  - `webhook.ts` → topup QRIS — ✅ sudah aman (`WHERE status = 'pending'` + `.returning()`)
  - `admin.ts` → topup manual admin panel — ⚠️ **DIPERBAIKI** (double-credit bisa terjadi saat double-click)
  - `telegram-bot.ts` → topup manual Telegram — ⚠️ **DIPERBAIKI** (double-credit bisa terjadi saat double-click)
  - Fix: pola atomic `UPDATE WHERE status = 'pending'` + `.returning()` — hanya 1 request yang menang
  - File: `artifacts/api-server/src/routes/admin.ts`, `artifacts/api-server/src/routes/telegram-bot.ts`

- [ ] **A3. Audit Webhook Payment — Signature Verification Depth**
  Webhook AutoGoPay/KetantechPay sudah ada signature check, tapi perlu audit:
  - Apakah HMAC timing-safe comparison sudah benar di semua case? (✅ sudah `timingSafeEqual`)
  - Apakah ada edge case `rawBody` vs `reserialized body` yang bisa bypass?
  - Replay cache in-memory hilang saat restart → apakah ada risiko?
  - File terkait: `artifacts/api-server/src/routes/webhook.ts`

### 🟡 Prioritas Sedang (Stabilitas & UX)

- [ ] **B1. Error Handling Dynamic VPN Order**
  Jika NadiaVPN API down/timeout saat user bayar:
  - Apakah saldo sudah kerefund? (harusnya iya — deduct setelah provider success)
  - Apakah order status kembali ke `pending`? (harusnya iya — catch di `pay` endpoint)
  - Test: matikan API Nadia sementara → coba order → cek saldo user
  - File terkait: `artifacts/api-server/src/routes/dynamic-vpn.ts`

- [ ] **B2. Database Query Performance & Indexing**
  Tabel yang mungkin butuh index tambahan:
  - `wa_verifications.whatsapp` — query saat webhook masuk
  - `dynamic_vpn_orders.userId` — query riwayat order user
  - `vpn_accounts.username` + `vpn_accounts.isActive` — cek duplikat saat order
  - `dynamic_provider_servers.provider` + `provider_server_id` — sync lookup
  - Tool: `EXPLAIN ANALYZE` di PostgreSQL untuk query yang lambat

- [ ] **B3. Expired Session/Token Handling**
  Apa yang terjadi jika JWT expired saat user di tengah proses:
  - Checkout/order VPN → POST gagal 401 → apakah frontend handle gracefully?
  - Topup QRIS → user sudah scan tapi token expired → apakah webhook tetap proses?
  - File terkait: `artifacts/vpn-web/src/`, `artifacts/api-server/src/lib/auth.ts`

- [ ] **B4. Backup/Restore Robustness**
  Test end-to-end: backup via Telegram → restore dari file → verifikasi data intact.
  - Apakah `pre-restore` safety backup benar-benar jalan?
  - Apakah restore bisa handle schema yang berbeda (misal setelah push kolom baru)?
  - File terkait: `artifacts/api-server/src/routes/backup.ts`

### 🟢 Prioritas Rendah (Polish & Business Intelligence)

- [ ] **C1. Profit Tracking per Server NadiaVPN**
  Sekarang sudah ada data `costPerDay/Month` dan `sellPricePerDay/Month` di setiap server.
  Tambahkan di admin dashboard:
  - Profit per order = `amount - (cost × duration)`
  - Total profit per server per bulan
  - Alert jika margin < threshold (misal < 10%)

- [ ] **C2. Notifikasi Harga Berubah saat Sync**
  Saat `syncNadiaVpnServersFromProvider()`, bandingkan `costPerDay/Month` lama vs baru.
  Jika berubah → kirim alert ke admin via Telegram:
  "⚠️ Harga NadiaVPN berubah: Server X — /hari Rp 1.000 → Rp 1.500 (+50%)"
  - File terkait: `artifacts/api-server/src/routes/dynamic-vpn.ts`, `lib/telegram.ts`

- [ ] **C3. Cleanup Expired `wa_verifications`**
  Record yang expired menumpuk di database. Tambahkan scheduler untuk bersihkan:
  - Hapus record dengan `expiresAt < NOW() - 1 day`
  - Jalankan setiap 6 jam
  - File terkait: `artifacts/api-server/src/lib/scheduler.ts`

### 📌 Urutan Eksekusi yang Disarankan

| Urutan | Item | Estimasi | Dampak |
|:------:|------|----------|--------|
| ~~①~~ | ~~**A1. Port 8080**~~ | ~~1 sesi~~ | ✅ Selesai |
| ~~②~~ | ~~**A2. Race Condition Saldo**~~ | ~~1 sesi~~ | ✅ Selesai |
| ③ | **B1. Error Handling Order** | 1 sesi | 🟡 Stabilitas |
| ④ | **B2. DB Indexing** | 0.5 sesi | 🟡 Performa |
| ⑤ | **C2. Alert Harga Berubah** | 0.5 sesi | 🟢 Business |
| ⑥ | **C3. Cleanup wa_verifications** | 0.5 sesi | 🟢 Maintenance |
| ⑦ | **C1. Profit Tracking** | 1-2 sesi | 🟢 Business |
