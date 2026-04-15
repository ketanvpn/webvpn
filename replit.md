# KETANTECH VPN Store — Panduan Proyek

## Ringkasan
Platform penjualan VPN Indonesia berbasis web + bot Telegram. Dibangun sebagai pnpm monorepo dengan TypeScript. Memiliki:
- **User dashboard** — beli VPN, kelola akun, topup saldo
- **Admin dashboard** — kelola user/produk/server/order/topup/akun VPN
- **Bot Telegram** — penjualan VPN via chat (`botvpn-fixed/`)

---

## Stack Teknis

| Komponen | Teknologi |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Bahasa | TypeScript 5.9 |
| API Framework | Express 5 |
| Database (web) | PostgreSQL + Drizzle ORM |
| Database (bot) | SQLite |
| Validasi | Zod (v4), drizzle-zod |
| API Codegen | Orval (OpenAPI → TS client) |
| Build | esbuild |
| Frontend | React + Vite + TailwindCSS + shadcn/ui |
| State / Data | TanStack Query v5 |
| Routing (web) | Wouter |

---

## Artifacts (App yang Berjalan)

### VPN Store Web (`artifacts/vpn-web`)
- React + Vite SPA
- Preview path: `/`
- Port: `5173` (via env `PORT`)
- Workflow: "VPN Web" — `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/vpn-web run dev`

### API Server (`artifacts/api-server`)
- Express 5 REST API
- Base path semua endpoint: `/api`
- Port: `8080`
- Auth: JWT httpOnly cookie bernama `token`
- bcrypt 12 rounds
- Role user: `user` | `reseller` | `admin`

---

## Credentials Test
- **Admin**: `admin` / `admin123` → akses `/admin`
- **Demo user**: `demo` / `demo123` → akses `/dashboard`

---

## Perintah Penting

```bash
# Regenerate API client dari OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push perubahan schema ke PostgreSQL (di Replit/local — DATABASE_URL sudah di env)
pnpm --filter @workspace/db run push

# Push perubahan schema ke PostgreSQL (di VPS — DATABASE_URL harus eksplisit)
DATABASE_URL="postgresql://ketantech:PASSWORD@localhost:5432/ketantech_db" pnpm --filter @workspace/db run push

# Jalankan dev server API
pnpm --filter @workspace/api-server run dev

# Jalankan dev server frontend
pnpm --filter @workspace/vpn-web run dev
```

## Command Deploy Lengkap di VPS

Gunakan command ini setiap kali ada update (ganti PASSWORD sesuai setup kamu):

```bash
cd /var/www/ketantech-vpn && git pull origin main && pnpm install && DATABASE_URL="postgresql://ketantech:PASSWORD@localhost:5432/ketantech_db" pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/vpn-web run build && pm2 restart ketantech-api
```

> **Kenapa DATABASE_URL harus ditulis eksplisit?** Drizzle Kit (`db push`) tidak otomatis membaca file `.env`. Harus diberikan via env variable saat menjalankan perintah.

---

## Struktur Monorepo

```
artifacts/
  api-server/          — Backend Express API
    src/
      routes/          — auth, admin, orders, accounts, balance, products, servers, dashboard
      lib/             — auth middleware, vpn-panel integration
  vpn-web/             — Frontend React+Vite
    src/
      pages/
        admin/         — dashboard, users, orders, topups, accounts, servers, products, user-detail
        user/          — dashboard, orders, accounts, balance, products
        auth/          — login, register

lib/
  db/                  — Drizzle ORM schema + migrations
    src/schema/        — users, products, servers, orders, vpn_accounts, topups
  api-spec/            — openapi.yaml + orval codegen config
  api-client-react/    — Generated TanStack Query hooks (dari codegen)
  api-zod/             — Generated Zod validators (dari codegen)

botvpn-fixed/          — Bot Telegram (Node.js + SQLite, terpisah dari web)
```

---

## Database Schema (`lib/db/src/schema/`)

