# NadiaVPN Reseller B2B API — Dokumentasi Lengkap

> **Status**: Terverifikasi langsung via Live API Tester (7 September 2026)  
> **Base URL**: `https://www.nadiavpn.web.id/api/v1`  
> **Versi Dashboard**: v2.0 Enterprise

---

## 1. Informasi Umum & Autentikasi

| Item | Value |
|---|---|
| **Base URL** | `https://www.nadiavpn.web.id/api/v1` |
| **Autentikasi** | Header `Authorization: Bearer sk_live_YOUR_TOKEN` |
| **Headers Wajib** | `Accept: application/json`, `Content-Type: application/json` (untuk POST/DELETE) |
| **Rate Limit** | 60 request / menit |
| **Biaya API** | Rp 10 / order harian · Rp 200 / order bulanan (di luar harga server) |

### Struktur Response Standar

Semua endpoint mengembalikan format envelope yang konsisten:

**Sukses:**
```json
{
  "status": true,
  "code": 200,
  "message": "Pesan sukses dari server.",
  "data": { ... }
}
```

**Validasi Gagal (HTTP 422):**
```json
{
  "status": false,
  "code": 422,
  "message": "The server id field is required.",
  "data": null
}
```

**Unauthorized (HTTP 401):**
```json
{
  "status": false,
  "code": 401,
  "message": "Unauthorized. API Key (Bearer Token) tidak ditemukan."
}
```

**Forbidden / Server Tertentu (HTTP 403):**
```json
{
  "status": false,
  "code": 403,
  "message": "Server ini tidak mengizinkan akun Trial.",
  "data": null
}
```

**Bad Request / Tipe Tidak Didukung (HTTP 400):**
```json
{
  "status": false,
  "code": 400,
  "message": "Tipe langganan (month) belum diaktifkan untuk order baru di server ini."
}
```

---

## 2. Ringkasan Endpoint

| # | Method | Endpoint | Biaya | Deskripsi |
|---|---|---|---|---|
| 1 | `GET` | `/user/balance` | Gratis | Cek saldo, profil & statistik transaksi bulanan |
| 2 | `GET` | `/servers` | Gratis | Katalog server, kapasitas, protokol, & harga |
| 3 | `POST` | `/vpn/trial` | Gratis | Buat akun VPN Trial (30 menit) |
| 4 | `POST` | `/vpn/order` | 💰 Saldo | Order akun VPN baru (day / week / month) |
| 5 | `POST` | `/vpn/renew` | 💰 Saldo | Perpanjang akun VPN (day / week / month) |
| 6 | `POST` | `/vpn/migrate` | ⚠️ Selisih | Pindah server sisa masa aktif |
| 7 | `POST` | `/vpn/change-protocol` | Gratis | Ganti protokol di server yang sama |
| 8 | `GET` | `/vpn/accounts` | Gratis | List semua akun VPN aktif & expired |
| 9 | `POST` | `/vpn/account/details` | Gratis | Detail lengkap 1 akun + config & link |
| 10 | `POST` | `/vpn/account/sync` | Gratis | Fix / sync ulang config di VPS |
| 11 | `DELETE` | `/vpn/account/delete` | Gratis | Hapus akun VPN secara permanen |

---

## 3. Detail Setiap Endpoint

---

### 1. Cek Saldo & Profil Reseller

```http
GET /api/v1/user/balance
Authorization: Bearer sk_live_xxx
Accept: application/json
```

**Contoh Response (HTTP 200):**
```json
{
  "status": true,
  "code": 200,
  "message": "Data profil reseller berhasil diambil.",
  "data": {
    "username": "ushshsus1169",
    "email": "user@example.com",
    "balance": 37678,
    "api_trx_count": 56,
    "monthly_stats": {
      "period": "2026-09",
      "daily_order_count": 3,
      "daily_renew_count": 0,
      "weekly_order_count": 0,
      "weekly_renew_count": 0,
      "monthly_order_count": 3,
      "monthly_renew_count": 0,
      "fee_daily": 30,
      "fee_weekly": 0,
      "fee_monthly": 600,
      "fee_total": 630
    }
  }
}
```

---

### 2. Katalog Server

```http
GET /api/v1/servers
Authorization: Bearer sk_live_xxx
Accept: application/json
```

