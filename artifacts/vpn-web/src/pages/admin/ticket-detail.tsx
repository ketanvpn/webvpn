import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, XCircle, User, ShieldCheck } from "lucide-react";
import { safeFormatDate } from "@/lib/format";
import { apiClient } from "@/lib/api-client";

type Message = { id: number; isAdmin: boolean; message: string; username: string; createdAt: string };
type TicketDetail = { id: number; username: string; subject: string; status: string; priority: string; createdAt: string; messages: Message[] };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Terbuka", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  answered: { label: "Dijawab", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  closed: { label: "Ditutup", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["admin-ticket-detail", id],
    queryFn: () => apiClient.get<TicketDetail>(`/api/admin/tickets/${id}`),
    refetchInterval: 10000,
  });

  const sendReply = useMutation({
    mutationFn: () => apiClient.post(`/api/admin/tickets/${id}/reply`, { message: reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      setReply("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const closeTicket = useMutation({
    mutationFn: () => apiClient.post(`/api/admin/tickets/${id}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ticket-detail", id] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast({ title: "Tiket ditutup" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Memuat...</p>;
  if (!ticket) return <p className="text-muted-foreground">Tiket tidak ditemukan</p>;

  const status = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const isClosed = ticket.status === "closed";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets">
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft size={14} /> Kembali</Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-white">#{ticket.id} — {ticket.subject}</h1>
            <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Dari: <b>{ticket.username}</b> • {safeFormatDate(ticket.createdAt, "dd MMM yyyy HH:mm")}</p>
        </div>
        {!isClosed && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-muted-foreground"><XCircle size={14} /> Tutup Tiket</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-panel">
              <AlertDialogHeader>
                <AlertDialogTitle>Tutup Tiket?</AlertDialogTitle>
                <AlertDialogDescription>Tiket yang ditutup tidak bisa dibalas lagi.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => closeTicket.mutate()}>Tutup Tiket</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="space-y-3">
        {ticket.messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.isAdmin ? "bg-primary/20 border border-primary/30 rounded-tr-sm" : "bg-secondary/60 rounded-tl-sm"}`}>
              <div className="flex items-center gap-2 mb-1">
                {msg.isAdmin ? (
                  <div className="flex items-center gap-1 text-xs text-primary"><ShieldCheck size={12} /> Admin</div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><User size={12} /> {msg.username}</div>
                )}
                <span className="text-xs text-muted-foreground/60">{safeFormatDate(msg.createdAt, "HH:mm")}</span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{msg.message}</p>
            </div>
          </div>
        ))}
      </div>

      {!isClosed && (
        <div className="flex gap-2 pt-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Tulis balasan sebagai admin..."
            rows={3}
            className="flex-1 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && reply.trim()) sendReply.mutate(); }}
          />
          <Button onClick={() => sendReply.mutate()} disabled={sendReply.isPending || reply.trim().length < 1} className="self-end gap-1">
            <Send size={14} /> Balas
          </Button>
        </div>
      )}
    </div>
  );
}
