"use client";

import { minorToDisplay } from "@/lib/catalog-utils";
import { trackingModeOptions } from "@/server/catalog/types";
import type { CategorySelectOption, ProductFormRecord, SelectOption } from "@/server/catalog/types";
import { createProduct, updateProduct } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { ManyToManyTags } from "@/components/ui/many-to-many-tags";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { useMemo, useState } from "react";

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductFormRecord;
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  taxes: { id: string; label: string; scope: "purchase" | "sale" | "both" }[];
  notice?: string;
  error?: string;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const readonlyInputClass = "h-10 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground";
const textareaClass = "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ProductForm({
  mode,
  product,
  categories,
  brands,
  units,
  taxes,
  notice,
  error,
}: ProductFormProps) {
  const action = mode === "create" ? createProduct : updateProduct;
  const title = mode === "create" ? "New Product" : product?.name ?? "Edit Product";
  const submitLabel = mode === "create" ? "Create product" : "Save changes";
  const [saleTaxIds, setSaleTaxIds] = useState(product?.saleTaxIds ?? []);
  const [purchaseTaxIds, setPurchaseTaxIds] = useState(product?.purchaseTaxIds ?? []);
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [model, setModel] = useState(product?.model ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [specificationValues, setSpecificationValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(product?.specifications ?? {}).map(([key, value]) => [
        key,
        value === null || value === undefined ? "" : String(value),
      ]),
    ),
  );
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );
  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === brandId),
    [brands, brandId],
  );
  const specificationFields = useMemo(
    () => selectedCategory?.specificationSchema ?? [],
    [selectedCategory?.specificationSchema],
  );
  const generatedStandardName = useMemo(() => {
    const parts = [
      selectedBrand?.name,
      model.trim(),
      selectedCategory?.name,
      ...specificationFields.map((field) => specificationValues[field.key]?.trim()).filter(Boolean),
    ].filter(Boolean);

    return parts.join(" ");
  }, [model, selectedBrand?.name, selectedCategory?.name, specificationFields, specificationValues]);
  const standardName = generatedStandardName || product?.name || "";
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

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}
      {units.length === 0 ? (
        <Alert kind="warning">Create at least one unit of measure before creating a product.</Alert>
      ) : null}

      <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
        {product ? <input type="hidden" name="id" value={product.id} /> : null}
        <input type="hidden" name="isActive" value="on" />
        <input type="hidden" name="name" value={standardName} />

        <div className="grid gap-4 md:grid-cols-2">
          {generatedStandardName ? (
            <div className="grid gap-1 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm md:col-span-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Standard Name</span>
              <span className="min-h-6 break-words text-base font-semibold text-foreground">{generatedStandardName}</span>
            </div>
          ) : null}
          {mode === "edit" ? (
            <label className="grid gap-1 text-sm font-medium">
              Item Code
              <input
                name="sku"
                defaultValue={product?.sku}
                maxLength={60}
                readOnly
                className={readonlyInputClass}
              />
            </label>
          ) : null}
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
                    <RelatedModelSelect
                      name="categoryId"
                      label="Category"
                      options={categories}
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Select category"
                      emptyLabel="No categories found."
                    />
                    <RelatedModelSelect
                      name="brandId"
                      label="Brand"
                      options={brands}
                      value={brandId}
                      onValueChange={setBrandId}
                      placeholder="Select brand"
                      emptyLabel="No brands found."
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">
                      Model
                      <input
                        name="model"
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        maxLength={100}
                        className={inputClass}
                      />
                    </label>
                    <RelatedModelSelect
                      name="unitId"
                      label="Unit"
                      options={units}
                      defaultValue={product?.unitId ?? units[0]?.id ?? ""}
                      required
                      placeholder="Select unit"
                      emptyLabel="No units found."
                    />
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
            {
              value: "specifications",
              label: "Specifications",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  {specificationFields.map((field) => {
                    const value = product?.specifications?.[field.key];

                    return (
                      <label key={field.key} className="grid gap-1 text-sm font-medium">
                        <span>{field.label}</span>
                        <input type="hidden" name="specificationKey" value={field.key} />
                        <input
                          name={`specificationValue:${field.key}`}
                          value={specificationValues[field.key] ?? (value === null || value === undefined ? "" : String(value))}
                          onChange={(event) =>
                            setSpecificationValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className={inputClass}
                        />
                      </label>
                    );
                  })}
                  {specificationFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Select a category with configured specifications to fill product details.
                    </p>
                  ) : null}
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
