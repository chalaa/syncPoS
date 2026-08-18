import {
  formatProductType,
  minorToDisplay,
  productTypeOptions,
  trackingModeOptions,
} from "@/server/catalog/products";
import type { ProductFormRecord, SelectOption } from "@/server/catalog/types";
import { createProduct, updateProduct } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductFormRecord;
  categories: SelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
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
  error,
}: ProductFormProps) {
  const action = mode === "create" ? createProduct : updateProduct;
  const title = mode === "create" ? "New Product" : product?.name ?? "Edit Product";
  const submitLabel = mode === "create" ? "Create product" : "Save changes";

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

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_180px]">
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
            SKU
            <input
              name="sku"
              defaultValue={product?.sku}
              required
              maxLength={60}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Active
            <span className="flex h-10 items-center rounded-md border border-input bg-background px-3">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={product?.isActive ?? true}
                className="size-4"
              />
            </span>
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
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Product Type
                      <select
                        name="productType"
                        defaultValue={product?.productType ?? "machinery"}
                        className={inputClass}
                      >
                        {productTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {formatProductType(type)}
                          </option>
                        ))}
                      </select>
                    </label>
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

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1 text-sm font-medium">
                      Barcode
                      <input name="barcode" defaultValue={product?.barcode ?? ""} maxLength={80} className={inputClass} />
                    </label>
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
                <div className="grid gap-4 md:grid-cols-3">
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
                  <label className="grid gap-1 text-sm font-medium">
                    Standard Cost
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
                    List Price
                    <input
                      name="listPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={product ? minorToDisplay(product.listPriceMinor) : "0.00"}
                      className={inputClass}
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
