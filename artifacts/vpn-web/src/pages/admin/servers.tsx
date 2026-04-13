import { useAdminListServers, useAdminDeleteServer, getAdminListServersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Plus, MoreVertical, Edit, Trash2, Activity } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminServers() {
  const { data: servers, isLoading } = useAdminListServers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteServer = useAdminDeleteServer();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this server?")) {
      deleteServer.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Server deleted" });
          queryClient.invalidateQueries({ queryKey: getAdminListServersQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to delete server", description: err.error, variant: "destructive" });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VPN Servers</h1>
          <p className="text-muted-foreground mt-1">Manage infrastructure nodes and nodes status.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Server
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)
        ) : servers && servers.length > 0 ? (
          servers.map((server) => (
            <Card key={server.id} className="flex flex-col group">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" role="img" aria-label="flag">{server.flag}</span>
                    <Badge variant={server.isActive ? "default" : "destructive"}>
                      {server.isActive ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Edit className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => handleDelete(server.id)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-lg mt-2">{server.name}</CardTitle>
                <div className="text-sm text-muted-foreground">{server.location}</div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">{server.host}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {server.supportedProtocols.map(p => (
                    <Badge key={p} variant="secondary" className="text-[10px] uppercase px-1.5 py-0">
                      {p}
                    </Badge>
                  ))}
                </div>
                <div className="pt-4 mt-auto border-t flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="h-4 w-4" /> Active Accounts
                  </span>
                  <span className="font-bold">{server.activeAccounts || 0}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-12 text-center border rounded-xl bg-card border-dashed">
            <p className="text-muted-foreground">No servers found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
