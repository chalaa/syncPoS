"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useMemo, useState, useTransition } from "react";

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
import { useFormValidation, type FormValidationResult } from "@/hooks/use-form-validation";
import { cn } from "@/lib/utils";
import { createSupplierFromPurchasing } from "@/app/admin/purchasing/actions";
import type { PurchaseFormOption, PurchaseOrderDetail, PurchaseTaxOption } from "@/server/purchasing/types";
import type { OwnerOption } from "@/server/owners/types";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const tableInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

type PurchaseLineDraft = {
  key: string;
  ownerId: string;
  productId: string;
  quantity: string;
  unitCost: string;
  taxIds: string[];
};

type PurchaseOrderActionResult = { error?: string } | void;

type PurchaseFormValues = {
  supplierId: string;
  ownerId: string;
  deliverToLocationId: string;
  paymentTerm: "cash" | "credit";
  orderDate: string;
  paymentDueDate: string;
  lines: PurchaseLineDraft[];
};

function newLine(ownerId = ""): PurchaseLineDraft {
  return {
    key: crypto.randomUUID(),
    ownerId,
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

function fieldKey(field: string, key: string) {
  return `${field}:${key}`;
}

function validatePurchaseOrderForm(values: PurchaseFormValues): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!values.supplierId) {
    fieldErrors.supplierId = "Select a supplier.";
  }

  if (!values.ownerId) {
    fieldErrors.ownerId = "Select an owner.";
  }

  if (!values.deliverToLocationId) {
    fieldErrors.deliverToLocationId = "Select the receiving warehouse.";
  }

  if (!values.orderDate) {
    fieldErrors.orderDate = "Select an order date.";
  }

  if (values.paymentTerm === "credit" && !values.paymentDueDate) {
    fieldErrors.paymentDueDate = "Select the payment date.";
  }

  const activeLines = values.lines.filter((line) => line.productId || line.quantity || line.unitCost || line.taxIds.length > 0);

  activeLines.forEach((line) => {
    if (!line.productId) {
      fieldErrors[fieldKey("productId", line.key)] = "Select a product.";
    }

    if (!line.ownerId && !values.ownerId) {
      fieldErrors[fieldKey("ownerId", line.key)] = "Select an owner.";
    }

    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fieldErrors[fieldKey("quantity", line.key)] = "Enter a quantity greater than zero.";
    }

    const unitCost = Number(line.unitCost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      fieldErrors[fieldKey("unitCost", line.key)] = "Enter a valid unit cost.";
    }
  });

  return {
    formErrors: activeLines.length === 0 ? ["Add at least one purchase order line."] : [],
    fieldErrors,
  };
}