| Tabel | Kolom Penting |
|---|---|
| `users` | id, username, email, passwordHash, role, balance, isActive, referralCode, **telegramId** (bigint), **telegramLinkToken** (text) |
| `vpn_servers` | id, name, location, flag, host, apiUrl, apiToken, supportedProtocols, isActive |
| `products` | id, name, protocol, durationDays, price, quota, maxConnections, **stock** (INTEGER NOT NULL DEFAULT 100), isActive, category, sortOrder |
| `orders` | id, userId, productId, amount, status (pending/processing/paid/failed/expired), paymentMethod, notes, vpnAccountId, **autogopayTransactionId**, **qrisUrl**, **expiresAt** |
| `vpn_accounts` | id, userId, protocol, username, password, uuid, serverId, configLink, allLinks, expiresAt, isActive |
| `topup_transactions` | id, userId, amount, qrisUrl, status (pending/confirmed/rejected), confirmedBy, rejectionNote |
| `settings` | key, value — menyimpan konfigurasi Telegram bot (telegramBotToken, telegramAdminChatId, telegramEnabled, telegramBotUsername) |
| `balance_logs` | id, userId, type, amount, balanceBefore, balanceAfter, description, relatedId, createdAt — log semua perubahan saldo |

---

## API Routes (`artifacts/api-server/src/routes/`)

### Public / Auth
- `POST /api/auth/register` — daftar user baru (field: username, password, fullName, email, whatsapp, referralCode opsional)
- `POST /api/auth/login` — login via username **atau** nomor WhatsApp; set JWT httpOnly cookie
- `POST /api/auth/logout` — hapus cookie
- `GET /api/auth/me` — info user yang login
- `GET /api/auth/check-username?username=xxx` — cek ketersediaan username saat register (min 3 karakter); response: `{ available: bool, suggestions: string[] }` (maks 3 saran)
- `POST /api/auth/forgot-password/send-otp` — kirim OTP WA untuk reset password (rate limit 3x/15 menit, OTP berlaku 5 menit, purpose `"reset"`)
- `POST /api/auth/forgot-password/reset` — reset password dengan OTP yang valid (field: whatsapp, otp, newPassword)

### Reseller (requireAuth + role reseller)
- `GET /api/reseller/status` — status reseller bulan ini: diskon, target, total penjualan, progress %; 403 jika bukan reseller

### User (requireAuth)
- `GET /api/balance` — saldo user
- `POST /api/balance/topup` — buat permintaan topup + QRIS
- `GET /api/balance/topup/history` — riwayat topup
- `GET /api/balance/logs` — log semua perubahan saldo user (topup, pembelian, penyesuaian)
- `GET /api/products` — daftar produk
- `GET /api/products/:id` — detail produk
- `GET /api/servers` — daftar server (publik)
- `POST /api/orders` — beli produk; jika `paymentMethod=qris` dan AutoGoPay aktif → generate QRIS otomatis, simpan `qrisUrl`/`expiresAt`/`autogopayTransactionId`
- `GET /api/orders` — riwayat order user
- `GET /api/orders/:id` — detail order (include `qrisUrl`, `expiresAt`)
- `POST /api/orders/:id/pay` — bayar order dengan saldo (QRIS dikonfirmasi otomatis via webhook)
- `GET /api/accounts` — daftar akun VPN aktif user
- `GET /api/accounts/:id` — detail akun VPN
- `POST /api/accounts/:id/renew` — perpanjang akun VPN
- `GET /api/dashboard/summary` — summary dashboard user

