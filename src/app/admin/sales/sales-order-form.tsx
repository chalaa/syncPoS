"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ManyToManyTags } from "@/components/ui/many-to-many-tags";
import { Notebook } from "@/components/ui/notebook";
import { cn } from "@/lib/utils";
import type { SalesFormOption, SalesOrderDetail, SalesTaxOption } from "@/server/sales/types";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const tableInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

type SalesLineDraft = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxIds: string[];
};

function newLine(): SalesLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    quantity: "1",
    unitPrice: "0",
    discount: "0",
    taxIds: [],
  };
}

function money(value: number) {
  return value.toFixed(2);
}

function taxLabel(tax: SalesTaxOption) {
  if (tax.computation === "fixed") {
    return `${tax.code} / ${tax.name} (${money(tax.amountMinor / 100)})`;
  }

  return `${tax.code} / ${tax.name} (${Number(tax.rate).toFixed(2)}%)`;
}

function calculateTax(lineAmount: number, quantity: number, tax?: SalesTaxOption) {
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

function calculateTaxes(lineAmount: number, quantity: number, selectedTaxes: SalesTaxOption[]) {
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

export function SalesOrderForm({
  action,
  customers,
  products,
  locations,
  taxes,
  error,
  order,
  submitLabel = "Create Quotation",
}: {
  action: (formData: FormData) => void | Promise<void>;
  customers: SalesFormOption[];
  products: SalesFormOption[];
  locations: SalesFormOption[];
  taxes: SalesTaxOption[];
  error?: string;
  order?: SalesOrderDetail;
  submitLabel?: string;
}) {
  const [lines, setLines] = useState<SalesLineDraft[]>(() =>
    order?.lines.length
      ? order.lines.map((line) => ({
          key: line.id,
          productId: line.productId,
          quantity: line.quantityOrdered,
          unitPrice: String(line.unitPriceMinor / 100),
          discount: String(line.discountMinor / 100),
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
        const unitPrice = Number(line.unitPrice);
        const discount = Number(line.discount);
        const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
        const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
        const safeDiscount = Number.isFinite(discount) && discount > 0 ? discount : 0;
        const lineAmount = safeQuantity * Math.max(safeUnitPrice - safeDiscount, 0);
        const selectedTaxes = line.taxIds
          .map((taxId) => taxById.get(taxId))
          .filter((tax): tax is SalesTaxOption => Boolean(tax));

        return calculateTaxes(lineAmount, safeQuantity, selectedTaxes);
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

  function updateLine(key: string, patch: Partial<SalesLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.key !== key)));
  }

  return (
    <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
      {order ? <input type="hidden" name="salesOrderId" value={order.id} /> : null}
      {error ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Customer
          <select name="customerId" required defaultValue={order?.customerId ?? ""} className={inputClass}>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.code} / {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Customer reference
          <input name="customerReference" defaultValue={order?.customerReference ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Valid until
          <input name="validUntil" type="date" defaultValue={order?.validUntil ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Expected delivery
          <input name="expectedDeliveryDate" type="date" defaultValue={order?.expectedDeliveryDate ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Source location
          <select name="sourceLocationId" defaultValue={order?.sourceLocationId ?? ""} className={inputClass}>
            <option value="">Select when delivering/reserving</option>
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
                  <table className="w-full min-w-[1080px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-2 py-2">Product</th>
                        <th className="w-28 px-2 py-2 text-right">Quantity</th>
                        <th className="w-32 px-2 py-2 text-right">Unit Price</th>
                        <th className="w-32 px-2 py-2 text-right">Discount</th>
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
                              name="unitPrice"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={line.unitPrice}
                              className={cn(tableInputClass, "text-right")}
                              onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              name="discount"
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.discount}
                              className={cn(tableInputClass, "text-right")}
                              onChange={(event) => updateLine(line.key, { discount: event.target.value })}
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
                              aria-label="Remove line"
                              onClick={() => removeLine(line.key)}
                            >
                              <Trash2Icon />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, newLine()])}>
                    <PlusIcon data-icon="inline-start" />
                    Add line
                  </Button>
                  <div className="grid min-w-72 gap-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{money(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">{money(totals.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 text-base">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold">{money(totals.total)}</span>
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
              <div className="grid gap-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="reserveOnConfirm"
                    defaultChecked={order?.reserveOnConfirm ?? false}
                    className="size-4 rounded border-input"
                  />
                  Reserve stock when quotation is confirmed
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Notes
                  <textarea
                    name="notes"
                    rows={4}
                    defaultValue={order?.notes ?? ""}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="flex justify-end">
        <Button disabled={customers.length === 0 || products.length === 0}>{submitLabel}</Button>
      </div>
    </form>
  );
}
