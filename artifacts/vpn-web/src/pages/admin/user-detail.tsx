import { useAdminGetUser, useAdminUpdateUser, getAdminGetUserQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserCircle, Wallet, Lock, Unlock, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminUpdateUserBodyRole } from "@workspace/api-client-react/src/generated/api.schemas";
import { useState } from "react";

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [balanceAdjustment, setBalanceAdjustment] = useState("");

  const { data: user, isLoading } = useAdminGetUser(userId, {
    query: { enabled: !!userId }
  });

  const updateUser = useAdminUpdateUser();

  const handleUpdateRole = (role: AdminUpdateUserBodyRole) => {
    updateUser.mutate({
      id: userId,
      data: { role }
    }, {
      onSuccess: () => {
        toast({ title: "User updated", description: `Role changed to ${role}` });
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
      }
    });
  };

  const handleToggleLock = () => {
    updateUser.mutate({
      id: userId,
      data: { isActive: !user?.isActive }
    }, {
      onSuccess: () => {
        toast({ title: "User updated", description: `Account ${!user?.isActive ? 'unlocked' : 'locked'}` });
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
      }
    });
  };

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(balanceAdjustment, 10);
    if (isNaN(amount) || amount === 0) return;

    updateUser.mutate({
      id: userId,
      data: { adjustBalance: amount }
    }, {
      onSuccess: () => {
        toast({ title: "Balance adjusted", description: `Added ${formatRupiah(amount)} to user balance` });
        setBalanceAdjustment("");
        queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
      },
      onError: (err) => {
        toast({ title: "Failed to adjust balance", description: err.error, variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/admin/users" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Users
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <div className="h-24 bg-primary/10 relative">
              <div className="absolute -bottom-8 left-6 h-16 w-16 bg-background rounded-full p-1.5">
                <div className="h-full w-full bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                  {user.username.substring(0, 2).toUpperCase()}
                </div>
              </div>
            </div>
            <CardContent className="pt-12 pb-6 px-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{user.username}</h2>
                  <div className="text-muted-foreground flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" /> {user.email}
                  </div>
                </div>
                <Badge variant={user.isActive ? "outline" : "destructive"}>
                  {user.isActive ? "Active" : "Locked"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Full Name</div>
                  <div className="font-medium">{user.fullName || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Joined
                  </div>
                  <div className="font-medium">{format(new Date(user.createdAt), "MMM d, yyyy")}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Activity history will be displayed here.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Wallet & Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                <div className="text-3xl font-bold text-primary">{formatRupiah(user.balance)}</div>
              </div>
              
              <form onSubmit={handleAdjustBalance} className="space-y-3 pt-4 border-t">
                <Label className="text-xs text-muted-foreground">Adjust Balance (+/-)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    placeholder="e.g. 50000 or -10000" 
                    value={balanceAdjustment}
                    onChange={(e) => setBalanceAdjustment(e.target.value)}
                  />
                  <Button type="submit" size="sm" disabled={updateUser.isPending || !balanceAdjustment}>
                    Apply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" /> Access Control
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <Label>Account Role</Label>
                <Select value={user.role} onValueChange={(v: AdminUpdateUserBodyRole) => handleUpdateRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Regular User</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  variant={user.isActive ? "destructive" : "default"} 
                  className="w-full gap-2"
                  onClick={handleToggleLock}
                  disabled={updateUser.isPending}
                >
                  {user.isActive ? (
                    <><Lock className="h-4 w-4" /> Suspend Account</>
                  ) : (
                    <><Unlock className="h-4 w-4" /> Reactivate Account</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {user.isActive ? "Suspended users cannot login or buy." : "User will regain full access."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