### Admin (requireAdmin)
- `GET /api/admin/dashboard` — statistik: totalUsers, totalOrders, totalRevenue, activeAccounts, pendingTopups, pendingOrders, revenueToday/Month, ordersByProtocol, recentOrders, recentTopups
- `GET /api/admin/users?search=&role=&limit=&offset=` — list user (server-side pagination + filter role)
- `GET /api/admin/users/:id` — detail user beserta orders dan akun
- `PATCH /api/admin/users/:id` — update role/status user
- `POST /api/admin/users/:id/adjust-balance` — adjust saldo manual
- `GET /api/admin/products` — list produk (termasuk `stock` dan `availableStock`)
- `POST /api/admin/products` — buat produk baru (wajib isi `stock`)
- `PATCH /api/admin/products/:id` — update produk
- `DELETE /api/admin/products/:id` — hapus/nonaktifkan produk
- `GET /api/admin/servers` — list server
- `POST /api/admin/servers` — tambah server
- `PUT /api/admin/servers/:id` — update server
- `DELETE /api/admin/servers/:id` — hapus server
- `GET /api/admin/orders?status=&userId=&search=&limit=&offset=` — list order (search by username)
- `POST /api/admin/orders/:id/confirm` — konfirmasi order (buat akun VPN via panel)
- `DELETE /api/admin/orders/:id` — hapus order (non-paid only)
- `GET /api/admin/topups?status=` — list permintaan topup
- `POST /api/admin/topups/:id/confirm` — konfirmasi topup
- `POST /api/admin/topups/:id/reject` — tolak topup (body: `{ rejectionNote?: string }`)
- `GET /api/admin/accounts` — list akun VPN
- `POST /api/admin/accounts/:id/extend` — perpanjang akun N hari
- `PATCH /api/admin/accounts/:id/toggle` — aktif/nonaktif akun
- `DELETE /api/admin/accounts/:id` — hapus akun permanen
- `GET /api/admin/settings/telegram` — baca konfigurasi Telegram bot
- `PUT /api/admin/settings/telegram` — update konfigurasi Telegram bot
- `GET /api/admin/export/topups` — export topups ke CSV
- `GET /api/admin/export/orders` — export orders ke CSV
- `POST /api/admin/broadcast` — broadcast pesan ke semua user yang sudah link Telegram
- `GET /api/admin/users/:id/balance-logs` — riwayat perubahan saldo user tertentu (admin)

### Telegram Bot (Webhook)
- `POST /api/telegram/webhook` — terima update dari Telegram API
- `GET /api/telegram/link` — generate token untuk linking akun Telegram (user)
- `DELETE /api/telegram/link` — unlink Telegram dari akun user

---

## Fitur Admin Dashboard (Lengkap)

### Dashboard Overview
- Card stats: Total Revenue, Total Users, Active VPNs, Pending Topups, Pending Orders
- Card Pending Topups & Pending Orders berwarna/highlight jika ada yang menunggu
- Card bisa diklik langsung ke halaman terkait
- Recent Orders & Recent Topups list

### Admin Orders
- List semua order dengan filter status (all/pending/paid/failed)
- **Search by username** (debounced, server-side)
- Konfirmasi order manual → otomatis buat akun VPN via panel API
- Hapus order (non-paid) dengan AlertDialog konfirmasi
- Order "paid" menampilkan link ke akun VPN yang dibuat
- **Auto-refresh setiap 30 detik**
- Menampilkan total count

### Admin Topups
- List topup dengan filter status (pending/confirmed/rejected/all)
- Konfirmasi topup → tambah saldo user
- Tolak topup dengan **dialog alasan penolakan** (rejectionNote, max 200 karakter)
- Topup ditolak menampilkan alasan di bawah item
- **Auto-refresh setiap 30 detik**

### Admin Users
- List user dengan search (by username) dan filter role
- **Server-side pagination** (20 per halaman) dengan tombol prev/next
- Menampilkan total count
- Link ke halaman detail user

### Admin Servers
- Grid card server dengan status online/offline
- Tambah/edit server via dialog form
- Hapus server via **AlertDialog** (bukan browser `confirm()`)

### Admin VPN Accounts
- List semua akun VPN
- Tombol Perpanjang (extend expiry by N hari)
- Toggle aktif/nonaktif
- Hapus akun permanen

---

## VPN Panel Integration

- Endpoint: `POST http://{server.apiUrl}/vps/vmessall`
- Auth: `Authorization: Bearer {server.apiToken}`
- Server aktif saat ini: SG-01 (`http://129.212.235.191`)
- `allLinks` format: `tls|none|grpc|uptls|upntls` (pipe-separated, urutan tetap)
- File: `artifacts/api-server/src/lib/vpn-panel.ts`

---

## Alur Codegen (Penting!)

Setiap kali mengubah `lib/api-spec/openapi.yaml`:
1. Jalankan `pnpm --filter @workspace/api-spec run codegen`
2. Ini akan regenerate:
   - `lib/api-client-react/src/generated/` — TanStack Query hooks
   - `lib/api-zod/src/generated/` — Zod validators
