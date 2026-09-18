"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Layers, Package, ShieldCheck, Tag, Trash2, RotateCcw } from "lucide-react";

import { minorToDisplay } from "@/lib/catalog-utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { ProductDetailModal } from "./product-detail-modal";
import { restoreProduct, softDeleteProduct } from "./actions";
import { useTranslation } from "@/lib/i18n/use-translation";
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
  const { t } = useTranslation();

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
              <th className="px-4 py-3">{t("field.sku")}</th>
              <th className="px-4 py-3">{t("field.info")}</th>
              <th className="px-4 py-3">{t("product.category")}</th>
              <th className="px-4 py-3">{t("field.tracking")}</th>
              <th className="px-4 py-3">{t("field.unit")}</th>
              <th className="px-4 py-3 text-right">{t("product.stdCost")}</th>
              <th className="px-4 py-3 text-right">{t("product.sellingPrice")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {products.map((product) => (
              <tr key={product.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5 align-middle">
                  <button
                    type="button"
                    onClick={() => handleOpen(product.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs font-semibold text-primary transition-all hover:bg-primary/10 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {product.sku}
                  </button>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {product.name}
                  </div>
                  {product.standardName && product.standardName !== product.name ? (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {t("product.altName")}: {product.standardName}
                    </div>
                  ) : null}
                  {product.country ? (
                    <div className="text-[11px] text-muted-foreground">{t("product.origin")}: {product.country}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {product.categoryName ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground border border-border/50">
                        <Layers className="size-3 text-muted-foreground" />
                        {product.categoryName}
                      </span>
                    ) : null}
                    {product.brandName ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 border border-blue-500/20">
                        <Tag className="size-3 text-blue-500" />
                        {product.brandName}
                      </span>
                    ) : null}
                    {!product.categoryName && !product.brandName ? (
                      <span className="text-xs text-muted-foreground">{t("product.unassigned")}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3.5 align-middle">
                  {product.trackingMode === "serial" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {t("product.trackingSerial")}
                    </span>
                  ) : product.trackingMode === "lot" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 border border-blue-500/20">
                      <span className="size-1.5 rounded-full bg-blue-500" />
                      {t("product.trackingLot")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground border border-border/60">
                      {t("product.trackingStandard")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <span className="inline-flex items-center rounded bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                    {product.unitCode || "PCS"}
                  </span>
                </td>
                <td className="px-4 py-3.5 align-middle text-right font-mono text-xs text-muted-foreground">
                  {product.currencyCode} {minorToDisplay(product.standardCostMinor)}
                </td>
                <td className="px-4 py-3.5 align-middle text-right font-mono text-xs font-bold text-foreground">
                  {product.currencyCode} {minorToDisplay(product.listPriceMinor)}
                </td>
                <td className="px-4 py-3.5 align-middle">
                  <div className="flex items-center justify-end gap-1.5">
                    {!showDeleted ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpen(product.id)}
                          className="h-8 gap-1 px-2 text-xs font-medium hover:bg-primary/10 hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                          {t("action.view")}
                        </Button>
                        <ButtonLink
                          href={`/admin/products/${product.id}/edit`}
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                        >
                          {t("action.edit")}
                        </ButtonLink>
                        <DeleteConfirmationDialog
                          action={softDeleteProduct}
                          hiddenInputs={{ id: product.id }}
                          itemName={product.name}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title={t("action.delete")}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </DeleteConfirmationDialog>
                      </>
                    ) : (
                      <form action={restoreProduct}>
                        <input type="hidden" name="id" value={product.id} />
                        <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs">
                          <RotateCcw className="size-3.5" />
                          {t("action.restore")}
                        </Button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  <div className="mx-auto flex max-w-xs flex-col items-center justify-center text-center">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground ring-1 ring-border">
                      <Package className="size-6" />
                    </div>
                    <p className="mt-3 font-semibold text-foreground">{t("product.emptyTitle")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("product.emptyDescription")}
                    </p>
                  </div>
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
