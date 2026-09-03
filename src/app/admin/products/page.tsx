import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { getProductList, minorToDisplay } from "@/server/catalog/products";
import { restoreProduct, softDeleteProduct } from "./actions";
import { requirePermission } from "@/server/auth/session";

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
        eyebrow="Catalog"
        title="Products"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products/import" variant="outline">Import</ButtonLink>
            <ButtonLink href="/admin/products/export" variant="outline">Export</ButtonLink>
            <ButtonLink href="/admin/products/new" variant="default">New product</ButtonLink>
          </div>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <form className="flex min-w-0 flex-1 gap-2">
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search item code, name, model"
                  className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                />
                {showDeleted ? <input type="hidden" name="show" value="deleted" /> : null}
                <Button variant="outline">
                  <SearchIcon data-icon="inline-start" />
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
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Item Code</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/admin/products/${product.id}`} className="text-primary underline-offset-4 hover:underline">
                          {product.sku}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[product.brandName, product.categoryName, product.model]
                            .filter(Boolean)
                            .join(" / ") || "No category"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{product.trackingMode}</td>
                      <td className="px-4 py-3">{product.unitCode}</td>
                      <td className="px-4 py-3 text-right">
                        {product.currencyCode} {minorToDisplay(product.standardCostMinor)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {product.currencyCode} {minorToDisplay(product.listPriceMinor)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!showDeleted ? (
                            <>
                              <Link
                                href={`/admin/products/${product.id}`}
                                className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent"
                              >
                                Open
                              </Link>
                              <Link
                                href={`/admin/products/${product.id}/edit`}
                                className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent"
                              >
                                Edit
                              </Link>
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
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No products found.
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
