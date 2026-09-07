"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

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
import { ProductSelect, type ProductSelectOption } from "@/app/admin/products/product-select";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { cn } from "@/lib/utils";
import { createCustomerFromSales } from "@/app/admin/sales/actions";
import type { SalesAvailableStockOption, SalesFormOption, SalesOrderDetail, SalesTaxOption } from "@/server/sales/types";
import { useAppStore } from "@/stores/app-store";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const tableInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

type SalesLineDraft = {
  key: string;
  ownerId: string;
  sourceLocationId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxIds: string[];
};

type SalesLineErrors = Partial<Record<"sourceLocationId" | "ownerId" | "productId" | "quantity", string>>;

function newLine(ownerId = "", sourceLocationId = ""): SalesLineDraft {
  return {
    key: crypto.randomUUID(),
    ownerId,
    sourceLocationId,
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
  owners,
  products,
  productCategories,
  productBrands,
  productUnits,
  locations,
  taxes,
  availableStock,
  error,
  order,
  submitLabel = "Create Quotation",
  defaultDate = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  customers: SalesFormOption[];
  owners: SalesFormOption[];
  products: SalesFormOption[];
  productCategories: Parameters<typeof ProductSelect>[0]["categories"];
  productBrands: Parameters<typeof ProductSelect>[0]["brands"];
  productUnits: Parameters<typeof ProductSelect>[0]["units"];
  locations: SalesFormOption[];
  taxes: SalesTaxOption[];
  availableStock: SalesAvailableStockOption[];
  error?: string;
  order?: SalesOrderDetail;
  submitLabel?: string;
  defaultDate?: string;
}) {
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [paymentTerm, setPaymentTerm] = useState<"cash" | "credit">(order?.paymentTerm ?? "credit");
  const defaultOwnerId = order?.ownerId ?? owners[0]?.id ?? "";
  const [headerOwnerId, setHeaderOwnerId] = useState(defaultOwnerId);
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const setSelectedLocationId = useAppStore((state) => state.setSelectedLocationId);
  const selectedShopId = !order && selectedLocationId && locations.some((location) => location.id === selectedLocationId)
    ? selectedLocationId
    : "";
  const initialSourceLocationId = order?.sourceLocationId ?? selectedShopId;
  const [sourceLocationId, setSourceLocationId] = useState(initialSourceLocationId);
  const [showValidation, setShowValidation] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductSelectOption[]>(products);
  const [lines, setLines] = useState<SalesLineDraft[]>(() =>
    order?.lines.length
      ? order.lines.map((line) => ({
          key: line.id,
          ownerId: line.ownerId ?? defaultOwnerId,
          sourceLocationId: line.sourceLocationId ?? initialSourceLocationId,
          productId: line.productId,
          quantity: line.quantityOrdered,
          unitPrice: String(line.unitPriceMinor / 100),
          discount: String(line.discountMinor / 100),
          taxIds: line.taxIds,
        }))
      : [newLine(defaultOwnerId, initialSourceLocationId)],
  );
  const taxById = useMemo(() => new Map(taxes.map((tax) => [tax.id, tax])), [taxes]);
  const productById = useMemo(() => new Map(productOptions.map((product) => [product.id, product])), [productOptions]);
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
  const effectiveSourceLocationId = sourceLocationId || selectedShopId;
  const availableQuantityByDomain = useMemo(() => {
    const map = new Map<string, number>();

    for (const stock of availableStock) {
      map.set(
        `${stock.locationId}:${stock.ownerId}:${stock.productId}`,
        (map.get(`${stock.locationId}:${stock.ownerId}:${stock.productId}`) ?? 0) + Number(stock.quantityAvailable),
      );
    }

    return map;
  }, [availableStock]);

  function availableQuantityFor(line: SalesLineDraft) {
    const ownerId = line.ownerId || headerOwnerId;
    const locationId = line.sourceLocationId || effectiveSourceLocationId;

    if (!ownerId || !locationId || !line.productId) {
      return 0;
    }

    return availableQuantityByDomain.get(`${locationId}:${ownerId}:${line.productId}`) ?? 0;
  }

  const lineErrors = useMemo(() => {
    const nextErrors: Record<string, SalesLineErrors> = {};

    for (const line of lines) {
      const errors: SalesLineErrors = {};
      const ownerId = line.ownerId || headerOwnerId;
      const locationId = line.sourceLocationId || effectiveSourceLocationId;
      const quantity = Number(line.quantity);
      const availableQuantity = line.productId && ownerId && locationId
        ? (availableQuantityByDomain.get(`${locationId}:${ownerId}:${line.productId}`) ?? 0)
        : 0;

      if (!locationId) {
        errors.sourceLocationId = "Select a source location.";
      }

      if (!ownerId) {
        errors.ownerId = "Select an owner with stock in this location.";
      }

      if (!line.productId) {
        errors.productId = "Select a product with available stock.";
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.quantity = "Quantity must be greater than zero.";
      } else if (line.productId && quantity > availableQuantity) {
        errors.quantity = `Only ${availableQuantity.toFixed(6)} available for this owner and location.`;
      }

      if (Object.keys(errors).length > 0) {
        nextErrors[line.key] = errors;
      }
    }

    return nextErrors;
  }, [availableQuantityByDomain, effectiveSourceLocationId, headerOwnerId, lines]);
  const displayedLineErrors = showValidation ? lineErrors : {};

  function ownerOptionsForLine(line: SalesLineDraft) {
    const locationId = line.sourceLocationId || effectiveSourceLocationId;

    if (!locationId) {
      return [];
    }

    const ownerIds = new Set(
      availableStock
        .filter((stock) => stock.locationId === locationId && Number(stock.quantityAvailable) > 0)
        .map((stock) => stock.ownerId),
    );

    return owners.filter((owner) => ownerIds.has(owner.id));
  }

  function productOptionsForLine(line: SalesLineDraft) {
    const ownerId = line.ownerId || headerOwnerId;
    const locationId = line.sourceLocationId || effectiveSourceLocationId;

    if (!ownerId || !locationId) {
      return [];
    }

    const productIds = new Set(
      availableStock
        .filter((stock) => stock.locationId === locationId && stock.ownerId === ownerId && Number(stock.quantityAvailable) > 0)
        .map((stock) => stock.productId),
    );

    return productOptions.filter((product) => productIds.has(product.id));
  }

  function updateLine(key: string, patch: Partial<SalesLineDraft>) {
    setShowValidation(true);
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

  function addLine() {
    const line = newLine(headerOwnerId, effectiveSourceLocationId);

    setLines((current) => [...current, line]);
  }

  const editingLine = lines.find((line) => line.key === editingLineKey);

  function changeHeaderOwner(ownerId: string) {
    const previousOwnerId = headerOwnerId;

    setShowValidation(true);
    setHeaderOwnerId(ownerId);
    setLines((current) =>
      current.map((line) => {
        if (line.ownerId && line.ownerId !== previousOwnerId) {
          return line;
        }

        return { ...line, ownerId, productId: "" };
      }),
    );
  }

  function changeSourceLocation(locationId: string) {
    const previousSourceLocationId = effectiveSourceLocationId;

    setShowValidation(true);
    setSourceLocationId(locationId);

    if (!order) {
      setSelectedLocationId(locationId || null);
    }

    setLines((current) =>
      current.map((line) => {
        if (line.sourceLocationId && line.sourceLocationId !== previousSourceLocationId) {
          return line;
        }

        return { ...line, sourceLocationId: locationId, ownerId: headerOwnerId, productId: "" };
      }),
    );
  }

  function changeLineSourceLocation(line: SalesLineDraft, locationId: string) {
    updateLine(line.key, { sourceLocationId: locationId, ownerId: headerOwnerId, productId: "" });
  }

  function changeLineOwner(line: SalesLineDraft, ownerId: string) {
    updateLine(line.key, { ownerId, productId: "" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (Object.keys(lineErrors).length > 0) {
      setShowValidation(true);
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-border bg-card p-5">
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
          <input type="hidden" name="customerReference" value={order?.customerReference ?? ""} />
          <input
            defaultValue={order?.customerReference ?? ""}
            placeholder="Auto"
            disabled
            aria-readonly="true"
            className={cn(inputClass, "cursor-not-allowed bg-muted text-muted-foreground")}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          FS Number
          <input name="fsNumber" defaultValue={order?.fsNumber ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <RelatedModelSelect
          name="ownerId"
          label="Owner"
          options={owners}
          value={headerOwnerId}
          onValueChange={changeHeaderOwner}
          required={owners.length > 0}
          placeholder="Select owner"
          emptyLabel="No owners found."
        />
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
          <input name="orderDate" type="date" defaultValue={order?.orderDate ?? defaultDate} className={inputClass} />
        </label>
        {paymentTerm === "credit" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Last Payment Date
            <input name="validUntil" type="date" defaultValue={order?.validUntil ?? defaultDate} className={inputClass} />
          </label>
        ) : null}
        <RelatedModelSelect
          name="sourceLocationId"
          label="Source location"
          options={locations}
          value={effectiveSourceLocationId}
          onValueChange={changeSourceLocation}
          placeholder="Select when delivering/reserving"
          emptyLabel="No locations found."
        />
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
                    <input type="hidden" name="lineOwnerId" value={line.ownerId || headerOwnerId} />
                    <input type="hidden" name="lineSourceLocationId" value={line.sourceLocationId || effectiveSourceLocationId} />
                    <input type="hidden" name="quantity" value={line.quantity} />
                    <input type="hidden" name="unitPrice" value={line.unitPrice} />
                    <input type="hidden" name="discount" value={line.discount} />
                    <input type="hidden" name="taxIds" value={line.taxIds.join(",")} />
                  </div>
                ))}

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="w-80 px-2 py-2">Product</th>
                        <th className="w-64 px-2 py-2">Source Location</th>
                        <th className="w-56 px-2 py-2">Owner</th>
                        <th className="w-32 px-2 py-2 text-right">Available</th>
                        <th className="w-28 px-2 py-2 text-right">Quantity</th>
                        <th className="w-32 px-2 py-2 text-right">Unit Price</th>
                        <th className="w-32 px-2 py-2 text-right">Discount</th>
                        <th className="w-64 px-2 py-2">Tax</th>
                        <th className="w-32 px-2 py-2 text-right">Subtotal</th>
                        <th className="w-32 px-2 py-2 text-right">Total</th>
                        <th className="w-12 px-2 py-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={line.key} className="border-b border-border/70">
                          <td className="w-80 px-2 py-3">
                            <ProductSelect
                              value={line.productId}
                              options={productOptionsForLine(line)}
                              categories={productCategories}
                              brands={productBrands}
                              units={productUnits}
                              onValueChange={(productId) => updateLineProduct(line.key, productId)}
                              onOptionsChange={setProductOptions}
                              placeholder="Select product"
                              emptyLabel={(line.ownerId || headerOwnerId) && (line.sourceLocationId || effectiveSourceLocationId) ? "No products with available stock." : "Select owner and source location first."}
                              inputClassName={cn(tableInputClass, displayedLineErrors[line.key]?.productId ? "border-destructive focus-visible:border-destructive" : "")}
                            />
                            {displayedLineErrors[line.key]?.productId ? <p className="mt-1 text-xs text-destructive">{displayedLineErrors[line.key]?.productId}</p> : null}
                          </td>
                          <td className="w-64 px-2 py-3">
                            <RelatedModelSelect
                              value={line.sourceLocationId || effectiveSourceLocationId}
                              options={locations}
                              onValueChange={(locationId) => changeLineSourceLocation(line, locationId)}
                              placeholder="Select source"
                              emptyLabel="No locations found."
                              inputClassName={cn(tableInputClass, displayedLineErrors[line.key]?.sourceLocationId ? "border-destructive focus-visible:border-destructive" : "")}
                            />
                            {displayedLineErrors[line.key]?.sourceLocationId ? <p className="mt-1 text-xs text-destructive">{displayedLineErrors[line.key]?.sourceLocationId}</p> : null}
                          </td>
                          <td className="w-56 px-2 py-3">
                            <RelatedModelSelect
                              value={line.ownerId || headerOwnerId}
                              options={ownerOptionsForLine(line)}
                              onValueChange={(ownerId) => changeLineOwner(line, ownerId)}
                              placeholder="Select owner"
                              emptyLabel={(line.sourceLocationId || effectiveSourceLocationId) ? "No owners with stock in this location." : "Select source location first."}
                              inputClassName={cn(tableInputClass, displayedLineErrors[line.key]?.ownerId ? "border-destructive focus-visible:border-destructive" : "")}
                            />
                            {displayedLineErrors[line.key]?.ownerId ? <p className="mt-1 text-xs text-destructive">{displayedLineErrors[line.key]?.ownerId}</p> : null}
                          </td>
                          <td className="px-2 py-3 text-right font-medium">
                            {line.productId ? availableQuantityFor(line).toFixed(6) : "-"}
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={line.quantity}
                              className={cn(tableInputClass, "text-right", displayedLineErrors[line.key]?.quantity ? "border-destructive focus-visible:border-destructive" : "")}
                              onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            />
                            {displayedLineErrors[line.key]?.quantity ? <p className="mt-1 text-xs text-destructive">{displayedLineErrors[line.key]?.quantity}</p> : null}
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
                          <td className="w-64 px-2 py-3">
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
                    const owner = owners.find((item) => item.id === (line.ownerId || headerOwnerId));
                    const sourceLocation = locations.find((item) => item.id === (line.sourceLocationId || effectiveSourceLocationId));
                    const selectedTaxCount = line.taxIds.length;

                    return (
                      <div key={`${line.key}-card`} className="rounded-md border border-border bg-background p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{product ? `${product.code} / ${product.name}` : "No product selected"}</p>
                            <p className="text-xs text-muted-foreground">
                              {owner?.name ?? "No owner"} / {sourceLocation?.code ?? "No source"} / Available {line.productId ? availableQuantityFor(line).toFixed(6) : "-"} / Qty {line.quantity || "0"} / Unit price {line.unitPrice || "0"} / Taxes {selectedTaxCount}
                            </p>
                            {displayedLineErrors[line.key] ? (
                              <p className="mt-1 text-xs text-destructive">
                                {Object.values(displayedLineErrors[line.key]).filter(Boolean)[0]}
                              </p>
                            ) : null}
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
                  <Button type="button" variant="outline" onClick={addLine}>
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
                          <ProductSelect
                            value={editingLine.productId}
                            options={productOptionsForLine(editingLine)}
                            categories={productCategories}
                            brands={productBrands}
                            units={productUnits}
                            onValueChange={(productId) => updateLineProduct(editingLine.key, productId)}
                            onOptionsChange={setProductOptions}
                            placeholder="Select product"
                            emptyLabel={(editingLine.ownerId || headerOwnerId) && (editingLine.sourceLocationId || effectiveSourceLocationId) ? "No products with available stock." : "Select owner and source location first."}
                          />
                          {displayedLineErrors[editingLine.key]?.productId ? <p className="text-xs text-destructive">{displayedLineErrors[editingLine.key]?.productId}</p> : null}
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Source Location
                          <RelatedModelSelect
                            value={editingLine.sourceLocationId || effectiveSourceLocationId}
                            options={locations}
                            onValueChange={(locationId) => changeLineSourceLocation(editingLine, locationId)}
                            placeholder="Select source"
                            emptyLabel="No locations found."
                          />
                          {displayedLineErrors[editingLine.key]?.sourceLocationId ? <p className="text-xs text-destructive">{displayedLineErrors[editingLine.key]?.sourceLocationId}</p> : null}
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Owner
                          <RelatedModelSelect
                            value={editingLine.ownerId || headerOwnerId}
                            options={ownerOptionsForLine(editingLine)}
                            onValueChange={(ownerId) => changeLineOwner(editingLine, ownerId)}
                            placeholder="Select owner"
                            emptyLabel={(editingLine.sourceLocationId || effectiveSourceLocationId) ? "No owners with stock in this location." : "Select source location first."}
                          />
                          {displayedLineErrors[editingLine.key]?.ownerId ? <p className="text-xs text-destructive">{displayedLineErrors[editingLine.key]?.ownerId}</p> : null}
                        </label>
                        <p className="text-sm text-muted-foreground">
                          Available: <span className="font-medium text-foreground">{editingLine.productId ? availableQuantityFor(editingLine).toFixed(6) : "-"}</span>
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="flex flex-col gap-1 text-sm font-medium">
                            Quantity
                            <input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={editingLine.quantity}
                              className={cn(inputClass, "text-right", displayedLineErrors[editingLine.key]?.quantity ? "border-destructive focus-visible:border-destructive" : "")}
                              onChange={(event) => updateLine(editingLine.key, { quantity: event.target.value })}
                            />
                            {displayedLineErrors[editingLine.key]?.quantity ? <p className="text-xs text-destructive">{displayedLineErrors[editingLine.key]?.quantity}</p> : null}
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
