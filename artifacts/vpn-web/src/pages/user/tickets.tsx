import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { TicketCheck, Plus, ChevronRight, Clock } from "lucide-react";
import { safeFormatDate } from "@/lib/format";

type Ticket = { id: number; subject: string; status: string; priority: string; createdAt: string; updatedAt: string };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Terbuka", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  answered: { label: "Dijawab", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  closed: { label: "Ditutup", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Rendah", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  normal: { label: "Normal", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  high: { label: "Tinggi", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

function isTicketUnread(ticket: Ticket): boolean {
  if (ticket.status !== "answered") return false;
  const lastRead = localStorage.getItem(`tkr_${ticket.id}`);
  if (!lastRead) return true;
  return new Date(ticket.updatedAt) > new Date(lastRead);
}

export default function UserTickets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "", priority: "normal" });

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["user-tickets"],
    queryFn: () => apiClient.get<Ticket[]>("/api/tickets"),
    refetchInterval: 10000,
  });

  const create = useMutation({
    mutationFn: () => apiClient.post("/api/tickets", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-tickets"] });
      toast({ title: "Tiket berhasil dibuat! Admin akan segera merespons." });
      setOpen(false);
      setForm({ subject: "", message: "", priority: "normal" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const unreadCount = tickets.filter(isTicketUnread).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TicketCheck className="text-primary" /> Tiket Bantuan
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                {unreadCount} balasan baru
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Kirim pertanyaan atau laporan masalah ke admin</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus size={16} /> Buat Tiket
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Memuat...</div>
      ) : tickets.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-16 text-center text-muted-foreground">
            <TicketCheck className="mx-auto mb-3 opacity-30" size={40} />
            <p>Belum ada tiket bantuan</p>
            <p className="text-xs mt-1">Klik "Buat Tiket" jika kamu butuh bantuan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
            const priority = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.normal;
            const unread = isTicketUnread(t);
            return (
              <Link key={t.id} href={`/tickets/${t.id}`}>
                <Card className={`glass-panel cursor-pointer transition-colors ${unread ? "border-green-500/40 hover:border-green-500/60" : "hover:border-primary/30"}`}>
                  <CardContent className="py-4 px-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {unread && (
                          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                        )}
                        <span className={`font-semibold text-sm ${unread ? "text-white" : "text-white/80"}`}>
                          #{t.id} — {t.subject}
                        </span>
                        <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
                        <Badge variant="outline" className={`text-xs ${priority.className}`}>{priority.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={11} />
                        <span>Diperbarui {safeFormatDate(t.updatedAt, "dd MMM yyyy HH:mm")}</span>
                        {unread && <span className="text-green-400 font-medium ml-1">· Ada balasan baru</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className={`shrink-0 ${unread ? "text-green-400" : "text-muted-foreground"}`} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Tiket Bantuan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subjek</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Masalah yang ingin kamu laporkan..." />
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Rendah</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Tinggi (urgent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi Masalah</Label>
              <Textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Jelaskan masalahmu secara detail..." rows={5} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.subject.length < 5 || form.message.length < 10}>
              {create.isPending ? "Mengirim..." : "Kirim Tiket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
