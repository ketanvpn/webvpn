# Changelog

Semua perubahan penting pada proyek KETANTECH VPN akan didokumentasikan di file ini.

---

## [2026-05-02] - Hardening Auth & Webhook Security

### 🛡️ Security Fixes
- **Admin endpoint protection** — Endpoint `POST /api/admin/telegram/register-webhook` sekarang wajib `requireAdmin` (sebelumnya masih `requireAuth`).
- **JWT session revocation** — Menambahkan `sessionVersion` pada user dan payload JWT. Token lama sekarang otomatis invalid setelah:
  1. Logout
  2. Ubah password sendiri
  3. Reset password via OTP
  4. Reset password oleh admin
- **Suspend enforcement** — Middleware `requireAuth` sekarang cek `isActive` ke database agar akun suspended tidak bisa akses endpoint protected walau token belum expired.
- **Production secret policy** — API sekarang fail-fast di production jika `SESSION_SECRET` kosong atau kurang dari 32 karakter.
- **Rate limit endpoint sensitif** — Menambahkan limiter untuk `GET /api/auth/check-username` dan `POST /api/auth/forgot-password/reset`.

### 💳 Payment/Webhook Hardening
- **Signature wajib (fail-closed)** — Webhook AutoGoPay sekarang menolak request jika secret key belum dikonfigurasi, signature tidak ada, atau signature tidak valid.
- **Validasi nominal transaksi** — Menambahkan verifikasi `amount` payload webhook terhadap nominal topup/order di database sebelum proses konfirmasi.
- **Replay guard** — Menambahkan proteksi replay in-memory (TTL) untuk menahan event webhook duplikat cepat.
- **Log payload dipersempit** — Logging webhook tidak lagi menyimpan full payload object; sekarang diringkas ke field inti (`event`, `transactionId`, `status`, `amount`).

### 🔧 Provisioning & Account Sync Hardening
- **Admin confirm order fail-closed** — `POST /api/admin/orders/:id/confirm` sekarang tidak lagi menandai order `paid` jika provisioning akun ke panel VPS gagal. Endpoint akan mengembalikan `502` dan menghentikan proses.
- **Renew idempotency guard** — `POST /api/accounts/:id/renew` sekarang memakai lock sementara per akun (TTL) untuk mencegah renew paralel akibat double-click/retry cepat.
- **Admin extend akun fail-closed** — `POST /api/admin/accounts/:id/extend` kini mewajibkan renew panel sukses terlebih dahulu, baru update `expiresAt` di database.
- **Admin delete akun panel-first** — `DELETE /api/admin/accounts/:id` sekarang menghapus akun di panel terlebih dahulu (jika server punya API panel), baru menghapus row database.
- **Bulk delete partial-safe** — `POST /api/admin/accounts/bulk-delete` kini hanya menghapus akun dari database jika delete di panel sukses. Akun yang gagal di panel dikembalikan di response `failed[]`.
- **Toggle akun sinkron panel** — `POST /api/admin/accounts/:id/toggle` sekarang sinkron ke panel juga: OFF memanggil lock, ON memanggil unlock. Jika panel gagal, perubahan DB dibatalkan (fail-closed).
- **Panel client update** — Menambahkan `unlockPanelAccount` dan mengubah `lockPanelAccount` agar melempar error saat gagal, sehingga route dapat menjaga konsistensi state panel vs DB.

### ✅ Verifikasi Manual
- Uji webhook berhasil dengan hasil:
  - tanpa signature -> `401`
  - signature salah -> `401`
  - signature valid + transaksi tidak dikenal -> `200` (`success: true`)
- Uji session revocation berhasil:
  - login -> `/auth/me` `200`
  - logout -> `/auth/me` `401`

