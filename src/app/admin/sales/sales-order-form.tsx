"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManyToManyTags } from "@/components/ui/many-to-many-tags";
import { ManyToOneCreateSelect } from "@/components/ui/many-to-one-create-select";
import { Notebook } from "@/components/ui/notebook";
import { cn } from "@/lib/utils";
import { createCustomerFromSales } from "@/app/admin/sales/actions";
import type { SalesFormOption, SalesOrderDetail, SalesTaxOption } from "@/server/sales/types";
import { useAppStore } from "@/stores/app-store";

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
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<"cash" | "credit">(order?.paymentTerm ?? "credit");
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const setSelectedLocationId = useAppStore((state) => state.setSelectedLocationId);
  const [sourceLocationId, setSourceLocationId] = useState(order?.sourceLocationId ?? "");
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
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
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

  function updateLineProduct(key: string, productId: string) {
    const product = productById.get(productId);

    updateLine(key, {
      productId,
      unitPrice: product?.listPriceMinor !== undefined ? String(product.listPriceMinor / 100) : "0",
      taxIds: product?.saleTaxIds ?? [],
    });
  }

  function addLineForEditing() {
    const line = newLine();

    setLines((current) => [...current, line]);
    setEditingLineKey(line.key);
  }

  const editingLine = lines.find((line) => line.key === editingLineKey);
  const selectedShopId = !order && selectedLocationId && locations.some((location) => location.id === selectedLocationId)
    ? selectedLocationId
    : "";
  const effectiveSourceLocationId = sourceLocationId || selectedShopId;

  function changeSourceLocation(locationId: string) {
    setSourceLocationId(locationId);

    if (!order) {
      setSelectedLocationId(locationId || null);
    }
  }

  return (
    <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
      {order ? <input type="hidden" name="salesOrderId" value={order.id} /> : null}
      {error ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <ManyToOneCreateSelect
          name="customerId"
          label="Customer"
          options={customers}
          defaultValue={order?.customerId}
          placeholder="Search customer"
          onCreate={createCustomerFromSales}
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reference
          <input
            name="customerReference"
            defaultValue={order?.customerReference ?? ""}
            placeholder="Auto"
            readOnly
            className={cn(inputClass, "bg-muted text-muted-foreground")}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          FS Number
          <input name="fsNumber" defaultValue={order?.fsNumber ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Payment Term
          <select
            name="paymentTerm"
            value={paymentTerm}
            onChange={(event) => setPaymentTerm(event.target.value as "cash" | "credit")}
            className={inputClass}
          >
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Order Date
          <input name="orderDate" type="date" defaultValue={order?.orderDate ?? ""} className={inputClass} />
        </label>
        {paymentTerm === "credit" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Last Payment Date
            <input name="validUntil" type="date" defaultValue={order?.validUntil ?? ""} className={inputClass} />
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm font-medium">
          Source location
          <select
            name="sourceLocationId"
            value={effectiveSourceLocationId}
            onChange={(event) => changeSourceLocation(event.target.value)}
            className={inputClass}
          >
            <option value="">Select when delivering/reserving</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} / {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
        <input
          type="checkbox"
          name="reserveOnConfirm"
          defaultChecked={order?.reserveOnConfirm ?? true}
          className="size-4 rounded border-input"
        />
        Reserve stock when quotation is confirmed
      </label>

      <Notebook
        defaultValue="order-lines"
        items={[
          {
            value: "order-lines",
            label: "Order Lines",
            content: (
              <div className="grid gap-4">
                {lines.map((line) => (
                  <div key={`${line.key}-fields`} className="hidden">
                    <input type="hidden" name="productId" value={line.productId} />
                    <input type="hidden" name="quantity" value={line.quantity} />
                    <input type="hidden" name="unitPrice" value={line.unitPrice} />
                    <input type="hidden" name="discount" value={line.discount} />
                    <input type="hidden" name="taxIds" value={line.taxIds.join(",")} />
                  </div>
                ))}

                <div className="hidden overflow-x-auto lg:block">
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
                              value={line.productId}
                              className={tableInputClass}
                              onChange={(event) => updateLineProduct(line.key, event.target.value)}
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
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={line.quantity}
                              className={cn(tableInputClass, "text-right")}
                              onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitPrice}
                              className={cn(tableInputClass, "text-right")}
                              onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                            />
                          </td>
                          <td className="px-2 py-3">
                            <input
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

                <div className="grid gap-3 lg:hidden">
                  {lines.map((line, index) => {
                    const product = productById.get(line.productId);
                    const selectedTaxCount = line.taxIds.length;

                    return (
                      <div key={`${line.key}-card`} className="rounded-md border border-border bg-background p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{product ? `${product.code} / ${product.name}` : "No product selected"}</p>
                            <p className="text-xs text-muted-foreground">
                              Qty {line.quantity || "0"} / Unit price {line.unitPrice || "0"} / Taxes {selectedTaxCount}
                            </p>
                          </div>
                          <div className="shrink-0 text-right font-semibold">{money(lineTotals[index]?.total ?? 0)}</div>
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingLineKey(line.key)}>
                            Edit
                          </Button>
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
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Button type="button" variant="outline" onClick={addLineForEditing}>
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

                <Dialog open={Boolean(editingLine)} onOpenChange={(open) => !open && setEditingLineKey(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Order Line</DialogTitle>
                      <DialogDescription>Add or edit one sales order line.</DialogDescription>
                    </DialogHeader>
                    {editingLine ? (
                      <div className="grid gap-4">
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Product
                          <select
                            value={editingLine.productId}
                            className={inputClass}
                            onChange={(event) => updateLineProduct(editingLine.key, event.target.value)}
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.code} / {product.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="flex flex-col gap-1 text-sm font-medium">
                            Quantity
                            <input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={editingLine.quantity}
                              className={cn(inputClass, "text-right")}
                              onChange={(event) => updateLine(editingLine.key, { quantity: event.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium">
                            Unit price
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingLine.unitPrice}
                              className={cn(inputClass, "text-right")}
                              onChange={(event) => updateLine(editingLine.key, { unitPrice: event.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium">
                            Discount
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingLine.discount}
                              className={cn(inputClass, "text-right")}
                              onChange={(event) => updateLine(editingLine.key, { discount: event.target.value })}
                            />
                          </label>
                        </div>
                        <label className="grid gap-1 text-sm font-medium">
                          Taxes
                          <ManyToManyTags
                            options={taxTagOptions}
                            value={editingLine.taxIds}
                            onChange={(taxIds) => updateLine(editingLine.key, { taxIds })}
                            placeholder="Select tax"
                          />
                        </label>
                      </div>
                    ) : null}
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditingLineKey(null)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ),
          },
          {
            value: "other-information",
            label: "Other Information",
            content: (
              <div className="grid gap-4">
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
