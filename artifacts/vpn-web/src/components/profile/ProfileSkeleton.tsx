import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { InfoRowSkeleton } from "./InfoRow";

export function ProfileSkeleton() {
  return (
    <div className="max-w-lg mx-auto pb-6 space-y-4">
      <Card className="glass-panel border-white/5 overflow-hidden">
        <Skeleton className="h-24 w-full rounded-none" />
        <CardContent className="px-5 pb-5 pt-0">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
          <Skeleton className="h-6 w-32 mb-2" />
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="rounded-xl border bg-muted/20 overflow-hidden p-2 space-y-1">
            <InfoRowSkeleton />
            <InfoRowSkeleton />
            <InfoRowSkeleton />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/5 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </Card>

      {[1, 2, 3].map((i) => (
        <Card key={i} className="glass-panel border-white/5 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  );
}
