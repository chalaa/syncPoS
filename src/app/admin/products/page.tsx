import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";
import { getProductList, minorToDisplay } from "@/server/catalog/products";
import { restoreProduct, softDeleteProduct } from "./actions";
import { requirePermission } from "@/server/auth/session";

import { ProductNavTabs } from "@/app/admin/products/product-nav-tabs";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requirePermission("product.view");

  const params = await searchParams;
  const showDeleted = params.show === "deleted";
  const query = params.q ?? "";
  const products = await getProductList({ query, showDeleted });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog Management"
        title="Products & Pricing"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products/import" variant="outline">Import</ButtonLink>
            <ButtonLink href="/admin/products/export" variant="outline">Export</ButtonLink>
            <ButtonLink href="/admin/products/new" variant="default">New product</ButtonLink>
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Standard Name</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {products.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3.5 font-semibold text-primary">
                    <Link href={`/admin/products/${product.id}`} className="underline-offset-4 hover:underline">
                      {product.sku}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-foreground">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[product.brandName, product.categoryName, product.model]
                        .filter(Boolean)
                        .join(" · ") || "No category"}
                    </div>
                    {product.country ? (
                      <div className="text-xs text-muted-foreground">Country: {product.country}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{product.standardName ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded border border-border/80 bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground">
                      {product.trackingMode}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-foreground">{product.unitCode}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                    {product.currencyCode} {minorToDisplay(product.standardCostMinor)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                    {product.currencyCode} {minorToDisplay(product.listPriceMinor)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-2">
                      {!showDeleted ? (
                        <>
                          <ButtonLink
                            href={`/admin/products/${product.id}`}
                            variant="outline"
                            size="sm"
                          >
                            Open
                          </ButtonLink>
                          <ButtonLink
                            href={`/admin/products/${product.id}/edit`}
                            variant="outline"
                            size="sm"
                          >
                            Edit
                          </ButtonLink>
                          <form action={softDeleteProduct}>
                            <input type="hidden" name="id" value={product.id} />
                            <Button variant="destructive" size="sm">
                              Delete
                            </Button>
                          </form>
                        </>
                      ) : (
                        <form action={restoreProduct}>
                          <input type="hidden" name="id" value={product.id} />
                          <Button variant="outline" size="sm">
                            Restore
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}

