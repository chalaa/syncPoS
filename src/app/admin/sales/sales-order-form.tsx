"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  FileText,
  Loader2,
  Package,
  Pencil,
  PlusIcon,
  ShieldCheck,
  Tag,
  Trash2Icon,
  Users,
  Wallet,
} from "lucide-react";
import { type FormEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ManyToOneCreateSelect } from "@/components/ui/many-to-one-create-select";
import { Notebook } from "@/components/ui/notebook";
import { ProductSelect, type ProductSelectOption } from "@/app/admin/products/product-select";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { useFormValidation, type FormValidationResult } from "@/hooks/use-form-validation";
import { cn } from "@/lib/utils";
import { createCustomerFromSales } from "@/app/admin/sales/actions";
import type { OwnerOption } from "@/server/owners/types";
import type { SalesAvailableStockOption, SalesFormOption, SalesOrderDetail, SalesTaxOption } from "@/server/sales/types";
import { useAppStore } from "@/stores/app-store";

const inputClass =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B]";

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

export type SalesOrderActionResult = { error?: string } | void;

type SalesFormValues = {
  customerId: string;
  ownerId: string;
  sourceLocationId: string;
  paymentTerm: "cash" | "credit";
  orderDate: string;
  validUntil: string;
  lines: SalesLineDraft[];
  availableQuantityByDomain: Map<string, number>;
};

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
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function fieldKey(field: string, key: string) {
  return `${field}:${key}`;
}

function validateSalesOrderForm(values: SalesFormValues): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!values.customerId) {
    fieldErrors.customerId = "Select a customer.";
  }

  if (!values.ownerId) {
    fieldErrors.ownerId = "Select an owner.";
  }

  if (!values.sourceLocationId) {
    fieldErrors.sourceLocationId = "Select the source warehouse/location.";
  }

  if (!values.orderDate) {
    fieldErrors.orderDate = "Select an order date.";
  }

  if (values.paymentTerm === "credit" && !values.validUntil) {
    fieldErrors.validUntil = "Select the payment due date.";
  }

  const activeLines = values.lines.filter(
    (line) => line.productId || line.quantity || line.unitPrice || line.discount || line.taxIds.length > 0,
  );

  activeLines.forEach((line) => {
    if (!line.productId) {
      fieldErrors[fieldKey("productId", line.key)] = "Select a product.";
    }

    const ownerId = line.ownerId || values.ownerId;
    if (!ownerId) {
      fieldErrors[fieldKey("ownerId", line.key)] = "Select an owner.";
    }

    const locationId = line.sourceLocationId || values.sourceLocationId;
    if (!locationId) {
      fieldErrors[fieldKey("sourceLocationId", line.key)] = "Select a source location.";
    }

    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      fieldErrors[fieldKey("quantity", line.key)] = "Enter a quantity greater than zero.";
    } else if (line.productId && ownerId && locationId) {
      const available = values.availableQuantityByDomain.get(`${locationId}:${ownerId}:${line.productId}`) ?? 0;
      if (quantity > available) {
        fieldErrors[fieldKey("quantity", line.key)] = `Only ${available.toFixed(6)} available for this owner and location.`;
      }
    }

    const unitPrice = Number(line.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      fieldErrors[fieldKey("unitPrice", line.key)] = "Enter a valid unit price.";
    }

    const discount = Number(line.discount);
    if (!Number.isFinite(discount) || discount < 0) {
      fieldErrors[fieldKey("discount", line.key)] = "Enter a valid discount.";
    }
  });

  return {
    formErrors: activeLines.length === 0 ? ["Add at least one sales order line."] : [],
    fieldErrors,
  };
}

export type SalesOrderFormHandle = {
  saveDraft: () => void;
};

type SalesOrderFormProps = {
  action: (formData: FormData) => SalesOrderActionResult | Promise<SalesOrderActionResult>;
  customers: SalesFormOption[];
  owners: OwnerOption[];
  products: SalesFormOption[] | ProductSelectOption[];
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
  isModal?: boolean;
  onCancel?: () => void;
};

