import { useMutation, useQuery } from "@tanstack/react-query";
import { useGetBalance } from "@workspace/api-client-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { isDynamicDurationType, type DynamicDurationType } from "@/lib/dynamic-duration";
import { getUnmetCheckoutRequirements, type DynamicOrderPolicyInput } from "@/lib/dynamic-order-policy";
import type { DynamicServer, Quote } from "@/components/dynamic-order/types";
import type { DynamicOrderState, DynamicOrderActions, DynamicOrderData } from "./dynamic-order-checkout-types";
import { computeLocalQuote } from "./quote-helpers";

export function useDynamicOrderCheckout() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetSlug = params.get("preset") || params.get("paket") || null;
  const paketKind = params.get("kind") as "normal" | "cloudfront" | null;
  const validKind = paketKind === "normal" || paketKind === "cloudfront" ? paketKind : null;

  const serversQuery = useQuery<{ servers: DynamicServer[] }>({
    queryKey: ["dynamic-vpn-servers"],
    queryFn: () => apiClient.get("/api/dynamic-vpn/servers"),
  });
  const serversRaw = serversQuery.data?.servers ?? [];

  const filteredServers = useMemo(() => {
    if (!validKind) return serversRaw;
    const copy = [...serversRaw];
    if (validKind === "cloudfront") {
      copy.sort((a, b) => (b.isCloudfrontCapable ? 1 : 0) - (a.isCloudfrontCapable ? 1 : 0));
    }
    return copy;
  }, [serversRaw, validKind]);

  const recommendedServers = useMemo(() => {
    if (!validKind) return [];
    if (validKind === "cloudfront") return serversRaw.filter((s) => s.isCloudfrontCapable);
    return serversRaw;
  }, [serversRaw, validKind]);

  const [selectedServer, setSelectedServer] = useState<DynamicServer | null>(null);
  const [protocol, setProtocol] = useState("");
  const [durationType, setDurationType] = useState<DynamicDurationType>("month");
  const [duration, setDuration] = useState("1");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [voucherError, setVoucherError] = useState("");
  const [paidOrderId, setPaidOrderId] = useState<number | null>(null);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const { data: balanceData } = useGetBalance();
  const balance = balanceData?.balance || 0;

  const durationNum = parseInt(duration || "0", 10);

  const localQuote = useMemo(
    () => selectedServer ? computeLocalQuote(selectedServer, durationType, durationNum) : null,
    [selectedServer, durationType, durationNum]
  );

  const quoteQuery = useQuery<Quote>({
    queryKey: ["dynamic-vpn-quote", selectedServer?.id, protocol, durationType, durationNum, appliedVoucher],
    enabled: !!selectedServer && !!protocol && !!durationNum && durationNum > 0,
    queryFn: async () => {
      if (!selectedServer) throw new Error("Server not selected");
      return apiClient.post("/api/dynamic-vpn/quote", {
        serverId: selectedServer.id, protocol, durationType, duration: durationNum,
        voucherCode: appliedVoucher || undefined,
      });
    },
    retry: false,
  });
  const quote = quoteQuery.data ?? localQuote;

  useEffect(() => { if (appliedVoucher) { setAppliedVoucher(""); setVoucherError(""); } }, [selectedServer?.id, durationType, duration]);
  useEffect(() => {
    if (quoteQuery.error && appliedVoucher) {
      setVoucherError(quoteQuery.error instanceof Error ? quoteQuery.error.message : "Voucher tidak valid");
      setAppliedVoucher("");
    }
  }, [quoteQuery.error, appliedVoucher]);

  const policyInput: DynamicOrderPolicyInput = useMemo(
    () => ({ selectedServer, protocol, durationType, duration: durationNum, username, password, balance, quote, pendingOrders: [] }),
    [selectedServer, protocol, durationType, durationNum, username, password, balance, quote]
  );

  const unmetRequirements = getUnmetCheckoutRequirements(policyInput);

  const orderMut = useMutation({
    mutationFn: async () => {
      if (!selectedServer) throw new Error("Pilih server terlebih dahulu");
      const created = await apiClient.post<{ order: { id: number } }>("/api/dynamic-vpn/orders", {
        serverId: selectedServer.id, protocol, durationType, duration: durationNum, username,
        password: protocol === "ssh" ? password : undefined, voucherCode: appliedVoucher || undefined, paymentMethod: "balance",
      });
      return apiClient.post<{ order: { id: number; vpnAccountId: number | null } }>(`/api/dynamic-vpn/orders/${created.order.id}/pay`);
    },
    onSuccess: (data) => {
      setPaidOrderId(data.order.id); setSelectedServer(null); setAppliedVoucher(""); setVoucherInput("");
      serversQuery.refetch();
      toast({ title: "Order berhasil", description: "Akun VPN sudah dibuat. Membuka detail akun..." });
      if (data.order.vpnAccountId) setLocation(`/accounts/${data.order.vpnAccountId}`);
    },
    onError: (err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : "Gagal membuat order";
      toast({ title: "Order gagal", description: `${errorMessage}. Cek halaman Riwayat Order untuk retry atau hubungi bantuan.`, variant: "destructive" });
    },
  });

  const openOrder = (server: DynamicServer) => {
    setSelectedServer(server); setProtocol(server.enabledProtocols?.[0] ?? "");
    const defaultType: DynamicDurationType = server.supportedTypes.includes("month") ? "month" : server.supportedTypes.includes("week") ? "week" : "day";
    setDurationType(defaultType); setDuration("1"); setUsername(""); setPassword(""); setVoucherInput(""); setAppliedVoucher(""); setVoucherError(""); setPaidOrderId(null);
  };

  const closeOrder = () => setSelectedServer(null);
  const applyVoucher = () => { const code = voucherInput.trim().toUpperCase(); if (!code) return; setVoucherError(""); setAppliedVoucher(code); };
  const removeVoucher = () => { setVoucherInput(""); setAppliedVoucher(""); setVoucherError(""); };
  const openPayConfirm = () => { if (unmetRequirements.length === 0 && !orderMut.isPending) setPayConfirmOpen(true); };
  const closePayConfirm = () => setPayConfirmOpen(false);
  const submitOrder = () => { if (unmetRequirements.length === 0 && !orderMut.isPending) { orderMut.mutate(); setPayConfirmOpen(false); } };

  const state: DynamicOrderState = { selectedServer, protocol, durationType, duration, username, password, voucherInput, appliedVoucher, voucherError, paidOrderId, payConfirmOpen };
  const actions: DynamicOrderActions = { openOrder, closeOrder, setProtocol, setDurationType, setDuration, setUsername, setPassword, setVoucherInput, applyVoucher, removeVoucher, openPayConfirm, closePayConfirm, submitOrder };
  const data = {
    servers: filteredServers,
    serversLoading: serversQuery.isLoading,
    quote,
    quoteFetching: quoteQuery.isFetching,
    balance,
    unmetRequirements,
    isSubmitting: orderMut.isPending,
    durationNum,
    presetSlug,
    paketKind: validKind,
    allServers: serversRaw,
    recommendedServers,
    recommendedCount: recommendedServers.length,
  } as unknown as DynamicOrderData & { presetSlug: string | null; paketKind: "normal" | "cloudfront" | null; allServers: DynamicServer[]; recommendedServers: DynamicServer[]; recommendedCount: number };

  return { state, actions, data };
}

export type { DynamicOrderState, DynamicOrderActions, DynamicOrderData } from "./dynamic-order-checkout-types";
