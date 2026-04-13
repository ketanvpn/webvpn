import { useListAccounts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";
import { Server, Activity, ShieldOff, Globe } from "lucide-react";

export default function Accounts() {
  const { data, isLoading } = useListAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Active Accounts</h1>
        <p className="text-muted-foreground mt-1">Manage your VPN connections and configs.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((account) => {
            const isExpiringSoon = new Date(account.expiresAt).getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000;
            
            return (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full flex flex-col group">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex justify-between items-start">
                      <Badge variant={account.isActive ? "default" : "destructive"} className="mb-2">
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="uppercase font-bold">{account.protocol}</Badge>
                    </div>
                    <CardTitle className="text-lg font-mono truncate" title={account.username}>
                      {account.username}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>{account.server.name} ({account.server.flag})</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      <span>Quota: {account.quota ? `${account.usedQuota || 0}/${account.quota} GB` : "Unlimited"}</span>
                    </div>
                    
                    <div className={`mt-auto pt-4 border-t flex items-center gap-2 text-sm font-medium ${
                      isExpiringSoon ? "text-destructive" : "text-muted-foreground group-hover:text-primary"
                    }`}>
                      {account.isActive ? (
                        <>
                          <Server className="h-4 w-4" />
                          <span>Expires {format(new Date(account.expiresAt), "MMM d, yyyy")}</span>
                        </>
                      ) : (
                        <>
                          <ShieldOff className="h-4 w-4" />
                          <span>Expired</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-24 border rounded-xl bg-card border-dashed">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Server className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No VPN accounts found.</p>
          <Link href="/products" className="text-primary hover:underline text-sm mt-2 inline-block">
            Purchase a package to get started
          </Link>
        </div>
      )}
    </div>
  );
}
