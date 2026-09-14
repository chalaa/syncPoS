import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { getCatalogFormOptions, getProductDetail, getProductList } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";

import { NewProductModal } from "./new-product-modal";
import { ProductNavTabs } from "@/app/admin/products/product-nav-tabs";
import { ProductListTable } from "./product-list-table";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
    new?: string;
    name?: string;
    productId?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requirePermission("product.view");

  const params = await searchParams;
  const showDeleted = params.show === "deleted";
  const query = params.q ?? "";
  const [products, formOptions, initialProductDetail] = await Promise.all([
    getProductList({ query, showDeleted }),
    getCatalogFormOptions(),
    params.productId ? getProductDetail(params.productId) : Promise.resolve(null),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog Management"
        title="Products & Pricing"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/admin/products/import" variant="outline">Import</ButtonLink>
            <ButtonLink href="/admin/products/export" variant="outline">Export</ButtonLink>
            <NewProductModal
              categories={formOptions.categories}
              brands={formOptions.brands}
              units={formOptions.units}
              taxes={formOptions.taxes}
              initialOpen={params.new === "1" || params.new === "true"}
              initialProductName={params.name}
            />
          </div>
        }
      />

      <ProductNavTabs currentHref="/admin/products" />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-4">
          <form className="flex min-w-0 flex-1 gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search item code, SKU, product name, or model..."
                className="h-10 w-full rounded-md border border-input bg-background pl-3 pr-3 text-sm font-normal text-foreground"
              />
            </div>
            {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
            <Button variant="outline" className="gap-1.5">
              <SearchIcon className="size-4" />
              Search
            </Button>
          </form>
          <div className="flex rounded-md border border-border bg-muted p-1 text-sm">
            <Button asChild variant={!showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/products">Active</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/products?show=deleted">Deleted</Link>
            </Button>
          </div>
        </div>

        <ProductListTable
          products={products}
          showDeleted={showDeleted}
          initialProductId={params.productId}
          initialProductDetail={initialProductDetail}
        />
      </section>
    </PageShell>
  );
}
