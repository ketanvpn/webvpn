import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketCheck, ChevronRight, User, Clock } from "lucide-react";
import { safeFormatDate } from "@/lib/format";
import { apiClient } from "@/lib/api-client";

type Ticket = { id: number; userId: number; username: string; subject: string; status: string; priority: string; createdAt: string; updatedAt: string };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Terbuka", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  answered: { label: "Dijawab", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  closed: { label: "Ditutup", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Rendah", className: "bg-gray-500/10 text-gray-400" },
  normal: { label: "Normal", className: "bg-yellow-500/10 text-yellow-400" },
  high: { label: "Tinggi", className: "bg-red-500/10 text-red-400" },
};

export default function AdminTickets() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-tickets", statusFilter],
    queryFn: () => apiClient.get<Ticket[]>(`/api/admin/tickets?status=${statusFilter}`),
    refetchInterval: 30000,
  });

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TicketCheck className="text-primary" /> Tiket Bantuan
            {openCount > 0 && <Badge className="bg-blue-500 text-white ml-1">{openCount}</Badge>}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola tiket bantuan dari pengguna</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="open">Terbuka</SelectItem>
            <SelectItem value="answered">Dijawab</SelectItem>
            <SelectItem value="closed">Ditutup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Memuat...</p>
      ) : tickets.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-16 text-center text-muted-foreground">
            <TicketCheck className="mx-auto mb-3 opacity-30" size={40} />
            <p>Tidak ada tiket</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
            const priority = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.normal;
            return (
              <Link key={t.id} href={`/admin/tickets/${t.id}`}>
                <Card className="glass-panel cursor-pointer hover:border-primary/30 transition-colors">
                  <CardContent className="py-4 px-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white text-sm">#{t.id} — {t.subject}</span>
                        <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
                        <Badge variant="outline" className={`text-xs ${priority.className}`}>{priority.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><User size={11} /> {t.username}</div>
                        <div className="flex items-center gap-1"><Clock size={11} /> {safeFormatDate(t.updatedAt, "dd MMM yyyy HH:mm")}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
