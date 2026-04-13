import { useAdminListUsers } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";
import { Users, Search, ShieldAlert, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const { data, isLoading } = useAdminListUsers({
    search: debouncedSearch || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">Manage platform users and resellers.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search username or email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> User Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data?.users && data.users.length > 0 ? (
            <div className="divide-y">
              {data.users.map((user) => (
                <div key={user.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {user.username}
                        {user.role === 'admin' && <ShieldAlert className="h-3 w-3 text-destructive" />}
                        {user.role === 'reseller' && <Shield className="h-3 w-3 text-primary" />}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:justify-end">
                    <div className="text-sm text-right hidden sm:block">
                      <div className="font-medium text-primary">{formatRupiah(user.balance)}</div>
                      <div className="text-xs text-muted-foreground">Joined {format(new Date(user.createdAt), "MMM yyyy")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={user.isActive ? "outline" : "destructive"}>
                        {user.isActive ? "Active" : "Locked"}
                      </Badge>
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/admin/users/${user.id}`}>Manage</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No users found matching "{search}".
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
