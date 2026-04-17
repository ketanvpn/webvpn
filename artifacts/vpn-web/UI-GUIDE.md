# KETANTECH VPN - UI/UX Guidelines (Sultan Theme)

Dokumen ini mencatat standar desain antarmuka (UI) "Sultan / Glassmorphism" yang digunakan pada Panel User dan Panel Admin di proyek KETANTECH VPN. 

Tujuannya agar jika di masa depan ada penambahan halaman baru, gaya visual yang premium dan elegan ini bisa dengan mudah direplikasi (di-copy-paste) tanpa merusak konsistensi desain.

## 1. Konsep Utama
Desain KETANTECH mengandalkan efek **Glassmorphism**, yang memberikan kesan kaca tembus pandang pada *background* yang gelap. Ini dicapai dengan kombinasi transparansi warna, *backdrop-blur*, dan pembatas (border) yang sangat tipis agar membaur dengan warna latar belakang.

## 2. Kelas Tailwind CSS (Custom Utilities)
Semua kelas ini bisa ditemukan konfigurasinya di `index.css`. Gunakan kelas ini di `className` untuk membangun komponen baru.

### A. Panel Induk (Glass Panel)
Digunakan sebagai pengganti `<Card>` standar atau kontainer besar.
```tsx
<!-- STANDAR SHADCN (JANGAN GUNAKAN INI) -->
<Card className="border bg-card"> ... </Card>

<!-- SULTAN THEME (GUNAKAN INI) -->
<Card className="glass-panel border-white/5"> ... </Card>
```

### B. List / Daftar Tabel (List Item)
Digunakan untuk membagi list data (seperti list server, user, transaksi).
```tsx
<!-- Pembungkus / Container List -->
<div className="divide-y divide-white/5">
  
  <!-- Item List -->
  <div className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
    Isi Data
  </div>

</div>
```

### C. Kartu Aksi / Hover Interaktif (Glass Card)
Digunakan pada kartu yang dapat diklik atau disorot oleh kursor (seperti kartu pada daftar Server, atau Stats Card di Dashboard).
```tsx
<Card className="glass-card border-white/5 hover:border-primary/50 hover:glow-border-primary transition-all">
  ...
</Card>
```

### D. Pembatas & Header (Borders & Headers)
Jangan gunakan `border-b` bawaan shadcn yang biasanya berwarna solid abu-abu, gantilah dengan transparan.
```tsx
<!-- STANDAR -->
<CardHeader className="border-b bg-muted/20"> ... </CardHeader>

<!-- SULTAN THEME -->
<CardHeader className="border-b border-white/5"> ... </CardHeader>
```
Untuk garis bawah/atas standar, selalu gunakan `border-white/5` atau `border-white/10` (bergantung intensitas yang diinginkan).

### E. Komponen Notifikasi / Status (Badge & Alert)
Warna *Badge* dan *Alert* juga menggunakan background dengan *opacity* rendah (10%-15%) agar tidak menutupi tema gelap secara mencolok.
*   **Sukses (Hijau):** `bg-green-500/10 border-green-200 text-green-500`
*   **Peringatan (Kuning):** `bg-yellow-500/10 border-yellow-200 text-yellow-500`
*   **Bahaya (Merah):** `bg-red-500/10 border-red-200 text-red-500`
*   **Info (Biru):** `bg-blue-500/10 border-blue-200 text-blue-500`

## 3. Aturan Tambahan
1. **Tidak Boleh Memakai Solid Background pada Kontainer.**
   Hindari pemakaian `bg-white`, `bg-black`, atau `bg-card` murni secara langsung jika elemen tersebut bertumpuk (overlay). Selalu andalkan efek semi-transparan `bg-black/40 backdrop-blur-xl`.
2. **Hover State (Sentuhan Animasi).**
   Untuk setiap elemen tabel atau daftar (`div`), tambahkan `hover:bg-white/5 transition-colors` agar terasa responsif dan dinamis ketika di-*hover* oleh mouse.
3. **Penyelarasan Shadcn UI.**
   Jika mengimpor komponen baru dari `shadcn-ui`, pastikan untuk melakukan override warnanya melalui properti `className` agar sesuai dengan *Sultan Theme*.