### 📁 File yang Diubah
- `artifacts/api-server/src/routes/telegram-bot.ts`
- `artifacts/api-server/src/lib/auth.ts`
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/routes/webhook.ts`
- `lib/db/src/schema/users.ts`
- `TODO.md`
- `artifacts/api-server/src/routes/accounts.ts`
- `artifacts/api-server/src/routes/admin.ts`
- `artifacts/api-server/src/lib/vpn-panel.ts`

## [2026-04-29] - Telegram Admin Menu & Auto-Cleanup

### ✨ Fitur Baru (Backend & Bot)
- **Telegram Admin Menu (Interactive)** — Menambahkan menu rahasia khusus Admin di Telegram Bot. Ketik `/admin` untuk memunculkan antarmuka tombol interaktif (*Inline Keyboard*) dengan 4 fitur utama:
  1. **🖥️ Status Server**: Cek daftar server, kapasitas terpakai, dan opsi menyalakan/mematikan server (ON/OFF) hanya dengan 1 kali klik.
  2. **📊 Statistik Hari Ini**: Ringkasan kilat pendapatan hari ini, pendaftar baru, total Topup pending, dan tiket terbuka.
  3. **💸 Antrean Topup**: Menampilkan 5 antrean topup terlama yang belum dikonfirmasi, lengkap dengan tombol ✅ dan ❌ untuk proses instan.
  4. **🔍 Cari User Kilat**: Bot akan menampilkan cara menggunakan perintah `/cek [username]` untuk mengecek Saldo, Poin, dan daftar akun VPN aktif milik user tanpa perlu login ke web.
  5. **💾 Force Backup**: Tombol untuk memerintahkan bot membungkus isi database ke file `.sql.gz` dan mengirimkannya saat itu juga ke Telegram.
  6. **📢 Broadcast Instan**: Perintah `/broadcast [pesan]` memungkinkan admin mengirim pengumuman massal ke seluruh Telegram pengguna secara instan dari layar HP.
- **Auto-Cleanup Akun Kedaluwarsa (Ghost Accounts)** — Menambahkan fungsi `cleanupGhostAccounts` ke dalam sistem *Scheduler*. Sistem kini akan otomatis berjalan setiap 3 jam untuk mencari dan menghapus akun VPN dari database web yang sudah lewat masa kedaluwarsanya lebih dari **7 hari**.

### 🛡️ Security Fixes
- **Logika Server Non-aktif (Maintenance)** — Memperbaiki kebocoran logika (logic flaw) di mana saat admin mematikan suatu server, produk VPN yang mengarah ke server mati tersebut tetap bisa dibeli. Lebih parahnya, sistem sebelumnya akan melempar (fallback) pesanan user ke server aktif lainnya tanpa pemberitahuan. Kini:
  1. Produk yang menempel pada server non-aktif otomatis disembunyikan dari Toko VPN.
  2. Order otomatis ditolak dengan pesan error yang jelas jika sistem tidak sengaja memprosesnya.
  3. User tidak dapat melakukan perpanjangan (Renew) pada akun yang berada di server non-aktif/maintenance.
- **Pemotongan Saldo Asinkron (Fire-and-forget)** — Sebelumnya, sistem memotong saldo user dan mencatat transaksi ke database *sebelum* berhasil mengeksekusi perpanjangan akun di Panel VPS. Jika VPS *down* atau API gagal, saldo user hangus tapi akun gagal diperpanjang.
- **Validasi Terpusat (Triple Validation)** — Alur dirombak sehingga:
  1. Mengecek saldo user terlebih dahulu.
  2. Melakukan sinkronisasi & menembak API perpanjangan (`renewPanelAccount`) ke Panel VPS **secara sinkron (awaited)**.
  3. Memotong saldo dan update database lokal **HANYA JIKA** VPS merespons sukses dengan kode HTTP 200.
- **Error Propagation VPS API** — Fungsi `renewPanelAccount` di library `vpn-panel.ts` kini dengan benar melempar (`throw`) HTTP Error dari response Axios agar sistem transaksi database bisa membatalkannya (bukan lagi sekadar di-*catch* dan di-log sebagai *warning* diam-diam).

### 🐛 Bug Fix
- **Pengecekan Ketersediaan Akun Kedaluwarsa** — Mengidentifikasi bahwa panel *Potato Tunneling API* menghapus akun kedaluwarsa secara internal tanpa mengizinkan akses ke *endpoint* `modify` maupun `renew` setelahnya, sehingga kebijakan penolakan perpanjangan bagi akun `expired` adalah satu-satunya tindakan yang valid dan wajib dipertahankan untuk mencegah sistem merespons sukses untuk proses modifikasi *ghost account*.

### 📁 File yang Diubah
- `artifacts/api-server/src/routes/accounts.ts` — Perubahan alur logika `POST /accounts/:id/renew` ke model tembak server dulu, baru transaksi database.
- `artifacts/api-server/src/lib/vpn-panel.ts` — Pembenahan penangkapan `AxiosError` pada fungsi `renewPanelAccount`.

---

## [2026-04-28] - Perbaikan Pengumuman: Tanggal Mulai & Berakhir

### 🐛 Bug Fix
- **Tanggal pengumuman tidak tersimpan** — Input `datetime-local` sebelumnya hanya bisa diisi melalui date picker bawaan browser, namun tidak ada petunjuk visual yang jelas bagi admin. Tanggal yang diketik manual tidak ter-register oleh browser sehingga nilai yang dikirim selalu kosong (`null`).
- **Tanggal tidak muncul saat edit** — Menambahkan fungsi `safeFormat` untuk parsing tanggal dari database ke format yang kompatibel dengan input `datetime-local` (`yyyy-MM-ddTHH:mm`), sehingga tanggal yang sudah tersimpan akan tampil kembali saat modal edit dibuka.
- **Validasi tanggal di backend** — Menambahkan fungsi `parseDate` dengan pengecekan `isNaN` di route POST dan PUT untuk mencegah penyimpanan `Invalid Date` ke database.

### ✨ Peningkatan UX
- **Ikon kalender** pada label "Mulai Tayang" dan "Berakhir" agar admin langsung tahu bahwa field tersebut adalah pemilih tanggal.
- **Teks petunjuk** "Klik untuk pilih tanggal" muncul di bawah input saat belum ada tanggal yang dipilih.
- **Dark color scheme** pada input datetime agar ikon calendar bawaan browser terlihat jelas di dark mode.
- **Konversi timezone** — Frontend sekarang mengkonversi tanggal lokal ke ISO string (`toISOString()`) sebelum dikirim ke backend, memastikan konsistensi timezone antara admin dan server.

### 📁 File yang Diubah
- `artifacts/vpn-web/src/pages/admin/announcements.tsx` — Perbaikan UX input tanggal, parsing tanggal saat edit, konversi timezone saat simpan.
- `artifacts/api-server/src/routes/announcements.ts` — Validasi tanggal yang lebih ketat di route POST dan PUT.