**Field Penting per Server:**
- `server_id` (UUID): ID unik server untuk order/trial/migrasi.
- `supported_protocols`: Array protokol yang didukung (`["ssh", "vmess", "vless", "trojan"]`).
- `supported_types`: Array durasi yang diizinkan untuk order/renew di server ini (`["day", "week", "month"]`). **PENTING**: Beberapa server hanya mendukung `["week"]` atau `["month"]`. Order dengan tipe di luar array ini akan ditolak (HTTP 400).
- `trial_enabled`: `true`/`false` apakah server mengizinkan akun Trial.
- `renew_enabled`: `true`/`false` apakah akun di server ini bisa diperpanjang.
- `migration_enabled`: `true`/`false` apakah server bisa jadi target migrasi.
- `pricing`: Objek `{ per_day: number, per_week: number, per_month: number }`.
- `capacity`: Objek `{ limit: "Unlimited"|number, used: number, is_full: boolean }`.
- `domain_cloudfront`: Domain CDN CloudFront jika server mendukung CloudFront WebSocket.

**Contoh Response (HTTP 200):**
```json
{
  "status": true,
  "code": 200,
  "message": "Daftar server berhasil diambil.",
  "data": {
    "total_servers": 13,
    "servers": [
      {
        "server_id": "019d4b9f-7fb5-7369-8f4b-8974abd0123c",
        "name": "RAJAMITRA",
        "location": "ID",
        "domain": "id.vpnstore28.my.id",
        "domain_cloudfront": null,
        "is_active": true,
        "is_virtual": false,
        "supported_protocols": ["ssh", "vmess", "vless", "trojan"],
        "supported_types": ["day", "week", "month"],
        "trial_enabled": true,
        "trial_duration": null,
        "renew_enabled": true,
        "migration_enabled": true,
        "migration_price": 0,
        "pricing": {
          "per_day": 267,
          "per_week": 1869,
          "per_month": 6000
        },
        "capacity": {
          "limit": "Unlimited",
          "used": 150,
          "is_full": false
        }
      }
    ]
  }
}
```

---

### 3. Trial VPN Gratis

```http
POST /api/v1/vpn/trial
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "server_id": "019d4b9f-7fb5-7369-8f4b-8974abd0123c",
  "protocol": "vless"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `server_id` | `string` (UUID) | ✅ | Server yang memiliki `trial_enabled: true` |
| `protocol` | `string` | ✅ | `ssh`, `vmess`, `vless`, atau `trojan` (huruf kecil) |

**Aturan & Batasan Trial:**
- Durasi: **30 menit** (sesuai setting server).
- Username & password: **Otomatis di-generate** oleh sistem.
- Limit IP: **1 device** · Kuota: **1 GB**.
- Syarat saldo: Minimal saldo akun **Rp 1.000** (hanya syarat, **saldo tidak dipotong**).
- Kuota Trial per akun reseller: **3 + jumlah akun berbayar yang pernah dibeli**.
- Protokol `zivpn`: **TIDAK didukung** untuk trial.

**Contoh Response (HTTP 201 Created):**
```json
{
  "status": true,
  "code": 201,
  "message": "Akun Trial berhasil dibuat. Masa aktif 30 menit.",
  "data": {
    "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2",
    "username": "trial12345",
    "protocol": "VLESS",
    "uuid": "d96e472f-88cf-401c-921c-f3b49f170f59",
    "trial_duration": "30 menit",
    "expire_at": "2026-09-07 14:30:00",
    "config": { ... }
  }
}
```

---

### 4. Order VPN Baru

```http
POST /api/v1/vpn/order
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "server_id": "019d4b9f-7fb5-7369-8f4b-8974abd0123c",
  "protocol": "vless",
  "type": "month",
  "duration": 1,
  "username": "userku123"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `server_id` | `string` (UUID) | ✅ | Server tujuan |
| `protocol` | `string` | ✅ | `ssh`, `vmess`, `vless`, `trojan`, atau `zivpn` |
| `type` | `string` | ✅ | **`day`**, **`week`**, atau **`month`** (harus ada di `supported_types` server) |
| `duration` | `number` | ✅ | Jumlah hari / minggu / bulan sesuai `type` |
| `username` | `string` | ✅ | Username akun VPN (alfanumerik, unik di protokol tsb) |