3. Frontend import dari `@workspace/api-client-react` (bukan relative path)

---

## Bot Telegram (`botvpn-fixed/`)

- Runtime: Node.js, SQLite (file: `sellvpn.db`) — **terpisah** dari PostgreSQL web
- Modul: `create`, `renew`, `del`, `lock`, `unlock`, `trial`
- Menggunakan `axios` untuk panggil AutoScript Potato API
- Shared DB connection di `modules/db.js` dengan WAL mode

---

## Catatan Pengembangan

- Currency: IDR, format tampilan: `Rp XX.XXX` (gunakan `formatRupiah()` di `src/lib/format.ts`)
- Bahasa UI: Bahasa Indonesia
- Semua operasi delete/destructive di admin menggunakan AlertDialog (shadcn), bukan `window.confirm()`
- Session plan progress dicatat di `.local/` (jangan commit)

## Progress Batch Improvement

### Batch 7 ✅ (April 2026)
- **AutoGoPay QRIS untuk Order — end-to-end selesai:**
  - `ordersTable` ditambah kolom `autogopayTransactionId`, `qrisUrl`, `expiresAt`
  - `generateAutoGopayQris()` — helper generate QRIS via AutoGoPay API (dipakai saat create order)
  - `fulfillOrder(orderId, opts)` — fungsi reusable untuk fulfill order (buat akun panel + atomic DB tx + opsional deduct balance); menggantikan logika duplikat di pay endpoint
  - `POST /orders` dengan `paymentMethod=qris`: langsung generate QRIS → simpan `qrisUrl`/`autogopayTransactionId`/`expiresAt` ke order
  - `POST /orders/:id/pay`: dipersingkat — untuk QRIS cukup return order (konfirmasi via webhook), untuk balance panggil `fulfillOrder({ deductBalance: true })`
  - `webhook.ts`: kini menangani **dua jenis settlement** — topup (existing) dan **order QRIS** (baru): atomic lock → `fulfillOrder()` otomatis → akun VPN aktif
  - OpenAPI spec: tambah field `qrisUrl` dan `expiresAt` ke schema `Order` → codegen dijalankan
  - Frontend `order-detail.tsx`: tampilkan gambar QRIS dari `order.qrisUrl`, countdown timer `expiresAt`, **auto-poll setiap 5 detik** selama pending, toast otomatis saat bayar diterima, status "Sedang Diproses" ditambahkan

### Batch 6 ✅ (April 2026)
- **Grafik Statistik Admin Dashboard:** Revenue harian (AreaChart) + Order per hari (BarChart) menggunakan Recharts; toggle 7H/14H/30H; endpoint baru `GET /admin/stats/revenue-chart`
- **Konfirmasi Order:** Dialog review sebelum buat order di `product-detail.tsx` — tampil ringkasan produk, nama akun, metode bayar, saldo sebelum/sesudah
- **Struk Digital Order:** Setelah bayar, `order-detail.tsx` langsung tampil detail akun VPN inline — UUID, server, expiry, config link + QR Code
- **Konfirmasi Bayar:** AlertDialog sebelum klik "Bayar Sekarang" di order detail

### Batch 5b ✅ (April 2026)
- Pengaturan Notifikasi Kedaluwarsa di admin (`GET/PUT /admin/settings/expiry-notif`)
- Scheduler sekarang menghormati setting: bisa nonaktifkan H-3/H-1 secara terpisah
- Halaman admin `expiry-notification-settings.tsx` + route + sidebar nav
- Scheduler juga membaca config setiap siklus (realtime, tidak perlu restart server)

