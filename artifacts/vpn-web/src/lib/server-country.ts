export type ParsedLocation = {
  countryCode: string;
  countryName: string;
};

const COUNTRY_MAP: Record<string, ParsedLocation> = {
  sg: { countryCode: "SG", countryName: "Singapore" },
  singapore: { countryCode: "SG", countryName: "Singapore" },
  id: { countryCode: "ID", countryName: "Indonesia" },
  indonesia: { countryCode: "ID", countryName: "Indonesia" },
  jakarta: { countryCode: "ID", countryName: "Indonesia" },
  us: { countryCode: "US", countryName: "United States" },
  "united states": { countryCode: "US", countryName: "United States" },
  "united states of america": { countryCode: "US", countryName: "United States" },
  jp: { countryCode: "JP", countryName: "Japan" },
  japan: { countryCode: "JP", countryName: "Japan" },
  nl: { countryCode: "NL", countryName: "Netherlands" },
  netherlands: { countryCode: "NL", countryName: "Netherlands" },
  de: { countryCode: "DE", countryName: "Germany" },
  germany: { countryCode: "DE", countryName: "Germany" },
  uk: { countryCode: "GB", countryName: "United Kingdom" },
  "united kingdom": { countryCode: "GB", countryName: "United Kingdom" },
  au: { countryCode: "AU", countryName: "Australia" },
  australia: { countryCode: "AU", countryName: "Australia" },
  my: { countryCode: "MY", countryName: "Malaysia" },
  malaysia: { countryCode: "MY", countryName: "Malaysia" },
  th: { countryCode: "TH", countryName: "Thailand" },
  thailand: { countryCode: "TH", countryName: "Thailand" },
  hk: { countryCode: "HK", countryName: "Hong Kong" },
  "hong kong": { countryCode: "HK", countryName: "Hong Kong" },
  in: { countryCode: "IN", countryName: "India" },
  india: { countryCode: "IN", countryName: "India" },
  ca: { countryCode: "CA", countryName: "Canada" },
  canada: { countryCode: "CA", countryName: "Canada" },
  br: { countryCode: "BR", countryName: "Brazil" },
  brazil: { countryCode: "BR", countryName: "Brazil" },
  ru: { countryCode: "RU", countryName: "Russia" },
  russia: { countryCode: "RU", countryName: "Russia" },
  kr: { countryCode: "KR", countryName: "South Korea" },
  "south korea": { countryCode: "KR", countryName: "South Korea" },
  korea: { countryCode: "KR", countryName: "South Korea" },
  tw: { countryCode: "TW", countryName: "Taiwan" },
  taiwan: { countryCode: "TW", countryName: "Taiwan" },
  ph: { countryCode: "PH", countryName: "Philippines" },
  philippines: { countryCode: "PH", countryName: "Philippines" },
  vn: { countryCode: "VN", countryName: "Vietnam" },
  vietnam: { countryCode: "VN", countryName: "Vietnam" },
  sg01: { countryCode: "SG", countryName: "Singapore" },
  sg02: { countryCode: "SG", countryName: "Singapore" },
  id01: { countryCode: "ID", countryName: "Indonesia" },
  id02: { countryCode: "ID", countryName: "Indonesia" },
};

export function parseServerLocation(location: string | null | undefined): ParsedLocation | null {
  if (!location) return null;

  const normalized = location.toLowerCase().trim();
  
  if (!normalized) return null;
  
  const directMatch = COUNTRY_MAP[normalized];
  if (directMatch) return directMatch;
  
  if (/^sg-\d+$/i.test(normalized)) {
    return COUNTRY_MAP.sg;
  }
  if (/^id-\d+$/i.test(normalized)) {
    return COUNTRY_MAP.id;
  }
  
  return null;
}
