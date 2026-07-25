export const LINK_ORDER = ["tls", "none", "grpc", "uptls", "upntls"];

export const LINK_LABELS: Record<string, string> = {
  tls: "WS TLS",
  none: "WS No TLS",
  grpc: "gRPC TLS",
  uptls: "Upgrade TLS",
  upntls: "Upgrade No TLS",
};

export const SSH_WS_PAYLOADS = [
  {
    title: "CDN",
    payload: "GET / HTTP/1.1[crlf]Host: [host_port][crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]",
  },
  {
    title: "WITHPATH",
    payload: "GET /worryfree/ssh HTTP/1.1[crlf]Host: BUG[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]",
  },
];

export const NON_LINK_KEYS = [
  "hostname",
  "servername",
  "host",
  "domain",
  "server",
  "cloudfront",
  "sni",
];

export function pickDisplayHost(
  allLinks: Record<string, string | null> | null | undefined,
  fallback: string,
): string {
  const values = [
    allLinks?.domain,
    allLinks?.cloudfront,
    allLinks?.host,
    allLinks?.server,
    allLinks?.sni,
    allLinks?.servername,
    allLinks?.hostname,
    fallback,
  ];
  return (
    values.find((value) => {
      const normalized = String(value ?? "").trim().toLowerCase();
      return normalized && !["no", "none", "null", "undefined", "-"].includes(normalized);
    }) ?? ""
  );
}
