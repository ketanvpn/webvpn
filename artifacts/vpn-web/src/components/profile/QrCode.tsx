export function SimpleQrBox({ value, size = 160 }: { value: string; size?: number }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/register?ref=${encodeURIComponent(value)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}`;

  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border shadow-sm">
      <img
        src={qrApiUrl}
        width={size}
        height={size}
        alt={`QR kode referral ${value}`}
        className="rounded-lg bg-white"
        loading="lazy"
        decoding="async"
      />
      <p className="text-[11px] text-muted-foreground text-center leading-tight break-all max-w-[200px]">{link}</p>
    </div>
  );
}

export function QrCode(props: { value: string; size?: number; className?: string }) {
  return <SimpleQrBox {...props} />;
}
