import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Critical pages - direct import for fast initial render
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/auth/login";

// Auth pages - lazy loaded
const Register = lazy(() => import("@/pages/auth/register"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password"));

// User pages - lazy loaded
const Dashboard = lazy(() => import("@/pages/user/dashboard"));
const Products = lazy(() => import("@/pages/user/products"));
const ProductDetail = lazy(() => import("@/pages/user/product-detail"));
const Orders = lazy(() => import("@/pages/user/orders"));
const OrderDetail = lazy(() => import("@/pages/user/order-detail"));
const Accounts = lazy(() => import("@/pages/user/accounts"));
const AccountDetail = lazy(() => import("@/pages/user/account-detail"));
const Balance = lazy(() => import("@/pages/user/balance"));
const BalanceLogs = lazy(() => import("@/pages/user/balance-logs"));
const Profile = lazy(() => import("@/pages/user/profile"));
const UserPoints = lazy(() => import("@/pages/user/points"));
const UserTickets = lazy(() => import("@/pages/user/tickets"));
const UserTicketDetail = lazy(() => import("@/pages/user/ticket-detail"));
const ConfigConverter = lazy(() => import("@/pages/user/converter"));
const DynamicOrderPage = lazy(() => import("@/pages/user/dynamic-order"));
const DynamicOrderHistory = lazy(() => import("@/pages/user/dynamic-order-history"));

// Admin pages - lazy loaded
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminUserDetail = lazy(() => import("@/pages/admin/user-detail"));
const AdminProducts = lazy(() => import("@/pages/admin/products"));
const AdminServers = lazy(() => import("@/pages/admin/servers"));
const AdminOrders = lazy(() => import("@/pages/admin/orders"));
const AdminTopups = lazy(() => import("@/pages/admin/topups"));
const AdminAccounts = lazy(() => import("@/pages/admin/accounts"));
const AdminPaymentSettings = lazy(() => import("@/pages/admin/payment-settings"));
const AdminBroadcast = lazy(() => import("@/pages/admin/broadcast"));
const AdminTelegramSettings = lazy(() => import("@/pages/admin/telegram-settings"));
const AdminWhatsappSettings = lazy(() => import("@/pages/admin/whatsapp-settings"));
const AdminReferralSettings = lazy(() => import("@/pages/admin/referral-settings"));
const AdminResellerSettings = lazy(() => import("@/pages/admin/reseller-settings"));
const AdminExpiryNotifSettings = lazy(() => import("@/pages/admin/expiry-notification-settings"));
const AdminBackup = lazy(() => import("@/pages/admin/backup"));
const AdminAnnouncements = lazy(() => import("@/pages/admin/announcements"));
const AdminPointsSettings = lazy(() => import("@/pages/admin/points-settings"));
const AdminTickets = lazy(() => import("@/pages/admin/tickets"));
const AdminTicketDetail = lazy(() => import("@/pages/admin/ticket-detail"));
const AdminServerMonitor = lazy(() => import("@/pages/admin/server-monitor"));
const AdminNadiaVpn = lazy(() => import("@/pages/admin/nadiavpn"));
const AdminDynamicVpnHub = lazy(() => import("@/pages/admin/dynamic-vpn-hub"));
const AdminVouchers = lazy(() => import("@/pages/admin/vouchers"));
const AdminBugPresets = lazy(() => import("@/pages/admin/bug-presets"));
const AdminInjectPresets = lazy(() => import("@/pages/admin/inject-presets"));
const AdminAuditLogs = lazy(() => import("@/pages/admin/audit-logs"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Memuat halaman...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />

        {/* Authenticated User Routes */}
        <Route path="/dashboard">
          <Layout><Dashboard /></Layout>
        </Route>
        <Route path="/products">
          <Layout><Products /></Layout>
        </Route>
        <Route path="/products/:id">
          <Layout><ProductDetail /></Layout>
        </Route>
        <Route path="/orders">
          <Layout><Orders /></Layout>
        </Route>
        <Route path="/orders/:id">
          <Layout><OrderDetail /></Layout>
        </Route>
        <Route path="/accounts">
          <Layout><Accounts /></Layout>
        </Route>
        <Route path="/accounts/:id">
          <Layout><AccountDetail /></Layout>
        </Route>
        <Route path="/balance">
          <Layout><Balance /></Layout>
        </Route>
        <Route path="/balance/logs">
          <Layout><BalanceLogs /></Layout>
        </Route>
        <Route path="/profile">
          <Layout><Profile /></Layout>
        </Route>
        <Route path="/points">
          <Layout><UserPoints /></Layout>
        </Route>
        <Route path="/tickets">
          <Layout><UserTickets /></Layout>
        </Route>
        <Route path="/tickets/:id">
          <Layout><UserTicketDetail /></Layout>
        </Route>
        <Route path="/converter">
          <Layout><ConfigConverter /></Layout>
        </Route>
        <Route path="/order-vpn">
          <Layout><DynamicOrderPage /></Layout>
        </Route>
        <Route path="/order-vpn/history">
          <Layout><DynamicOrderHistory /></Layout>
        </Route>

        {/* Admin Routes */}
        <Route path="/admin">
          <Layout requireAdmin><AdminDashboard /></Layout>
        </Route>
        <Route path="/admin/users">
          <Layout requireAdmin><AdminUsers /></Layout>
        </Route>
        <Route path="/admin/users/:id">
          <Layout requireAdmin><AdminUserDetail /></Layout>
        </Route>
        <Route path="/admin/products">
          <Layout requireAdmin><AdminProducts /></Layout>
        </Route>
        <Route path="/admin/servers">
          <Layout requireAdmin><AdminServers /></Layout>
        </Route>
        <Route path="/admin/orders">
          <Layout requireAdmin><AdminOrders /></Layout>
        </Route>
        <Route path="/admin/accounts">
          <Layout requireAdmin><AdminAccounts /></Layout>
        </Route>
        <Route path="/admin/topups">
          <Layout requireAdmin><AdminTopups /></Layout>
        </Route>
        <Route path="/admin/settings/payment">
          <Layout requireAdmin><AdminPaymentSettings /></Layout>
        </Route>
        <Route path="/admin/settings/telegram">
          <Layout requireAdmin><AdminTelegramSettings /></Layout>
        </Route>
        <Route path="/admin/settings/whatsapp">
          <Layout requireAdmin><AdminWhatsappSettings /></Layout>
        </Route>
        <Route path="/admin/settings/referral">
          <Layout requireAdmin><AdminReferralSettings /></Layout>
        </Route>
        <Route path="/admin/settings/reseller">
          <Layout requireAdmin><AdminResellerSettings /></Layout>
        </Route>
        <Route path="/admin/settings/expiry-notif">
          <Layout requireAdmin><AdminExpiryNotifSettings /></Layout>
        </Route>
        <Route path="/admin/broadcast">
          <Layout requireAdmin><AdminBroadcast /></Layout>
        </Route>
        <Route path="/admin/backup">
          <Layout requireAdmin><AdminBackup /></Layout>
        </Route>
        <Route path="/admin/announcements">
          <Layout requireAdmin><AdminAnnouncements /></Layout>
        </Route>
        <Route path="/admin/settings/points">
          <Layout requireAdmin><AdminPointsSettings /></Layout>
        </Route>
        <Route path="/admin/tickets">
          <Layout requireAdmin><AdminTickets /></Layout>
        </Route>
        <Route path="/admin/tickets/:id">
          <Layout requireAdmin><AdminTicketDetail /></Layout>
        </Route>
        <Route path="/admin/server-monitor">
          <Layout requireAdmin><AdminServerMonitor /></Layout>
        </Route>
        <Route path="/admin/nadiavpn">
          <Layout requireAdmin><AdminNadiaVpn /></Layout>
        </Route>
        <Route path="/admin/dynamic-vpn">
          <Layout requireAdmin><AdminDynamicVpnHub /></Layout>
        </Route>
        <Route path="/admin/vouchers">
          <Layout requireAdmin><AdminVouchers /></Layout>
        </Route>
        <Route path="/admin/bug-presets">
          <Layout requireAdmin><AdminBugPresets /></Layout>
        </Route>
        <Route path="/admin/inject-presets">
          <Layout requireAdmin><AdminInjectPresets /></Layout>
        </Route>
        <Route path="/admin/audit-logs">
          <Layout requireAdmin><AdminAuditLogs /></Layout>
        </Route>

        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
            <PwaInstallBanner />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
