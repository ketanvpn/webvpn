import { useState } from "react";
import { useAdminBroadcast } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, Users, CheckCircle, XCircle, Megaphone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminBroadcast() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const { toast } = useToast();
  const broadcast = useAdminBroadcast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setResult(null);
    broadcast.mutate(
      { data: { message: message.trim() } },
      {
        onSuccess: (data) => {
          setResult({ sent: data.sent, failed: data.failed });
          if (data.sent > 0) {
            toast({ title: `Berhasil dikirim ke ${data.sent} pengguna` });
          } else {
            toast({ title: "Tidak ada pengguna yang terhubung Telegram", variant: "destructive" });
          }
          setMessage("");
        },
        onError: (err) =>
          toast({ title: "Broadcast gagal", description: err.error, variant: "destructive" }),
      }
    );
  };

  const charCount = message.length;
  const maxChar = 4000;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Broadcast</h1>
        <p className="text-muted-foreground mt-1">
          Kirim pesan ke semua pengguna yang sudah menghubungkan Telegram.
        </p>
      </div>

      <Alert>
        <Megaphone className="h-4 w-4" />
        <AlertDescription>
          Pesan hanya dikirim ke pengguna yang sudah menghubungkan akun Telegram mereka di halaman Profil.
        </AlertDescription>
      </Alert>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" /> Kirim Pesan Broadcast
          </CardTitle>
          <CardDescription>Pesan akan dikirim via bot Telegram KETANTECH VPN</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Isi Pesan</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis pesan broadcast di sini..."
                rows={6}
                maxLength={maxChar}
                className="resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mendukung HTML sederhana: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;</span>
                <span className={charCount > maxChar * 0.9 ? "text-orange-500" : ""}>
                  {charCount}/{maxChar}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={broadcast.isPending || !message.trim()}
            >
              <Send className="h-4 w-4" />
              {broadcast.isPending ? "Mengirim..." : "Kirim Broadcast"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" /> Hasil Broadcast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-200">
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-green-600">{result.sent}</div>
                  <div className="text-xs text-muted-foreground">Terkirim</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-200">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <div className="text-2xl font-bold text-red-500">{result.failed}</div>
                  <div className="text-xs text-muted-foreground">Gagal</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
