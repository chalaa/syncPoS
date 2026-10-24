"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  Package,
  PlusIcon,
  ShoppingBag,
  Tag,
  Trash2Icon,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProductSelect } from "@/app/admin/products/product-select";
import { Button } from "@/components/ui/button";
import { ManyToOneCreateSelect } from "@/components/ui/many-to-one-create-select";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import type { SalesTaxOption } from "@/server/sales/types";
import { useAppStore } from "@/stores/app-store";
import {
  createCustomerFromDirectVendor,
  createVendorFromDirectVendor,
} from "./actions";
import type { DirectVendorSaleFormOptions } from "@/server/direct-vendor-sales/types";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]";

type PaymentTerm = "cash" | "credit";

type DirectVendorLineDraft = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  vendorUnitCost: string;
  customerUnitPrice: string;
  taxIds: string[];
  lineNotes: string;
};

type DirectVendorSaleFormProps = DirectVendorSaleFormOptions & {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  defaultDate: string;
  isModal?: boolean;
  onCancel?: () => void;
};

type LineAmounts = {
  vendorTotalMinor: number;
  subtotalMinor: number;
  taxAmountMinor: number;
  customerTotalMinor: number;
  marginMinor: number;
};

function newLine(): DirectVendorLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    description: "",
    quantity: "1",
    vendorUnitCost: "",
    customerUnitPrice: "",
    taxIds: [],
    lineNotes: "",
  };
}

