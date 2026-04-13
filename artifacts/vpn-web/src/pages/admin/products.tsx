import { useAdminListProducts, useAdminCreateProduct, useAdminUpdateProduct, useAdminDeleteProduct, getAdminListProductsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { Package, Plus, MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminProducts() {
  const { data: products, isLoading } = useAdminListProducts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteProduct = useAdminDeleteProduct();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Product deleted" });
          queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to delete product", description: err.error, variant: "destructive" });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage VPN packages available in the store.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" /> Product Catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="divide-y">
              {products.map((product) => (
                <div key={product.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="uppercase w-16 justify-center">
                      {product.protocol}
                    </Badge>
                    <div>
                      <div className="font-semibold text-lg flex items-center gap-2">
                        {product.name}
                        {!product.isActive && <Badge variant="destructive" className="text-[10px] h-5">Inactive</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground flex gap-3 mt-1">
                        <span>{product.durationDays} Days</span>
                        <span>&bull;</span>
                        <span>{product.quota ? `${product.quota} GB` : 'Unlimited GB'}</span>
                        <span>&bull;</span>
                        <span>{product.maxConnections ? `${product.maxConnections} IP` : 'Unlimited IP'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="font-bold text-lg text-primary hidden sm:block">
                      {formatRupiah(product.price)}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No products found. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
