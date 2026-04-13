# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run --filter @workspace/api-spec codegen` — Re-run OpenAPI → client codegen
- `pnpm --filter @workspace/db run push` — Push DB schema changes to PostgreSQL

## Artifacts

### VPN Store Web (`artifacts/vpn-web`)
- React + Vite SPA, preview path: `/`
- Port: `18678` (set via `PORT` env var)

### API Server (`artifacts/api-server`)
- Express 5 REST API, base path: `/api`
- Port: `8080`
- Auth: JWT in httpOnly cookie (`token`)

## Project: KETANTECH VPN Store

An Indonesian VPN sales platform with both user-facing and admin dashboards.

### Features
- **User dashboard**: balance display (IDR), active VPN accounts, order history, account renewal
- **Product store**: Browse SSH, VMess, VLess, Trojan, Shadowsocks packages with protocol filters
- **Balance & Topup**: QRIS payment requests, topup history
- **VPN accounts**: View config links (vmess://, vless://, trojan://), copy-to-clipboard, renewal
- **Admin panel**: User management, product CRUD, server CRUD, order management, topup approval/rejection
- **Admin dashboard**: Revenue stats (today/month), order counts, active accounts, order breakdown by protocol; stat cards are clickable links to relevant pages
- **Admin sidebar**: Badge notifikasi kuning menampilkan jumlah topup pending di menu "Topups"
- **Admin Users**: Filter berdasarkan role (user/reseller/admin)
- **Admin Orders**: Tampilkan remarks/notes pesanan; tombol hapus order (non-paid only) dengan konfirmasi dialog
- **Admin VPN Accounts**: Tombol "Perpanjang" (extend expiry by N days), toggle aktif/nonaktif, dan hapus akun permanen
- **Admin User Detail**: Adjust saldo user manual (+/-)
- **API Admin routes (baru)**: POST /admin/accounts/:id/extend, DELETE /admin/accounts/:id, DELETE /admin/orders/:id

### Test Credentials
- Admin: `admin` / `admin123`
- Demo user: `demo` / `demo123`

### DB Schema (`lib/db/src/schema/`)
- `users` — user accounts with role (user/reseller/admin), balance (IDR), isActive
- `vpn_servers` — VPN server info (host, API URL, supported protocols, flag)
- `products` — VPN packages (protocol, duration, price, quota)
- `orders` — purchase orders (pending/paid/failed/expired)
- `vpn_accounts` — active VPN credentials (username, password, UUID, configLink, expiresAt)
- `topup_transactions` — balance topup requests with QRIS info

### API Routes (`artifacts/api-server/src/routes/`)
- `auth.ts` — POST /auth/register, /auth/login, /auth/logout, GET /auth/me
- `products.ts` — GET /products, /products/:id
- `servers.ts` — GET /servers (public)
- `orders.ts` — GET/POST /orders, GET /orders/:id, POST /orders/:id/pay
- `accounts.ts` — GET /accounts, /accounts/:id, POST /accounts/:id/renew
- `balance.ts` — GET /balance, POST /balance/topup, GET /balance/topup/history
- `dashboard.ts` — GET /dashboard/summary
- `admin.ts` — All /admin/* routes (users, products, servers, orders, topups)

### Bot (`botvpn-fixed/`)
Fixed Telegram bot for VPN sales management.
- Uses SQLite (`sellvpn.db`) — separate from the web app's PostgreSQL
- Fixed modules: create, renew, del, lock, unlock, trial
- Uses axios instead of exec(curl) for AutoScript Potato API calls
- Shared DB connection in `modules/db.js` with WAL mode
