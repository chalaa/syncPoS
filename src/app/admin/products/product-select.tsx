"use client";

import { useMemo, useState } from "react";
import { Eye, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RelatedModelSelect, type RelatedModelOption } from "@/components/ui/related-model-select";
import type { CategorySelectOption, SelectOption } from "@/server/catalog/types";
import { NewProductModal } from "@/app/admin/products/new-product-modal";
import { ProductDetailModal } from "@/app/admin/products/product-detail-modal";

export type ProductSelectOption = RelatedModelOption & {
  sku?: string | null;
  listPriceMinor?: number;
  standardCostMinor?: number;
  saleTaxIds?: string[];
  purchaseTaxIds?: string[];
};

type ProductSelectProps = {
  name?: string;
  value?: string | null;
  options: ProductSelectOption[];
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  taxes?: { id: string; label?: string; name?: string; code?: string; scope?: "purchase" | "sale" | "both" }[];
  placeholder?: string;
  emptyLabel?: string;
  inputClassName?: string;
  error?: string;
  onValueChange?: (value: string) => void;
  onOptionsChange?: (options: ProductSelectOption[]) => void;
};

export function ProductSelect({
  name,
  value,
  options,
  categories,
  brands,
  units,
  taxes,
  placeholder = "Select product",
  emptyLabel = "No products found.",
  inputClassName,
  error,
  onValueChange,
  onOptionsChange,
}: ProductSelectProps) {
  const [createdItems, setCreatedItems] = useState<ProductSelectOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [initialName, setInitialName] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const selectedProductId = value ?? "";

  const allItems = useMemo(() => {
    const map = new Map<string, ProductSelectOption>();
    for (const opt of options) {
      map.set(opt.id, opt);
    }
    for (const opt of createdItems) {
      map.set(opt.id, opt);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [options, createdItems]);

  function addCreatedProduct(product: ProductSelectOption) {
    setCreatedItems((prev) => [...prev.filter((p) => p.id !== product.id), product]);
    onOptionsChange?.([...options.filter((p) => p.id !== product.id), product]);
    onValueChange?.(product.id);
  }

  const modalTaxes = useMemo(() => {
    return (taxes ?? []).map((t) => ({
      id: t.id,
      label:
        (t as any).label ??
        ((t as any).code ? `${(t as any).code} - ${(t as any).name}` : (t as any).name ?? t.id),
      scope: ((t as any).scope as "purchase" | "sale" | "both") ?? "both",
    }));
  }, [taxes]);

  function handleProductCreated(product: {
    id: string;
    sku: string;
    name: string;
    standardCostMinor?: number;
    listPriceMinor?: number;
    saleTaxIds?: string[];
    purchaseTaxIds?: string[];
  }) {
    const newOption: ProductSelectOption = {
      id: product.id,
      name: product.name,
      code: product.sku,
      sku: product.sku,
      listPriceMinor: product.listPriceMinor,
      standardCostMinor: product.standardCostMinor,
      saleTaxIds: product.saleTaxIds,
      purchaseTaxIds: product.purchaseTaxIds,
    };
    addCreatedProduct(newOption);
    setIsDialogOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-1.5 w-full">
        <div className="flex-1 min-w-0">
          <RelatedModelSelect
            name={name}
            value={selectedProductId}
            options={allItems}
            onValueChange={onValueChange}
            placeholder={placeholder}
            emptyLabel={emptyLabel}
            inputClassName={inputClassName}
            error={error}
            createLabel="Add Product..."
            onCreateAndEdit={(query) => {
              setInitialName(query);
              setIsDialogOpen(true);
            }}
            editHrefFor={(productId) => `/admin/products/${productId}/edit`}
          />
        </div>

        {/* Quick-view button — only shown when a product is selected */}
        {selectedProductId ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsDetailOpen(true)}
            className="size-10 shrink-0 rounded-lg border-border/80 text-muted-foreground transition-all hover:border-[#0B5D4B]/40 hover:bg-emerald-500/10 hover:text-[#0B5D4B] dark:hover:text-emerald-300 active:scale-95"
            title="View product details"
          >
            <Eye className="size-4" />
            <span className="sr-only">View Product Details</span>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            setInitialName("");
            setIsDialogOpen(true);
          }}
          className="size-10 shrink-0 rounded-lg border-border/80 text-muted-foreground transition-all hover:border-[#0B5D4B]/40 hover:bg-emerald-500/10 hover:text-[#0B5D4B] dark:hover:text-emerald-300 active:scale-95"
          title="Add new product"
        >
          <PackagePlus className="size-4" />
          <span className="sr-only">Add Product</span>
        </Button>
      </div>

      {isDialogOpen ? (
        <NewProductModal
          key={`${isDialogOpen}-${initialName}`}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          categories={categories}
          brands={brands}
          units={units}
          taxes={modalTaxes}
          initialProductName={initialName}
          onSuccess={handleProductCreated}
        />
      ) : null}

      {isDetailOpen && selectedProductId ? (
        <ProductDetailModal
          productId={selectedProductId}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
        />
      ) : null}
    </>
  );
}
