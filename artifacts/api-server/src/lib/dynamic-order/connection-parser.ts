// File: artifacts/api-server/src/lib/dynamic-order/connection-parser.ts

function stringifyConfigValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

/**
 * Mengekstrak detail koneksi (host, port, payload, url) dari respon NadiaVPN.
 * Telah disesuaikan dengan format API terbaru NadiaVPN (v2.0 Enterprise).
 */
export function extractNadiaConnectionDetails(response: any, protocol?: string): Record<string, string | null> | null {
  const data = response?.data ?? {};
  const config = data.config ?? data.config_data;
  const rawLinks = config?.link;
  const serverInfo = data.server && typeof data.server === "object" ? data.server : {};

  // 1. Jika ini VMess/VLess/Trojan, biasanya mereka punya array/object `link`
  if (rawLinks && typeof rawLinks === "object") {
    const links: Record<string, string | null> = {
      hostname: stringifyConfigValue(config?.hostname ?? data.hostname),
      servername: stringifyConfigValue(config?.servername ?? data.servername),
      host: stringifyConfigValue(config?.host ?? data.host),
      domain: stringifyConfigValue(serverInfo?.domain ?? config?.domain ?? data.domain),
      server: stringifyConfigValue(config?.server ?? data.server),
      sni: stringifyConfigValue(config?.sni ?? data.sni),
      cloudfront: stringifyConfigValue(config?.cloudfront ?? data.cloudfront),
    };
    for (const [key, value] of Object.entries(rawLinks)) {
      links[key] = typeof value === "string" ? value : null;
    }
    return links;
  }

  // 2. Jika tidak ada `link` (biasanya SSH), kita ambil port dan payload manual
  if (!config || typeof config !== "object") return null;

  const port = config.port && typeof config.port === "object" ? config.port : {};
  const payloadws = config.payloadws && typeof config.payloadws === "object" ? config.payloadws : {};
  
  const details: Record<string, string | null> = {
    // Info Dasar
    hostname: stringifyConfigValue(config.hostname ?? data.hostname),
    servername: stringifyConfigValue(config.servername ?? data.servername),
    domain: stringifyConfigValue(serverInfo?.domain ?? config.domain ?? data.domain),
    host: stringifyConfigValue(config.host ?? data.host),
    cloudfront: stringifyConfigValue(config.cloudfront ?? data.cloudfront),
    sni: stringifyConfigValue(config.sni ?? data.sni),
    pubkey: stringifyConfigValue(config.pubkey),
    isp: stringifyConfigValue(config.ISP),
    city: stringifyConfigValue(config.CITY),
    ip: stringifyConfigValue(config.ip ?? data.ip),
    
    // Port Lengkap
    port_openssh: stringifyConfigValue(port.openssh ?? port.ssh),
    port_dropbear: stringifyConfigValue(port.dropbear),
    port_ws_tls: stringifyConfigValue(port.ws_tls ?? port.tls),
    port_ws_http: stringifyConfigValue(port.ws_http ?? port.none),
    port_openvpn_tcp: stringifyConfigValue(port.openvpn_tcp ?? port.ovpntcp),
    port_openvpn_udp: stringifyConfigValue(port.openvpn_udp ?? port.ovpnudp),
    port_badvpn: stringifyConfigValue(port.badvpn),
    port_squid: stringifyConfigValue(port.squid),
    port_udpcustom: stringifyConfigValue(port.udpcustom),
    port_slowdns: stringifyConfigValue(port.slowdns),
    
    // Proxy & URL
    squid_proxy: stringifyConfigValue(config.squid_proxy),
    http_proxy: stringifyConfigValue(config.http_proxy),
    http_custom: stringifyConfigValue(config.http_custom),
    ovpn_tcp_url: stringifyConfigValue(config.ovpn_tcp ?? config.ovpn_url),
    
    // Payload WebSocket
    payload_tls: stringifyConfigValue(payloadws.payloadtls),
    payload_nontls: stringifyConfigValue(payloadws.payloadnontls),
  };

  return Object.values(details).some(Boolean) ? details : null;
}

export function extractProviderAccountId(data: any): string | null {
  return stringifyConfigValue(
    data?.account_id ??
    data?.accountId ??
    data?.id ??
    data?.account?.account_id ??
    data?.account?.id,
  );
}
