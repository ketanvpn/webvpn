# Changelog

Semua perubahan penting pada proyek KETANTECH VPN akan didokumentasikan di file ini.

---

## [2026-04-29] - Auto-Cleanup Akun Hantu & Keamanan Alur Renew

### ✨ Fitur Baru (Backend)
- **Auto-Cleanup Akun Kedaluwarsa (Ghost Accounts)** — Menambahkan fungsi `cleanupGhostAccounts` ke dalam sistem *Scheduler*. Sistem kini akan otomatis berjalan setiap jam untuk mencari dan menghapus akun VPN dari database web yang sudah lewat masa kedaluwarsanya lebih dari **7 hari**. Hal ini selaras dengan *behavior* server VPS yang otomatis membersihkan config *expired*, sehingga menjaga database web tetap ringan dan UI pengguna bebas dari riwayat akun lawas yang sudah tidak bisa dipakai.

### 🛡️ Security Fixes
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
