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
import Dashboard from "@/pages/user/dashboard";
import Products from "@/pages/user/products";
import ProductDetail from "@/pages/user/product-detail";
import Orders from "@/pages/user/orders";
import OrderDetail from "@/pages/user/order-detail";
import Accounts from "@/pages/user/accounts";
import AccountDetail from "@/pages/user/account-detail";
import Balance from "@/pages/user/balance";
import Profile from "@/pages/user/profile";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminUserDetail from "@/pages/admin/user-detail";
import AdminProducts from "@/pages/admin/products";
import AdminServers from "@/pages/admin/servers";
import AdminOrders from "@/pages/admin/orders";
import AdminTopups from "@/pages/admin/topups";

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
      <Route path="/profile">
        <Layout><Profile /></Layout>
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
      <Route path="/admin/topups">
        <Layout requireAdmin><AdminTopups /></Layout>
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