export function PurchaseOrderForm({
  action,
  suppliers,
  owners,
  products,
  productCategories,
  productBrands,
  productUnits,
  locations,
  taxes,
  error,
  order,
  submitLabel = "Create RFQ",
  defaultDate = "",
}: {
  action: (formData: FormData) => PurchaseOrderActionResult | Promise<PurchaseOrderActionResult>;
  suppliers: PurchaseFormOption[];
  owners: OwnerOption[];
  products: PurchaseFormOption[];
  productCategories: Parameters<typeof ProductSelect>[0]["categories"];
  productBrands: Parameters<typeof ProductSelect>[0]["brands"];
  productUnits: Parameters<typeof ProductSelect>[0]["units"];
  locations: PurchaseFormOption[];
  taxes: PurchaseTaxOption[];
  error?: string;
  order?: PurchaseOrderDetail;
  submitLabel?: string;
  defaultDate?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? "");
  const [paymentTerm, setPaymentTerm] = useState<"cash" | "credit">(order?.paymentTerm ?? "credit");
  const defaultOwnerId = order?.ownerId ?? owners[0]?.id ?? "";
  const [headerOwnerId, setHeaderOwnerId] = useState(defaultOwnerId);
  const defaultDeliverToLocationId = order?.deliverToLocationId ?? locations.find((location) => location.code === "WH-001")?.id ?? locations[0]?.id ?? "";
  const [deliverToLocationId, setDeliverToLocationId] = useState(defaultDeliverToLocationId);
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? defaultDate);
  const [paymentDueDate, setPaymentDueDate] = useState(order?.paymentDueDate ?? defaultDate);
  const [productOptions, setProductOptions] = useState<ProductSelectOption[]>(products);
  const [lines, setLines] = useState<PurchaseLineDraft[]>(() =>
    order?.lines.length
      ? order.lines.map((line) => ({
          key: line.id,
          ownerId: line.ownerId ?? defaultOwnerId,
          productId: line.productId,
          quantity: line.quantityOrdered,
          unitCost: String(line.unitCostMinor / 100),
          taxIds: line.taxIds,
        }))
      : [newLine(defaultOwnerId)],
  );
  const validationValues = useMemo<PurchaseFormValues>(
    () => ({
      supplierId,
      ownerId: headerOwnerId,
      deliverToLocationId,
      paymentTerm,
      orderDate,
      paymentDueDate,
      lines,
    }),
    [supplierId, headerOwnerId, deliverToLocationId, paymentTerm, orderDate, paymentDueDate, lines],
  );
  const { formErrors, fieldErrors, isValid } = useFormValidation(validationValues, validatePurchaseOrderForm);
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

  function updateLineProduct(key: string, productId: string) {
    const product = productById.get(productId);

    updateLine(key, {
      productId,
      unitCost: product?.standardCostMinor !== undefined ? String(product.standardCostMinor / 100) : "0",
      taxIds: product?.purchaseTaxIds ?? [],
    });
  }

  function addLine() {
    const line = newLine(headerOwnerId);

    setLines((current) => [...current, line]);
  }

  const editingLine = lines.find((line) => line.key === editingLineKey);

  function changeHeaderOwner(ownerId: string) {
    setLines((current) =>
      current.map((line) =>
        !line.ownerId || line.ownerId === headerOwnerId ? { ...line, ownerId } : line,
      ),
    );
    setHeaderOwnerId(ownerId);
  }

  function showFieldError(key: string) {
    return hasSubmitted ? fieldErrors[key] : undefined;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setServerError(null);

    if (!isValid) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(formData);

      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-lg border border-border bg-card p-5">
      {order ? <input type="hidden" name="purchaseOrderId" value={order.id} /> : null}
      {error || serverError ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{serverError ?? error}</p> : null}
      {hasSubmitted && formErrors.length > 0 ? (
        <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          {formErrors.map((formError) => (
            <p key={formError}>{formError}</p>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ManyToOneCreateSelect
          name="supplierId"
          label="Supplier"
          options={suppliers}
          defaultValue={supplierId}
          placeholder="Search supplier"
          entityLabel="Supplier"
          onCreate={createSupplierFromPurchasing}
          onValueChange={setSupplierId}
          error={showFieldError("supplierId")}
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Reference
          <input
            name="vendorReference"
            defaultValue={order?.vendorReference ?? ""}
            placeholder="Auto"
            readOnly
            className={cn(inputClass, "bg-muted text-muted-foreground")}
          />
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
          error={showFieldError("ownerId")}
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
          <input
            name="orderDate"
            type="date"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
            className={cn(inputClass, showFieldError("orderDate") ? "border-destructive focus-visible:border-destructive" : "")}
          />
          {showFieldError("orderDate") ? <span className="text-sm font-normal text-destructive">{showFieldError("orderDate")}</span> : null}
        </label>
        {paymentTerm === "credit" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Payment Date
            <input
              name="paymentDueDate"
              type="date"
              value={paymentDueDate}
              onChange={(event) => setPaymentDueDate(event.target.value)}
              className={cn(inputClass, showFieldError("paymentDueDate") ? "border-destructive focus-visible:border-destructive" : "")}
            />
            {showFieldError("paymentDueDate") ? <span className="text-sm font-normal text-destructive">{showFieldError("paymentDueDate")}</span> : null}
          </label>
        ) : null}
        <RelatedModelSelect
          name="deliverToLocationId"
          label="Deliver to"
          options={locations}
          value={deliverToLocationId}
          onValueChange={setDeliverToLocationId}
          placeholder="Select on receipt"
          emptyLabel="No locations found."
          error={showFieldError("deliverToLocationId")}
        />
      </div>

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
                    <input type="hidden" name="quantity" value={line.quantity} />
                    <input type="hidden" name="unitCost" value={line.unitCost} />
                    <input type="hidden" name="taxIds" value={line.taxIds.join(",")} />
                  </div>
                ))}

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1140px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase text-muted-foreground">
                        <th className="px-2 py-2">Product</th>
                        <th className="w-44 px-2 py-2">Owner</th>
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
                            <ProductSelect
                              value={line.productId}
                              options={productOptions}
                              categories={productCategories}
                              brands={productBrands}
                              units={productUnits}
                              onValueChange={(productId) => updateLineProduct(line.key, productId)}
                              onOptionsChange={setProductOptions}
                              placeholder="Select product"
                              emptyLabel="No products found."
                              inputClassName={tableInputClass}
                              error={showFieldError(fieldKey("productId", line.key))}
                            />
                            {showFieldError(fieldKey("productId", line.key)) ? (
                              <p className="mt-1 text-xs text-destructive">{showFieldError(fieldKey("productId", line.key))}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3">
                            <RelatedModelSelect
                              value={line.ownerId || headerOwnerId}
                              options={owners}
                              onValueChange={(ownerId) => updateLine(line.key, { ownerId })}
                              placeholder="Select owner"
                              emptyLabel="No owners found."
                              inputClassName={tableInputClass}
                              error={showFieldError(fieldKey("ownerId", line.key))}
                            />
                            {showFieldError(fieldKey("ownerId", line.key)) ? (
                              <p className="mt-1 text-xs text-destructive">{showFieldError(fieldKey("ownerId", line.key))}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={line.quantity}
                              className={cn(tableInputClass, "text-right", showFieldError(fieldKey("quantity", line.key)) ? "border-destructive focus-visible:border-destructive" : "")}
                              onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            />
                            {showFieldError(fieldKey("quantity", line.key)) ? (
                              <p className="mt-1 text-xs text-destructive">{showFieldError(fieldKey("quantity", line.key))}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitCost}
                              className={cn(tableInputClass, "text-right", showFieldError(fieldKey("unitCost", line.key)) ? "border-destructive focus-visible:border-destructive" : "")}
                              onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                            />
                            {showFieldError(fieldKey("unitCost", line.key)) ? (
                              <p className="mt-1 text-xs text-destructive">{showFieldError(fieldKey("unitCost", line.key))}</p>
                            ) : null}
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

                <div className="grid gap-3 lg:hidden">
                  {lines.map((line, index) => {
                    const product = productById.get(line.productId);
                    const owner = owners.find((item) => item.id === (line.ownerId || headerOwnerId));
                    const selectedTaxCount = line.taxIds.length;

                    return (
                      <div
                        key={`${line.key}-card`}
                        className={cn(
                          "rounded-md border border-border bg-background p-3 text-sm",
                          hasSubmitted &&
                            ["productId", "ownerId", "quantity", "unitCost"].some((field) => fieldErrors[fieldKey(field, line.key)])
                            ? "border-destructive"
                            : "",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{product ? `${product.code} / ${product.name}` : "No product selected"}</p>
                            <p className="text-xs text-muted-foreground">
                              {owner?.name ?? "No owner"} / Qty {line.quantity || "0"} / Unit cost {line.unitCost || "0"} / Taxes {selectedTaxCount}
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

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <Button type="button" variant="outline" onClick={addLine}>
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

                <Dialog open={Boolean(editingLine)} onOpenChange={(open) => !open && setEditingLineKey(null)}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Order Line</DialogTitle>
                      <DialogDescription>Add or edit one purchase order line.</DialogDescription>
                    </DialogHeader>
                    {editingLine ? (
                      <div className="grid gap-4">
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Product
                          <ProductSelect
                            value={editingLine.productId}
                            options={productOptions}
                            categories={productCategories}
                            brands={productBrands}
                            units={productUnits}
                            onValueChange={(productId) => updateLineProduct(editingLine.key, productId)}
                            onOptionsChange={setProductOptions}
                            placeholder="Select product"
                            emptyLabel="No products found."
                            error={showFieldError(fieldKey("productId", editingLine.key))}
                          />
                          {showFieldError(fieldKey("productId", editingLine.key)) ? (
                            <span className="text-sm font-normal text-destructive">{showFieldError(fieldKey("productId", editingLine.key))}</span>
                          ) : null}
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Owner
                          <RelatedModelSelect
                            value={editingLine.ownerId || headerOwnerId}
                            options={owners}
                            onValueChange={(ownerId) => updateLine(editingLine.key, { ownerId })}
                            placeholder="Select owner"
                            emptyLabel="No owners found."
                            error={showFieldError(fieldKey("ownerId", editingLine.key))}
                          />
                          {showFieldError(fieldKey("ownerId", editingLine.key)) ? (
                            <span className="text-sm font-normal text-destructive">{showFieldError(fieldKey("ownerId", editingLine.key))}</span>
                          ) : null}
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm font-medium">
                            Quantity
                            <input
                              type="number"
                              min="0.000001"
                              step="0.000001"
                              value={editingLine.quantity}
                              className={cn(inputClass, "text-right", showFieldError(fieldKey("quantity", editingLine.key)) ? "border-destructive focus-visible:border-destructive" : "")}
                              onChange={(event) => updateLine(editingLine.key, { quantity: event.target.value })}
                            />
                            {showFieldError(fieldKey("quantity", editingLine.key)) ? (
                              <span className="text-sm font-normal text-destructive">{showFieldError(fieldKey("quantity", editingLine.key))}</span>
                            ) : null}
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium">
                            Unit cost
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingLine.unitCost}
                              className={cn(inputClass, "text-right", showFieldError(fieldKey("unitCost", editingLine.key)) ? "border-destructive focus-visible:border-destructive" : "")}
                              onChange={(event) => updateLine(editingLine.key, { unitCost: event.target.value })}
                            />
                            {showFieldError(fieldKey("unitCost", editingLine.key)) ? (
                              <span className="text-sm font-normal text-destructive">{showFieldError(fieldKey("unitCost", editingLine.key))}</span>
                            ) : null}
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
        <Button disabled={isPending}>{isPending ? (submitLabel.startsWith("Save") ? "Saving..." : "Creating...") : submitLabel}</Button>
      </div>
    </form>
  );
}
