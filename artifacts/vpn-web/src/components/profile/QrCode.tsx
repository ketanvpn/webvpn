import { useEffect, useRef } from "react";

function makeSimpleQrDataUrl(text: string, size = 180): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    const hash = (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    };
    const seed = hash(text);
    const grid = 16;
    const cell = Math.floor(size / (grid + 2));
    const offset = Math.floor((size - cell * grid) / 2);
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const v = ((seed >> ((x + y) % 24)) + x * 7 + y * 13) & 1;
        const isFinder = (x < 2 && y < 2) || (x >= grid - 2 && y < 2) || (x < 2 && y >= grid - 2);
        if (isFinder || v) {
          ctx.fillRect(offset + x * cell, offset + y * cell, cell - 1, cell - 1);
        }
      }
    }
    ctx.fillStyle = "#000";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text.slice(0, 12), size / 2, size - 4);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    if (typeof window === "undefined") return;

    const win = window as unknown as Record<string, unknown>;
    const QR = (win as any).QRCode as unknown;

    const drawFallback = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#000000";
      const text = value.slice(0, 32);
      ctx.font = `${Math.max(10, size / 14)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = [text.match(/.{1,8}/g) ?? [text]].flat();
      lines.slice(0, 6).forEach((line, i) => {
        ctx.fillText(line, size / 2, size / 2 - 20 + i * 14);
      });
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#666";
      ctx.fillText("Scan: kode referral", size / 2, size - 8);
    };

    import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js" as any)
      .then(() => {})
      .catch(() => {});

    const tryQrLib = async () => {
      try {
        const mod = await import("qrcode");
        const QRCode = (mod as any).default ?? mod;
        await QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        return true;
      } catch {
        return false;
      }
    };

    tryQrLib().then((ok) => {
      if (!ok) {
        const url = makeSimpleQrDataUrl(value, size);
        if (url) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, size, size);
          img.src = url;
        } else {
          drawFallback();
        }
      }
    });
  }, [value, size]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} width={size} height={size} className="rounded-lg border bg-white" style={{ width: size, height: size }} />
    </div>
  );
}

export function SimpleQrBox({ value, size = 160 }: { value: string; size?: number }) {
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${encodeURIComponent(value)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`;

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border shadow-sm">
      <img
        src={qrApiUrl}
        width={size}
        height={size}
        alt={`QR kode referral ${value}`}
        className="rounded-lg"
        loading="lazy"
      />
      <p className="text-[11px] text-muted-foreground text-center leading-tight break-all max-w-[160px]">{link}</p>
    </div>
  );
}