**Aturan Biaya & Validasi:**
- Memotong saldo: `(harga_server * duration) + fee_api`.
- Fee API: **Rp 10** / order harian, **Rp 200** / order bulanan.
- Jika server tidak mendukung tipe yang diminta (misal order `month` di server yang hanya `["week"]`), server menolak dengan HTTP 400: `"Tipe langganan (month) belum diaktifkan untuk order baru di server ini."`

---

### 5. Perpanjang (Renew) VPN

```http
POST /api/v1/vpn/renew
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2",
  "type": "month",
  "duration": 1
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `account_id` | `string` (UUID) | ✅ | UUID akun dari `/vpn/accounts` |
| `type` | `string` | ✅ | **`day`**, **`week`**, atau **`month`** |
| `duration` | `number` | ✅ | Jumlah satuan durasi |

**Aturan:**
- Server akun harus memiliki `renew_enabled: true`.
- Masa aktif akan bertambah dari tanggal kadaluarsa sebelumnya (jika belum expired) atau dari sekarang (jika sudah expired).
- Memotong saldo sesuai tarif durasi server.

---

### 6. Migrasi Server

```http
POST /api/v1/vpn/migrate
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2",
  "new_server_id": "019d3fd8-5c1e-734d-806e-72feec9973c5"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `account_id` | `string` (UUID) | ✅ | UUID akun yang ingin dipindahkan |
| `new_server_id` | `string` (UUID) | ✅ | UUID server tujuan (`migration_enabled: true`) |

**Catatan:**
- Memindahkan sisa masa aktif VPN ke server lain tanpa mengubah config (kecuali IP / Host / Domain).
- Jika server tujuan memiliki `migration_price > 0`, saldo akan dipotong sebesar biaya tersebut.

---

### 7. Ganti Protokol

```http
POST /api/v1/vpn/change-protocol
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2",
  "target_protocol": "vless"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `account_id` | `string` (UUID) | ✅ | UUID akun VPN |
| `target_protocol` | `string` | ✅ | `ssh`, `vmess`, `vless`, `trojan`, atau `zivpn` |
| `ssh_password` | `string` | ⚠️ | **Wajib diisi** jika mengubah dari non-SSH ke SSH |

**Aturan Transformasi:**
- **Gratis** — tidak memotong saldo reseller. Sisa masa aktif dipertahankan.
- **SSH → Lain**: Username SSH dipertahankan, password dibuang (berganti UUID).
- **Lain → SSH**: Username tetap, field `ssh_password` **wajib dikirim**.
- **Lain → Lain**: Username tetap, UUID config dibuat baru.
- **Validasi Unik**: Username tidak boleh pernah digunakan di protokol tujuan di server tersebut (termasuk akun lama yang sudah expired).

---

### 8. List Semua Akun VPN

```http
GET /api/v1/vpn/accounts
Authorization: Bearer sk_live_xxx
Accept: application/json
```

**Contoh Response (HTTP 200):**
```json
{
  "status": true,
  "code": 200,
  "message": "Daftar akun VPN berhasil ditarik.",
  "data": {
    "total_accounts": 16,
    "accounts": [
      {
        "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2",
        "server_name": "RAJAMITRA",
        "username": "afhii17",
        "protocol": "SSH",
        "status": "active",
        "expire_at": "2026-09-08 10:28:17",
        "days_left": 1
      },
      {
        "account_id": "01a078ec-62f4-70a3-8299-748d439f48b2",
        "server_name": "CLOUD-MTK",
        "username": "afhii10",
        "protocol": "VMESS",
        "status": "active",
        "expire_at": "2026-09-08 05:52:28",
        "days_left": 1
      }
    ]
  }
}
```

---

### 9. Detail Lengkap 1 Akun VPN

```http
POST /api/v1/vpn/account/details
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "account_id": "01a078ec-62f4-70a3-8299-748d439f48b2"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `account_id` | `string` (UUID) | ✅ | UUID akun dari `/vpn/accounts` |

