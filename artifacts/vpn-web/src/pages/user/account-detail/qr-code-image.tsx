export function QrCodeImage({ data, label }: { data: string; label: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data)}`;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-xl border-2 border-muted shadow">
        <img
          src={url}
          alt={`QR Code ${label}`}
          width={220}
          height={220}
          className="block"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Scan menggunakan aplikasi VPN seperti V2Ray, NekoBox, atau Shadowrocket.
      </p>
    </div>
  );
}
