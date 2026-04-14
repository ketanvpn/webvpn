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
- Port: `18678` (via env `PORT`)

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

# Push perubahan schema ke PostgreSQL
pnpm --filter @workspace/db run push

# Jalankan dev server API
pnpm --filter @workspace/api-server run dev

# Jalankan dev server frontend
pnpm --filter @workspace/vpn-web run dev
```

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
| `products` | id, name, protocol, durationDays, price, quota, serverId |
| `orders` | id, userId, productId, amount, status (pending/paid/failed/expired), paymentMethod, notes, vpnAccountId |
| `vpn_accounts` | id, userId, protocol, username, password, uuid, serverId, configLink, allLinks, expiresAt, isActive |
| `topup_transactions` | id, userId, amount, qrisUrl, status (pending/confirmed/rejected), confirmedBy, rejectionNote |
| `settings` | key, value — menyimpan konfigurasi Telegram bot (telegramBotToken, telegramAdminChatId, telegramEnabled, telegramBotUsername) |
| `balance_logs` | id, userId, type, amount, balanceBefore, balanceAfter, description, relatedId, createdAt — log semua perubahan saldo |

---

## API Routes (`artifacts/api-server/src/routes/`)

### Public / Auth
- `POST /api/auth/register` — daftar user baru
- `POST /api/auth/login` — login, set JWT cookie
- `POST /api/auth/logout` — hapus cookie
- `GET /api/auth/me` — info user yang login

### User (requireAuth)
- `GET /api/balance` — saldo user
- `POST /api/balance/topup` — buat permintaan topup + QRIS
- `GET /api/balance/topup/history` — riwayat topup
- `GET /api/balance/logs` — log semua perubahan saldo user (topup, pembelian, penyesuaian)
- `GET /api/products` — daftar produk
- `GET /api/products/:id` — detail produk
- `GET /api/servers` — daftar server (publik)
- `POST /api/orders` — beli produk
- `GET /api/orders` — riwayat order user
- `GET /api/orders/:id` — detail order
- `POST /api/orders/:id/pay` — bayar order dengan saldo
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
- `GET /api/admin/products` — list produk
- `POST /api/admin/products` — buat produk baru
- `PUT /api/admin/products/:id` — update produk
- `DELETE /api/admin/products/:id` — hapus produk
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

### Batch 2 ✅
- Topup rejection dialog dengan rejectionNote
- Pending orders card di admin dashboard
- Search orders by username (server-side)
- Auto-refresh topups/orders (30 detik)
- Server-side pagination users + filter role
- Servers delete pakai AlertDialog
- Paid orders link ke akun VPN
