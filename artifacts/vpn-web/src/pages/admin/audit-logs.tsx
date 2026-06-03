import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

type AuditLog = {
  id: number;
  adminUserId: number;
  adminUsername: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
};

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, isLoading, error } = useQuery<{
    data: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["admin-audit-logs", page],
    queryFn: () => apiFetch(`/admin/audit-logs?limit=${limit}&offset=${offset}`),
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Riwayat Aksi Admin</h1>
        <p className="text-muted-foreground text-sm md:text-base">Catatan lengkap aktivitas admin di sistem</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">Daftar Aktivitas ({total} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="py-8 text-center text-muted-foreground">Memuat data...</div>}
          {error && <div className="py-4 text-red-500">Gagal memuat data: {(error as Error).message}</div>}

          {!isLoading && logs.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">Belum ada aktivitas tercatat.</div>
          )}

          {logs.length > 0 && (
            <>
              <div className="rounded-md border overflow-x-auto -mx-1 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Waktu</TableHead>
                      <TableHead className="min-w-[120px]">Admin</TableHead>
                      <TableHead className="min-w-[100px]">Aksi</TableHead>
                      <TableHead className="min-w-[100px]">Target</TableHead>
                      <TableHead className="min-w-[180px]">Detail</TableHead>
                      <TableHead className="min-w-[100px]">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-xs md:text-sm">
                          {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm">{log.adminUsername || `User #${log.adminUserId}`}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] md:text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs md:text-sm">
                          {log.targetType}
                          {log.targetId ? ` #${log.targetId}` : ""}
                        </TableCell>
                        <TableCell>
                          <pre className="text-[9px] md:text-[10px] bg-muted p-1.5 rounded max-w-[200px] md:max-w-xs overflow-auto max-h-20 whitespace-pre-wrap leading-tight">
                            {JSON.stringify(log.details, null, 1)}
                          </pre>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] md:text-xs text-muted-foreground">
                          {log.ipAddress || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                <div className="text-xs md:text-sm text-muted-foreground text-center sm:text-left">
                  Halaman {page} dari {totalPages} • {logs.length} dari {total}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Selanjutnya →
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
