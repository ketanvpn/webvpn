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

- [ ] **7. Redesign Landing Page & SEO**
  Upgrade tampilan halaman depan agar lebih menarik untuk akuisisi user baru. Optimasi meta tags, heading structure, dan performa loading.
  *Tingkat Risiko: Rendah*
  *⚠️ Kendala: Harus hati-hati agar perubahan CSS tidak merusak halaman lain yang sudah pakai "Sultan Glassmorphism". Disarankan audit komponen shared sebelum mulai.*

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
| ① | **#7 Redesign Landing Page & SEO** | 1-2 sesi | ❌ | Tidak ada — bisa langsung mulai |
| ② | **#8 Notifikasi Email** | 2-3 sesi | ✅ (kolom `emailVerified`) | Pilih SMTP provider dulu (Resend/Brevo/Gmail) |
| ③ | **#10 Dashboard Analytics** | 1-2 sesi | ❌ | Cek library chart yang sudah dipakai di frontend |
| ④ | **#9 Login Security & 2FA** | 2-3 sesi | ✅ (tabel `login_logs`, kolom `totpSecret`) | Install `otplib`, siapkan UI QR code |
| ⑤ | **#11 Promo Terjadwal** | 1-2 sesi | ✅ (kolom jadwal di `vouchers`) | Pastikan scheduler timezone WIB sudah stabil |
| ⑥ | **#12 Multi-bahasa (i18n)** | 3-4 sesi | ❌ | Semua fitur lain harus stabil dulu |

> **Langkah pertama:** Mulai dari **#7 Redesign Landing Page & SEO** — tanpa risiko database, dampak langsung ke akuisisi user.
