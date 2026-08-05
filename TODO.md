# 📋 KETANTECH VPN — Status & Rencana Pengembangan

Dokumen ringkas status sistem, perbaikan teknis, dan rencana fitur ke depan. Terakhir diperbarui: **Agustus 2026**.

---

## 🛡️ 1. Sisa Audit Keamanan & Teknis (Backlog)

Item temuan audit yang siap dikerjakan untuk stabilitas & keamanan ekstra:

- [ ] **A3. Webhook Payment — Replay Cache Persistent & Alert Mismatch**
  - Buat tabel/cache persistent untuk signature webhook (AutoGoPay & KetantechPay) agar anti-replay bertahan meski server restart.
  - Tambah trigger alert Telegram jika terjadi `amount_mismatch` atau `identity_conflict`.
  - File: `artifacts/api-server/src/routes/webhook.ts`

- [ ] **B3. Expired Session — Global 401 Interceptor Frontend**
  - Tambahkan interceptor global di frontend saat JWT expired/revoked: otomatis clear state & redirect ke `/login` dengan toast informatif.
  - File: `lib/api-client-react/src/custom-fetch.ts`, `artifacts/vpn-web/src/components/layout.tsx`

- [ ] **B4. Backup & Restore — Path Traversal & Retention Hardening**
  - Validasi ketat `targetPath` pada ekstraksi bundle backup untuk cegah path traversal.
  - Pruning otomatis untuk file backup terenkripsi (`.enc`) dan bundle (`.bundle.gz`).
  - File: `artifacts/api-server/src/lib/backup.ts`

---

## 🚀 2. Rencana Fitur Baru (Roadmap)

### 🔴 Prioritas Tinggi
- [ ] **Notifikasi Email (Transaksional)**
  - Kirim email otomatis untuk: bukti topup, akun VPN baru siap pakai, invoice pembelian.
  - Provider opsi: Resend, Brevo, atau Gmail SMTP.

### 🟡 Prioritas Sedang
- [ ] **Riwayat Login & 2FA (Two-Factor Authentication)**
  - Pencatatan log IP & device login user.
  - Opsi keamanan 2FA menggunakan aplikasi authenticator (TOTP Google Authenticator / Authy).

- [ ] **Dashboard Analytics Lanjutan**
  - Grafik pertumbuhan revenue bulanan, retensi pelanggan, dan statistik server/protokol paling diminati.

### 🟢 Prioritas Rendah
- [ ] **Sistem Promo / Flash Sale Terjadwal**
  - Diskon/potongan otomatis berbasis jam/hari tertentu yang diatur dari menu admin.

- [ ] **Multi-Bahasa (i18n)**
  - Dukungan Bahasa Indonesia & English di seluruh antarmuka web.

---

## ✅ 3. Fitur & Hardening yang Sudah Selesai (Arsip Ringkas)

- [x] **Dynamic VPN Migration** — Full beralih ke NadiaVPN + Local Panel, auto-sync harga/kuota, hapus produk static lama (Agustus 2026).
- [x] **Redesign Halaman Profil** — Arsitektur modular 10+ komponen, skeleton loader, QR referral, stats saldo & poin (Agustus 2026).
- [x] **Hardening Bot Telegram** — Webhook `secret_token` verification, rate limiter API, sanitasi credit/debit, anti-injection HTML (Agustus 2026).
- [x] **Audit Keamanan Saldo & Port** — Race condition double-spend fixed, port 8080 internal proxy, session revocation JWT `sessionVersion`.
- [x] **Enkripsi Backup Database** — AES-256-GCM, format KTBUNDLE1, verifikasi checksum.
- [x] **Monitoring & Diagnostik** — Menu System Test, VPS Resource Monitor, auto-alert telegram 15m, laporan harian 08.00 WIB.
- [x] **Program Loyalty & Reseller** — Sistem poin reward, voucher diskon, auto-upgrade reseller, referral link.
