/**
 * Types for Config Generator API
 */

export type HcGenerateResponse = {
  success: true;
  data: {
    format: "hc";
    variant: "locked";
    method: "ssh" | "xray";
    filename: string;
    content: string;
    contentBase64: string;
  };
};

export type DarkGenerateResponse = {
  success: true;
  data: {
    format: "dark";
    variant: "locked";
    method: "ssh" | "vmess" | "vless" | "trojan";
    filename: string;
    link: string;
    config: {
      type: string;
      name: string;
      encryptedLockedConfig: string;
      [key: string]: unknown;
    };
  };
};

export type GeneratorApiStatus = {
  configured: boolean;
  available?: boolean;
  endpoints?: string[];
  message?: string;
};

/**
 * Check if Generator API is configured and available
 */
export async function checkGeneratorApiStatus(): Promise<GeneratorApiStatus> {
  try {
    const response = await fetch("/api/config/status", {
      credentials: "include",
    });

    if (!response.ok) {
      return { configured: false, message: "Failed to check Generator API status" };
    }

    return await response.json();
  } catch (error) {
    return {
      configured: false,
      message: error instanceof Error ? error.message : "Generator API unreachable",
    };
  }
}

/**
 * Generate HTTP Custom (.hc) config file
 */
async function parseJsonSafe(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function generateHcConfig(params: {
  presetId: number;
  accountId: number;
  name?: string;
  noteHtml?: string;
}): Promise<HcGenerateResponse> {
  const response = await fetch("/api/config/hc/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error((data.message as string) || (data.error as string) || `HTTP ${response.status}`);
  }

  return data as HcGenerateResponse;
}

export async function generateDarkConfig(params: {
  presetId: number;
  accountId: number;
  name?: string;
  noteHtml?: string;
}): Promise<DarkGenerateResponse> {
  const response = await fetch("/api/config/dark/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error((data.message as string) || (data.error as string) || `HTTP ${response.status}`);
  }

  return data as DarkGenerateResponse;
}

/**
 * Download a file from base64 content
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBase64File(
  base64Content: string,
  filename: string,
  mimeType: string = "application/octet-stream",
): void {
  if (!base64Content || typeof base64Content !== "string") {
    throw new Error("Base64 content is empty");
  }
  const cleaned = base64Content.trim().replace(/\s/g, "");
  if (!cleaned) throw new Error("Base64 content is empty");
  let binaryString: string;
  try {
    binaryString = atob(cleaned);
  } catch {
    throw new Error("Invalid base64 content");
  }
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  triggerBlobDownload(blob, filename);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = "application/octet-stream;charset=utf-8",
): void {
  if (!filename) throw new Error("Filename is required");
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(blob, filename);
}

export function isBase64(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const cleaned = value.trim().replace(/\s/g, "");
  if (cleaned.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
}
