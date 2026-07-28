import { getApiError } from "@/lib/utils";
import {
  useAdminListOrders,
  useAdminConfirmOrder,
  useAdminDeleteOrder,
  getAdminListOrdersQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { ShoppingCart, CheckCircle, Trash2, FileText, Search, Server, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminListOrdersStatus } from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link, useSearch } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const statusLabel: Record<string, string> = {
  pending: "Menunggu",
  processing: "Diproses",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export default function AdminOrders() {
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const initialStatus = urlParams.get("status") ?? "all";

  const [status, setStatus] = useState<string>(initialStatus);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryParams = {
    status: status === "all" ? undefined : (status as AdminListOrdersStatus),
    search: debouncedSearch || undefined,
  };

  const { data, isLoading } = useAdminListOrders(
    queryParams,
    { query: { queryKey: getAdminListOrdersQueryKey(queryParams), refetchInterval: 30_000 } }
  );

  const confirmOrder = useAdminConfirmOrder();
  const deleteOrder = useAdminDeleteOrder();

  const handleConfirm = (id: number) => {
    confirmOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order dikonfirmasi", description: "Akun VPN berhasil dibuat" });
        queryClient.invalidateQueries({ queryKey: getAdminListOrdersQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Gagal konfirmasi", description: getApiError(err), variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order dihapus" });
        queryClient.invalidateQueries({ queryKey: getAdminListOrdersQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Gagal menghapus", description: getApiError(err), variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1">Kelola dan konfirmasi pembelian user.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/admin/export/orders", "_blank")}
            className="gap-1.5 shrink-0"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari username..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-order-search"
          />
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="pending">Menunggu</TabsTrigger>
          <TabsTrigger value="paid">Lunas</TabsTrigger>
          <TabsTrigger value="failed">Gagal</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Transaksi
            {data && <span className="text-sm font-normal text-muted-foreground">({data.total} total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : data?.orders && data.orders.length > 0 ? (
            <div className="divide-y divide-white/5">
              {data.orders.map((order) => (
                <div key={order.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="hidden sm:flex h-10 w-10 rounded-full bg-primary/10 items-center justify-center text-primary font-bold text-sm">
                      #{order.id}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        {order.user?.username}
                        <Badge variant="outline" className={`text-[10px] ${statusColors[order.status]}`}>
                          {statusLabel[order.status] ?? order.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {order.product?.name} &bull; {order.paymentMethod} &bull; {format(new Date(order.createdAt), "d MMM, HH:mm")}
                      </div>
                      {order.notes && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span className="font-medium text-foreground/70">Remarks:</span> {order.notes}
                        </div>
                      )}
                      {order.status === "paid" && order.vpnAccountId && (
                        <div className="mt-1.5">
                          <Link
                            href={`/admin/users/${order.userId}`}
                            className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                          >
                            <Server className="h-3 w-3" />
                            Lihat Akun VPN user ini →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:justify-end flex-wrap">
                    <div className="font-bold text-lg text-primary">
                      {formatRupiah(order.payableAmount ?? order.amount)}
                    </div>
                    {order.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(order.id)}
                        disabled={confirmOrder.isPending}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" /> Konfirmasi
                      </Button>
                    )}
                    {order.status !== "paid" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            disabled={deleteOrder.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Order #{order.id}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Order dari <strong>{order.user?.username}</strong> untuk <strong>{order.product?.name}</strong> akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => handleDelete(order.id)}
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              {search ? `Tidak ada order untuk username "${search}".` : "Tidak ada order ditemukan."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