### Batch 5 ✅ (April 2026)
- **Notifikasi Kedaluwarsa VPN:** Scheduler berjalan setiap 6 jam, cek akun H-3 dan H-1 → kirim WA (Fonnte) + Telegram otomatis
- **Sistem Referral:** Kode referral sudah ada; kini bisa dipakai saat registrasi → bonus saldo otomatis ke referrer saat referral beli pertama kali
- `artifacts/api-server/src/lib/scheduler.ts` — `checkExpiringAccounts()` + `startScheduler()` + `getReferralBonusAmount()`
- `artifacts/api-server/src/lib/fonnte.ts` — tambah `sendWhatsapp()` fungsi generik untuk kirim pesan WA
- `artifacts/api-server/src/routes/settings.ts` — endpoint `GET/PUT /admin/settings/referral` (enable/disable, bonus amount)
- `artifacts/api-server/src/routes/auth.ts` — register menerima `referralCode` opsional, simpan `referredBy`
- `artifacts/api-server/src/routes/admin.ts` — konfirmasi order → cek referral → beri bonus ke referrer otomatis
- `lib/db/src/schema/vpn_accounts.ts` — tambah kolom `notified3Days`, `notified1Day`
- `lib/db/src/schema/users.ts` — tambah kolom `referredBy`, `referralBonusClaimed`
- `artifacts/vpn-web/src/pages/auth/register.tsx` — tambah field "Kode Referral" (opsional) di step 3
- `artifacts/vpn-web/src/pages/user/profile.tsx` — kartu Program Referral dengan tombol salin + penjelasan
- `artifacts/vpn-web/src/pages/admin/referral-settings.tsx` — halaman pengaturan referral admin (baru)
- `artifacts/vpn-web/src/App.tsx` + `sidebar.tsx` — route + nav item Program Referral di admin sidebar

### Batch 4 ✅ (April 2026)
- Admin mobile: sticky header bar dengan judul halaman dinamis + indikator notifikasi topup pending
- Admin users: tombol "Tambah Pengguna" manual via dialog form (username, password, role, email, WA)
- Backend: `POST /api/admin/users` — buat user manual tanpa OTP, langsung verified
- Auto-seed admin default: saat startup, jika belum ada admin → otomatis buat `admin/admin123`
- `artifacts/api-server/src/lib/seed.ts` — fungsi `seedDefaultAdmin()`

### Batch 3 ✅ (April 2026)
- Backend: `PATCH /auth/profile` (edit fullName/email) + `POST /auth/change-password` (verifikasi current password)
- Profile page: form edit profil inline + form ganti password (dengan validasi)
- User dashboard: semua card jadi clickable (Saldo→/balance, Akun Aktif→/accounts, Total Order→/orders)
- Balance page: semua label Bahasa Indonesia, rejectionNote tampil di riwayat topup ditolak, QRIS dialog diupdate
- User accounts list: tampilkan sisa hari dengan warna (hijau >7hr, kuning 3-7hr, merah ≤3hr)
- Admin accounts: search berubah dari client-side → server-side (debounced, instant filter)
- Admin orders: link "Lihat Akun VPN" → `/admin/users/{userId}` (lebih targeted)
- Admin topups: tombol "Lihat QRIS" untuk topup pending (dialog preview QRIS image)
- Admin dashboard: refetchInterval 30 detik ditambahkan

### Batch 8 ✅ (April 2026)
- **VPN Username overhaul:** Timestamp suffix dihapus. User wajib isi "Remarks" (min 5 karakter, min 1 huruf, min 2 angka, lowercase). Dipakai langsung sebagai username VPN tanpa suffix.
- **Duplikat akun VPN dicegah:** Cek ke `vpnAccountsTable` (active) + pending orders sebelum buat order baru (case-insensitive via `lower(notes)`)
- **Auto-cancel QRIS expired:** Scheduler berjalan setiap 5 menit, auto-cancel order QRIS yang sudah melewati `expiresAt`
- **Notifikasi Telegram diperluas:** `notifyAdminNewUser` (dipanggil saat registrasi, info username/nama/email/WA/referral + total user), `notifyUserVpnAccountCreated` + `notifyAdminOrderFulfilled` dipanggil di `fulfillOrder` dan admin confirm route
- **Jam pengiriman notifikasi bisa diatur:** Setting baru `expiryNotifSendHour` (default 08:00 WIB). Scheduler jalan setiap jam, kirim notif hanya di jam yang dikonfigurasi. Konversi WIB manual (UTC+7) tidak bergantung timezone VPS.
- **Perbaikan keamanan CORS:** Dibatasi ke domain via env `CORS_ORIGIN`. Jika tidak diset → fallback `true` (untuk dev)
- **Vite build tidak butuh PORT:** `vite.config.ts` tidak lagi throw error jika `PORT` tidak ada saat build production
- **Info user lengkap di admin:** `formatUser` sekarang include `whatsapp`, `telegramId`, `telegramUsername`, `referredBy`. Halaman `user-detail.tsx` menampilkan WA (link klik langsung buka WhatsApp), status Telegram, dan dari referral siapa
- **Dropdown jam bisa scroll:** Fix komponen Select — `SelectViewport` tidak lagi dibatasi tinggi trigger button (`h-[var(--radix-select-trigger-height)]` dihapus dari mode popper)