function minorToMajor(value: number) {
  return (value / 100).toFixed(2);
}

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function displayMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${money(value / 100)}`;
}

function majorToMinor(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function calculateLineTax(lineAmountMinor: number, quantity: number, tax: {
  id: string;
  computation: "percent" | "fixed";
  rate: string;
  amountMinor: number;
  priceIncluded: boolean;
}) {
  if (tax.computation === "fixed") {
    const amount = Math.round(tax.amountMinor * quantity);
    return tax.priceIncluded ? Math.min(amount, lineAmountMinor) : amount;
  }

  const rate = Number(tax.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  if (tax.priceIncluded) {
    return Math.round(lineAmountMinor - lineAmountMinor / (1 + rate / 100));
  }

  return Math.round(lineAmountMinor * (rate / 100));
}

function calculateLineTaxes(lineAmountMinor: number, quantity: number, selectedTaxes: SalesTaxOption[]) {
  const lineTaxes = selectedTaxes.map((tax) => ({
    taxId: tax.id,
    taxAmountMinor: calculateLineTax(lineAmountMinor, quantity, tax),
    priceIncluded: tax.priceIncluded,
  }));
  const includedTaxAmount = lineTaxes
    .filter((tax) => tax.priceIncluded)
    .reduce((sum, tax) => sum + tax.taxAmountMinor, 0);
  const excludedTaxAmount = lineTaxes
    .filter((tax) => !tax.priceIncluded)
    .reduce((sum, tax) => sum + tax.taxAmountMinor, 0);
  const taxAmountMinor = includedTaxAmount + excludedTaxAmount;
  const subtotalMinor = Math.max(lineAmountMinor - includedTaxAmount, 0);
  const customerTotalMinor = lineAmountMinor + excludedTaxAmount;

  return { lineTaxes, taxAmountMinor, subtotalMinor, customerTotalMinor };
}

function calculateLine(line: DirectVendorLineDraft, taxById: Map<string, SalesTaxOption>): LineAmounts {
  const quantity = Number(line.quantity);
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const vendorTotalMinor = Math.round(majorToMinor(line.vendorUnitCost) * safeQuantity);
  const grossCustomerMinor = Math.round(majorToMinor(line.customerUnitPrice) * safeQuantity);

  const selectedTaxes = line.taxIds.map((id) => taxById.get(id)).filter((t): t is SalesTaxOption => Boolean(t));
  const { subtotalMinor, taxAmountMinor, customerTotalMinor } = calculateLineTaxes(
    grossCustomerMinor,
    safeQuantity,
    selectedTaxes,
  );

  return {
    vendorTotalMinor,
    subtotalMinor,
    taxAmountMinor,
    customerTotalMinor,
    marginMinor: customerTotalMinor - vendorTotalMinor,
  };
}

export function DirectVendorSaleForm({
  action,
  company,
  customers,
  vendors,
  owners,
  products,
  productCategories,
  productBrands,
  productUnits,
  taxes = [],
  error,
  defaultDate,
  onCancel,
}: DirectVendorSaleFormProps) {
  const { t } = useTranslation();
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const [step, setStep] = useState<1 | 2>(1);
  const [clientError, setClientError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [userSelectedOwner, setUserSelectedOwner] = useState(false);

  const findLinkedOwner = useCallback(
    (locId: string | null) => {
      if (!locId) return undefined;
      return owners.find((owner) => (owner.locationIds ?? []).includes(locId));
    },
    [owners],
  );

  const [ownerId, setOwnerId] = useState(() => {
    const currentLocId =
      useAppStore.getState().selectedLocationId ||
      (typeof window !== "undefined" ? localStorage.getItem("syncpos-selected-location") : null);
    if (currentLocId) {
      const linked = owners.find((owner) => (owner.locationIds ?? []).includes(currentLocId));
      if (linked) return linked.id;
    }
    return "";
  });

  useEffect(() => {
    if (userSelectedOwner) return;

    const activeLocId =
      selectedLocationId ||
      (typeof window !== "undefined" ? localStorage.getItem("syncpos-selected-location") : null);

    if (activeLocId) {
      const linked = findLinkedOwner(activeLocId);
      if (linked) {
        setOwnerId(linked.id);
      }
    }
  }, [selectedLocationId, findLinkedOwner, userSelectedOwner]);

  const [saleDate, setSaleDate] = useState(defaultDate);
  const [deliverProduct, setDeliverProduct] = useState(true);
  const [customerPaymentTerm, setCustomerPaymentTerm] = useState<PaymentTerm>("cash");
  const [vendorPaymentTerm, setVendorPaymentTerm] = useState<PaymentTerm>("cash");
  const [lines, setLines] = useState<DirectVendorLineDraft[]>(() => [newLine()]);

  const taxById = useMemo(() => new Map(taxes.map((t) => [t.id, t])), [taxes]);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const amounts = calculateLine(line, taxById);
        return {
          subtotalMinor: sum.subtotalMinor + amounts.subtotalMinor,
          taxAmountMinor: sum.taxAmountMinor + amounts.taxAmountMinor,
          customerTotalMinor: sum.customerTotalMinor + amounts.customerTotalMinor,
          vendorCostTotalMinor: sum.vendorCostTotalMinor + amounts.vendorTotalMinor,
          marginMinor: sum.marginMinor + amounts.marginMinor,
        };
      },
      { subtotalMinor: 0, taxAmountMinor: 0, customerTotalMinor: 0, vendorCostTotalMinor: 0, marginMinor: 0 },
    );
  }, [lines, taxById]);

  const specifiedLineCount = lines.filter((line) => line.productId).length;

  function updateLine(key: string, patch: Partial<DirectVendorLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleProductChange(line: DirectVendorLineDraft, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(line.key, {
      productId,
      customerUnitPrice: product?.listPriceMinor ? minorToMajor(product.listPriceMinor) : "",
      vendorUnitCost: product?.standardCostMinor ? minorToMajor(product.standardCostMinor) : "",
      taxIds: product?.saleTaxIds ?? [],
    });
  }

  function goToStep(targetStep: 1 | 2) {
    if (targetStep === 2) {
      if (!customerId) {
        setClientError("Please select or create a customer.");
        return;
      }
      if (!vendorId) {
        setClientError("Please select or create a vendor.");
        return;
      }
      const activeProducts = lines.filter((l) => l.productId);
      if (activeProducts.length === 0) {
        setClientError("Please select at least one product.");
        return;
      }
      for (const [idx, line] of activeProducts.entries()) {
        const sellPrice = Number(line.customerUnitPrice);
        if (!line.customerUnitPrice || Number.isNaN(sellPrice) || sellPrice <= 0) {
          setClientError(`Sale price is mandatory and must be greater than 0 (Line ${idx + 1}).`);
          return;
        }
        const vendorCost = Number(line.vendorUnitCost);
        if (!line.vendorUnitCost || Number.isNaN(vendorCost) || vendorCost <= 0) {
          setClientError(`Vendor cost/purchase price is mandatory and must be greater than 0 (Line ${idx + 1}).`);
          return;
        }
      }
    }
    setClientError(null);
    setStep(targetStep);
  }

  return (
    <form action={action} className="flex flex-col">
      <input type="hidden" name="deliverProduct" value={deliverProduct ? "true" : "false"} />
      {/* Hidden inputs preserved when on Step 2 */}
      {step === 2 ? (
        <div hidden>
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="vendorId" value={vendorId} />
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="saleDate" value={saleDate} />
          {lines.map((line) => (
            <div key={line.key}>
              <input type="hidden" name="productId" value={line.productId} />
              <input type="hidden" name="description" value={line.description} />
              <input type="hidden" name="quantity" value={line.quantity} />
              <input type="hidden" name="vendorUnitCost" value={line.vendorUnitCost} />
              <input type="hidden" name="customerUnitPrice" value={line.customerUnitPrice} />
              <input type="hidden" name="taxIds" value={line.taxIds.join(",")} />
              <input type="hidden" name="lineNotes" value={line.lineNotes} />
            </div>
          ))}
        </div>
      ) : null}

      {clientError || error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {clientError || error}
        </div>
      ) : null}

      {/* Responsive Step Progress Tabs */}
      <div className="border-b border-border/70 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs sm:text-sm font-semibold transition-all",
                step === 1
                  ? "bg-gradient-to-r from-[#0B5D4B] to-[#073B35] text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                1
              </span>
              <span className="truncate">{t("directVendor.step1", "Details & Products")}</span>
            </button>
            <button
              type="button"
              onClick={() => goToStep(2)}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs sm:text-sm font-semibold transition-all",
                step === 2
                  ? "bg-gradient-to-r from-[#0B5D4B] to-[#073B35] text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                2
              </span>
              <span className="truncate">{t("directVendor.step2", "Review & Payment")}</span>
            </button>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-muted-foreground">
            <span>{t("sales.form.stepOf", "Step")} {step} {t("sales.form.of2", "of 2")}</span>
            <span className="font-semibold text-primary">
              {step === 1 ? t("directVendor.stepProductsPricing", "1. Products & Pricing") : t("directVendor.stepReadyToPost", "2. Ready to Post")}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-4 sm:py-5 space-y-5">
        {step === 1 ? (
          <div className="flex flex-col gap-5">
            {/* Parties & Terms Card Grid */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Customer & Vendor */}
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="size-4" />
                    </span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {t("directVendor.customerVendor", "Customer & Vendor")}
                    </h2>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t("directVendor.requiredParties", "Required Parties")}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <ManyToOneCreateSelect
                      name="customerId"
                      label={t("sales.col.customer", "Customer")}
                      options={customers}
                      value={customerId}
                      defaultValue={customerId}
                      placeholder={t("sales.form.searchCustomer", "Search or add customer...")}
                      entityLabel={t("sales.col.customer", "Customer")}
                      onCreate={createCustomerFromDirectVendor}
                      onValueChange={(val) => {
                        setCustomerId(val);
                        setClientError(null);
                      }}
                    />
                  </div>
                  <div className="relative">
                    <ManyToOneCreateSelect
                      name="vendorId"
                      label={t("directVendor.vendor", "Vendor")}
                      options={vendors}
                      value={vendorId}
                      defaultValue={vendorId}
                      placeholder={t("directVendor.searchVendor", "Search or add vendor...")}
                      entityLabel={t("directVendor.vendor", "Vendor")}
                      onCreate={createVendorFromDirectVendor}
                      onValueChange={(val) => {
                        setVendorId(val);
                        setClientError(null);
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Commercial Terms & Date */}
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Coins className="size-4" />
                    </span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {t("directVendor.orderSettings", "Order Settings")}
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("directVendor.badge.noInventory", "No Inventory")}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("sales.form.selectOwner", "Sales Owner")}
                    <select
                      name="ownerId"
                      value={ownerId}
                      onChange={(event) => {
                        setOwnerId(event.target.value);
                        setUserSelectedOwner(true);
                      }}
                      className={inputClass}
                    >
                      <option value="">{t("sales.form.none", "No owner")}</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("directVendor.saleDate", "Sale Date")}
                    <input
                      name="saleDate"
                      type="date"
                      value={saleDate}
                      onChange={(event) => setSaleDate(event.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground sm:col-span-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-primary shrink-0" />
                      <div>
                        <span className="font-semibold text-foreground">
                          {t("directVendor.fulfillmentNoticeTitle", "Direct vendor fulfillment:")}
                        </span>{" "}
                        {t("directVendor.fulfillmentNoticeDesc", "Product is shipped directly from vendor to customer.")}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Line Items Section */}
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Package className="size-4" />
                  </span>
                  <h2 className="text-sm font-bold tracking-tight text-foreground">
                    {t("directVendor.productLines", "Product Lines")}
                  </h2>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-primary">
                    {lines.length}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-dashed text-xs font-semibold"
                  onClick={() => setLines((current) => [...current, newLine()])}
                >
                  <PlusIcon className="size-3.5 text-primary" />
                  <span>{t("directVendor.addLine", "Add Line")}</span>
                </Button>
              </div>

              {/* Lines List */}
              <div className="space-y-3.5">
                {lines.map((line, index) => {
                  const amounts = calculateLine(line, taxById);

                  return (
                    <div
                      key={line.key}
                      className="rounded-xl border border-border/80 bg-background/50 p-3.5 sm:p-4 shadow-2xs transition-all hover:border-primary/30"
                    >
                      {/* Product Header Row */}
                      <div className="mb-3 flex items-start gap-2.5 sm:gap-3">
                        <span className="mt-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <ProductSelect
                            name="productId"
                            value={line.productId}
                            options={products}
                            categories={productCategories}
                            brands={productBrands}
                            units={productUnits}
                            taxes={taxes}
                            placeholder={t("sales.form.selectProduct", "Select product...")}
                            inputClassName={inputClass}
                            onValueChange={(productId) => handleProductChange(line, productId)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={lines.length === 1}
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 mt-0.5"
                          aria-label={t("sales.form.removeLine", "Remove line")}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>

                      {/* Numeric Inputs Responsive Grid */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3 items-start">
                        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                          {t("sales.form.quantity", "Quantity")}
                          <input
                            name="quantity"
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                          <span>{t("directVendor.salePriceUnit", "Sale Price")} <span className="text-destructive">*</span></span>
                          <input
                            name="customerUnitPrice"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.customerUnitPrice}
                            placeholder="0.00"
                            onChange={(event) => updateLine(line.key, { customerUnitPrice: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
                          <span>{t("directVendor.vendorCostUnit", "Vendor Cost")} <span className="text-destructive">*</span></span>
                          <input
                            name="vendorUnitCost"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={line.vendorUnitCost}
                            placeholder="0.00"
                            onChange={(event) => updateLine(line.key, { vendorUnitCost: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                            required
                          />
                        </label>

                        {/* Taxes Pill Selector */}
                        {taxes.length > 0 ? (
                          <div className="flex flex-col gap-1 col-span-2 sm:col-span-2">
                            <label className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <Tag className="size-3 text-[#0B5D4B]" />
                                <span>{t("sales.form.taxes", "Taxes")}</span>
                              </span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                {t("directVendor.clickToToggle", "Click to toggle")}
                              </span>
                            </label>
                            <div className="flex flex-wrap gap-1.5 min-h-[40px] items-center p-1 rounded-lg border border-input bg-background">
                              {taxes.map((tax) => {
                                const isSelected = line.taxIds.includes(tax.id);
                                return (
                                  <button
                                    key={tax.id}
                                    type="button"
                                    onClick={() => {
                                      const nextTaxes = isSelected
                                        ? line.taxIds.filter((id) => id !== tax.id)
                                        : [...line.taxIds, tax.id];
                                      updateLine(line.key, { taxIds: nextTaxes });
                                    }}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                                      isSelected
                                        ? "bg-[#0B5D4B] text-white shadow-xs font-semibold"
                                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                  >
                                    <span className="font-bold">{isSelected ? "✓" : "+"}</span>
                                    <span>
                                      {tax.code} ({tax.computation === "fixed" ? (tax.amountMinor / 100).toFixed(2) : `${Number(tax.rate)}%`})
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Hidden description, taxIds, and notes */}
                      <input type="hidden" name="taxIds" value={line.taxIds.join(",")} />
                      <input type="hidden" name="description" value={line.description} />
                      <input type="hidden" name="lineNotes" value={line.lineNotes} />

                      {/* Line Summary Footer */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>
                            {t("directVendor.customerTotal", "Customer Total")}:{" "}
                            <strong className="font-mono text-foreground">
                              {displayMoney(amounts.customerTotalMinor, company.baseCurrencyCode)}
                            </strong>
                          </span>
                          <span>
                            {t("directVendor.vendorTotal", "Vendor Total")}:{" "}
                            <strong className="font-mono text-foreground">
                              {displayMoney(amounts.vendorTotalMinor, company.baseCurrencyCode)}
                            </strong>
                          </span>
                          {amounts.taxAmountMinor > 0 ? (
                            <span>
                              {t("common.tax", "Tax")}:{" "}
                              <strong className="font-mono text-foreground">
                                {displayMoney(amounts.taxAmountMinor, company.baseCurrencyCode)}
                              </strong>
                            </span>
                          ) : null}
                        </div>
                        <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {t("directVendor.lineMargin", "Margin")}: {displayMoney(amounts.marginMinor, company.baseCurrencyCode)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Product & Summary Box layout */}
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto border-dashed gap-2 font-semibold"
                    onClick={() => setLines((current) => [...current, newLine()])}
                  >
                    <PlusIcon className="size-4 text-primary" />
                    <span>{t("directVendor.addAnotherLine", "Add Another Line")}</span>
                  </Button>
                </div>
                <SummaryBox totals={totals} currencyCode={company.baseCurrencyCode} />
              </div>
            </section>
          </div>
        ) : (
          /* Step 2: Review & Both-Way Payment Terms */
          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-5">
              <div className="flex items-center gap-2 border-b border-border/70 pb-3">
                <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wallet className="size-4" />
                </span>
                <h2 className="text-sm font-bold tracking-tight text-foreground">
                  {t("directVendor.bothWaySettlement", "Both-Way Settlement Terms")}
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <PaymentTermPanel
                  title={t("directVendor.customerPayment", "Customer Payment")}
                  caption={t("directVendor.accountsReceivable", "Accounts Receivable (Sales)")}
                  term={customerPaymentTerm}
                  onTermChange={setCustomerPaymentTerm}
                  inputName="customerPaymentTerm"
                  totalLabel={t("directVendor.customerOwes", "Customer Owes")}
                  totalValue={displayMoney(totals.customerTotalMinor, company.baseCurrencyCode)}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("directVendor.customerPaymentHint", "Set whether customer pays immediately (Cash) or on account (Credit). Payments can be recorded once the order is posted.")}
                  </p>
                </PaymentTermPanel>

                <PaymentTermPanel
                  title={t("directVendor.vendorPayment", "Vendor Payment")}
                  caption={t("directVendor.accountsPayable", "Accounts Payable (Procurement)")}
                  term={vendorPaymentTerm}
                  onTermChange={setVendorPaymentTerm}
                  inputName="vendorPaymentTerm"
                  totalLabel={t("directVendor.vendorSourcingCost", "Vendor Sourcing Cost")}
                  totalValue={displayMoney(totals.vendorCostTotalMinor, company.baseCurrencyCode)}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("directVendor.vendorPaymentHint", "Set whether vendor requires upfront payment (Cash) or supplier credit (Credit). Disbursal is tracked per document.")}
                  </p>
                </PaymentTermPanel>

                <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-2">
                  {t("directVendor.orderNotes", "Order Notes & Instructions")}
                  <textarea
                    name="notes"
                    placeholder={t("directVendor.orderNotesPlaceholder", "Add any delivery notes, vendor reference, or special terms...")}
                    className="min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]"
                  />
                </label>

                {/* Deliver Product Toggle Card */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all sm:col-span-2 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-[#0B5D4B]/10 text-[#0B5D4B] dark:bg-emerald-950 dark:text-emerald-300">
                      <Truck className="size-4" />
                    </div>
                    <div>
                      <label htmlFor="dvs-deliver-product-checkbox" className="text-sm font-semibold text-foreground cursor-pointer flex items-center gap-2">
                        <span>{t("directVendor.deliverProduct", "Deliver product")}</span>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {t("directVendor.deliverProductHint", "Automatically post delivery and confirm sale upon completion.")}
                      </p>
                    </div>
                  </div>
                  <input
                    id="dvs-deliver-product-checkbox"
                    type="checkbox"
                    checked={deliverProduct}
                    onChange={(e) => setDeliverProduct(e.target.checked)}
                    className="size-5 rounded border-border text-[#0B5D4B] focus:ring-[#0B5D4B] cursor-pointer"
                  />
                </div>
              </div>
            </section>

            <SummaryBox totals={totals} currencyCode={company.baseCurrencyCode} />
          </div>
        )}
      </div>

      {/* Responsive Action Bottom Bar */}
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border/80 pt-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1">
            <Package className="size-3.5 text-primary" />
            <span>
              {specifiedLineCount} / {lines.length} Line{lines.length === 1 ? "" : "s"}
            </span>
          </span>
          <span>
            {t("common.total", "Total")}:{" "}
            <strong className="font-mono text-sm font-bold text-foreground">
              {displayMoney(totals.customerTotalMinor, company.baseCurrencyCode)}
            </strong>
          </span>
          <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400 font-semibold">
            ({t("directVendor.lineMargin", "Margin")}: {displayMoney(totals.marginMinor, company.baseCurrencyCode)})
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {step === 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => goToStep(1)}
              className="gap-1.5 font-semibold flex-1 sm:flex-initial"
            >
              <ArrowLeft className="size-4" />
              <span>{t("action.back", "Back")}</span>
            </Button>
          ) : null}

          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="font-semibold flex-1 sm:flex-initial"
            >
              {t("action.cancel", "Cancel")}
            </Button>
          ) : null}

          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            className="font-semibold hidden sm:inline-flex"
          >
            {t("directVendor.saveDraft", "Save Draft")}
          </Button>

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => goToStep(2)}
              className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 flex-1 sm:flex-initial"
            >
              <span>{t("action.continue", "Continue")}</span>
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              name="intent"
              value={deliverProduct ? "post" : "draft"}
              className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 flex-1 sm:flex-initial"
            >
              <span>{deliverProduct ? t("directVendor.postSale", "Post Direct Sale") : t("directVendor.saveDraftSale", "Save Direct Sale (Draft)")}</span>
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function PaymentTermPanel({
  title,
  caption,
  term,
  onTermChange,
  inputName,
  totalLabel,
  totalValue,
  children,
}: {
  title: string;
  caption: string;
  term: PaymentTerm;
  onTermChange: (term: PaymentTerm) => void;
  inputName: string;
  totalLabel: string;
  totalValue: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{caption}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">{totalLabel}</div>
          <div className="font-mono text-xs font-bold text-primary">{totalValue}</div>
        </div>
      </div>

      <input type="hidden" name={inputName} value={term} />
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => onTermChange("cash")}
          className={cn(
            "h-8 rounded-lg text-xs font-semibold transition-all",
            term === "cash"
              ? "bg-background text-primary shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("common.cash", "Cash")}
        </button>
        <button
          type="button"
          onClick={() => onTermChange("credit")}
          className={cn(
            "h-8 rounded-lg text-xs font-semibold transition-all",
            term === "credit"
              ? "bg-background text-primary shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("common.credit", "Credit")}
        </button>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function SummaryBox({
  totals,
  currencyCode,
}: {
  totals: {
    subtotalMinor: number;
    taxAmountMinor: number;
    customerTotalMinor: number;
    vendorCostTotalMinor: number;
    marginMinor: number;
  };
  currencyCode: string;
}) {
  const { t } = useTranslation();

  return (
    <aside className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5 shadow-xs">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {t("directVendor.summary.title", "Commercial Summary")}
      </h3>
      <dl className="flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t("directVendor.summary.subtotal", "Untaxed Subtotal")}</dt>
          <dd className="font-mono font-semibold">{displayMoney(totals.subtotalMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t("directVendor.summary.taxes", "Applicable Taxes")}</dt>
          <dd className="font-mono font-semibold">{displayMoney(totals.taxAmountMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{t("directVendor.summary.vendorCost", "Vendor Procurement Cost")}</dt>
          <dd className="font-mono font-semibold">{displayMoney(totals.vendorCostTotalMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="font-bold text-foreground">{t("directVendor.summary.customerTotal", "Customer Total")}</dt>
          <dd className="font-mono text-base font-extrabold text-primary">
            {displayMoney(totals.customerTotalMinor, currencyCode)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-2">
          <dt className="font-bold text-emerald-600 dark:text-emerald-400">{t("directVendor.summary.netMargin", "Net Profit Margin")}</dt>
          <dd className="font-mono text-base font-extrabold text-emerald-600 dark:text-emerald-400">
            {displayMoney(totals.marginMinor, currencyCode)}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
