import { SlidersHorizontal, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminDynamicVpn from "./dynamic-vpn";
import AdminDynamicVpnOrders from "./dynamic-vpn-orders";

export default function AdminDynamicVpnHub() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/70 p-6 shadow-2xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            Dynamic Order Center
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
            <SlidersHorizontal className="h-8 w-8 text-emerald-300" />
            Order VPN Dynamic
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Kelola server sendiri dan provider eksternal untuk halaman Order VPN user dalam satu tempat yang terpisah dari monitoring NadiaVPN.
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex h-auto min-w-max gap-1 bg-white/5 p-1 sm:grid sm:w-full sm:max-w-xl sm:grid-cols-2">
            <TabsTrigger value="settings" className="min-w-44 px-3 py-2 text-xs sm:min-w-0 sm:text-sm">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Pengaturan Server
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-40 px-3 py-2 text-xs sm:min-w-0 sm:text-sm">
              <History className="mr-2 h-4 w-4" /> Riwayat Order
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="settings">
          <AdminDynamicVpn />
        </TabsContent>

        <TabsContent value="history">
          <AdminDynamicVpnOrders />
        </TabsContent>
      </Tabs>
    </div>
  );
}