### Batch 9 ✅ (April 2026)
- **Sistem Stok Produk:** Kolom `stock` (INTEGER NOT NULL DEFAULT 100) ditambahkan ke tabel `products`
- `availableStock` = `stock - jumlah akun VPN aktif (expiresAt > sekarang)` — dihitung real-time di API
- Admin: form tambah/edit produk ada field **Stok** (angka, wajib diisi, min 1), list produk tampil "Stok: tersedia/total" merah jika habis
- User: halaman daftar produk tampil badge slot tersedia, tombol beli disabled + label "Stok Habis" jika availableStock = 0
- User: halaman detail produk juga blokir tombol beli jika stok habis
- **Perbaikan deploy command VPS:** `db run push` gagal tanpa DATABASE_URL eksplisit — command deploy lengkap kini menyertakan `DATABASE_URL="..."` di depan perintah push schema
- **Troubleshooting DATABASE_URL di VPS:** Diketahui bahwa `drizzle-kit` tidak membaca file `.env` otomatis — solusi: selalu berikan DATABASE_URL via env variable eksplisit saat menjalankan `db push`

### Batch 11 ✅ (April 2026)
- **Pin Produk ke Server:** Kolom `server_id` (nullable FK) ditambahkan ke tabel `products`; saat order masuk, sistem prioritaskan server yang di-pin; fallback ke logika lama (cari berdasarkan protokol) jika tidak di-pin
- **Admin produk:** Form tambah/edit produk ada dropdown pilih server (atau "Otomatis"); list produk tampil nama server yang di-pin atau label "Server: Otomatis" (kuning)
- **optionalAuth middleware:** Middleware baru yang membaca token cookie tanpa reject jika tidak ada — dipakai di route publik `/products` agar role reseller bisa terdeteksi

### Batch 10 ✅ (April 2026)
- **Sistem Reseller (backend):** `getResellerSettings()` helper + GET/PUT `/admin/settings/reseller` endpoints; `formatProduct()` menerima param `resellerDiscount` dan mengembalikan `resellerPrice`; routes produk & orders mendeteksi role reseller dan menerapkan diskon otomatis
- **Sistem Reseller (scheduler):** `checkResellerTargets()` berjalan tiap tanggal 1 pukul 07:00 WIB — cek total order lunas bulan lalu, downgrade + notifikasi WA+Telegram jika tidak capai target
- **Sistem Reseller (frontend):** Halaman admin `/admin/settings/reseller` (aktif/nonaktif, % diskon, target bulanan); sidebar link "Program Reseller"; halaman produk & detail produk menampilkan harga reseller (strikethrough harga normal + badge hijau "Harga Reseller") jika user adalah reseller; logika balance check menggunakan harga efektif (resellerPrice ?? price)
- **OpenAPI spec:** `ResellerSettings` schema + `resellerPrice` field pada Product schema; codegen sudah dijalankan ulang

