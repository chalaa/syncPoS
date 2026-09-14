"use client";

import { useEffect, useState } from "react";
import { minorToDisplay } from "@/lib/catalog-utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProductDetailModal } from "./product-detail-modal";
import { restoreProduct, softDeleteProduct } from "./actions";
import type { ProductDetail } from "@/server/catalog/types";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  standardName: string | null;
  model: string | null;
  country: string | null;
  specifications: unknown;
  trackingMode: string;
  standardCostMinor: number;
  listPriceMinor: number;
  currencyCode: string;
  isActive: boolean;
  deletedAt: Date | null;
  categoryName: string | null;
  brandName: string | null;
  unitCode: string | null;
};

export type ProductListTableProps = {
  products: ProductListItem[];
  showDeleted: boolean;
  initialProductId?: string | null;
  initialProductDetail?: ProductDetail | null;
};

export function ProductListTable({
  products,
  showDeleted,
  initialProductId,
  initialProductDetail,
}: ProductListTableProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    initialProductId ?? null,
  );
  const [modalOpen, setModalOpen] = useState(Boolean(initialProductId));

  // Sync state if initialProductId changes via searchParams
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
      setModalOpen(true);
    }
  }, [initialProductId]);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const url = new URL(window.location.href);
      const pid = url.searchParams.get("productId");
      setSelectedProductId(pid);
      setModalOpen(Boolean(pid));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleOpen(id: string) {
    setSelectedProductId(id);
    setModalOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.set("productId", id);
    window.history.pushState({}, "", url.toString());
  }

  function handleClose(open: boolean) {
    setModalOpen(open);
    if (!open) {
      setSelectedProductId(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("productId");
      const search = url.searchParams.toString();
      const nextUrl = search ? `${url.pathname}?${search}` : url.pathname;
      window.history.pushState({}, "", nextUrl);
    }
  }

  return (
    <>
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
                  <button
                    type="button"
                    onClick={() => handleOpen(product.id)}
                    className="font-mono text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                  >
                    {product.sku}
                  </button>
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpen(product.id)}
                        >
                          Open
                        </Button>
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

      <ProductDetailModal
        productId={selectedProductId}
        initialProduct={initialProductDetail}
        open={modalOpen}
        onOpenChange={handleClose}
      />
    </>
  );
}
