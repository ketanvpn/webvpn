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
- [ ] **5. Kompensasi Saldo (Gift Balance) via Telegram**
  Fitur untuk menambahkan saldo secara manual ke pengguna sebagai bentuk kompensasi (misal karena komplain). Admin mengetik perintah `/gift <username> <nominal>` di bot Telegram.
  *Tingkat Risiko: Sangat Rendah*
