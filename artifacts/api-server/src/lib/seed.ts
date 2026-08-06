import { db } from "@workspace/db";
import {
  easyInjectPresetRevisionsTable,
  easyInjectPresetsTable,
  usersTable,
  appTutorialsTable,
  type EasyInjectPreset,
  type EasyInjectPresetSnapshot,
  type InsertEasyInjectPreset,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { logger } from "./logger";

const EASY_INJECT_PAYLOAD =
  "GET / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]";

const DEFAULT_EASY_INJECT_PRESETS: InsertEasyInjectPreset[] = [
  {
    slug: "gamemax",
    name: "GameMax",
    description: "Untuk paket GameMax menggunakan akun SSH biasa.",
    accountLabel: "SSH biasa",
    requiredAccountKind: "normal",
    sshPort: 80,
    mode: "PROXY",
    proxyHost: "ir.huya.com",
    proxyPort: 80,
    payload: EASY_INJECT_PAYLOAD,
    sniPolicy: "none",
    customSni: null,
    usePayload: true,
    ssl: false,
    supportsDarkTunnel: true,
    supportsHttpCustom: true,
    isActive: true,
    isBuiltIn: true,
    sortOrder: 10,
    version: 1,
    purchaseOptions: [
      {
        id: "gm-main",
        label: "GameMax",
        quotaText: "Unlimited Game",
        url: "https://my.telkomsel.com/app/payment-method?link=fa9f025645de4e8458280c7462acc9320240ecf31a041050799da4964d123a9089295a3c5ee1a2d45527e68c20a0e8ae",
        isActive: true,
        sortOrder: 0,
      },
    ],
  },
  {
    slug: "ilmupedia",
    name: "Ilmupedia",
    description: "Untuk paket Ilmupedia menggunakan akun SSH CloudFront.",
    accountLabel: "SSH CloudFront",
    requiredAccountKind: "cloudfront",
    sshPort: 443,
    mode: "PROXY_SNI",
    proxyHost: "wpassets.kuncie.com",
    proxyPort: 443,
    payload: EASY_INJECT_PAYLOAD,
    sniPolicy: "account_host",
    customSni: null,
    usePayload: true,
    ssl: true,
    supportsDarkTunnel: true,
    supportsHttpCustom: true,
    isActive: true,
    isBuiltIn: true,
    sortOrder: 20,
    version: 1,
    purchaseOptions: [
      {
        id: "ilmu-1",
        label: "Ilmupedia 1",
        url: "https://my.telkomsel.com/app/package-details/68c4b16ef346a8d08b4650e2155c2d0b",
        isActive: true,
        sortOrder: 0,
      },
      {
        id: "ilmu-2",
        label: "Ilmupedia 2",
        url: "https://my.telkomsel.com/app/package-details/ad6bad56793e0077a163fcae1faa18e3",
        isActive: true,
        sortOrder: 1,
      },
    ],
  },
];

function toSeedSnapshot(preset: EasyInjectPreset): EasyInjectPresetSnapshot {
  return {
    id: preset.id,
    slug: preset.slug,
    name: preset.name,
    description: preset.description,
    accountLabel: preset.accountLabel,
    requiredAccountKind: preset.requiredAccountKind,
    sshPort: preset.sshPort,
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: preset.proxyPort,
    payload: preset.payload,
    sniPolicy: preset.sniPolicy,
    customSni: preset.customSni,
    usePayload: preset.usePayload,
    ssl: preset.ssl,
    supportsDarkTunnel: preset.supportsDarkTunnel,
    supportsHttpCustom: preset.supportsHttpCustom,
    purchaseOptions: preset.purchaseOptions,
    isActive: preset.isActive,
    isBuiltIn: preset.isBuiltIn,
    sortOrder: preset.sortOrder,
    version: preset.version,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  };
}

export async function seedDefaultAdmin() {
  try {
    const [existingAdmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (existingAdmin) {
      return;
    }

    const passwordHash = await bcrypt.hash("admin123", 12);
    const referralCode = randomBytes(4).toString("hex").toUpperCase();

    await db.insert(usersTable).values({
      username: "admin",
      email: "admin@ketantech.id",
      passwordHash,
      fullName: "Administrator",
      whatsapp: null,
      isVerified: true,
      role: "admin",
      referralCode,
    });

    logger.info("Default admin created — username: admin, password: admin123");
    logger.warn("PENTING: Segera ganti password admin default setelah login pertama!");
  } catch (err) {
    logger.error({ err }, "Gagal membuat admin default");
  }
}

export async function seedEasyInjectPresets() {
  let insertedCount = 0;

  for (const defaultPreset of DEFAULT_EASY_INJECT_PRESETS) {
    const inserted = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(easyInjectPresetsTable)
        .values(defaultPreset)
        .onConflictDoNothing({ target: easyInjectPresetsTable.slug })
        .returning();

      if (!created) {
        return false;
      }

      await tx.insert(easyInjectPresetRevisionsTable).values({
        presetId: created.id,
        version: created.version,
        snapshot: toSeedSnapshot(created),
        action: "seed",
        adminUserId: null,
      });
      return true;
    });

    if (inserted) {
      insertedCount += 1;
    }
  }

  if (insertedCount > 0) {
    logger.info({ insertedCount }, "Default Easy Inject presets created");
  }
}

