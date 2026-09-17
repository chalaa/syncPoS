"use client";

import { EditIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { createPriceList, softDeletePriceList, updatePriceList } from "@/app/admin/products/actions";
import { ProductNavTabs } from "@/app/admin/products/product-nav-tabs";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { ProductSelect, type ProductSelectOption } from "@/app/admin/products/product-select";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { minorToDisplay } from "@/lib/catalog-utils";
import { cn } from "@/lib/utils";
import type { PriceListFormOptions, ProductPriceListItemRow, ProductPriceListRow } from "@/server/catalog/types";

type PriceListMutation = (formData: FormData) => Promise<void>;

type PriceListLineDraft = {
  key: string;
  productId: string;
  minimumQuantity: string;
  unitPrice: string;
  discount: string;
  isActive: boolean;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const tableInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function newLine(): PriceListLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    minimumQuantity: "1",
    unitPrice: "0.00",
    discount: "0.00",
    isActive: true,
  };
}

function lineFromItem(item: ProductPriceListItemRow): PriceListLineDraft {
  return {
    key: item.id,
    productId: item.productId,
    minimumQuantity: item.minimumQuantity,
    unitPrice: minorToDisplay(item.unitPriceMinor),
    discount: minorToDisplay(item.discountMinor),
    isActive: item.isActive,
  };
}

function PriceListForm({
  title,
  action,
  record,
  options,
  returnPath,
}: {
  title: string;
  action: PriceListMutation;
  record?: ProductPriceListRow;
  options: PriceListFormOptions;
  returnPath: string;
}) {
  const [lines, setLines] = useState<PriceListLineDraft[]>(() => record?.items.length ? record.items.map(lineFromItem) : [newLine()]);
  const [productOptions, setProductOptions] = useState<ProductSelectOption[]>(options.products);

  function updateLine(key: string, patch: Partial<PriceListLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.key !== key)));
  }

  return (
    <form action={action} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      <DialogDescription>Set product prices by owner and quantity break.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {record ? <input type="hidden" name="id" value={record.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Name
          <input name="name" required defaultValue={record?.name} className={inputClass} />
        </label>
        <RelatedModelSelect
          name="ownerId"
          label="Owner"
          options={options.owners}
          defaultValue={record?.ownerId ?? options.owners[0]?.id ?? ""}
          required={options.owners.length > 0}
          placeholder="Select owner"
          emptyLabel="No owners found."
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input name="isActive" type="checkbox" defaultChecked={record?.isActive ?? true} className="size-4 rounded border-input" />
        Active
      </label>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Price Items</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, newLine()])}>
            <PlusIcon data-icon="inline-start" />
            Add item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2">Product</th>
                <th className="w-28 px-2 py-2 text-right">Min Qty</th>
                <th className="w-32 px-2 py-2 text-right">Unit Price</th>
                <th className="w-32 px-2 py-2 text-right">Discount</th>
                <th className="w-24 px-2 py-2">Active</th>
                <th className="w-12 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} className="border-b border-border/70">
                  <td className="px-2 py-2">
                    <ProductSelect
                      name="itemProductId"
                      value={line.productId}
                      options={productOptions}
                      categories={options.productCategories}
                      brands={options.productBrands}
                      units={options.productUnits}
                      onValueChange={(productId) => updateLine(line.key, { productId })}
                      onOptionsChange={setProductOptions}
                      placeholder="Select product"
                      emptyLabel="No products found."
                      inputClassName={tableInputClass}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input name="itemMinimumQuantity" type="number" min="0.000001" step="0.000001" value={line.minimumQuantity} className={cn(tableInputClass, "text-right")} onChange={(event) => updateLine(line.key, { minimumQuantity: event.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <input name="itemUnitPrice" type="number" min="0" step="0.01" value={line.unitPrice} className={cn(tableInputClass, "text-right")} onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <input name="itemDiscount" type="number" min="0" step="0.01" value={line.discount} className={cn(tableInputClass, "text-right")} onChange={(event) => updateLine(line.key, { discount: event.target.value })} />
                  </td>
                  <td className="px-2 py-2">
                    <select name="itemIsActive" value={line.isActive ? "true" : "false"} className={tableInputClass} onChange={(event) => updateLine(line.key, { isActive: event.target.value === "true" })}>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => removeLine(line.key)}>
                      <Trash2Icon />
                      <span className="sr-only">Remove item</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button>{record ? "Save changes" : "Create price list"}</Button>
      </DialogFooter>
    </form>
  );
}

function PriceListDialog({
  label,
  action,
  record,
  options,
  returnPath,
  children,
}: {
  label: string;
  action: PriceListMutation;
  record?: ProductPriceListRow;
  options: PriceListFormOptions;
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-6xl">
        <PriceListForm title={label} action={action} record={record} options={options} returnPath={returnPath} />
      </DialogContent>
    </Dialog>
  );
}

export function PriceListManager({
  rows,
  options,
  notice,
  error,
}: {
  rows: ProductPriceListRow[];
  options: PriceListFormOptions;
  notice?: string;
  error?: string;
}) {
  const returnPath = "/admin/products/price-lists";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog Management"
        title="Price Lists & Tiered Pricing"
        actions={
          <PriceListDialog label="New price list" action={createPriceList} options={options} returnPath={returnPath}>
            <Button size="sm">
              <PlusIcon className="size-4" data-icon="inline-start" />
              New price list
            </Button>
          </PriceListDialog>
        }
      />

      <ProductNavTabs currentHref="/admin/products/price-lists" />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Price List</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.items.slice(0, 2).map((item) => `${item.sku} ${minorToDisplay(item.unitPriceMinor)}`).join(", ") || "No items configured"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{row.ownerName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.currencyCode}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-foreground">{row.itemCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.isActive ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <PriceListDialog label={`Edit ${row.name}`} action={updatePriceList} record={row} options={options} returnPath={returnPath}>
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                          <EditIcon className="size-3.5" data-icon="inline-start" />
                          Edit
                        </Button>
                      </PriceListDialog>
                      <DeleteConfirmationDialog
                        action={softDeletePriceList}
                        hiddenInputs={{ id: row.id, returnPath }}
                        itemName={row.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No price lists found.
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