**Struktur Data Response (Akun SSH):**
```json
{
  "status": true,
  "code": 200,
  "message": "Detail akun berhasil ditemukan.",
  "data": {
    "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2",
    "username": "afhii17",
    "password": "SecretPassword",
    "protocol": "SSH",
    "status": "active",
    "type": "day",
    "expire_at": "2026-09-08 10:28:17",
    "days_left": 1,
    "server": {
      "server_id": "019d4b9f-7fb5-7369-8f4b-8974abd0123c",
      "name": "RAJAMITRA",
      "domain": "id.vpnstore28.my.id"
    },
    "config_data": {
      "username": "afhii17",
      "password": "SecretPassword",
      "hostname": "id.vpnstore28.my.id",
      "ip": "103.227.252.190",
      "port": {
        "openssh": "22, 3303",
        "dropbear": "109",
        "ws_tls": "443",
        "ws_http": "80, 8888",
        "squid": "3128",
        "badvpn": "7300",
        "openvpn_tcp": "1194",
        "udpcustom": "1-65535"
      },
      "squid_proxy": "id.vpnstore28.my.id:3128",
      "http_proxy": "id.vpnstore28.my.id:3128",
      "http_custom": "id.vpnstore28.my.id:1-65535@afhii17:SecretPassword",
      "ovpn_tcp": "http://103.227.252.190:81/myvpn-config.zip",
      "servername": "id.vpnstore28.my.id",
      "pubkey": "",
      "payloadws": {
        "payloadtls": "GET /ssh HTTP/1.1[crlf]Host: id.vpnstore28.my.id[crlf]Upgrade: websocket[crlf][crlf]",
        "payloadnontls": "GET /ssh HTTP/1.1[crlf]Host: id.vpnstore28.my.id[crlf]Upgrade: websocket[crlf][crlf]"
      }
    }
  }
}
```

**Struktur Data Response (Akun VMess / VLess / Trojan):**
```json
{
  "status": true,
  "code": 200,
  "message": "Detail akun berhasil ditemukan.",
  "data": {
    "account_id": "01a078ec-62f4-70a3-8299-748d439f48b2",
    "username": "afhii10",
    "password": null,
    "protocol": "VMESS",
    "status": "active",
    "type": "day",
    "expire_at": "2026-09-08 05:52:28",
    "days_left": 1,
    "server": {
      "server_id": "019d3fd8-5c1e-734d-806e-72feec9973c5",
      "name": "CLOUD-MTK",
      "domain": "nusa.vpnstore28.my.id"
    },
    "config_data": {
      "hostname": "nusa.vpnstore28.my.id",
      "ISP": "PT Atria Teknologi Indonesia",
      "CITY": "Jakarta",
      "username": "afhii10",
      "expired": "2026-09-08",
      "uuid": "d96e472f-88cf-401c-921c-f3b49f170f59",
      "time": "1 Days",
      "port": {
        "tls": "443, 8443",
        "none": "80, 8080",
        "any": "2052, 2053, 8880"
      },
      "path": {
        "stn": "/vmess",
        "multi": "/yourbug",
        "grpc": "vmess",
        "up": "/upvmess"
      },
      "link": {
        "tls": "vmess://ey...",
        "none": "vmess://ey...",
        "grpc": "vmess://ey...",
        "uptls": "vmess://ey...",
        "upntls": "vmess://ey..."
      }
    }
  }
}
```

---

### 10. Sync / Fix Akun

```http
POST /api/v1/vpn/account/sync
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `account_id` | `string` (UUID) | ✅ | UUID akun yang perlu di-sync |

**Catatan:**
- **Gratis** — tidak memotong saldo.
- Memvalidasi status akun di VPS server dan menulis ulang konfigurasi/rule jika hilang atau error.
- Mengembalikan response `200` dengan objek konfigurasi terbaru.

**Contoh Response (HTTP 200):**
```json
{
  "status": true,
  "code": 200,
  "message": "Akun tervalidasi di VPS. Konfigurasi berhasil disinkronkan ulang.",
  "data": {
    "config": {
      "username": "afhii17",
      "password": "SecretPassword",
      "hostname": "id.vpnstore28.my.id",
      "ip": "103.227.252.190",
      "squid_proxy": "id.vpnstore28.my.id:3128",
      "http_proxy": "id.vpnstore28.my.id:3128",
      "http_custom": "id.vpnstore28.my.id:1-65535@afhii17:SecretPassword",
      "ovpn_tcp": "http://103.227.252.190:81/myvpn-config.zip",
      "servername": "id.vpnstore28.my.id",
      "exp": "2026-09-08"
    }
  }
}
```

---

### 11. Hapus Akun Permanen

```http
DELETE /api/v1/vpn/account/delete
Authorization: Bearer sk_live_xxx
Content-Type: application/json
Accept: application/json