export async function seedTutorials() {
  try {
    const [created] = await db
      .insert(appTutorialsTable)
      .values({
        appSlug: "http-custom",
        appName: "HTTP Custom",
        description: "Panduan pengaturan HTTP Custom v7.9.17+ untuk koneksi SSH",
        isActive: true,
        sortOrder: 0,
        steps: [
          {
            id: randomUUID(),
            stepNumber: 1,
            title: "Buka HTTP Custom",
            description:
              "Buka aplikasi **HTTP Custom**. Pastikan kamu menggunakan versi terbaru (v7.9.17+).",
            imageUrl: null,
          },
          {
            id: randomUUID(),
            stepNumber: 2,
            title: "Pilih Protokol SSH",
            description:
              'Di halaman **Beranda**, ketuk chip **SSH** pada daftar protokol yang tersedia.',
            imageUrl: null,
          },
          {
            id: randomUUID(),
            stepNumber: 3,
            title: "Aktifkan Payload",
            description:
              'Aktifkan toggle **"Gunakan payload"** untuk membuka pengaturan payload.',
            imageUrl: null,
          },
          {
            id: randomUUID(),
            stepNumber: 4,
            title: "Pilih Metode Koneksi",
            description:
              "Pilih metode yang sesuai dengan preset kamu:\n- **Enhanced** — untuk koneksi standar\n- **TLS** — untuk koneksi SSL/TLS (SNI akan muncul)\n- **SlowDNS** — untuk jaringan yang memblokir port",
            imageUrl: null,
          },
          {
            id: randomUUID(),
            stepNumber: 5,
            title: "Isi Pengaturan Payload",
            description:
              "Tempel **Custom Payload** dan **Remote Proxy** dari data di atas ke field yang sesuai di kartu Payload.\n\nJika menggunakan metode **TLS**, tempel juga **SNI** ke field Server Name Indication.",
            imageUrl: null,
          },
          {
            id: randomUUID(),
            stepNumber: 6,
            title: "Isi Akun SSH",
            description:
              "Di kartu **Akun**, isi:\n- **SSH Host:Port** — alamat server\n- **Username** — username SSH\n- **Password** — password SSH\n\nAtau tempel langsung format `host:port@username:password` dari field SSH Login di atas.",
            imageUrl: null,
          },
          {
            id: randomUUID(),
            stepNumber: 7,
            title: "Hubungkan",
            description:
              "Kembali ke halaman **Beranda** dan ketuk tombol **▶** (Play) di pojok kanan bawah untuk memulai koneksi.",
            imageUrl: null,
          },
        ],
      })
      .onConflictDoNothing({ target: appTutorialsTable.appSlug })
      .returning();

    if (created) {
      logger.info("Default HTTP Custom tutorial created");
    }
  } catch (err) {
    logger.error({ err }, "Gagal membuat tutorial default");
  }
}
