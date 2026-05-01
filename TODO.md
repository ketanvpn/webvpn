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
