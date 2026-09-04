import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { safeFormatDate } from "@/lib/format";

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
  const [filters, setFilters] = useState({ action: '', q: '' });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const limit = 20;
  const offset = (page - 1) * limit;

  const queryParams = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.action) queryParams.set('action', filters.action);
  if (filters.q) queryParams.set('q', filters.q);

  const { data, isLoading, error } = useQuery<{
    data: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["admin-audit-logs", page, filters],
    queryFn: () => apiClient.get<{
      data: AuditLog[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/admin/audit-logs?${queryParams.toString()}`),
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: '', q: '' });
    setPage(1);
  };

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
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              className="border rounded px-3 py-2 text-sm bg-background"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">Semua Aksi</option>
              <option value="update_user">Update User</option>
              <option value="delete_user">Delete User</option>
              <option value="reset_user_password">Reset Password</option>
              <option value="approve_topup">Approve Topup</option>
              <option value="reject_topup">Reject Topup</option>
              <option value="create_server">Create Server</option>
              <option value="update_server">Update Server</option>
              <option value="delete_server">Delete Server</option>
              <option value="create_product">Create Product</option>
              <option value="update_product">Update Product</option>
              <option value="delete_product">Delete Product</option>
              <option value="create_easy_inject_preset">Create Easy Inject Preset</option>
              <option value="update_easy_inject_preset">Update Easy Inject Preset</option>
              <option value="toggle_easy_inject_preset">Toggle Easy Inject Preset</option>
              <option value="delete_easy_inject_preset">Delete Easy Inject Preset</option>
              <option value="restore_easy_inject_preset">Restore Easy Inject Preset</option>
            </select>
            <input
              placeholder="Cari admin atau detail..."
              className="border rounded px-3 py-2 text-sm flex-1 bg-background"
              value={filters.q}
              onChange={(e) => handleFilterChange('q', e.target.value)}
            />
            {(filters.action || filters.q) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
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
                      <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                        <TableCell className="whitespace-nowrap text-xs md:text-sm">
                          {safeFormatDate(log.createdAt, "dd MMM yyyy HH:mm")}
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

              {/* Export CSV */}
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!logs.length) return;
                    const headers = ["id", "createdAt", "adminUsername", "action", "targetType", "targetId", "ipAddress", "details"];
                    const csv = [
                      headers.join(","),
                      ...logs.map(log => [
                        log.id,
                        log.createdAt,
                        log.adminUsername || "",
                        log.action,
                        log.targetType,
                        log.targetId || "",
                        log.ipAddress || "",
                        JSON.stringify(log.details).replace(/"/g, '""')
                      ].join(","))
                    ].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export CSV
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detail Aksi #{selectedLog?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div><strong>Waktu:</strong> {selectedLog && safeFormatDate(selectedLog.createdAt, "dd MMM yyyy HH:mm:ss")}</div>
            <div><strong>Admin:</strong> {selectedLog?.adminUsername || `User #${selectedLog?.adminUserId}`}</div>
            <div><strong>Aksi:</strong> <Badge>{selectedLog?.action}</Badge></div>
            <div><strong>Target:</strong> {selectedLog?.targetType} {selectedLog?.targetId ? `#${selectedLog?.targetId}` : ''}</div>
            <div><strong>IP:</strong> {selectedLog?.ipAddress || '-'}</div>
            <div>
              <strong>Detail lengkap:</strong>
              <pre className="mt-2 bg-muted p-3 rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap">
                {selectedLog && JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
