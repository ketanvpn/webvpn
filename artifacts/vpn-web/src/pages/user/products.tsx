import { useListProducts } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Clock, HardDrive, Network } from "lucide-react";
import type { ListProductsProtocol } from "@workspace/api-client-react/src/generated/api.schemas";

const protocols: { value: string; label: string }[] = [
  { value: "all", label: "All Protocols" },
  { value: "ssh", label: "SSH" },
  { value: "vmess", label: "VMess" },
  { value: "vless", label: "VLess" },
  { value: "trojan", label: "Trojan" },
  { value: "shadowsocks", label: "Shadowsocks" },
];

export default function Products() {
  const [protocol, setProtocol] = useState<string>("all");
  
  const { data: products, isLoading } = useListProducts(
    protocol === "all" ? undefined : { protocol: protocol as ListProductsProtocol }
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground mt-1">Browse and purchase premium VPN accounts.</p>
      </div>

      <Tabs defaultValue="all" value={protocol} onValueChange={setProtocol} className="w-full">
        <TabsList className="mb-8 flex flex-wrap h-auto p-1 gap-1">
          {protocols.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="capitalize">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[300px] w-full rounded-xl" />
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col border-2 transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="uppercase font-bold tracking-wider">
                    {product.protocol}
                  </Badge>
                  {product.category && (
                    <Badge variant="outline">{product.category}</Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{product.name}</CardTitle>
                <div className="text-3xl font-bold text-primary mt-4">
                  {formatRupiah(product.price)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {product.durationDays} days
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 text-sm">
                {product.description && (
                  <p className="text-muted-foreground">{product.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{product.durationDays} Days</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="h-4 w-4 text-primary" />
                    <span>{product.quota ? `${product.quota} GB` : "Unlimited"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Network className="h-4 w-4 text-primary" />
                    <span>{product.maxConnections ? `${product.maxConnections} IP` : "Unlimited"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4 text-primary" />
                    <span>Premium Server</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" asChild>
                  <Link href={`/products/${product.id}`}>Purchase</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border rounded-xl bg-card border-dashed">
          <p className="text-muted-foreground">No products found for the selected protocol.</p>
        </div>
      )}
    </div>
  );
}
