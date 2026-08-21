"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ManyToManyTags } from "@/components/ui/many-to-many-tags";
import { Notebook } from "@/components/ui/notebook";
import { cn } from "@/lib/utils";
import type { PurchaseFormOption, PurchaseOrderDetail, PurchaseTaxOption } from "@/server/purchasing/types";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const tableInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

type PurchaseLineDraft = {
  key: string;
  productId: string;
  quantity: string;
  unitCost: string;
  taxIds: string[];
};

function newLine(): PurchaseLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    quantity: "1",
    unitCost: "0",
    taxIds: [],
  };
}

function money(value: number) {
  return value.toFixed(2);
}

function taxLabel(tax: PurchaseTaxOption) {
  if (tax.computation === "fixed") {
    return `${tax.code} / ${tax.name} (${money(tax.amountMinor / 100)})`;
  }

  return `${tax.code} / ${tax.name} (${Number(tax.rate).toFixed(2)}%)`;
}

function calculateTax(lineAmount: number, quantity: number, tax?: PurchaseTaxOption) {
  if (!tax) {
    return 0;
  }

  if (tax.computation === "fixed") {
    const amount = (tax.amountMinor / 100) * quantity;

    return tax.priceIncluded ? Math.min(amount, lineAmount) : amount;
  }

  const rate = Number(tax.rate);

  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  if (tax.priceIncluded) {
    return lineAmount - lineAmount / (1 + rate / 100);
  }

  return lineAmount * (rate / 100);
}

function calculateTaxes(lineAmount: number, quantity: number, selectedTaxes: PurchaseTaxOption[]) {
  const taxAmounts = selectedTaxes.map((tax) => ({
    tax,
    amount: calculateTax(lineAmount, quantity, tax),
  }));
  const includedTaxAmount = taxAmounts
    .filter((line) => line.tax.priceIncluded)
    .reduce((sum, line) => sum + line.amount, 0);
  const excludedTaxAmount = taxAmounts
    .filter((line) => !line.tax.priceIncluded)
    .reduce((sum, line) => sum + line.amount, 0);
  const taxAmount = includedTaxAmount + excludedTaxAmount;
  const subtotal = Math.max(lineAmount - includedTaxAmount, 0);
  const total = lineAmount + excludedTaxAmount;

  return { subtotal, taxAmount, total };
}

