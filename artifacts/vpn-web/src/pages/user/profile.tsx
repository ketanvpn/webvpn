import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Mail, Key, Shield, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal information.</p>
      </div>

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="h-32 bg-primary/10 relative">
           <div className="absolute -bottom-12 left-6 h-24 w-24 bg-background rounded-full p-2">
             <div className="h-full w-full bg-primary/20 rounded-full flex items-center justify-center text-primary">
               <UserCircle className="h-12 w-12" />
             </div>
           </div>
        </div>
        
        <CardContent className="pt-16 pb-8 px-6 space-y-8">
          <div>
            <h2 className="text-2xl font-bold">{user.fullName || user.username}</h2>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="secondary" className="capitalize flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {user.role}
              </Badge>
              <Badge variant={user.isActive ? "outline" : "destructive"} className={user.isActive ? "border-green-500 text-green-600" : ""}>
                {user.isActive ? "Active Account" : "Suspended"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-6 pt-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCircle className="h-4 w-4" /> Username
                </div>
                <div className="font-medium text-lg">{user.username}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </div>
                <div className="font-medium text-lg">{user.email}</div>
              </div>
              {user.referralCode && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="h-4 w-4" /> Referral Code
                  </div>
                  <div className="font-mono bg-muted px-2 py-1 rounded inline-block text-sm">
                    {user.referralCode}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Member Since
                </div>
                <div className="font-medium">{format(new Date(user.createdAt), "MMMM d, yyyy")}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