export const SalesOrderForm = forwardRef<SalesOrderFormHandle, SalesOrderFormProps>(
  function SalesOrderForm({
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
    isModal = false,
    onCancel,
  }, ref) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitIntent, setSubmitIntent] = useState<"draft" | "confirm">("confirm");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(order?.customerId ?? "");
  const [fsNumber, setFsNumber] = useState(order?.fsNumber ?? "");
  const [paymentTerm, setPaymentTerm] = useState<"cash" | "credit">(order?.paymentTerm ?? "cash");

  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const setSelectedLocationId = useAppStore((state) => state.setSelectedLocationId);
  const selectedShopId =
    !order && selectedLocationId && locations.some((location) => location.id === selectedLocationId)
      ? selectedLocationId
      : "";
  const initialSourceLocationId = order?.sourceLocationId ?? selectedShopId ?? locations[0]?.id ?? "";
  const [sourceLocationId, setSourceLocationId] = useState(initialSourceLocationId);

  useEffect(() => {
    if (!order && selectedLocationId && locations.some((loc) => loc.id === selectedLocationId)) {
      setSourceLocationId(selectedLocationId);
    }
  }, [selectedLocationId, locations, order]);

  const findLinkedOwner = useCallback(
    (locId: string) => {
      if (!locId) return undefined;
      const linkedByLocId = owners.find((owner) => (owner as any).locationIds?.includes(locId));
      if (linkedByLocId) return linkedByLocId;
      const targetLoc = locations.find((l) => l.id === locId);
      if (targetLoc?.name) {
        const locNameLower = targetLoc.name.toLowerCase();
        const linkedByName = owners.find(
          (owner) => locNameLower.includes(owner.name.toLowerCase()) || owner.name.toLowerCase().includes(locNameLower),
        );
        if (linkedByName) return linkedByName;
      }
      return undefined;
    },
    [owners, locations],
  );

  const defaultOwnerId = useMemo(() => {
    if (order?.ownerId) return order.ownerId;
    if (sourceLocationId) {
      const linkedOwner = findLinkedOwner(sourceLocationId);
      if (linkedOwner) return linkedOwner.id;

      const ownerWithStock = owners.find((owner) =>
        availableStock.some(
          (stock) =>
            stock.locationId === sourceLocationId &&
            stock.ownerId === owner.id &&
            Number(stock.quantityAvailable) > 0,
        ),
      );
      if (ownerWithStock) return ownerWithStock.id;
    }
    return owners[0]?.id ?? "";
  }, [order?.ownerId, sourceLocationId, findLinkedOwner, owners, availableStock]);

  const [headerOwnerId, setHeaderOwnerId] = useState(defaultOwnerId);

  useEffect(() => {
    if (!order && sourceLocationId) {
      const linkedOwner = findLinkedOwner(sourceLocationId);
      if (linkedOwner) {
        setHeaderOwnerId(linkedOwner.id);
        setLines((prev) =>
          prev.map((line) => ({
            ...line,
            ownerId: linkedOwner.id,
            sourceLocationId: sourceLocationId,
          })),
        );
      }
    }
  }, [sourceLocationId, findLinkedOwner, order]);
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? defaultDate);
  const [validUntil, setValidUntil] = useState(order?.validUntil ?? defaultDate);
  const [reserveOnConfirm, setReserveOnConfirm] = useState(order?.reserveOnConfirm ?? true);
  const [notes, setNotes] = useState(order?.notes ?? "");

  const [productOptions, setProductOptions] = useState<ProductSelectOption[]>(products);
  const formRef = useRef<HTMLFormElement>(null);

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

  const [editingLineKeys, setEditingLineKeys] = useState<Set<string>>(
    () => new Set(lines.filter((l) => !l.productId).map((l) => l.key)),
  );

  const [savedLineKeys, setSavedLineKeys] = useState<Set<string>>(
    () => new Set(order?.lines ? order.lines.map((l) => l.id) : []),
  );

  function toggleEditLine(key: string) {
    setEditingLineKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function finishEditingLine(key: string) {
    setSavedLineKeys((prev) => new Set([...prev, key]));
    setEditingLineKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

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

  const validationValues = useMemo<SalesFormValues>(
    () => ({
      customerId,
      ownerId: headerOwnerId,
      sourceLocationId: effectiveSourceLocationId,
      paymentTerm,
      orderDate,
      validUntil,
      lines,
      availableQuantityByDomain,
    }),
    [customerId, headerOwnerId, effectiveSourceLocationId, paymentTerm, orderDate, validUntil, lines, availableQuantityByDomain],
  );

  const { formErrors, fieldErrors, isValid } = useFormValidation(validationValues, validateSalesOrderForm);

  const taxById = useMemo(() => new Map(taxes.map((tax) => [tax.id, tax])), [taxes]);
  const productById = useMemo(() => new Map(productOptions.map((product) => [product.id, product])), [productOptions]);

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

    if (line.ownerId) {
      ownerIds.add(line.ownerId);
    }

    return owners.filter((owner) => ownerIds.has(owner.id));
  }

  function productOptionsForLine(line: SalesLineDraft) {
    const ownerId = line.ownerId || headerOwnerId;
    const locationId = line.sourceLocationId || effectiveSourceLocationId;

    if (!ownerId || !locationId) {
      if (line.productId) {
        return productOptions.filter((product) => product.id === line.productId);
      }
      return [];
    }

    const productIds = new Set(
      availableStock
        .filter((stock) => stock.locationId === locationId && stock.ownerId === ownerId && Number(stock.quantityAvailable) > 0)
        .map((stock) => stock.productId),
    );

    if (line.productId) {
      productIds.add(line.productId);
    }

    return productOptions.filter((product) => productIds.has(product.id));
  }

  function updateLine(key: string, patch: Partial<SalesLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.key !== key)));
    setEditingLineKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
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

    setSavedLineKeys((prev) => {
      const next = new Set(prev);
      for (const l of lines) {
        if (l.productId) {
          next.add(l.key);
        }
      }
      return next;
    });

    setLines((current) => [...current, line]);
    setEditingLineKeys(new Set([line.key]));
  }

  function changeHeaderOwner(ownerId: string) {
    const previousOwnerId = headerOwnerId;
    setHeaderOwnerId(ownerId);
    setLines((current) =>
      current.map((line) => {
        if (line.ownerId && line.ownerId !== previousOwnerId) {
          return line;
        }
        return { ...line, ownerId };
      }),
    );
  }

  function changeSourceLocation(locationId: string) {
    const previousSourceLocationId = effectiveSourceLocationId;
    setSourceLocationId(locationId);

    if (!order) {
      setSelectedLocationId(locationId || null);
    }

    let targetOwnerId = headerOwnerId;
    const currentOwnerHasStock = availableStock.some(
      (stock) => stock.locationId === locationId && stock.ownerId === headerOwnerId && Number(stock.quantityAvailable) > 0,
    );
    if (!currentOwnerHasStock) {
      const ownerWithStock = owners.find((owner) =>
        availableStock.some(
          (stock) => stock.locationId === locationId && stock.ownerId === owner.id && Number(stock.quantityAvailable) > 0,
        ),
      );
      if (ownerWithStock) {
        targetOwnerId = ownerWithStock.id;
        setHeaderOwnerId(targetOwnerId);
      }
    }

    setLines((current) =>
      current.map((line) => {
        if (line.sourceLocationId && line.sourceLocationId !== previousSourceLocationId) {
          return line;
        }
        return { ...line, sourceLocationId: locationId, ownerId: targetOwnerId };
      }),
    );
  }

  function changeLineSourceLocation(line: SalesLineDraft, locationId: string) {
    updateLine(line.key, { sourceLocationId: locationId, ownerId: headerOwnerId });
  }

  function changeLineOwner(line: SalesLineDraft, ownerId: string) {
    updateLine(line.key, { ownerId });
  }

  function showFieldError(key: string) {
    return hasSubmitted ? fieldErrors[key] : undefined;
  }

  function submitWithIntent(intent: "draft" | "confirm") {
    setSubmitIntent(intent);
    setHasSubmitted(true);
    setServerError(null);

    if (!isValid) {
      setStep(1);
      return;
    }

    if (formRef.current) {
      const formData = new FormData(formRef.current);
      formData.set("intent", intent);
      startTransition(async () => {
        const result = await action(formData);

        if (result?.error) {
          setServerError(result.error);
        }
      });
    }
  }

  function handleContinueToStep2() {
    setHasSubmitted(true);
    if (!isValid) {
      return;
    }
    setStep(2);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      handleContinueToStep2();
      return;
    }
    submitWithIntent(submitIntent);
  }

  // Expose saveDraft so the parent modal can trigger it from the close-confirmation dialog.
  useImperativeHandle(ref, () => ({
    saveDraft: () => submitWithIntent("draft"),
  }));

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn("grid gap-5", isModal ? "p-0" : "rounded-xl border border-border bg-card p-6 shadow-xs")}
    >
      {order ? <input type="hidden" name="salesOrderId" value={order.id} /> : null}
      <input
        type="hidden"
        name="returnPath"
        value={isModal ? "/admin/sales" : order ? `/admin/sales/${order.id}` : "/admin/sales/new"}
      />
      <input type="hidden" name="intent" value={submitIntent} />

      {error || serverError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive flex items-center gap-2">
          <span className="font-semibold">Error:</span> {serverError ?? error}
        </div>
      ) : null}

      {hasSubmitted && formErrors.length > 0 ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive space-y-1">
          {formErrors.map((formError) => (
            <p key={formError} className="font-medium">• {formError}</p>
          ))}
        </div>
      ) : null}

      {/* Wizard Stepper Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-3 mb-1">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              step === 1
                ? "bg-gradient-to-r from-[#0B5D4B] to-[#073B35] text-white shadow-xs"
                : "bg-emerald-500/10 text-[#0B5D4B] hover:bg-emerald-500/20 dark:bg-emerald-950 dark:text-emerald-300"
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                step === 1 ? "bg-white/20 text-white" : "bg-[#0B5D4B] text-white dark:bg-emerald-500"
              )}
            >
              {step === 2 ? <Check className="size-3" /> : "1"}
            </span>
            <span>1. Quotation Details & Lines</span>
          </button>

          <div className="h-0.5 w-6 bg-border sm:w-10" />

          <button
            type="button"
            onClick={() => {
              if (isValid) {
                setStep(2);
              } else {
                setHasSubmitted(true);
              }
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              step === 2
                ? "bg-gradient-to-r from-[#0B5D4B] to-[#073B35] text-white shadow-xs"
                : "bg-muted/60 text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                step === 2 ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              2
            </span>
            <span>2. Review & Confirm</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-medium">Step {step} of 2</span>
          <span className="text-[11px] font-medium text-[#0B5D4B] dark:text-emerald-400">
            {step === 1 ? "Drafting quotation" : "Ready for confirmation"}
          </span>
        </div>
      </div>

      {/* STEP 1: FORM SPECIFICATIONS & LINE ITEMS */}
      <div className={cn(step === 1 ? "grid gap-5" : "hidden")}>
        {/* Bento Grid Header Layout */}
        <div className="relative z-30 grid gap-4 lg:grid-cols-2">
          {/* Bento Card 1: Customer & Fulfillment */}
          <div className="relative z-20 rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <div className="flex size-6 items-center justify-center rounded-md bg-[#0B5D4B]/10 text-[#0B5D4B] dark:bg-emerald-950 dark:text-emerald-300">
                  <Users className="size-3.5" />
                </div>
                <span>Customer & Fulfillment</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Client & Source</span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ManyToOneCreateSelect
                  name="customerId"
                  label="Customer"
                  options={customers}
                  value={customerId}
                  defaultValue={customerId}
                  placeholder="Search or add customer..."
                  entityLabel="Customer"
                  onCreate={createCustomerFromSales}
                  onValueChange={setCustomerId}
                  error={showFieldError("customerId")}
                />
              </div>

              <div className="relative z-20">
                <RelatedModelSelect
                  name="sourceLocationId"
                  label="Source Warehouse / Location"
                  options={locations}
                  value={effectiveSourceLocationId}
                  onValueChange={changeSourceLocation}
                  placeholder="Select source location..."
                  emptyLabel="No locations found."
                  error={showFieldError("sourceLocationId")}
                />
              </div>

              <input type="hidden" name="customerReference" value={order?.customerReference ?? ""} />

              <div className="sm:col-span-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  <span>FS Number (Fiscal Slip)</span>
                  <input
                    name="fsNumber"
                    value={fsNumber}
                    onChange={(event) => setFsNumber(event.target.value)}
                    placeholder="Optional fiscal slip number..."
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Commercial Terms & Schedule */}
          <div className="relative z-10 rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <div className="flex size-6 items-center justify-center rounded-md bg-[#D9A441]/15 text-[#D9A441] dark:bg-amber-950 dark:text-amber-300">
                  <Wallet className="size-3.5" />
                </div>
                <span>Commercial Terms & Schedule</span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">Terms & Inventory</span>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="relative z-20">
                <RelatedModelSelect
                  name="ownerId"
                  label="Sales Owner"
                  options={owners}
                  value={headerOwnerId}
                  onValueChange={changeHeaderOwner}
                  required={owners.length > 0}
                  placeholder="Select sales owner..."
                  emptyLabel="No owners found."
                  error={showFieldError("ownerId")}
                />
              </div>

              <div className="flex flex-col gap-1 text-sm font-medium">
                <span>Payment Term</span>
                <input type="hidden" name="paymentTerm" value={paymentTerm} />
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-input bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentTerm("cash")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
                      paymentTerm === "cash"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Coins className="size-3.5 text-[#D9A441]" />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentTerm("credit")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
                      paymentTerm === "credit"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calendar className="size-3.5 text-[#0B5D4B]" />
                    <span>Credit</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  <span>Order Date</span>
                  <input
                    name="orderDate"
                    type="date"
                    value={orderDate}
                    onChange={(event) => setOrderDate(event.target.value)}
                    className={cn(inputClass, showFieldError("orderDate") ? "border-destructive focus-visible:border-destructive" : "")}
                  />
                  {showFieldError("orderDate") ? <span className="text-xs font-normal text-destructive">{showFieldError("orderDate")}</span> : null}
                </label>
              </div>

              {paymentTerm === "credit" ? (
                <div>
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    <span>Last Payment Date</span>
                    <input
                      name="validUntil"
                      type="date"
                      value={validUntil}
                      onChange={(event) => setValidUntil(event.target.value)}
                      className={cn(inputClass, showFieldError("validUntil") ? "border-destructive focus-visible:border-destructive" : "")}
                    />
                    {showFieldError("validUntil") ? <span className="text-xs font-normal text-destructive">{showFieldError("validUntil")}</span> : null}
                  </label>
                </div>
              ) : null}

              <div className="sm:col-span-2 pt-1">
                <label className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-muted/20 px-3.5 py-2.5 text-xs font-medium cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    name="reserveOnConfirm"
                    checked={reserveOnConfirm}
                    onChange={(event) => setReserveOnConfirm(event.target.checked)}
                    className="size-4 rounded border-input text-[#0B5D4B] focus:ring-[#0B5D4B]"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Reserve Stock on Confirmation</span>
                    <span className="text-[11px] text-muted-foreground">Automatically lock available inventory for this order upon approval.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Notebook Tabs for Order Lines & Other Info */}
        <div className="relative z-10">
          <Notebook
            defaultValue="order-lines"
            items={[
              {
                value: "order-lines",
                label: (
                  <span className="flex items-center gap-2">
                    <Package className="size-4 text-[#0B5D4B]" />
                    <span>Order Items</span>
                    <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {lines.length}
                    </span>
                  </span>
                ),
                content: (
                  <div className="grid gap-4">
                    {/* Hidden form data elements for submission */}
                    {lines.map((line) => (
                      <div key={`${line.key}-hidden`} className="hidden">
                        <input type="hidden" name="productId" value={line.productId} />
                        <input type="hidden" name="lineOwnerId" value={line.ownerId || headerOwnerId} />
                        <input type="hidden" name="lineSourceLocationId" value={line.sourceLocationId || effectiveSourceLocationId} />
                        <input type="hidden" name="quantity" value={line.quantity} />
                        <input type="hidden" name="unitPrice" value={line.unitPrice} />
                        <input type="hidden" name="discount" value={line.discount} />
                        <input type="hidden" name="taxIds" value={line.taxIds.join(",")} />
                      </div>
                    ))}

                    {/* Item Cards List */}
                    <div className="grid gap-3.5">
                      {lines.map((line, index) => {
                        const product = productById.get(line.productId);
                        const owner = owners.find((item) => item.id === (line.ownerId || headerOwnerId));
                        const sourceLocation = locations.find(
                          (item) => item.id === (line.sourceLocationId || effectiveSourceLocationId),
                        );
                        const availableStock = line.productId ? availableQuantityFor(line) : null;
                        const hasLineErrors =
                          hasSubmitted &&
                          ["productId", "ownerId", "sourceLocationId", "quantity", "unitPrice", "discount"].some(
                            (field) => fieldErrors[fieldKey(field, line.key)],
                          );
                        const isEditing = editingLineKeys.has(line.key) || hasLineErrors;

                        if (!isEditing) {
                          return (
                            <div
                              key={line.key}
                              className="group relative rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 shadow-xs transition-all duration-200 hover:border-emerald-500/40 hover:bg-card flex items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 font-mono text-[11px] font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                                  {String(index + 1).padStart(2, "0")}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-bold text-foreground truncate">
                                      {product ? product.name : <span className="text-muted-foreground italic">No product selected</span>}
                                    </h4>
                                    {product?.code ? (
                                      <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                                        {product.code}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                                    <span>Qty: <strong className="text-foreground">{line.quantity || "1"}</strong></span>
                                    <span>•</span>
                                    <span>Price: <strong className="text-foreground">ETB {money(Number(line.unitPrice) || 0)}</strong></span>
                                    {Number(line.discount) > 0 ? (
                                      <>
                                        <span>•</span>
                                        <span>Disc: <strong className="text-amber-600 dark:text-amber-400">ETB {money(Number(line.discount))}</strong></span>
                                      </>
                                    ) : null}
                                    <span>•</span>
                                    <span>Total: <strong className="text-[#0B5D4B] dark:text-emerald-400 font-bold">ETB {money(lineTotals[index]?.total ?? 0)}</strong></span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {line.productId && availableStock !== null ? (
                                  <div
                                    className={cn(
                                      "hidden sm:flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold border mr-1",
                                      availableStock > 0
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300"
                                        : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300",
                                    )}
                                  >
                                    <span className="text-[9px] uppercase font-sans font-bold text-muted-foreground">Avail:</span>
                                    <span>{availableStock.toFixed(2)}</span>
                                  </div>
                                ) : null}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleEditLine(line.key)}
                                  className="size-7 text-[#0B5D4B] hover:bg-emerald-500/10 hover:text-[#0B5D4B] active:scale-95 transition-all"
                                  title="Edit this product line"
                                >
                                  <Pencil className="size-3.5" />
                                  <span className="sr-only">Edit item</span>
                                </Button>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={lines.length === 1}
                                  onClick={() => removeLine(line.key)}
                                  className="size-7 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-20 transition-all"
                                  title="Remove item"
                                >
                                  <Trash2Icon className="size-3.5" />
                                  <span className="sr-only">Remove item</span>
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={line.key}
                            style={{ zIndex: lines.length - index + 10 }}
                            className={cn(
                              "group relative rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all duration-200 hover:border-emerald-500/30 hover:shadow-sm focus-within:!z-50",
                              hasLineErrors ? "border-destructive/60 bg-destructive/5" : "",
                            )}
                          >
                            {/* Card Header: Product Selector & Action */}
                            <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20 mt-0.5">
                                  {String(index + 1).padStart(2, "0")}
                                </span>

                                <div className="flex-1 min-w-0">
                                  <ProductSelect
                                    value={line.productId}
                                    options={productOptionsForLine(line)}
                                    categories={productCategories}
                                    brands={productBrands}
                                    units={productUnits}
                                    taxes={taxes}
                                    onValueChange={(productId) => updateLineProduct(line.key, productId)}
                                    onOptionsChange={setProductOptions}
                                    placeholder="Search product by name, SKU, or brand..."
                                    emptyLabel={
                                      (line.ownerId || headerOwnerId) && (line.sourceLocationId || effectiveSourceLocationId)
                                        ? "No products with available stock."
                                        : "Select owner and source location first."
                                    }
                                    inputClassName="h-10 rounded-lg text-sm font-medium w-full"
                                    error={showFieldError(fieldKey("productId", line.key))}
                                  />

                                  {showFieldError(fieldKey("productId", line.key)) ? (
                                    <p className="mt-1 text-xs text-destructive">
                                      {showFieldError(fieldKey("productId", line.key))}
                                    </p>
                                  ) : null}

                                  {product?.code ? (
                                    <span className="inline-block rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground mt-1">
                                      SKU: {product.code}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-1">
                                {line.productId ? (
                                  <>
                                    <div
                                      className={cn(
                                        "hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold border",
                                        availableStock !== null && availableStock > 0
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300"
                                          : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/40 dark:text-amber-300",
                                      )}
                                    >
                                      <span className="text-[10px] uppercase font-sans font-bold text-muted-foreground">Avail:</span>
                                      <span>{availableStock !== null ? availableStock.toFixed(2) : "0"}</span>
                                    </div>

                                    {savedLineKeys.has(line.key) ? (
                                      <Button
                                        type="button"
                                        variant="default"
                                        size="sm"
                                        onClick={() => finishEditingLine(line.key)}
                                        className="h-8 gap-1.5 text-xs font-bold bg-[#0B5D4B] text-white hover:bg-[#073B35] shadow-xs px-3 rounded-lg transition-all"
                                      >
                                        <Check className="size-3.5" />
                                        Update
                                      </Button>
                                    ) : null}
                                  </>
                                ) : null}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={lines.length === 1}
                                  onClick={() => removeLine(line.key)}
                                  className="size-8 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-20 shrink-0"
                                  title="Remove this item"
                                >
                                  <Trash2Icon className="size-4" />
                                  <span className="sr-only">Remove item</span>
                                </Button>
                              </div>
                            </div>

                            {/* Card Body: Controls Strip */}
                            <div
                              className={cn(
                                "grid grid-cols-2 gap-3 items-start pt-3.5",
                                taxes.length > 0 ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4",
                              )}
                            >
                              {/* Quantity */}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                  <span>Quantity</span>
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    {line.productId && availableStock !== null ? `Max: ${availableStock.toFixed(2)}` : "Units to sell"}
                                  </span>
                                </label>
                                <input
                                  type="number"
                                  min="0.000001"
                                  step="any"
                                  value={line.quantity}
                                  placeholder="1"
                                  className={cn(
                                    inputClass,
                                    "w-full text-left font-mono font-semibold text-sm",
                                    showFieldError(fieldKey("quantity", line.key)) ? "border-destructive focus-visible:border-destructive" : "",
                                  )}
                                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                                />
                                {showFieldError(fieldKey("quantity", line.key)) ? (
                                  <span className="text-[11px] text-destructive">
                                    {showFieldError(fieldKey("quantity", line.key))}
                                  </span>
                                ) : null}
                              </div>

                              {/* Unit Price */}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                  <span>Unit Price</span>
                                  <span className="text-[10px] text-muted-foreground font-normal">In Ethiopian Birr</span>
                                </label>
                                <div className="relative flex items-center">
                                  <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground">
                                    ETB
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.unitPrice}
                                    placeholder="0.00"
                                    className={cn(
                                      inputClass,
                                      "w-full pl-12 text-left font-mono font-semibold text-sm",
                                      showFieldError(fieldKey("unitPrice", line.key)) ? "border-destructive focus-visible:border-destructive" : "",
                                    )}
                                    onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                                  />
                                </div>
                                {showFieldError(fieldKey("unitPrice", line.key)) ? (
                                  <span className="text-[11px] text-destructive">
                                    {showFieldError(fieldKey("unitPrice", line.key))}
                                  </span>
                                ) : null}
                              </div>

                              {/* Discount */}
                              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                  <span>Discount</span>
                                  <span className="text-[10px] text-muted-foreground font-normal">Per line (ETB)</span>
                                </label>
                                <div className="relative flex items-center">
                                  <span className="pointer-events-none absolute left-3 text-xs font-bold text-muted-foreground">
                                    ETB
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.discount}
                                    placeholder="0.00"
                                    className={cn(
                                      inputClass,
                                      "w-full pl-12 text-left font-mono font-semibold text-sm",
                                      showFieldError(fieldKey("discount", line.key)) ? "border-destructive focus-visible:border-destructive" : "",
                                    )}
                                    onChange={(event) => updateLine(line.key, { discount: event.target.value })}
                                  />
                                </div>
                                {showFieldError(fieldKey("discount", line.key)) ? (
                                  <span className="text-[11px] text-destructive">
                                    {showFieldError(fieldKey("discount", line.key))}
                                  </span>
                                ) : null}
                              </div>

                              {/* Taxes Pill Selector */}
                              {taxes.length > 0 ? (
                                <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <Tag className="size-3 text-[#0B5D4B]" />
                                      <span>Taxes</span>
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-normal">Click to toggle</span>
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
                                            {tax.code} ({tax.computation === "fixed" ? money(tax.amountMinor / 100) : `${Number(tax.rate)}%`})
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              {/* Line Financial Total Summary */}
                              <div className="flex flex-col items-end justify-center rounded-lg bg-muted/40 border border-border/50 p-2.5 h-[62px] col-span-2 sm:col-span-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Line Total</span>
                                <span className="font-mono text-base font-extrabold text-[#0B5D4B] dark:text-emerald-400">
                                  ETB {money(lineTotals[index]?.total ?? 0)}
                                </span>
                                {taxes.length > 0 && (lineTotals[index]?.taxAmount ?? 0) > 0 ? (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    Untaxed: ETB {money(lineTotals[index]?.subtotal ?? 0)}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Card Footer: Location & Owner info & override */}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 text-xs text-muted-foreground border-t border-border/50">
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <span>Location:</span>
                                  <span className="font-semibold text-foreground">
                                    {sourceLocation?.name ?? "Default Location"}
                                  </span>
                                </div>
                                <span className="text-border">•</span>
                                <div className="flex items-center gap-1.5">
                                  <span>Owner:</span>
                                  <span className="font-semibold text-foreground">
                                    {owner?.name ?? "Order Owner"}
                                  </span>
                                </div>
                                {line.productId ? (
                                  <>
                                    <span className="text-border">•</span>
                                    <div className="flex items-center gap-1.5">
                                      <span>Stock Available:</span>
                                      <span
                                        className={cn(
                                          "font-mono font-bold",
                                          availableStock !== null && availableStock > 0
                                            ? "text-[#0B5D4B] dark:text-emerald-400"
                                            : "text-amber-600 dark:text-amber-400",
                                        )}
                                      >
                                        {availableStock !== null ? `${availableStock.toFixed(2)} units` : "—"}
                                      </span>
                                    </div>
                                  </>
                                ) : null}
                              </div>

                              <details className="text-right">
                                <summary className="cursor-pointer text-[#0B5D4B] hover:underline font-medium list-none">
                                  Assign different location / owner
                                </summary>
                                <div className="mt-2.5 flex flex-wrap gap-2 text-left justify-end">
                                  <div className="w-56">
                                    <span className="block text-[11px] font-medium text-muted-foreground mb-1">Source Location</span>
                                    <RelatedModelSelect
                                      value={line.sourceLocationId || effectiveSourceLocationId}
                                      options={locations}
                                      onValueChange={(locationId) => changeLineSourceLocation(line, locationId)}
                                      placeholder="Select location"
                                      emptyLabel="No locations found."
                                      inputClassName="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="w-56">
                                    <span className="block text-[11px] font-medium text-muted-foreground mb-1">Stock Owner</span>
                                    <RelatedModelSelect
                                      value={line.ownerId || headerOwnerId}
                                      options={ownerOptionsForLine(line)}
                                      onValueChange={(ownerId) => changeLineOwner(line, ownerId)}
                                      placeholder="Select owner"
                                      emptyLabel="No owners found."
                                      inputClassName="h-8 text-xs"
                                    />
                                  </div>
                                </div>
                              </details>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Line Action & Financial Summary Widget */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addLine}
                        className="w-full sm:w-auto gap-2 border-dashed border-[#0B5D4B]/50 bg-emerald-500/5 text-[#0B5D4B] font-semibold hover:bg-emerald-500/10 hover:border-[#0B5D4B] transition-all py-2.5 px-5 rounded-xl text-xs"
                      >
                        <PlusIcon className="size-4" />
                        + Add Product
                      </Button>

                      {/* Financial Grand Summary Card */}
                      <div className="w-full sm:w-80 rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-4 text-xs shadow-xs">
                        <div className="flex justify-between items-center py-1 text-muted-foreground">
                          <span>Untaxed Subtotal</span>
                          <span className="font-mono font-medium text-foreground">ETB {money(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 text-muted-foreground">
                          <span>Applicable Taxes</span>
                          <span className="font-mono font-medium text-foreground">ETB {money(totals.taxAmount)}</span>
                        </div>
                        <div className="mt-2.5 flex justify-between items-baseline border-t border-border/80 pt-2.5">
                          <div>
                            <span className="text-sm font-bold text-foreground">Total Quotation Value</span>
                            <p className="text-[10px] text-muted-foreground">Ethiopian Birr (ETB)</p>
                          </div>
                          <span className="font-mono text-lg font-extrabold text-[#0B5D4B] dark:text-emerald-400">
                            ETB {money(totals.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                value: "other-information",
                label: (
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span>Terms & Notes</span>
                    {order?.notes ? <span className="size-1.5 rounded-full bg-[#0B5D4B]" /> : null}
                  </span>
                ),
                content: (
                  <div className="flex flex-col gap-2 p-1">
                    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3.5 text-[#0B5D4B]" />
                        <span>Commercial Terms & Internal Notes</span>
                      </span>
                      <textarea
                        name="notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={4}
                        placeholder="Specify warranty terms, shipping conditions, or internal notes for sales fulfillment..."
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

      {/* STEP 2: REVIEW & CONFIRMATION VIEW */}
      <div className={cn(step === 2 ? "grid gap-5" : "hidden")}>
        {/* Step 2 Header Banner */}
        <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-transparent p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/20">
              <ShieldCheck className="size-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">Review & Confirmation</h3>
              <p className="text-xs text-muted-foreground">
                Confirm customer details, source warehouse, inventory reservation, and line totals before executing order confirmation.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-[#D9A441]/15 px-2.5 py-1 text-[11px] font-bold text-[#D9A441] border border-[#D9A441]/30">
            Final Approval
          </span>
        </div>

        {/* Review Bento Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Customer & Fulfillment Card */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5 text-[#0B5D4B]" />
                <span>Customer & Logistics</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Fulfillment</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px]">Customer</span>
                <p className="font-semibold text-foreground text-sm mt-0.5">
                  {customers.find((c) => c.id === customerId)?.name || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">Source Warehouse</span>
                <p className="font-semibold text-foreground text-sm mt-0.5">
                  {locations.find((l) => l.id === effectiveSourceLocationId)?.name || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">FS Number</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">
                  {fsNumber || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">Inventory Policy</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {reserveOnConfirm ? "Reserve stock on confirm" : "No reservation"}
                </p>
              </div>
            </div>
          </div>

          {/* Commercial Terms Card */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Wallet className="size-3.5 text-[#D9A441]" />
                <span>Commercial Terms</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  paymentTerm === "cash"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                )}
              >
                {paymentTerm}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px]">Sales Owner</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {owners.find((o) => o.id === headerOwnerId)?.name || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">Order Date</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">
                  {orderDate || "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">Payment Due</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">
                  {paymentTerm === "credit" ? (validUntil || "—") : "Immediate Cash"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items Review Table */}
        <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-[#0B5D4B]" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">Order Lines Breakdown</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-[#0B5D4B] dark:text-emerald-300">
                {lines.length} {lines.length === 1 ? "Line" : "Lines"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Source Location</th>
                  <th className="py-2.5 px-4">Owner</th>
                  <th className="py-2.5 px-4 text-right">Quantity</th>
                  <th className="py-2.5 px-4 text-right">Unit Price (ETB)</th>
                  <th className="py-2.5 px-4 text-right">Discount (ETB)</th>
                  {taxes.length > 0 ? <th className="py-2.5 px-4">Taxes</th> : null}
                  <th className="py-2.5 px-4 text-right font-bold text-foreground">Line Total (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {lines.map((line, index) => {
                  const product = productById.get(line.productId);
                  const lineOwner = owners.find((o) => o.id === (line.ownerId || headerOwnerId));
                  const lineLocation = locations.find((l) => l.id === (line.sourceLocationId || effectiveSourceLocationId));
                  const selectedTaxes = line.taxIds.map((tid) => taxById.get(tid)).filter(Boolean);

                  return (
                    <tr key={line.key} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{product?.name || "Unspecified Product"}</div>
                        {product?.code ? (
                          <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground mt-0.5">
                            SKU: {product.code}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {lineLocation?.name || "Default Location"}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {lineOwner?.name || "Order Owner"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                        {line.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">
                        ETB {money(Number(line.unitPrice))}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {Number(line.discount) > 0 ? `ETB ${money(Number(line.discount))}` : "—"}
                      </td>
                      {taxes.length > 0 ? (
                        <td className="py-3 px-4">
                          {selectedTaxes.length === 0 ? (
                            <span className="text-muted-foreground text-[11px]">None</span>
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
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0B5D4B] dark:text-emerald-400">
                        ETB {money(lineTotals[index]?.total ?? 0)}
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
              <span>Terms of Sale & Internal Notes</span>
            </div>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{notes}</p>
          </div>
        ) : null}

        {/* Step 2 Grand Totals Box */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-4 text-xs shadow-xs">
            <div className="flex justify-between items-center py-1 text-muted-foreground">
              <span>{totals.taxAmount > 0 ? "Untaxed Subtotal" : "Subtotal"}</span>
              <span className="font-mono font-medium text-foreground">ETB {money(totals.subtotal)}</span>
            </div>
            {totals.taxAmount > 0 ? (
              <div className="flex justify-between items-center py-1 text-muted-foreground">
                <span>Applicable Taxes</span>
                <span className="font-mono font-medium text-foreground">ETB {money(totals.taxAmount)}</span>
              </div>
            ) : null}
            <div className="mt-2.5 flex justify-between items-baseline border-t border-border/80 pt-2.5">
              <div>
                <span className="text-sm font-bold text-foreground">Total Order Value</span>
                <p className="text-[10px] text-muted-foreground">Ethiopian Birr (ETB)</p>
              </div>
              <span className="font-mono text-xl font-extrabold text-[#0B5D4B] dark:text-emerald-400">
                ETB {money(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer (Sticky inside modal or pinned bottom) */}
      <div
        className={cn(
          "flex items-center gap-4",
          isModal
            ? "sticky bottom-0 z-10 -mx-6 -mb-5 border-t border-border/80 bg-card/95 px-6 py-3.5 backdrop-blur-md justify-between shadow-lg mt-4"
            : "justify-between mt-4 pt-4 border-t border-border"
        )}
      >
        {step === 1 ? (
          <>
            <div className="flex items-center gap-3 text-xs">
              {isModal ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1">
                  <Package className="size-3.5 text-[#0B5D4B]" />
                  <span className="font-medium text-muted-foreground">
                    {lines.filter((l) => l.productId).length} / {lines.length}{" "}
                    {lines.length === 1 ? "Item specified" : "Items specified"}
                  </span>
                </div>
              ) : null}
              <div className="hidden sm:flex items-baseline gap-1.5 text-muted-foreground">
                <span>Total Value:</span>
                <strong className="font-mono text-base font-extrabold text-[#0B5D4B] dark:text-emerald-400">
                  ETB {money(totals.total)}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {isModal && onCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isPending}
                  className="px-4 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80"
                >
                  Cancel
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                onClick={() => submitWithIntent("draft")}
                disabled={isPending}
                className="px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 border-border"
              >
                Save as Draft Quotation
              </Button>

              <Button
                type="button"
                onClick={handleContinueToStep2}
                disabled={isPending}
                className={cn(
                  "gap-2 font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99] px-6 text-xs",
                  "bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#0B5D4B]"
                )}
              >
                <span>Continue to Confirmation</span>
                <ArrowRight className="size-3.5 text-emerald-200" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isPending}
                className="gap-1.5 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Edit</span>
              </Button>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => submitWithIntent("draft")}
                disabled={isPending}
                className="px-4 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 border-border"
              >
                {submitLabel || "Save as Draft Quotation"}
              </Button>

              <Button
                type="button"
                onClick={() => submitWithIntent("confirm")}
                disabled={isPending}
                className={cn(
                  "gap-2 font-bold text-white shadow-lg shadow-[#0B5D4B]/25 transition-all hover:brightness-110 active:scale-[0.99] px-7 py-2 text-xs",
                  "bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#0B5D4B]"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Confirming Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-200" />
                    <span>Confirm Sales Order</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </form>
  );
  }
);
