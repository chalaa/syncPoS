"use client";

import { minorToDisplay } from "@/lib/catalog-utils";
import { trackingModeOptions } from "@/server/catalog/types";
import type { ProductFormRecord, SelectOption } from "@/server/catalog/types";
import { createProduct, updateProduct } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { ManyToManyTags } from "@/components/ui/many-to-many-tags";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useMemo, useState } from "react";

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductFormRecord;
  categories: SelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  taxes: { id: string; label: string; scope: "purchase" | "sale" | "both" }[];
  error?: string;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const textareaClass = "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ProductForm({
  mode,
  product,
  categories,
  brands,
  units,
  taxes,
  error,
}: ProductFormProps) {
  const action = mode === "create" ? createProduct : updateProduct;
  const title = mode === "create" ? "New Product" : product?.name ?? "Edit Product";
  const submitLabel = mode === "create" ? "Create product" : "Save changes";
  const [saleTaxIds, setSaleTaxIds] = useState(product?.saleTaxIds ?? []);
  const [purchaseTaxIds, setPurchaseTaxIds] = useState(product?.purchaseTaxIds ?? []);
  const saleTaxOptions = useMemo(
    () => taxes.filter((tax) => tax.scope === "sale" || tax.scope === "both").map((tax) => ({ id: tax.id, label: tax.label })),
    [taxes],
  );
  const purchaseTaxOptions = useMemo(
    () => taxes.filter((tax) => tax.scope === "purchase" || tax.scope === "both").map((tax) => ({ id: tax.id, label: tax.label })),
    [taxes],
  );

  return (
    <PageShell maxWidth="max-w-6xl">
      <PageHeader
        eyebrow="Product"
        title={title}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products" variant="outline">
              Back
            </ButtonLink>
            {product ? (
              <ButtonLink href={`/admin/products/${product.id}`} variant="outline">
                Open
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {error ? <Alert kind="error">{error}</Alert> : null}
      {units.length === 0 ? (
        <Alert kind="warning">Create at least one unit of measure before creating a product.</Alert>
      ) : null}

      <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
        {product ? <input type="hidden" name="id" value={product.id} /> : null}
        <input type="hidden" name="isActive" value="on" />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Product Name
            <input
              name="name"
              defaultValue={product?.name}
              required
              maxLength={200}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Item Code
            <input
              name="sku"
              defaultValue={product?.sku}
              placeholder={mode === "create" ? "Auto" : undefined}
              maxLength={60}
              className={inputClass}
            />
          </label>
        </div>

        <Notebook
          defaultValue="general"
          items={[
            {
              value: "general",
              label: "General Information",
              content: (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">
                      Category
                      <select name="categoryId" defaultValue={product?.categoryId ?? ""} className={inputClass}>
                        <option value="">None</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Brand
                      <select name="brandId" defaultValue={product?.brandId ?? ""} className={inputClass}>
                        <option value="">None</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">
                      Model
                      <input name="model" defaultValue={product?.model ?? ""} maxLength={100} className={inputClass} />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                      Unit
                      <select
                        name="unitId"
                        defaultValue={product?.unitId ?? units[0]?.id ?? ""}
                        required
                        className={inputClass}
                      >
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.code} / {unit.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-1 text-sm font-medium">
                    Description
                    <textarea name="description" defaultValue={product?.description ?? ""} className={textareaClass} />
                  </label>
                </div>
              ),
            },
            {
              value: "inventory",
              label: "Inventory",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium">
                    Tracking Mode
                    <select
                      name="trackingMode"
                      defaultValue={product?.trackingMode ?? "none"}
                      className={inputClass}
                    >
                      {trackingModeOptions.map((modeOption) => (
                        <option key={modeOption} value={modeOption}>
                          {modeOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ),
            },
            {
              value: "sales",
              label: "Sales",
              content: (
                <div className="grid gap-4">
                  <label className="grid gap-1 text-sm font-medium">
                    Sales Unit Price
                    <input
                      name="listPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={product ? minorToDisplay(product.listPriceMinor) : "0.00"}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Customer Taxes
                    <ManyToManyTags
                      name="saleTaxIds"
                      options={saleTaxOptions}
                      value={saleTaxIds}
                      onChange={setSaleTaxIds}
                      placeholder="Select sale tax"
                    />
                  </label>
                </div>
              ),
            },
            {
              value: "purchase",
              label: "Purchase",
              content: (
                <div className="grid gap-4">
                  <label className="grid gap-1 text-sm font-medium">
                    Purchase Unit Cost
                    <input
                      name="standardCost"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={product ? minorToDisplay(product.standardCostMinor) : "0.00"}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Vendor Taxes
                    <ManyToManyTags
                      name="purchaseTaxIds"
                      options={purchaseTaxOptions}
                      value={purchaseTaxIds}
                      onChange={setPurchaseTaxIds}
                      placeholder="Select purchase tax"
                    />
                  </label>
                </div>
              ),
            },
          ]}
        />

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <ButtonLink href="/admin/products" variant="outline">
            Cancel
          </ButtonLink>
          <Button disabled={units.length === 0}>{submitLabel}</Button>
        </div>
      </form>
    </PageShell>
  );
}
