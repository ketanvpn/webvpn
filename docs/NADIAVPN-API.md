# NadiaVPN Reseller B2B API — Dokumentasi Lengkap

> Sumber: [https://www.nadiavpn.web.id/api-dashboard](https://www.nadiavpn.web.id/api-dashboard)
> Terakhir diperbarui: 7 September 2026
> Versi Dashboard: v2.0 Enterprise

---

## Informasi Umum

| Item              | Value                                        |
| ----------------- | -------------------------------------------- |
| **Base URL**      | `https://www.nadiavpn.web.id/api/v1`         |
| **Autentikasi**   | Header `Authorization: Bearer sk_live_xxx`   |
| **Rate Limit**    | 60 request / menit                           |
| **Format**        | JSON (`Content-Type: application/json`)      |
| **Fee Order**     | Rp 10 / order harian · Rp 200 / order bulanan |

---

## Ringkasan Endpoint

| # | Method   | Endpoint                | Biaya       | Deskripsi                     |
|---|----------|-------------------------|-------------|-------------------------------|
| 1 | `GET`    | `/user/balance`         | Gratis      | Cek saldo & profil reseller   |
| 2 | `GET`    | `/servers`              | Gratis      | Katalog server                |
| 3 | `POST`   | `/vpn/trial`            | Gratis      | Buat akun VPN trial           |
| 4 | `POST`   | `/vpn/order`            | ✅ Potong   | Order akun VPN baru           |
| 5 | `POST`   | `/vpn/renew`            | ✅ Potong   | Perpanjang akun VPN           |
| 6 | `POST`   | `/vpn/migrate`          | ⚠️ Mungkin  | Migrasi ke server lain        |
| 7 | `POST`   | `/vpn/change-protocol`  | Gratis      | Ganti protokol VPN            |
| 8 | `GET`    | `/vpn/accounts`         | Gratis      | List semua akun VPN           |
| 9 | `POST`   | `/vpn/account/details`  | Gratis      | Detail 1 akun spesifik        |
| 10 | `POST`  | `/vpn/account/sync`     | Gratis      | Fix / sync akun               |
| 11 | `DELETE`| `/vpn/account/delete`   | —           | Hapus akun VPN (permanen!)    |
| 12 | `POST`  | `/quota/check`          | Gratis      | Cek kuota XL/AXIS/LIVEON      |
| 13 | `POST`  | `/quota/check`          | Gratis      | Cek kuota Indosat Ooredoo     |

---

## Detail per Endpoint

### 1. Cek Saldo & Profil

```
GET /user/balance
```

Response berisi saldo reseller, nama, email, tier, dan statistik akun.

---

### 2. Katalog Server

```
GET /servers
```

Response berisi daftar server beserta:
- `id` (UUID)
- `name`, `location`, `country`
- `capacity` (max user & usage saat ini)
- `protocols` yang didukung (`vmess`, `vless`, `trojan`, `ssh`)
- `pricing` (harga per durasi)

---

### 3. Trial VPN

```
POST /vpn/trial
```

| Field       | Tipe     | Wajib | Keterangan                                               |
| ----------- | -------- | ----- | -------------------------------------------------------- |
| `server_id` | `string` | ✅    | UUID server dari `/servers`                               |
| `protocol`  | `string` | ✅    | `vmess`, `vless`, `trojan`, atau `ssh` (bukan `zivpn`)   |

**Catatan penting:**
- Durasi sesuai konfigurasi server (default **30 menit**)
- Username & password **di-generate otomatis** oleh sistem
- Limit IP: **1** · Limit Kuota: **1 GB**
- Minimum saldo **Rp 1.000** (tidak dipotong)
- Kuota trial = **3 + jumlah akun berbayar yang pernah dibeli**
- Protokol `zivpn` **tidak didukung** untuk trial

**Contoh Response (201 Created):**
```json
{
  "status": true,
  "code": 201,
  "message": "Akun Trial berhasil dibuat. Masa aktif 30 menit.",
  "data": {
    "account_id": "uuid-akun",
    "username": "trialxxxxx",
    "protocol": "VLESS",
    "uuid": "uuid-config",
    "trial_duration": "30 menit",
    "expire_at": "2026-05-27 15:30:00",
    "config": { ... }
  }
}
```

---

### 4. Order VPN Baru

```
POST /vpn/order
```

| Field       | Tipe     | Wajib | Keterangan                                        |
| ----------- | -------- | ----- | ------------------------------------------------- |
| `server_id` | `string` | ✅    | UUID server dari `/servers`                       |
| `protocol`  | `string` | ✅    | `vmess`, `vless`, `trojan`, `ssh`, atau `zivpn`   |
| `type`      | `string` | ✅    | `day`, `week`, atau `month`                       |
| `duration`  | `number` | ✅    | Jumlah hari / minggu / bulan sesuai `type`        |
| `username`  | `string` | ✅    | Username yang diinginkan                          |

**Biaya:** Memotong saldo. Fee tambahan: Rp 10 / order harian · Rp 200 / order bulanan (di luar harga server).

---

### 5. Perpanjang VPN

```
POST /vpn/renew
```

| Field        | Tipe     | Wajib | Keterangan                          |
| ------------ | -------- | ----- | ----------------------------------- |
| `account_id` | `string` | ✅    | UUID akun dari `/vpn/accounts`      |
| `type`       | `string` | ✅    | `day`, `week`, atau `month`         |
| `duration`   | `number` | ✅    | Jumlah hari / minggu / bulan        |

**Biaya:** Memotong saldo sesuai harga server × durasi.

---

### 6. Migrasi Server

```
POST /vpn/migrate
```

| Field           | Tipe     | Wajib | Keterangan                     |
| --------------- | -------- | ----- | ------------------------------ |
| `account_id`    | `string` | ✅    | UUID akun yang akan migrasi    |
| `new_server_id` | `string` | ✅    | UUID server tujuan             |

**Catatan:**
- Pindahkan sisa masa aktif VPN ke server lain tanpa mengubah config (kecuali IP/Bug)
- **Dapat memotong biaya migrasi** jika ada selisih harga server

---

### 7. Ganti Protokol

```
POST /vpn/change-protocol
```

| Field             | Tipe     | Wajib | Keterangan                                          |
| ----------------- | -------- | ----- | --------------------------------------------------- |
| `account_id`      | `string` | ✅    | UUID akun                                           |
| `target_protocol` | `string` | ✅    | `ssh`, `vmess`, `vless`, `trojan`, atau `zivpn`     |

**Biaya:** Gratis (tidak memotong saldo).

**Rules transformasi username:**
- **SSH → lain**: gunakan username SSH saja (tanpa password)
- **Lain → SSH**: username tetap, field `ssh_password` **wajib diisi**
- **Lain → Lain**: username tetap

⚠️ **Validasi ketat**: username tidak boleh pernah dipakai di protokol tujuan (termasuk akun expired/lama).

---

### 8. List Semua Akun VPN

```
GET /vpn/accounts
```

Response berisi array seluruh akun VPN milik reseller.

---

### 9. Detail Akun VPN

```
POST /vpn/account/details
```

| Field        | Tipe     | Wajib | Keterangan   |
| ------------ | -------- | ----- | ------------ |
| `account_id` | `string` | ✅    | UUID akun    |

Response berisi detail lengkap akun: username, password, links, expiry, config, dsb.

---

### 10. Sync / Fix Akun

```
POST /vpn/account/sync
```

| Field        | Tipe     | Wajib | Keterangan                   |
| ------------ | -------- | ----- | ---------------------------- |
| `account_id` | `string` | ✅    | UUID akun yang akan di-sync  |

Perbaiki config error / hilang di VPS **tanpa memotong saldo**.

---

### 11. Hapus Akun VPN

```
DELETE /vpn/account/delete
```

| Field        | Tipe     | Wajib | Keterangan           |
| ------------ | -------- | ----- | -------------------- |
| `account_id` | `string` | ✅    | UUID akun yang dihapus |

⚠️ **Hapus akun secara permanen dari server. Tindakan ini tidak bisa dibatalkan!**

> **Catatan**: Dashboard API code generator tidak menyertakan `account_id` di body curl/nodejs snippet.
> Kemungkinan `account_id` dikirim via request body JSON atau query parameter — perlu diverifikasi.

---

### 12. Cek Kuota XL

```
POST /quota/check
```

| Field      | Tipe     | Wajib | Keterangan                                   |
| ---------- | -------- | ----- | -------------------------------------------- |
| `provider` | `string` | ✅    | Nilai tetap: `"xl"`                          |
| `msisdn`   | `string` | ✅    | Nomor HP XL / AXIS / LIVEON (format 08xxx)   |

---

### 13. Cek Kuota Indosat

```
POST /quota/check
```

| Field      | Tipe     | Wajib | Keterangan                                    |
| ---------- | -------- | ----- | --------------------------------------------- |
| `provider` | `string` | ✅    | Nilai tetap: `"indosat"`                      |
| `msisdn`   | `string` | ✅    | Nomor HP Indosat Ooredoo (format 08xxx)       |

---

## Contoh Request

```bash
# Cek saldo
curl -H "Authorization: Bearer sk_live_xxx" \
  -H "Accept: application/json" \
  https://www.nadiavpn.web.id/api/v1/user/balance

# List server
curl -H "Authorization: Bearer sk_live_xxx" \
  -H "Accept: application/json" \
  https://www.nadiavpn.web.id/api/v1/servers

# Trial VPN
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"server_id":"SERVER_UUID","protocol":"vless"}' \
  https://www.nadiavpn.web.id/api/v1/vpn/trial

# Order VPN baru (mingguan)
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"server_id":"SERVER_UUID","protocol":"vmess","type":"week","duration":1,"username":"userku"}' \
  https://www.nadiavpn.web.id/api/v1/vpn/order

# Renew VPN (bulanan)
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"account_id":"ACCOUNT_UUID","type":"month","duration":1}' \
  https://www.nadiavpn.web.id/api/v1/vpn/renew

# Migrasi server
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"account_id":"ACCOUNT_UUID","new_server_id":"NEW_SERVER_UUID"}' \
  https://www.nadiavpn.web.id/api/v1/vpn/migrate

# Ganti protokol
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"account_id":"ACCOUNT_UUID","target_protocol":"ssh"}' \
  https://www.nadiavpn.web.id/api/v1/vpn/change-protocol

# List semua akun
curl -H "Authorization: Bearer sk_live_xxx" \
  -H "Accept: application/json" \
  https://www.nadiavpn.web.id/api/v1/vpn/accounts

# Detail akun
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"account_id":"ACCOUNT_UUID"}' \
  https://www.nadiavpn.web.id/api/v1/vpn/account/details

# Sync / fix akun
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"account_id":"ACCOUNT_UUID"}' \
  https://www.nadiavpn.web.id/api/v1/vpn/account/sync

# Hapus akun (PERMANEN!)
curl -X DELETE \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Accept: application/json" \
  https://www.nadiavpn.web.id/api/v1/vpn/account/delete

# Cek kuota XL / AXIS / LIVEON
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"provider":"xl","msisdn":"087812345678"}' \
  https://www.nadiavpn.web.id/api/v1/quota/check

# Cek kuota Indosat Ooredoo
curl -X POST \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"provider":"indosat","msisdn":"081512345678"}' \
  https://www.nadiavpn.web.id/api/v1/quota/check
```

---

## Protokol yang Didukung

| Protokol  | Order | Trial | Ganti Protokol | Keterangan       |
| --------- | ----- | ----- | -------------- | ---------------- |
| `vmess`   | ✅    | ✅    | ✅             |                  |
| `vless`   | ✅    | ✅    | ✅             |                  |
| `trojan`  | ✅    | ✅    | ✅             |                  |
| `ssh`     | ✅    | ✅    | ✅             |                  |
| `zivpn`   | ✅    | ❌    | ✅             | Tidak bisa trial |

---

## Tipe Durasi (Order & Renew)

| Tipe    | Keterangan                      |
| ------- | ------------------------------- |
| `day`   | Per hari                        |
| `week`  | Per minggu                      |
| `month` | Per bulan                       |

Field `duration` berisi jumlah satuan sesuai `type`. Contoh: `type: "week", duration: 2` = 2 minggu.

---

## Response Format

### Sukses
```json
{
  "status": true,
  "code": 200,
  "message": "Deskripsi sukses",
  "data": { ... }
}
```

### Error
```json
{
  "status": false,
  "code": 400,
  "message": "Deskripsi error"
}
```

### Kode HTTP Umum

| Kode  | Keterangan                                |
| ----- | ----------------------------------------- |
| `200` | Sukses                                    |
| `201` | Created (Trial / Order berhasil)          |
| `400` | Request tidak valid (field kurang/salah)  |
| `401` | Token tidak valid atau tidak ada          |
| `429` | Rate limit tercapai (60 req/menit)       |
| `500` | Server error                              |
