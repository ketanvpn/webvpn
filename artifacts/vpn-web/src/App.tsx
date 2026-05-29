import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";

// Pages
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import ForgotPassword from "@/pages/auth/forgot-password";
import Dashboard from "@/pages/user/dashboard";
import Products from "@/pages/user/products";
import ProductDetail from "@/pages/user/product-detail";
import Orders from "@/pages/user/orders";
import OrderDetail from "@/pages/user/order-detail";
import Accounts from "@/pages/user/accounts";
import AccountDetail from "@/pages/user/account-detail";
import Balance from "@/pages/user/balance";
import BalanceLogs from "@/pages/user/balance-logs";
import Profile from "@/pages/user/profile";
import UserPoints from "@/pages/user/points";
import UserTickets from "@/pages/user/tickets";
import UserTicketDetail from "@/pages/user/ticket-detail";
import ConfigConverter from "@/pages/user/converter";
import DynamicOrderPage from "@/pages/user/dynamic-order";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminUserDetail from "@/pages/admin/user-detail";
import AdminProducts from "@/pages/admin/products";
import AdminServers from "@/pages/admin/servers";
import AdminOrders from "@/pages/admin/orders";
import AdminTopups from "@/pages/admin/topups";
import AdminAccounts from "@/pages/admin/accounts";
import AdminPaymentSettings from "@/pages/admin/payment-settings";
import AdminBroadcast from "@/pages/admin/broadcast";
import AdminTelegramSettings from "@/pages/admin/telegram-settings";
import AdminWhatsappSettings from "@/pages/admin/whatsapp-settings";
import AdminReferralSettings from "@/pages/admin/referral-settings";
import AdminResellerSettings from "@/pages/admin/reseller-settings";
import AdminExpiryNotifSettings from "@/pages/admin/expiry-notification-settings";
import AdminBackup from "@/pages/admin/backup";
import AdminAnnouncements from "@/pages/admin/announcements";
import AdminPointsSettings from "@/pages/admin/points-settings";
import AdminTickets from "@/pages/admin/tickets";
import AdminTicketDetail from "@/pages/admin/ticket-detail";
import AdminServerMonitor from "@/pages/admin/server-monitor";
import AdminNadiaVpn from "@/pages/admin/nadiavpn";
import AdminDynamicVpnHub from "@/pages/admin/dynamic-vpn-hub";
import AdminVouchers from "@/pages/admin/vouchers";
import AdminBugPresets from "@/pages/admin/bug-presets";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
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

      <Route component={NotFound} />
    </Switch>
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
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