{
  "account_id": "01a079e8-eb9a-71d4-b418-ef23731023e2"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `account_id` | `string` (UUID) | ✅ | UUID akun yang akan dihapus |

⚠️ **PERINGATAN**: Menghapus akun secara permanen dari server VPS dan database. Tindakan ini **tidak bisa dibatalkan**!

> **PENTING**: Header `Content-Type: application/json` wajib dikirim bersama body JSON `{ "account_id": "..." }`. Jika body kosong, server mengembalikan error HTTP 422: `"The account id field is required."`

---

## 4. Referensi Lengkap Client SDK (TypeScript / Node.js)

```typescript
const BASE_URL = 'https://www.nadiavpn.web.id/api/v1';
const API_KEY = process.env.NADIAVPN_API_KEY; // sk_live_xxx

async function nadiaRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await res.json();
  if (!res.ok || !body.status) {
    throw new Error(`[NadiaVPN ${res.status}] ${body.message || 'Unknown error'}`);
  }
  return body.data;
}

// 1. Cek Saldo
export async function getBalance() {
  return nadiaRequest('/user/balance');
}

// 2. Ambil Server yang Support Durasi Tertentu
export async function getServers(requiredType?: 'day' | 'week' | 'month') {
  const data = await nadiaRequest<{ total_servers: number; servers: any[] }>('/servers');
  if (!requiredType) return data.servers;
  return data.servers.filter((s) => s.supported_types.includes(requiredType));
}

// 3. Buat Akun Trial (30 menit)
export async function createTrial(serverId: string, protocol: 'ssh' | 'vmess' | 'vless' | 'trojan') {
  return nadiaRequest('/vpn/trial', {
    method: 'POST',
    body: JSON.stringify({ server_id: serverId, protocol }),
  });
}

// 4. Order Akun VPN Baru
export async function orderVpn(params: {
  serverId: string;
  protocol: 'ssh' | 'vmess' | 'vless' | 'trojan' | 'zivpn';
  type: 'day' | 'week' | 'month';
  duration: number;
  username: string;
}) {
  return nadiaRequest('/vpn/order', {
    method: 'POST',
    body: JSON.stringify({
      server_id: params.serverId,
      protocol: params.protocol,
      type: params.type,
      duration: params.duration,
      username: params.username,
    }),
  });
}

// 5. Perpanjang Akun
export async function renewVpn(params: {
  accountId: string;
  type: 'day' | 'week' | 'month';
  duration: number;
}) {
  return nadiaRequest('/vpn/renew', {
    method: 'POST',
    body: JSON.stringify({
      account_id: params.accountId,
      type: params.type,
      duration: params.duration,
    }),
  });
}

// 6. Migrasi Server
export async function migrateVpn(accountId: string, newServerId: string) {
  return nadiaRequest('/vpn/migrate', {
    method: 'POST',
    body: JSON.stringify({ account_id: accountId, new_server_id: newServerId }),
  });
}

// 7. Ganti Protokol
export async function changeProtocol(accountId: string, targetProtocol: string, sshPassword?: string) {
  const body: Record<string, string> = { account_id: accountId, target_protocol: targetProtocol };
  if (sshPassword) body.ssh_password = sshPassword;
  return nadiaRequest('/vpn/change-protocol', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// 8. List Semua Akun
export async function listAccounts() {
  return nadiaRequest('/vpn/accounts');
}

// 9. Detail 1 Akun
export async function getAccountDetails(accountId: string) {
  return nadiaRequest('/vpn/account/details', {
    method: 'POST',
    body: JSON.stringify({ account_id: accountId }),
  });
}

// 10. Sync / Fix Akun
export async function syncAccount(accountId: string) {
  return nadiaRequest('/vpn/account/sync', {
    method: 'POST',
    body: JSON.stringify({ account_id: accountId }),
  });
}

// 11. Hapus Akun Permanen
export async function deleteAccount(accountId: string) {
  return nadiaRequest('/vpn/account/delete', {
    method: 'DELETE',
    body: JSON.stringify({ account_id: accountId }),
  });
}
```
