import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bug, Copy, ArrowRightLeft, CheckCircle2 } from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string) {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

type BugPreset = {
  id: number;
  name: string;
  bugDomain: string;
  mode: "wildcard" | "sni" | "host";
  isActive: boolean;
};

function convertVmess(raw: string, bug: BugPreset) {
  try {
    const b64 = raw.replace("vmess://", "");
    const decoded = atob(b64);
    const json = JSON.parse(decoded);
    
    const originalHost = json.host || json.add;
    
    if (bug.mode === "wildcard") {
      json.add = bug.bugDomain;
      json.host = `${bug.bugDomain}.${originalHost}`;
      json.sni = `${bug.bugDomain}.${originalHost}`;
    } else if (bug.mode === "sni") {
      // json.add = originalHost; // Keep original
      json.sni = bug.bugDomain;
    } else if (bug.mode === "host") {
      // json.add = originalHost; // Keep original
      json.host = bug.bugDomain;
    }
    
    return "vmess://" + btoa(JSON.stringify(json));
  } catch (e) {
    return null;
  }
}

function convertVlessOrTrojan(raw: string, bug: BugPreset) {
  try {
    const url = new URL(raw);
    const params = new URLSearchParams(url.search);
    
    const originalHost = url.hostname;
    const originalSni = params.get("sni") || originalHost;
    const originalHostParam = params.get("host") || originalHost;
    
    if (bug.mode === "wildcard") {
      url.hostname = bug.bugDomain;
      params.set("host", `${bug.bugDomain}.${originalHostParam}`);
      params.set("sni", `${bug.bugDomain}.${originalSni}`);
    } else if (bug.mode === "sni") {
      params.set("sni", bug.bugDomain);
    } else if (bug.mode === "host") {
      params.set("host", bug.bugDomain);
    }
    
    url.search = params.toString();
    // Re-decode the URL components to keep it cleaner
    return url.toString().replace(/%2F/g, "/").replace(/%3A/g, ":");
  } catch (e) {
    return null;
  }
}

function convertShadowsocks(raw: string, bug: BugPreset) {
  try {
    let config = raw.trim();
    if (!config.startsWith("ss://")) return null;

    // Remove ss:// prefix
    let body = config.slice(5);

    // Handle remark (#)
    let remark = "";
    const hashPos = body.indexOf("#");
    if (hashPos !== -1) {
      remark = body.slice(hashPos);
      body = body.slice(0, hashPos);
    }

    let userinfo: string;
    let hostPort: string;

    if (body.includes("@")) {
      // SIP002 format: method:password@host:port or base64@host:port
      const atPos = body.lastIndexOf("@");
      userinfo = body.slice(0, atPos);
      hostPort = body.slice(atPos + 1);
    } else {
      // Legacy base64 encoded userinfo@host:port inside
      try {
        const decoded = atob(body);
        if (decoded.includes("@")) {
          const atPos = decoded.lastIndexOf("@");
          userinfo = decoded.slice(0, atPos);
          hostPort = decoded.slice(atPos + 1);
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }

    const [host, ...portParts] = hostPort.split(":");
    const portRest = portParts.join(":");

    let newHost = host;
    if (bug.mode === "wildcard") {
      newHost = bug.bugDomain;
    } else if (bug.mode === "sni" || bug.mode === "host") {
      newHost = bug.bugDomain;
    }

    const newHostPort = `${newHost}:${portRest}`;
    return `ss://${userinfo}@${newHostPort}${remark}`;
  } catch (e) {
    return null;
  }
}

function convertSshOrText(raw: string, bug: BugPreset) {
  try {
    let result = raw;
    
    // Replace common BUG placeholder (case insensitive)
    if (bug.mode === "wildcard") {
      result = result.replace(/BUG/gi, `${bug.bugDomain}`);
      // For wildcard, sometimes people use bug.domain.original
      // But simple replace is most common for SSH payloads
    } else {
      result = result.replace(/BUG/gi, bug.bugDomain);
    }

    // Also try to replace common host patterns if they look like original host
    // This is heuristic for SSH / payload
    if (bug.mode === "wildcard") {
      // Example: replace host: example.com with bug.example.com in some payloads
      // Keep simple for now
    }

    return result;
  } catch (e) {
    return raw;
  }
}

export default function ConfigConverter() {
  const { toast } = useToast();
  const [rawConfig, setRawConfig] = useState("");
  const [selectedBugId, setSelectedBugId] = useState<string>("");
  const [result, setResult] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const { data: bugs = [], isLoading } = useQuery<BugPreset[]>({
    queryKey: ["bug-presets"],
    queryFn: () => apiFetch("/bug-presets"),
  });

  const handleConvert = () => {
    if (!rawConfig.trim()) {
      toast({ title: "Masukkan Config", description: "Config mentah tidak boleh kosong.", variant: "destructive" });
      return;
    }
    if (!selectedBugId) {
      toast({ title: "Pilih Bug", description: "Silakan pilih preset bug terlebih dahulu.", variant: "destructive" });
      return;
    }

    const bug = bugs.find((b) => b.id.toString() === selectedBugId);
    if (!bug) return;

    const lines = rawConfig.split("\n").map(l => l.trim()).filter(Boolean);
    const convertedLines = lines.map(line => {
      if (line.startsWith("vmess://")) return convertVmess(line, bug) || line;
      if (line.startsWith("vless://") || line.startsWith("trojan://")) return convertVlessOrTrojan(line, bug) || line;
      if (line.startsWith("ss://")) return convertShadowsocks(line, bug) || line;
      // Support SSH payloads, HTTP injector payloads, or any text config containing "BUG" or ssh keywords
      if (
        line.toLowerCase().includes("bug") ||
        line.toLowerCase().includes("ssh") ||
        line.includes("GET ") ||
        line.includes("Host:") ||
        line.includes("CONNECT ")
      ) {
        return convertSshOrText(line, bug) || line;
      }
      return line; // Not recognized, leave as is
    });

    const isAllFailed = convertedLines.every((l, i) => l === lines[i]);
    if (isAllFailed) {
      toast({ title: "Gagal Mengonversi", description: "Format tidak dikenali. Pastikan pakai protokol yang didukung (VMess/VLess/Trojan/SS/SSH payload).", variant: "destructive" });
      return;
    }

    setResult(convertedLines.join("\n"));
    toast({ title: "Config Berhasil Di-convert!" });
    setIsCopied(false);
    // Auto-scroll ke hasil, sangat berguna di tampilan ponsel
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(result);
      } else {
        // Fallback for HTTP (non-secure) environments
        const textArea = document.createElement("textarea");
        textArea.value = result;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      toast({ title: "Tersalin!", description: "Config berhasil disalin ke clipboard." });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast({ title: "Gagal menyalin", description: "Browser Anda tidak mendukung fitur salin otomatis.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Alat Convert Config</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ubah konfigurasi akun VPN mentah (VMess, VLess, Trojan, Shadowsocks, SSH Payload) dengan otomatis menyisipkan Bug/SNI dari preset admin.
        </p>
      </div>

      <Card className="border-primary/20 bg-card/40 backdrop-blur-md shadow-xl overflow-hidden relative">
        {/* Dekorasi Background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />

        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Config Injector
          </CardTitle>
          <CardDescription>
            Pilih preset bug, lalu tempel raw config dari semua protokol (termasuk SSH payload).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="space-y-2">
            <Label className="font-semibold text-base">1. Pilih Preset Bug</Label>
            <Select value={selectedBugId} onValueChange={setSelectedBugId}>
              <SelectTrigger className="bg-background/50 h-12">
                <SelectValue placeholder={isLoading ? "Memuat preset..." : "Klik untuk memilih bug..."} />
              </SelectTrigger>
              <SelectContent>
                {bugs.map((bug) => (
                  <SelectItem key={bug.id} value={bug.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-primary" />
                      <span>{bug.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({bug.bugDomain})</span>
                    </div>
                  </SelectItem>
                ))}
                {bugs.length === 0 && !isLoading && (
                  <div className="p-2 text-sm text-muted-foreground text-center">Belum ada preset bug.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-base">2. Config Mentah (Raw)</Label>
            <Textarea
              placeholder="Tempel config (vmess://, vless://, trojan://, ss://) atau payload SSH di sini.\nBisa multi-baris. Mendukung semua protokol + bug preset."
              className="min-h-[120px] font-mono text-sm bg-background/50 resize-y"
              value={rawConfig}
              onChange={(e) => setRawConfig(e.target.value)}
            />
          </div>

        </CardContent>
        <CardFooter className="bg-primary/5 flex justify-end p-4 border-t border-white/5">
          <Button onClick={handleConvert} size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/20">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Convert Sekarang
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <div ref={resultRef} className="scroll-mt-4">
          <Card className="border-emerald-500/30 bg-emerald-950/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-3 border-b border-white/5">
              <CardTitle className="text-emerald-400 flex items-center justify-between">
                <span>✅ Hasil Convert</span>
                {isCopied ? (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Tersalin
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="relative">
                <Textarea
                  readOnly
                  value={result}
                  className="min-h-[120px] font-mono text-sm bg-background/80 pr-12 focus-visible:ring-emerald-500/30 border-emerald-500/20"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300"
                  onClick={copyToClipboard}
                >
                  {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                onClick={copyToClipboard}
                className="w-full mt-3 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {isCopied ? "Tersalin!" : "Salin Config"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
