# Tutorial Lengkap untuk Pemula - KETANTECH VPN + DarkTunnel

Halo! Tutorial ini dibuat khusus untuk kamu yang baru pertama kali pakai. 
Bahasanya dibuat **sangat mudah**, langkah demi langkah, seperti ngobrol biasa.

**Yang kamu butuhkan:**
- HP Android
- Aplikasi **DarkTunnel** atau **HTTP Custom**, sesuai pilihan yang tersedia di website
- Akun di website KETANTECH (sudah punya? bagus. Belum? daftar dulu di https://ketantech.my.id)

---

## Langkah 1: Login ke Website

1. Buka browser di HP kamu (Chrome atau browser biasa).
2. Ketik alamat ini di kolom atas: **https://ketantech.my.id**
3. Tekan Enter.
4. Kamu akan melihat halaman utama.
5. Cari tombol **Login** (biasanya di pojok kanan atas atau tengah).
6. Ketuk **Login**.
7. Masukkan:
   - Username kamu, **atau**
   - Nomor WhatsApp yang kamu daftarkan
8. Masukkan **Password** yang kamu buat saat daftar.
9. Ketuk tombol **Login** atau **Masuk**.

**Selesai!** Kamu sekarang masuk ke Dashboard.

> **Tips:** Kalau lupa password, ada tombol "Lupa Password" di halaman login. Ikuti petunjuknya (biasanya lewat WhatsApp).

---

## Langkah 2: Top Up Saldo (Isi Uang ke Akun)

Sebelum beli akun VPN, kamu harus punya saldo di website.

1. Setelah login, kamu akan masuk ke **Dashboard**.
2. Cari bagian yang bertuliskan **Saldo** (biasanya ada angka uang di kotak).
3. Ketuk tombol **Topup Saldo** atau **Isi Saldo** (bisa di dashboard atau menu samping).
4. Pilih jumlah saldo yang ingin kamu isi (misalnya Rp 10.000, Rp 25.000, dll).
5. Pilih metode pembayaran (biasanya **QRIS** - paling mudah).
6. Muncul QR Code.
7. Buka aplikasi e-wallet kamu (DANA, OVO, GoPay, LinkAja, dll) atau m-banking.
8. Scan QR Code tersebut.
9. Bayar sesuai jumlah yang tertera.
10. Tunggu beberapa detik sampai muncul notifikasi "Pembayaran Berhasil".
11. Kembali ke website, saldo kamu akan bertambah otomatis.

**Selesai!** Saldo kamu sekarang bertambah.

> **Penting untuk pemula:** Jangan lupa screenshot bukti pembayaran kalau ada masalah.

---

## Langkah 3: Beli Akun SSH Khusus (untuk Inject Paket)

Ini akun yang khusus dipakai untuk inject paket melalui DarkTunnel atau HTTP Custom.

1. Di Dashboard, cari tombol besar **Order VPN** atau **Beli Akun VPN**.
2. Kamu akan masuk ke halaman pilihan paket.
3. Pilih jenis akun yang diminta oleh trik aktif di menu **Inject Paket**, biasanya **SSH biasa** atau **SSH CloudFront**.
   - Contoh yang mungkin tersedia: GameMax memakai SSH biasa dan Ilmupedia memakai SSH CloudFront.
   - Daftar dan kebutuhan akun dapat berubah saat admin memperbarui trik.
4. Pilih durasi (1 hari, 7 hari, 30 hari, dll).
5. Lihat harga.
6. Ketuk **Beli** atau **Order Sekarang**.
7. Pilih "Bayar Pakai Saldo".
8. Konfirmasi pembelian.
9. Tunggu sebentar, akun akan muncul di menu **Akun VPN** atau **Kelola Akun**.

**Cara lihat akun yang baru dibeli:**
- Buka menu **Akun VPN** (biasanya di sidebar atau bottom menu di HP).
- Kamu akan lihat daftar akun.
- Ketuk akun SSH yang baru dibeli.
- Website akan mengambil Host, Port, Username, dan Password akun tersebut saat membuat config.
- **Jangan membagikan atau screenshot Password, SSH Login, link DarkTunnel, maupun file `.dark`.** Semuanya dapat dipakai untuk masuk ke akun VPN kamu.

---

## Langkah 4: Pilih Paket, Akun, dan Aplikasi

1. Dari Dashboard atau menu, buka **Inject Paket**.
2. Pastikan tab **Mode Mudah** yang terbuka.
3. Pilih salah satu **trik/preset aktif** yang ditampilkan. GameMax dan Ilmupedia hanyalah contoh; admin dapat menambah, mengubah, atau menonaktifkan trik.
4. Baca badge jenis akun pada kartu, misalnya **SSH biasa** atau **SSH CloudFront**.
5. Pilih akun yang tersedia. Website hanya menampilkan akun aktif yang cocok dengan preset tersebut.
6. Kalau hanya ada satu akun yang cocok, akun dapat dipilih otomatis.
7. Pilih aplikasi yang tersedia pada preset:
   - **DarkTunnel** untuk pembuatan file `.dark` otomatis.
   - **HTTP Custom (Beta)** untuk panduan salin data langkah demi langkah.

Kalau sebuah aplikasi tidak muncul, berarti admin sedang menonaktifkan aplikasi itu untuk preset tersebut. Kalau tertulis **Mode Mudah sementara tidak tersedia**, semua trik sedang dinonaktifkan atau diperbarui; coba lagi nanti.

Kalau website menampilkan akun Nadia yang belum teridentifikasi, ketuk **Perbarui Data Akun**, lalu pilih preset dan akun kembali.

---

## Langkah 5A: Menggunakan DarkTunnel

1. Pilih **DarkTunnel**.
2. Ketuk **Buat Config DarkTunnel**.
3. Saat popup muncul, ketuk **Download File .dark**.
4. Buka notifikasi download atau aplikasi **File/Downloads** di HP.
5. Ketuk file yang namanya berakhiran **.dark**.
6. Pilih aplikasi DarkTunnel, pilih config, lalu ketuk **Connect/Start**.

Jika file tidak terbuka langsung, gunakan tombol **Buka di DarkTunnel** atau **Salin Link**, lalu import link tersebut dari DarkTunnel.

---

## Langkah 5B: Menggunakan HTTP Custom (Beta)

1. Pilih **HTTP Custom** pada website.
2. Install atau buka HTTP Custom melalui tombol Play Store resmi.
3. Salin **SSH Login**, lalu tempel ke field `ip:port@user:pass` di mode SSH.
4. Ketuk ikon **tiga garis (☰)** di kiri atas, lalu pilih menu **Payload**.
5. Di kolom **Payload**, salin dan tempel Payload dari website.
6. Di kolom **Remote Proxy** yang berada tepat di bawah Payload, salin dan tempel Remote Proxy dari website, lalu pilih **Apply**.
7. Ikuti badge website untuk **Use Payload**: aktifkan bila tertulis ON dan biarkan mati bila tertulis OFF.
8. Jika website menampilkan field **SNI**, ketuk ikon tiga garis lagi, pilih menu **SNI** yang berada di bawah menu Payload, lalu tempel nilainya ke **Server Name Indication**.
9. Ikuti badge **SSL** pada website: aktifkan bila ON; bila OFF, biarkan SSL mati dan SNI kosong jika tidak ditampilkan.
10. Ketuk **CONNECT** dan periksa tab **LOG** jika gagal.

Jangan mengubah teks `[host]`, `[ua]`, dan `[crlf]` di dalam payload. Tampilan/menu HTTP Custom dapat sedikit berbeda tergantung versi aplikasi.

Kalau berhasil, status koneksi akan aktif. Karena dukungan HTTP Custom masih Beta, kirim screenshot tab LOG ke admin bila koneksi gagal. **Sebelum mengirim screenshot, tutupi SSH Login, username, password, dan link config jika terlihat.**

---

## Tips Tambahan untuk Pemula

- **Selalu pilih akun yang masih aktif** (lihat tanggal expirednya).
- Kalau gagal connect di DarkTunnel:
  - Pastikan saldo cukup saat beli.
  - Pastikan badge jenis akun pada preset cocok dengan akun yang dibeli.
  - Coba restart HP atau ganti jaringan (4G/5G).
- Jangan lupa cek kuota data kamu setelah connect.
- Kalau ada error, screenshot dan tanya ke admin via Tiket Bantuan di website, tetapi tutupi semua kredensial dan link config terlebih dahulu.
- Jangan kirim atau menjual ulang file `.dark`; file itu berisi akses akun SSH kamu.

---

## Link Penting

- Website: https://ketantech.my.id
- Login: Buka website lalu klik Login
- Dashboard: Otomatis muncul setelah login
- Inject Paket: Cari menu "Inject Paket", lalu gunakan Mode Mudah
- Akun VPN: Menu "Akun" atau "Kelola Akun"

Kalau masih bingung di langkah tertentu, balas pesan ini atau buka Tiket Bantuan di website. Admin siap bantu!

**Semoga berhasil!** 🚀
