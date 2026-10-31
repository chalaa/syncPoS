"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Coins,
  FileText,
  Loader2,
  Package,
  PlusIcon,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2Icon,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ProductSelect } from "@/app/admin/products/product-select";
import { Button } from "@/components/ui/button";
import { ManyToOneCreateSelect } from "@/components/ui/many-to-one-create-select";
import { Notebook } from "@/components/ui/notebook";
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
  const grossVendorMinor = Math.round(majorToMinor(line.vendorUnitCost) * safeQuantity);
  const grossCustomerMinor = Math.round(majorToMinor(line.customerUnitPrice) * safeQuantity);

  const selectedTaxes = line.taxIds.map((id) => taxById.get(id)).filter((t): t is SalesTaxOption => Boolean(t));
  const saleTaxes = selectedTaxes.filter((t) => t.scope !== "purchase");
  const purchaseTaxes = selectedTaxes.filter((t) => t.scope === "purchase");

  const custCalc = calculateLineTaxes(grossCustomerMinor, safeQuantity, saleTaxes);
  const vendCalc = calculateLineTaxes(grossVendorMinor, safeQuantity, purchaseTaxes);

  const subtotalMinor = custCalc.subtotalMinor;
  const customerTotalMinor = custCalc.customerTotalMinor;
  const vendorTotalMinor = vendCalc.customerTotalMinor;
  const taxAmountMinor = custCalc.taxAmountMinor + vendCalc.taxAmountMinor;
  const marginMinor = customerTotalMinor - vendorTotalMinor;

  return {
    vendorTotalMinor,
    subtotalMinor,
    taxAmountMinor,
    customerTotalMinor,
    marginMinor,
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
  const [isPending, startTransition] = useTransition();
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const stepEnteredAt = useRef<number>(0);
  const formRef = useRef<HTMLFormElement>(null);
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
  const [notes, setNotes] = useState("");
  const [deliverProduct, setDeliverProduct] = useState(true);
  const [customerPaymentTerm, setCustomerPaymentTerm] = useState<PaymentTerm>("cash");
  const [vendorPaymentTerm, setVendorPaymentTerm] = useState<PaymentTerm>("credit");
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
    const combinedTaxIds = Array.from(
      new Set([...(product?.saleTaxIds ?? []), ...(product?.purchaseTaxIds ?? [])]),
    );
    updateLine(line.key, {
      productId,
      customerUnitPrice: product?.listPriceMinor ? minorToMajor(product.listPriceMinor) : "",
      vendorUnitCost: product?.standardCostMinor ? minorToMajor(product.standardCostMinor) : "",
      taxIds: combinedTaxIds,
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
      stepEnteredAt.current = Date.now();
      setIsStepTransitioning(true);
      setTimeout(() => {
        setIsStepTransitioning(false);
      }, 700);
    }
    setClientError(null);
    setStep(targetStep);
  }

  function submitWithIntent(intent: "post" | "draft") {
    if (intent === "post" && step !== 2) {
      return;
    }
    if (isPending || isStepTransitioning) {
      return;
    }
    if (intent === "post" && Date.now() - stepEnteredAt.current < 700) {
      return;
    }

    if (!customerId) {
      setClientError("Please select or create a customer.");
      goToStep(1);
      return;
    }
    if (!vendorId) {
      setClientError("Please select or create a vendor.");
      goToStep(1);
      return;
    }

    const activeProducts = lines.filter((l) => l.productId);
    if (activeProducts.length === 0) {
      setClientError("Please select at least one product.");
      goToStep(1);
      return;
    }

    for (const [idx, line] of activeProducts.entries()) {
      const sellPrice = Number(line.customerUnitPrice);
      if (!line.customerUnitPrice || Number.isNaN(sellPrice) || sellPrice <= 0) {
        setClientError(`Sale price is mandatory and must be greater than 0 (Line ${idx + 1}).`);
        goToStep(1);
        return;
      }
      const vendorCost = Number(line.vendorUnitCost);
      if (!line.vendorUnitCost || Number.isNaN(vendorCost) || vendorCost <= 0) {
        setClientError(`Vendor cost/purchase price is mandatory and must be greater than 0 (Line ${idx + 1}).`);
        goToStep(1);
        return;
      }
    }

    if (formRef.current) {
      const formData = new FormData(formRef.current);
      formData.set("intent", intent);
      formData.set("deliverProduct", deliverProduct ? "true" : "false");
      formData.set("customerId", customerId);
      formData.set("vendorId", vendorId);
      formData.set("ownerId", ownerId);
      formData.set("saleDate", saleDate);
      formData.set("customerPaymentTerm", customerPaymentTerm);
      formData.set("vendorPaymentTerm", vendorPaymentTerm);
      formData.set("notes", notes);

      formData.delete("productId");
      formData.delete("description");
      formData.delete("quantity");
      formData.delete("vendorUnitCost");
      formData.delete("customerUnitPrice");
      formData.delete("taxIds");
      formData.delete("lineNotes");

      for (const line of activeProducts) {
        formData.append("productId", line.productId);
        formData.append("description", line.description);
        formData.append("quantity", line.quantity);
        formData.append("vendorUnitCost", line.vendorUnitCost);
        formData.append("customerUnitPrice", line.customerUnitPrice);
        formData.append("taxIds", line.taxIds.join(","));
        formData.append("lineNotes", line.lineNotes);
      }

      startTransition(async () => {
        try {
          await action(formData);
        } catch (err) {
          if (err && typeof err === "object" && "digest" in err && String((err as any).digest).startsWith("NEXT_REDIRECT")) {
            throw err;
          }
          setClientError(err instanceof Error ? err.message : "An error occurred.");
        }
      });
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
          e.preventDefault();
        }
      }}
      className="flex flex-col"
    >
      <input type="hidden" name="deliverProduct" value={deliverProduct ? "true" : "false"} />
      {/* Hidden inputs preserved when on Step 2 */}
      {step === 2 ? (
        <div hidden>
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="vendorId" value={vendorId} />
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="saleDate" value={saleDate} />
          <input type="hidden" name="customerPaymentTerm" value={customerPaymentTerm} />
          <input type="hidden" name="vendorPaymentTerm" value={vendorPaymentTerm} />
          <input type="hidden" name="notes" value={notes} />
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
                  <div className="flex flex-col gap-3">
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
                    <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>{t("directVendor.customerPaymentTerm", "Customer Terms")}</span>
                      <input type="hidden" name="customerPaymentTerm" value={customerPaymentTerm} />
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-input bg-muted/40 p-1">
                        <button
                          type="button"
                          onClick={() => setCustomerPaymentTerm("cash")}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer",
                            customerPaymentTerm === "cash"
                              ? "bg-card text-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Coins className="size-3.5 text-[#D9A441]" />
                          <span>{t("common.cash", "Cash")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerPaymentTerm("credit")}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer",
                            customerPaymentTerm === "credit"
                              ? "bg-card text-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Calendar className="size-3.5 text-[#0B5D4B]" />
                          <span>{t("common.credit", "Credit")}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
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
                    <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>{t("directVendor.vendorPaymentTerm", "Vendor Terms")}</span>
                      <input type="hidden" name="vendorPaymentTerm" value={vendorPaymentTerm} />
                      <div className="grid grid-cols-2 gap-1 rounded-lg border border-input bg-muted/40 p-1">
                        <button
                          type="button"
                          onClick={() => setVendorPaymentTerm("cash")}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer",
                            vendorPaymentTerm === "cash"
                              ? "bg-card text-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Coins className="size-3.5 text-[#D9A441]" />
                          <span>{t("common.cash", "Cash")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVendorPaymentTerm("credit")}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all cursor-pointer",
                            vendorPaymentTerm === "credit"
                              ? "bg-card text-foreground shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Calendar className="size-3.5 text-[#0B5D4B]" />
                          <span>{t("common.credit", "Credit")}</span>
                        </button>
                      </div>
                    </div>
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

            {/* Notebook with Order Lines & Terms Tabs */}
            <div className="relative z-10">
              <Notebook
                defaultValue="order-lines"
                items={[
                  {
                    value: "order-lines",
                    label: (
                      <span className="flex items-center gap-2">
                        <Package className="size-4 text-[#0B5D4B]" />
                        <span>{t("directVendor.productLines", "Product Lines")}</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {lines.length}
                        </span>
                      </span>
                    ),
                    content: (
                      <div className="p-4 sm:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Package className="size-4" />
                            </span>
                            <h2 className="text-sm font-bold tracking-tight text-foreground">
                              {t("directVendor.productLines", "Product Lines")}
                            </h2>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-dashed text-xs font-semibold cursor-pointer"
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
                                const scopeLabel =
                                  tax.scope === "purchase"
                                    ? t("tax.scope.purchase", "Purch")
                                    : tax.scope === "sale"
                                      ? t("tax.scope.sale", "Sale")
                                      : t("tax.scope.both", "Both");

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
                                      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all cursor-pointer",
                                      isSelected
                                        ? "bg-[#0B5D4B] text-white shadow-xs font-semibold"
                                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                  >
                                    <span className="font-bold">{isSelected ? "✓" : "+"}</span>
                                    <span>
                                      {tax.code} ({tax.computation === "fixed" ? (tax.amountMinor / 100).toFixed(2) : `${Number(tax.rate)}%`})
                                    </span>
                                    {tax.scope ? (
                                      <span
                                        className={cn(
                                          "rounded px-1 py-0.5 text-[10px] font-semibold uppercase",
                                          isSelected
                                            ? "bg-white/20 text-white"
                                            : tax.scope === "purchase"
                                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                        )}
                                      >
                                        {scopeLabel}
                                      </span>
                                    ) : null}
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
            </div>
          ),
        },
        {
          value: "terms-and-notes",
          label: (
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <span>{t("purchasing.termsAndNotes", "Terms & Notes")}</span>
              {notes ? <span className="size-1.5 rounded-full bg-[#0B5D4B]" /> : null}
            </span>
          ),
          content: (
            <div className="flex flex-col gap-2 p-4 sm:p-5">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-[#0B5D4B]" />
                  <span>{t("directVendor.orderNotes", "Order Notes & Instructions")}</span>
                </span>
                <textarea
                  name="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  placeholder={t(
                    "directVendor.orderNotesPlaceholder",
                    "Add any delivery notes, vendor reference, or special terms...",
                  )}
                  className="rounded-xl border border-input bg-background/80 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 resize-y leading-relaxed"
                />
              </label>
            </div>
          ),
        },
      ]}
    />
  </div>
</div>
        ) : (
          /* Step 2: Review & Confirmation (Matches Purchase & Sales confirmation view) */
          <div className="space-y-5">
            {/* Step 2 Header Banner */}
            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-transparent p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/20">
                  <ShieldCheck className="size-5 text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight">
                    {t("directVendor.reviewAndConfirmation", "Review & Confirmation")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "directVendor.reviewHint",
                      "Confirm customer, vendor, and product lines before executing direct sale.",
                    )}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex rounded-full bg-[#D9A441]/15 px-2.5 py-1 text-[11px] font-bold text-[#D9A441] border border-[#D9A441]/30">
                {t("purchasing.finalApproval", "Final Approval")}
              </span>
            </div>

            {/* Review Bento Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Customer & Vendor Card */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Users className="size-3.5 text-[#0B5D4B]" />
                    <span>{t("directVendor.customerVendor", "Customer & Vendor")}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("directVendor.requiredParties", "Required Parties")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px]">{t("sales.col.customer", "Customer")}</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5 truncate">
                      {customers.find((c) => c.id === customerId)?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">{t("directVendor.vendor", "Vendor")}</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5 truncate">
                      {vendors.find((v) => v.id === vendorId)?.name || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Commercial Terms & Date Card */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Wallet className="size-3.5 text-[#D9A441]" />
                    <span>{t("purchasing.commercialTermsShort", "Commercial Terms")}</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {t("directVendor.badge.noInventory", "No Inventory")}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px]">{t("Sales Owner", "Sales Owner")}</span>
                    <p className="font-semibold text-foreground mt-0.5 truncate">
                      {owners.find((o) => o.id === ownerId)?.name || t("sales.form.none", "No owner")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">{t("directVendor.saleDate", "Sale Date")}</span>
                    <p className="font-mono font-semibold text-foreground mt-0.5">
                      {saleDate || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">{t("directVendor.customerPayment", "Customer")}</span>
                    <span className="inline-block mt-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                      {t("common.cash", "Cash")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">{t("directVendor.vendorPayment", "Vendor")}</span>
                    <span className="inline-block mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-[11px] text-amber-700 dark:text-amber-300">
                      {t("common.credit", "Credit")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deliver Product Toggle Card */}
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs flex items-center justify-between gap-4">
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

            {/* Product Lines Breakdown Table */}
            <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-[#0B5D4B]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t("directVendor.productLines", "Product Lines Breakdown")}
                  </span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-[#0B5D4B] dark:text-emerald-300">
                    {lines.filter((l) => l.productId).length} {lines.filter((l) => l.productId).length === 1 ? t("purchasing.line", "Line") : t("purchasing.lines", "Lines")}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">{t("Product", "Product")}</th>
                      <th className="py-2.5 px-4 text-right">{t("sales.form.quantity", "Quantity")}</th>
                      <th className="py-2.5 px-4 text-right">{t("directVendor.salePriceUnit", "Sale Price")}</th>
                      <th className="py-2.5 px-4 text-right">{t("directVendor.vendorCostUnit", "Vendor Cost")}</th>
                      {taxes.length > 0 ? <th className="py-2.5 px-4">{t("sales.form.taxes", "Taxes")}</th> : null}
                      <th className="py-2.5 px-4 text-right font-bold text-foreground">{t("directVendor.customerTotal", "Customer Total")}</th>
                      <th className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{t("directVendor.lineMargin", "Margin")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {lines.map((line, index) => {
                      const product = products.find((p) => p.id === line.productId);
                      const amounts = calculateLine(line, taxById);
                      const selectedTaxes = line.taxIds.map((tid) => taxById.get(tid)).filter(Boolean);

                      return (
                        <tr key={line.key} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">
                              {product?.name || t("purchasing.unspecifiedProduct", "Unspecified Product")}
                            </div>
                            {product?.code ? (
                              <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground mt-0.5">
                                {t("purchasing.skuAbbrev", "SKU:")} {product.code}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                            {line.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-foreground">
                            {company.baseCurrencyCode} {money(Number(line.customerUnitPrice))}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-foreground">
                            {company.baseCurrencyCode} {money(Number(line.vendorUnitCost))}
                          </td>
                          {taxes.length > 0 ? (
                            <td className="py-3 px-4">
                              {selectedTaxes.length === 0 ? (
                                <span className="text-muted-foreground text-[11px]">{t("common.none", "None")}</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {selectedTaxes.map((tax) => (
                                    <span
                                      key={tax?.id}
                                      className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0B5D4B] dark:text-emerald-300"
                                    >
                                      {tax?.code}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          ) : null}
                          <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                            {displayMoney(amounts.customerTotalMinor, company.baseCurrencyCode)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {displayMoney(amounts.marginMinor, company.baseCurrencyCode)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes Preview if available */}
            {notes ? (
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-muted-foreground text-[11px] mb-1.5">
                  <FileText className="size-3.5 text-[#0B5D4B]" />
                  <span>{t("purchasing.termsAndNotes", "Terms & Notes")}</span>
                </div>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
              </div>
            ) : null}

            {/* Step 2 Grand Totals Box */}
            <div className="flex justify-end">
              <SummaryBox totals={totals} currencyCode={company.baseCurrencyCode} />
            </div>
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

        {step === 1 ? (
          <div key="step-1-actions" className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onCancel ? (
              <Button
                key="step1-cancel"
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={onCancel}
                className="font-semibold flex-1 sm:flex-initial"
              >
                {t("action.cancel", "Cancel")}
              </Button>
            ) : null}

            <Button
              key="step1-draft"
              type="button"
              disabled={isPending}
              onClick={() => submitWithIntent("draft")}
              variant="outline"
              className="font-semibold hidden sm:inline-flex"
            >
              {t("directVendor.saveDraft", "Save Draft")}
            </Button>

            <Button
              key="step1-continue"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goToStep(2);
              }}
              disabled={isPending}
              className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 flex-1 sm:flex-initial cursor-pointer"
            >
              <span>{t("action.continue", "Continue")}</span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div key="step-2-actions" className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              key="step2-back"
              type="button"
              variant="outline"
              disabled={isPending || isStepTransitioning}
              onClick={() => goToStep(1)}
              className="gap-1.5 font-semibold flex-1 sm:flex-initial"
            >
              <ArrowLeft className="size-4" />
              <span>{t("action.back", "Back")}</span>
            </Button>

            {onCancel ? (
              <Button
                key="step2-cancel"
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={onCancel}
                className="font-semibold flex-1 sm:flex-initial"
              >
                {t("action.cancel", "Cancel")}
              </Button>
            ) : null}

            <Button
              key="step2-draft"
              type="button"
              disabled={isPending || isStepTransitioning}
              onClick={() => submitWithIntent("draft")}
              variant="outline"
              className="font-semibold hidden sm:inline-flex"
            >
              {t("directVendor.saveDraft", "Save Draft")}
            </Button>

            <Button
              key="step2-finish"
              type="button"
              disabled={isPending || isStepTransitioning}
              onClick={() => submitWithIntent(deliverProduct ? "post" : "draft")}
              className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 flex-1 sm:flex-initial cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  <span>{t("common.processing", "Processing...")}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 text-emerald-200" />
                  <span>
                    {deliverProduct
                      ? t("action.finishAndPost", "Finish & Post Sale")
                      : t("action.finishAndSaveDraft", "Finish & Save Draft")}
                  </span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </form>
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
