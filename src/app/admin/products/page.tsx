import Link from "next/link";
import { Download, Upload, SearchIcon } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { getCatalogFormOptions, getProductDetail, getProductList } from "@/server/catalog/products";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

import { NewProductModal } from "./new-product-modal";
import { ProductKpiCards } from "./product-kpi-cards";
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
  const user = await requirePermission(PERMISSIONS.PRODUCTS.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canManageProducts = userHasPermission(userPerms, PERMISSIONS.PRODUCTS.MANAGE);

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
        description="Manage unified product definitions, tracking modes, tax assignments, and catalog prices."
        actions={
          canManageProducts ? (
            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink href="/admin/products/import" variant="outline" className="gap-1.5 font-medium">
                <Upload className="size-3.5 text-muted-foreground" />
                Import
              </ButtonLink>
              <ButtonLink href="/admin/products/export" variant="outline" className="gap-1.5 font-medium">
                <Download className="size-3.5 text-muted-foreground" />
                Export
              </ButtonLink>
              <NewProductModal
                categories={formOptions.categories}
                brands={formOptions.brands}
                units={formOptions.units}
                taxes={formOptions.taxes}
                initialOpen={params.new === "1" || params.new === "true"}
                initialProductName={params.name}
              />
            </div>
          ) : null
        }
      />

      <ProductKpiCards
        products={products}
        categoriesCount={formOptions.categories.length}
        brandsCount={formOptions.brands.length}
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 p-4">
          <form className="flex min-w-0 flex-1 gap-2">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search item code, SKU, product name, or model..."
                className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm font-normal text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
            <Button variant="secondary" className="gap-1.5 font-medium">
              Search
            </Button>
          </form>
          <div className="flex rounded-xl border border-border bg-muted p-1 text-sm">
            <Button asChild variant={!showDeleted ? "secondary" : "ghost"} size="sm" className="rounded-lg text-xs font-semibold">
              <Link href="/admin/products">Active Items</Link>
            </Button>
            <Button asChild variant={showDeleted ? "secondary" : "ghost"} size="sm" className="rounded-lg text-xs font-semibold">
              <Link href="/admin/products?show=deleted">Deleted Archive</Link>
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
