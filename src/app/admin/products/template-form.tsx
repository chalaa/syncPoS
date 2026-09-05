"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  createProductTemplate,
  generateTemplateVariants,
  updateProductTemplate,
} from "@/app/admin/products/actions";
import { minorToDisplay } from "@/lib/catalog-utils";
import type {
  CatalogAttributeRecord,
  CategoryAttributeRecord,
  ProductTemplateDetail,
  SelectOption,
} from "@/server/catalog/types";
import { trackingModeOptions } from "@/server/catalog/types";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const textareaClass = "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm";

type TemplateFormProps = {
  mode: "create" | "edit";
  template?: ProductTemplateDetail;
  categories: SelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  attributes: CatalogAttributeRecord[];
  categoryAttributes: CategoryAttributeRecord[];
  notice?: string;
  error?: string;
};

export function ProductTemplateForm({
  mode,
  template,
  categories,
  brands,
  units,
  attributes,
  categoryAttributes,
  notice,
  error,
}: TemplateFormProps) {
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? "");
  const selectedValueIds = useMemo(
    () => new Set(template?.attributes.flatMap((attribute) => attribute.selectedValueIds) ?? []),
    [template],
  );
  const action = mode === "create" ? createProductTemplate : updateProductTemplate;
  const categoryName = categories.find((category) => category.id === template?.categoryId)?.name ?? "-";
  const brandName = brands.find((brand) => brand.id === template?.brandId)?.name ?? "-";
  const unitName = units.find((unit) => unit.id === template?.unitId);
  const inheritedAttributes = useMemo(() => {
    const activeAttributes = new Map(attributes.map((attribute) => [attribute.id, attribute]));

    return categoryAttributes
      .filter((assignment) => assignment.categoryId === categoryId)
      .map((assignment) => {
        const attribute = activeAttributes.get(assignment.attributeId);

        return attribute
          ? {
              ...assignment,
              values: attribute.values.filter((value) => value.isActive),
            }
          : null;
      })
      .filter((attribute): attribute is CategoryAttributeRecord & { values: CatalogAttributeRecord["values"] } => Boolean(attribute));
  }, [attributes, categoryAttributes, categoryId]);

  return (
    <PageShell maxWidth="max-w-6xl">
      <PageHeader
        eyebrow="Catalog"
        title={mode === "create" ? "New Product Template" : template?.name ?? "Product Template"}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products/templates" variant="outline">
              Back to templates
            </ButtonLink>
            {template ? (
              <form action={generateTemplateVariants}>
                <input type="hidden" name="templateId" value={template.id} />
                <Button>Generate variants</Button>
              </form>
            ) : null}
          </div>
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      {template ? (
        <section className="grid gap-4 rounded-lg border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Category</div>
              <div className="mt-1 font-semibold">{categoryName}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Brand</div>
              <div className="mt-1 font-semibold">{brandName}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Unit</div>
              <div className="mt-1 font-semibold">{unitName ? `${unitName.code} / ${unitName.name}` : "-"}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Tracking</div>
              <div className="mt-1 font-semibold capitalize">{template.trackingMode}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Variants</div>
              <div className="mt-1 font-semibold">{template.variants.length}</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Status</div>
              <div className="mt-1 font-semibold">{template.isActive ? "Active" : "Inactive"}</div>
              <div className="mt-3 text-xs font-medium uppercase text-muted-foreground">Description</div>
              <p className="mt-1 text-sm text-muted-foreground">{template.description || "No description"}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs font-medium uppercase text-muted-foreground">Selected Attribute Values</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {template.attributes.flatMap((attribute) =>
                  attribute.values
                    .filter((value) => attribute.selectedValueIds.includes(value.id))
                    .map((value) => (
                      <span key={`${attribute.attributeId}-${value.id}`} className="rounded-md border border-border bg-muted px-3 py-1 text-sm">
                        {attribute.attributeName}: {value.value}
                      </span>
                    )),
                )}
                {template.attributes.every((attribute) => attribute.selectedValueIds.length === 0) ? (
                  <span className="text-sm text-muted-foreground">No values selected.</span>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
        {template ? <input type="hidden" name="id" value={template.id} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Template Name
            <input name="name" defaultValue={template?.name} required maxLength={200} className={inputClass} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Category
            <select
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={inputClass}
            >
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
            <select name="brandId" defaultValue={template?.brandId ?? ""} className={inputClass}>
              <option value="">None</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Unit
            <select name="unitId" defaultValue={template?.unitId ?? units[0]?.id ?? ""} className={inputClass}>
              <option value="">None</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} / {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Tracking Mode
            <select name="trackingMode" defaultValue={template?.trackingMode ?? "none"} className={inputClass}>
              {trackingModeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-7 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isActive" defaultChecked={template?.isActive ?? true} className="size-4" />
            Active
          </label>
        </div>

        <label className="grid gap-1 text-sm font-medium">
          Description
          <textarea name="description" defaultValue={template?.description ?? ""} className={textareaClass} />
        </label>

        <section className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Variant Attributes</h2>
            <p className="text-sm text-muted-foreground">
              Attributes are loaded from the selected category. Select the values that should generate product variants.
            </p>
          </div>
          <div className="grid gap-4 p-4">
            {inheritedAttributes.map((attribute) => (
              <fieldset key={attribute.attributeId} className="grid gap-3 rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-semibold">
                  {attribute.attributeName}
                  {attribute.isRequired ? <span className="text-destructive"> *</span> : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {attribute.values.map((value) => (
                    <label key={value.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        name="attributeValueId"
                        value={value.id}
                        defaultChecked={selectedValueIds.has(value.id)}
                        className="size-4"
                      />
                      {value.value}
                    </label>
                  ))}
                  {attribute.values.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No active values configured.</span>
                  ) : null}
                </div>
              </fieldset>
            ))}
            {categoryId && inheritedAttributes.length === 0 ? (
              <p className="text-sm text-muted-foreground">This category has no attributes yet.</p>
            ) : null}
            {!categoryId ? (
              <p className="text-sm text-muted-foreground">Select a category to load variant attributes.</p>
            ) : null}
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <ButtonLink href="/admin/products/templates" variant="outline">
            Cancel
          </ButtonLink>
          <Button>{mode === "create" ? "Create template" : "Save changes"}</Button>
        </div>
      </form>

      {template ? (
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Generated Variants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Attributes</th>
                  <th className="px-4 py-3">Sales Price</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {template.variants.map((variant) => (
                  <tr key={variant.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/products/${variant.id}`} className="hover:underline">
                        {variant.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{variant.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{variant.attributeSummary || "-"}</td>
                    <td className="px-4 py-3">{variant.currencyCode} {minorToDisplay(variant.listPriceMinor)}</td>
                    <td className="px-4 py-3">{variant.currencyCode} {minorToDisplay(variant.standardCostMinor)}</td>
                    <td className="px-4 py-3">{variant.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
                {template.variants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No variants generated yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