export function PurchaseOrderForm({
  action,
  suppliers,
  products,
  locations,
  taxes,
  error,
  order,
  submitLabel = "Create RFQ",
}: {
  action: (formData: FormData) => void | Promise<void>;
  suppliers: PurchaseFormOption[];
  products: PurchaseFormOption[];
  locations: PurchaseFormOption[];
  taxes: PurchaseTaxOption[];
  error?: string;
  order?: PurchaseOrderDetail;
  submitLabel?: string;
}) {
  const [lines, setLines] = useState<PurchaseLineDraft[]>(() =>
    order?.lines.length
      ? order.lines.map((line) => ({
          key: line.id,
          productId: line.productId,
          quantity: line.quantityOrdered,
          unitCost: String(line.unitCostMinor / 100),
          taxIds: line.taxIds,
        }))
      : [newLine()],
  );
  const taxById = useMemo(() => new Map(taxes.map((tax) => [tax.id, tax])), [taxes]);
  const taxTagOptions = useMemo(
    () => taxes.map((tax) => ({ id: tax.id, label: taxLabel(tax) })),
    [taxes],
  );

  const lineTotals = useMemo(
    () =>
      lines.map((line) => {
        const quantity = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
        const safeUnitCost = Number.isFinite(unitCost) && unitCost > 0 ? unitCost : 0;
        const grossOrUntaxed = safeQuantity * safeUnitCost;
        const selectedTaxes = line.taxIds
          .map((taxId) => taxById.get(taxId))
          .filter((tax): tax is PurchaseTaxOption => Boolean(tax));

        return calculateTaxes(grossOrUntaxed, safeQuantity, selectedTaxes);
      }),
    [lines, taxById],
  );
  const totals = lineTotals.reduce(
    (sum, line) => ({
      subtotal: sum.subtotal + line.subtotal,
      taxAmount: sum.taxAmount + line.taxAmount,
      total: sum.total + line.total,
    }),
    { subtotal: 0, taxAmount: 0, total: 0 },
  );

  function updateLine(key: string, patch: Partial<PurchaseLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.key !== key)));
  }

  return (
    <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
      {order ? <input type="hidden" name="purchaseOrderId" value={order.id} /> : null}
      {error ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Supplier
          <select name="supplierId" required defaultValue={order?.supplierId ?? ""} className={inputClass}>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} / {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Vendor reference
          <input name="vendorReference" defaultValue={order?.vendorReference ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Order deadline
          <input name="orderDeadline" type="date" defaultValue={order?.orderDeadline ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Expected arrival
          <input name="expectedDate" type="date" defaultValue={order?.expectedDate ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Deliver to
          <select name="deliverToLocationId" defaultValue={order?.deliverToLocationId ?? ""} className={inputClass}>
            <option value="">Select on receipt</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} / {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Notebook
        defaultValue="order-lines"
        items={[
          {
            value: "order-lines",
            label: "Order Lines",
            content: (
              <div className="grid gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-2 py-2">Product</th>
                        <th className="w-28 px-2 py-2 text-right">Quantity</th>
                        <th className="w-32 px-2 py-2 text-right">Unit Cost</th>
                        <th className="w-56 px-2 py-2">Tax</th>
                        <th className="w-32 px-2 py-2 text-right">Subtotal</th>
                        <th className="w-32 px-2 py-2 text-right">Total</th>
                        <th className="w-12 px-2 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={line.key} className="border-b border-border/70">
                          <td className="px-2 py-3">
                            <select
                              name="productId"
                              required
                              value={line.productId}
                              className={tableInputClass}
                              onChange={(event) => updateLine(line.key, { productId: event.target.value })}
                            >
                              <option value="">Select product</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.code} / {product.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-3">
                            <input
                              name="quantity"
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              required
                              value={line.quantity}
                              className={cn(tableInputClass, "text-right")}
                              onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              name="unitCost"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={line.unitCost}
                              className={cn(tableInputClass, "text-right")}
                              onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <ManyToManyTags
                              name="taxIds"
                              options={taxTagOptions}
                              value={line.taxIds}
                              onChange={(taxIds) => updateLine(line.key, { taxIds })}
                              placeholder="Select tax"
                            />
                          </td>
                          <td className="px-2 py-3 text-right">{money(lineTotals[index]?.subtotal ?? 0)}</td>
                          <td className="px-2 py-3 text-right">{money(lineTotals[index]?.total ?? 0)}</td>
                          <td className="px-2 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={lines.length === 1}
                              onClick={() => removeLine(line.key)}
                            >
                              <Trash2Icon />
                              <span className="sr-only">Remove line</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, newLine()])}>
                    <PlusIcon data-icon="inline-start" />
                    Add line
                  </Button>
                  <div className="min-w-64 rounded-md border border-border bg-background p-3 text-sm">
                    <div className="flex justify-between gap-6 py-1">
                      <span className="text-muted-foreground">Untaxed amount</span>
                      <span className="font-medium">{money(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-6 py-1">
                      <span className="text-muted-foreground">Taxes</span>
                      <span className="font-medium">{money(totals.taxAmount)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-6 border-t border-border pt-2 text-base font-semibold">
                      <span>Total</span>
                      <span>{money(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            value: "other-information",
            label: "Other Information",
            content: (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Notes
                <textarea
                  name="notes"
                  defaultValue={order?.notes ?? ""}
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            ),
          },
        ]}
      />

      <div className="flex justify-end">
        <Button>{submitLabel}</Button>
      </div>
    </form>
  );
}
