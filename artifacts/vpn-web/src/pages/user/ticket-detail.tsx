import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { ArrowLeft, Send, XCircle, User, ShieldCheck, BellRing } from "lucide-react";
import { format } from "date-fns";

type Message = { id: number; isAdmin: boolean; message: string; createdAt: string };
type TicketDetail = { id: number; subject: string; status: string; priority: string; createdAt: string; messages: Message[] };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Terbuka", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  answered: { label: "Dijawab", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  closed: { label: "Ditutup", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

function markTicketRead(ticketId: string) {
  localStorage.setItem(`tkr_${ticketId}`, new Date().toISOString());
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reply, setReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number | null>(null);
  const isFirstLoad = useRef(true);

  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: ["ticket-detail", id],
    queryFn: () => apiClient.get<TicketDetail>(`/api/tickets/${id}`),
    refetchInterval: 5000,
  });

  // Mark as read + scroll + toast on new admin reply
  useEffect(() => {
    if (!ticket) return;

    const msgs = ticket.messages;
    const count = msgs.length;

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      prevMsgCountRef.current = count;
      markTicketRead(id);
      qc.invalidateQueries({ queryKey: ["user-tickets"] });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
      return;
    }

    if (prevMsgCountRef.current !== null && count > prevMsgCountRef.current) {
      const newMsgs = msgs.slice(prevMsgCountRef.current);
      const hasAdminReply = newMsgs.some((m) => m.isAdmin);
      if (hasAdminReply) {
        toast({
          title: "💬 Admin mengirim balasan!",
          description: ticket.subject,
        });
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      markTicketRead(id);
      qc.invalidateQueries({ queryKey: ["user-tickets"] });
    }

    prevMsgCountRef.current = count;
  }, [ticket?.messages.length]);

  const sendReply = useMutation({
    mutationFn: () => apiClient.post(`/api/tickets/${id}/reply`, { message: reply }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-detail", id] });
      setReply("");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const closeTicket = useMutation({
    mutationFn: () => apiClient.post(`/api/tickets/${id}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-detail", id] });
      qc.invalidateQueries({ queryKey: ["user-tickets"] });
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
        <Link href="/tickets">
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft size={14} /> Kembali</Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-white">#{ticket.id} — {ticket.subject}</h1>
            <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Dibuat {format(new Date(ticket.createdAt), "dd MMM yyyy HH:mm")}</p>
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
          <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.isAdmin ? "bg-secondary/60 rounded-tl-sm" : "bg-primary/20 border border-primary/30 rounded-tr-sm"}`}>
              <div className="flex items-center gap-2 mb-1">
                {msg.isAdmin ? (
                  <div className="flex items-center gap-1 text-xs text-primary"><ShieldCheck size={12} /> Admin</div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><User size={12} /> Kamu</div>
                )}
                <span className="text-xs text-muted-foreground/60">{format(new Date(msg.createdAt), "HH:mm")}</span>
              </div>
              <p className="text-sm text-white whitespace-pre-wrap">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isClosed && (
        <div className="flex gap-2 pt-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Tulis balasan..."
            rows={3}
            className="flex-1 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && reply.trim()) sendReply.mutate(); }}
          />
          <Button onClick={() => sendReply.mutate()} disabled={sendReply.isPending || reply.trim().length < 1} className="self-end gap-1">
            <Send size={14} /> Kirim
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground/40 text-center flex items-center justify-center gap-1">
        <BellRing size={10} /> Halaman ini memperbarui secara otomatis setiap 5 detik
      </p>
    </div>
  );
}