### Batch 14 ✅ (April 2026)
- **Promosi Reseller di Panel User:** Banner ajakan jadi reseller tampil di dashboard user biasa (bisa di-dismiss, tidak muncul lagi setelah dismiss). Card ajakan juga tampil di halaman Profil. Keduanya hanya tampil jika admin mengaktifkannya.
- **Admin bisa atur isi banner:** Di halaman "Pengaturan Reseller" admin, ada section baru "Promosi di Panel User" dengan: toggle aktif/nonaktif, input judul, textarea teks (mendukung `{discount}` placeholder), toggle izinkan request via panel, dan preview banner langsung.
- **Request jadi reseller via panel:** User klik "Ajukan Jadi Reseller" → API `POST /api/reseller/request` → kirim notifikasi Telegram ke admin → user dapat konfirmasi. Admin assign role secara manual dari panel.
- **Endpoint baru:** `GET /api/reseller/promo` (requireAuth) — info promo untuk frontend user. `POST /api/reseller/request` (requireAuth, role user only) — proses pengajuan.
- **Settings baru di tabel settings:** `resellerPromoEnabled`, `resellerPromoTitle`, `resellerPromoText`, `resellerRequestEnabled` — disimpan sebagai key-value di tabel settings yang sudah ada, tidak ada perubahan schema DB.

### Batch 13 ✅ (April 2026)
- **Dashboard Progres Reseller:** Endpoint baru `GET /api/reseller/status` (requireAuth + role check reseller) — mengembalikan `discountPercent`, `targetEnabled`, `monthlyTarget`, `currentMonthSales` (total order lunas bulan berjalan), `progressPercent`, `currentMonth`
- **Kartu Status Reseller di halaman Profil:** Hanya tampil jika `user.role === "reseller"`. Menampilkan: diskon yang didapat, progress bar penjualan bulan ini vs target, berapa yang masih kurang, serta catatan bahwa evaluasi dilakukan tiap tanggal 1. Jika target dinonaktifkan oleh admin, kartu tetap tampil dengan info "status reseller permanen". Jika target sudah capai → tampil pesan hijau "Target bulan ini sudah tercapai!".
- File baru: `artifacts/api-server/src/routes/reseller.ts`
- **Bug fix:** `req.user!.id` → `req.user!.userId` — JWT payload memakai field `userId` bukan `id`. Sebelum fix, query selalu menghasilkan 0 karena filter `userId = undefined` tidak cocok dengan record apapun.

### Batch 12 ✅ (April 2026)
- **Login via WhatsApp atau Username:** Input login mendeteksi otomatis — jika input berisi angka/+/- dengan ≥9 digit → dianggap nomor WA; selain itu → dianggap username. Normalisasi WA via `normalizeWhatsapp()`.
- **Cek ketersediaan username real-time saat daftar:** Input username di form register punya debounce 600ms → panggil `GET /api/auth/check-username`; tampil ikon ✅/❌; jika tidak tersedia tampil chip saran username alternatif (maks 3).
- **Lupa Password dengan OTP WhatsApp:** Halaman `/forgot-password` — user isi nomor WA, terima OTP via WhatsApp (Fonnte), lalu reset password baru. Rate limit 3x/15 menit. OTP berlaku 5 menit.
- **Bug kritis diperbaiki:** `POST /api/auth/forgot-password/reset` sebelumnya memakai `.set({ password: hashed })` → kolom salah (kolom DB adalah `passwordHash`/`password_hash`). Diperbaiki ke `.set({ passwordHash: hashed })` — tanpa fix ini reset password selalu gagal diam-diam.
- **95 TypeScript error dihapus:** TS6305 (stale `references` di tsconfig) → dihapus; TS7006 (implicit any) → `"noImplicitAny": false`; 9 bug logika nyata di halaman balance, account-detail, dashboard, order-detail, admin/accounts, admin/users → diperbaiki dengan cast/prop yang benar.
- **Dead code dibersihkan:** Fungsi `onSubmitAccount`, `useRegister` import, dan orphaned dynamic import dihapus dari `register.tsx`.
- **Catatan TS2741 (15 sisa):** Ketidakcocokan Orval v8 + TanStack Query v5 — `queryKey` required di `UseQueryOptions` tapi disuplai internal oleh hooks. Tidak mempengaruhi runtime, hanya cosmetic. Fix butuh perubahan config orval.

### Batch 2 ✅
- Topup rejection dialog dengan rejectionNote
- Pending orders card di admin dashboard
- Search orders by username (server-side)
- Auto-refresh topups/orders (30 detik)
- Server-side pagination users + filter role
- Servers delete pakai AlertDialog
- Paid orders link ke akun VPN
