"use client";

import { Check, FileText, Package, Pencil, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppStore } from "@/stores/app-store";

import { Button } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { cn } from "@/lib/utils";
import { useFormValidation, type FormValidationResult } from "@/hooks/use-form-validation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { RestoreDraftBanner } from "@/components/ui/restore-draft-banner";
import type { InventoryOperationFormOptions } from "@/server/inventory/stock-types";

type BalanceOption = {
  locationId: string;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  serialNo: string | null;
  lotNo: string | null;
  quantityOnHand: string;
  quantityAvailable: string;
  averageCostMinor: number;
  currencyCode: string;
};

type AdjustmentLine = {
  id: string;
  productId: string;
  countedQuantity: string;
  serialNo: string;
  lotNo: string;
  notes: string;
};

type ScrapLine = {
  id: string;
  productId: string;
  quantity: string;
  serialNo: string;
  lotNo: string;
  notes: string;
};

type InternalTransferLine = ScrapLine;

const inputClass =
  "h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-medium outline-none focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 transition-all font-sans";

function createAdjustmentLine(): AdjustmentLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    countedQuantity: "",
    serialNo: "",
    lotNo: "",
    notes: "",
  };
}

function createScrapLine(): ScrapLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantity: "",
    serialNo: "",
    lotNo: "",
    notes: "",
  };
}

function createInternalTransferLine(): InternalTransferLine {
  return createScrapLine();
}

function lineKey(locationId: string, ownerId: string, productId: string, serialNo: string | null, lotNo: string | null) {
  return `${locationId}:${ownerId}:${productId}:${serialNo ?? ""}:${lotNo ?? ""}`;
}

function productLocationKey(locationId: string, ownerId: string, productId: string) {
  return `${locationId}:${ownerId}:${productId}`;
}

function formatQuantity(value: string | number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "0";
}

function aggregateProductBalance(balances: BalanceOption[]) {
  const grouped = new Map<string, BalanceOption>();

  for (const balance of balances) {
    const key = productLocationKey(balance.locationId, balance.ownerId ?? "", balance.productId);
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, { ...balance, serialNo: null, lotNo: null });
      continue;
    }

    current.quantityOnHand = String(Number(current.quantityOnHand) + Number(balance.quantityOnHand));
    current.quantityAvailable = String(Number(current.quantityAvailable) + Number(balance.quantityAvailable));

    if (current.averageCostMinor === 0 && balance.averageCostMinor > 0) {
      current.averageCostMinor = balance.averageCostMinor;
      current.currencyCode = balance.currencyCode;
    }
  }

  return grouped;
}

function formDataValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function findBalance(
  balances: BalanceOption[],
  products: InventoryOperationFormOptions["products"],
  params: {
    locationId: string;
    ownerId?: string;
    productId: string;
    serialNo: string | null;
    lotNo: string | null;
  },
) {
  if (!params.locationId || !params.productId) {
    return undefined;
  }

  const product = products.find((item) => item.id === params.productId);

  // Filter balances matching ONLY the dropdown selected locationId and productId
  const locationBalances = balances.filter(
    (b) => b.locationId === params.locationId && b.productId === params.productId,
  );

  if (locationBalances.length === 0) {
    return undefined;
  }

  // If tracking mode is serial/lot and serialNo/lotNo is provided, try exact tracking match first
  if (product?.trackingMode === "serial" && params.serialNo) {
    const exactSerial = locationBalances.find((b) => b.serialNo === params.serialNo);
    if (exactSerial) return exactSerial;
  }
  if (product?.trackingMode === "lot" && params.lotNo) {
    const exactLot = locationBalances.find((b) => b.lotNo === params.lotNo);
    if (exactLot) return exactLot;
  }

  // Aggregate total onHand, available, and cost for the selected location dropdown
  let quantityOnHand = 0;
  let quantityAvailable = 0;
  let averageCostMinor = 0;
  let currencyCode = "ETB";

  for (const b of locationBalances) {
    if (product?.trackingMode === "serial" && params.serialNo && b.serialNo && b.serialNo !== params.serialNo) {
      continue;
    }
    if (product?.trackingMode === "lot" && params.lotNo && b.lotNo && b.lotNo !== params.lotNo) {
      continue;
    }

    quantityOnHand += Number(b.quantityOnHand) || 0;
    quantityAvailable += Number(b.quantityAvailable) || 0;
    if (b.averageCostMinor > 0) {
      averageCostMinor = b.averageCostMinor;
      currencyCode = b.currencyCode;
    }
  }

  return {
    locationId: params.locationId,
    ownerId: params.ownerId || null,
    ownerName: null,
    productId: params.productId,
    serialNo: params.serialNo,
    lotNo: params.lotNo,
    quantityOnHand: String(quantityOnHand),
    quantityAvailable: String(quantityAvailable),
    averageCostMinor,
    currencyCode,
  };
}

type InternalTransferValidationValues = {
  lines: InternalTransferLine[];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  fromLocationId: string;
  ownerId: string;
  t: (key: string, fallback?: string) => string;
};

function fieldKey(field: string, lineId: string) {
  return `${field}:${lineId}`;
}

function findOwnerForLocation(
  locId: string,
  owners: InventoryOperationFormOptions["owners"],
  balances: BalanceOption[],
): string {
  if (!locId) return owners[0]?.id ?? "";

  const linkedOwner = owners.find((owner) => (owner as any).locationIds?.includes(locId));
  if (linkedOwner) return linkedOwner.id;

  const balanceWithOwner = balances.find((b) => b.locationId === locId && b.ownerId);
  if (balanceWithOwner?.ownerId && owners.some((o) => o.id === balanceWithOwner.ownerId)) {
    return balanceWithOwner.ownerId;
  }

  return owners[0]?.id ?? "";
}

function validateInternalTransferLines({
  lines,
  products,
  balances,
  fromLocationId,
  ownerId,
  t,
}: InternalTransferValidationValues): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  for (const line of lines) {
    const hasLineInput = line.productId || line.quantity || line.serialNo || line.lotNo;

    if (!hasLineInput) {
      continue;
    }

    const product = products.find((item) => item.id === line.productId);
    const quantity = Number(line.quantity);

    if (!product) {
      fieldErrors[fieldKey("productId", line.id)] = t("inventory.errSelectProduct", "Select a product.");
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      fieldErrors[fieldKey("quantity", line.id)] = t("inventory.errQuantityGreaterThanZero", "Enter a quantity greater than zero.");
    }

    if (product.trackingMode === "serial" && !line.serialNo.trim()) {
      fieldErrors[fieldKey("serialNo", line.id)] = t("inventory.errEnterSerialNo", "Enter the serial number.");
    }

    if (product.trackingMode === "serial" && Number.isFinite(quantity) && quantity !== 1) {
      fieldErrors[fieldKey("quantity", line.id)] = t("inventory.errSerialQtyOne", "Serial products require quantity 1.");
    }

    if (product.trackingMode === "lot" && !line.lotNo.trim()) {
      fieldErrors[fieldKey("lotNo", line.id)] = t("inventory.errEnterLotNo", "Enter the lot number.");
    }

    if (Number.isFinite(quantity) && quantity > 0) {
      const balance = findBalance(balances, products, {
        locationId: fromLocationId,
        ownerId,
        productId: product.id,
        serialNo: line.serialNo.trim() || null,
        lotNo: line.lotNo.trim() || null,
      });
      const availableQuantity = Number(balance?.quantityAvailable ?? 0);

      if (!balance || availableQuantity < quantity) {
        fieldErrors[fieldKey("quantity", line.id)] = `${t("inventory.onlyAvailablePrefix", "Only")} ${formatQuantity(availableQuantity)} ${t("inventory.availableSuffix", "available.")}`;
      }
    }
  }

  return {
    formErrors: [],
    fieldErrors,
  };
}

export function AdjustmentLinesEditor({
  products,
  balances,
  locationId,
  ownerId,
  initialProductId,
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  locationId: string;
  ownerId: string;
  initialProductId?: string;
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<AdjustmentLine[]>(() => [
    { ...createAdjustmentLine(), productId: initialProductId ?? "" },
  ]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productSelectOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      })),
    [products],
  );
  const balanceByKey = useMemo(
    () => new Map(balances.map((balance) => [lineKey(balance.locationId, balance.ownerId ?? "", balance.productId, balance.serialNo, balance.lotNo), balance])),
    [balances],
  );
  const productBalanceByKey = useMemo(() => aggregateProductBalance(balances), [balances]);

  function updateLine(id: string, values: Partial<AdjustmentLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) {
          return line;
        }

        const next = { ...line, ...values };
        const product = values.productId ? productById.get(values.productId) : productById.get(next.productId);

        if (values.productId && product?.trackingMode === "serial") {
          next.countedQuantity = next.countedQuantity || "1";
          next.lotNo = "";
        }

        if (values.productId && product?.trackingMode === "lot") {
          next.serialNo = "";
        }

        if (values.productId && product?.trackingMode === "none") {
          next.serialNo = "";
          next.lotNo = "";
        }

        if (values.productId && next.countedQuantity === "") {
          const bal = findBalance(balances, products, {
            locationId,
            ownerId,
            productId: values.productId,
            serialNo: product?.trackingMode === "serial" ? next.serialNo || null : null,
            lotNo: product?.trackingMode === "lot" ? next.lotNo || null : null,
          });

          if (bal) {
            next.countedQuantity = String(Number(bal.quantityOnHand));
          }
        }

        return next;
      }),
    );
  }

  function currentBalance(line: AdjustmentLine) {
    const product = productById.get(line.productId);
    return findBalance(balances, products, {
      locationId,
      ownerId,
      productId: line.productId,
      serialNo: product?.trackingMode === "serial" ? line.serialNo || null : null,
      lotNo: product?.trackingMode === "lot" ? line.lotNo || null : null,
    });
  }

  const [editingLineIds, setEditingLineIds] = useState<Set<string>>(() => new Set([lines[0]?.id ?? ""]));

  function toggleEdit(id: string) {
    setEditingLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addLine() {
    if (lines.some((l) => !l.productId)) {
      return;
    }
    const newLine = createAdjustmentLine();
    setLines((current) => [...current, newLine]);
    setEditingLineIds(new Set([newLine.id]));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5">
        {lines.map((line, index) => {
          const product = productById.get(line.productId);
          const trackingMode = product?.trackingMode ?? "none";
          const balance = currentBalance(line);
          const onHand = Number(balance?.quantityOnHand ?? 0);
          const counted = Number(line.countedQuantity || 0);
          const difference = counted - onHand;
          const isEditing = editingLineIds.has(line.id) || !line.productId;

          if (!isEditing) {
            return (
              <div
                key={line.id}
                className="group relative rounded-xl border border-border/70 bg-card/80 px-3.5 py-2.5 shadow-xs transition-all duration-200 hover:border-[#0B5D4B]/40 hover:bg-card flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 font-mono text-[11px] font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {product ? product.name : <span className="text-muted-foreground italic">{t("inventory.noProductSelected", "No product selected")}</span>}
                      </h4>
                      {product?.code ? (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                          {product.code}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                      <span>{t("table.onHand", "On Hand")}: <strong className="text-foreground">{formatQuantity(onHand)}</strong></span>
                      <span>•</span>
                      <span>{t("inventory.countedQty", "Counted Qty")}: <strong className="text-[#0B5D4B] dark:text-emerald-400 font-bold">{formatQuantity(line.countedQuantity)}</strong></span>
                      <span>•</span>
                      <span>
                        {t("table.var", "Var")}:{" "}
                        {difference > 0 ? (
                          <strong className="text-emerald-600 dark:text-emerald-400">+{formatQuantity(difference)}</strong>
                        ) : difference < 0 ? (
                          <strong className="text-rose-600 dark:text-rose-400">{formatQuantity(difference)}</strong>
                        ) : (
                          <strong className="text-muted-foreground">0</strong>
                        )}
                      </span>
                      {line.serialNo ? (
                        <>
                          <span>•</span>
                          <span>Serial: <strong className="text-foreground">{line.serialNo}</strong></span>
                        </>
                      ) : null}
                      {line.lotNo ? (
                        <>
                          <span>•</span>
                          <span>Lot: <strong className="text-foreground">{line.lotNo}</strong></span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleEdit(line.id)}
                    className="size-7 text-[#0B5D4B] hover:bg-emerald-500/10 hover:text-[#0B5D4B] active:scale-95 transition-all"
                    title={t("action.editItem", "Edit item")}
                  >
                    <Pencil className="size-3.5" />
                    <span className="sr-only">{t("action.editItem", "Edit item")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createAdjustmentLine()]))
                    }
                    className="size-7 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-20 transition-all"
                    title={t("action.removeItem", "Remove item")}
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only">{t("action.removeItem", "Remove item")}</span>
                  </Button>
                </div>

                {/* Hidden inputs to ensure form data submission includes line values */}
                <input type="hidden" name="productId" value={line.productId} />
                <input type="hidden" name="countedQuantity" value={line.countedQuantity} />
                <input type="hidden" name="lineNotes" value={line.notes} />
                <input type="hidden" name="serialNo" value={line.serialNo} />
                <input type="hidden" name="lotNo" value={line.lotNo} />
              </div>
            );
          }

          return (
            <div
              key={line.id}
              style={{ zIndex: lines.length - index + 10 }}
              className="group relative rounded-2xl border border-border/80 bg-card px-3.5 pt-3 pb-2.5 shadow-2xs transition-all duration-200 hover:border-[#0B5D4B]/30 hover:shadow-xs focus-within:!z-50"
            >
              {/* Card Header: Product Name + Quantity */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 sm:gap-3">
                <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-mono text-xs font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <input type="hidden" name="productId" value={line.productId} />
                  <RelatedModelSelect
                    value={line.productId}
                    options={productSelectOptions}
                    placeholder={t("action.searchProducts", "Search product by name, SKU, or brand...")}
                    emptyLabel={t("inventory.noProductsFound", "No products found.")}
                    onValueChange={(val) => updateLine(line.id, { productId: val })}
                    inputClassName="h-10 rounded-xl text-xs font-semibold w-full"
                  />
                  {line.productId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground pl-0.5">
                      <span>{t("table.onHand", "On Hand")}: <strong className="text-foreground">{formatQuantity(onHand)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>{t("table.avail", "Avail")}: <strong className="text-foreground">{formatQuantity(balance?.quantityAvailable ?? onHand)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>
                        {t("table.var", "Var")}:{" "}
                        {difference > 0 ? (
                          <strong className="text-emerald-600 dark:text-emerald-400">+{formatQuantity(difference)}</strong>
                        ) : difference < 0 ? (
                          <strong className="text-rose-600 dark:text-rose-400">{formatQuantity(difference)}</strong>
                        ) : (
                          <strong className="text-muted-foreground">0</strong>
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Counted Quantity field - Same line with Product Name */}
                <div className="w-28 sm:w-36 shrink-0 space-y-1">
                  <div className="relative flex items-center h-10">
                    <input
                      name="countedQuantity"
                      required
                      type="number"
                      min="0"
                      step="0.000001"
                      value={line.countedQuantity}
                      placeholder={t("inventory.countedQty", "Counted Qty")}
                      onChange={(event) => updateLine(line.id, { countedQuantity: event.target.value })}
                      className={cn(inputClass, "font-mono font-bold text-foreground pr-10 text-right h-10")}
                    />
                    <span className="pointer-events-none absolute right-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="flex h-10 items-center gap-1 shrink-0">
                  {line.productId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleEdit(line.id)}
                      className="size-8 rounded-lg text-[#0B5D4B] hover:bg-emerald-500/10 dark:text-emerald-400"
                      title={t("action.done", "Done")}
                    >
                      <Check className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    className="size-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() =>
                      setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createAdjustmentLine()]))
                    }
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Hidden tracking & note inputs for index alignment */}
              <input type="hidden" name="lineNotes" value={line.notes} />
              {trackingMode !== "serial" ? <input type="hidden" name="serialNo" value="" /> : null}
              {trackingMode !== "lot" ? <input type="hidden" name="lotNo" value="" /> : null}

              {/* Serial / Lot tracking inputs (only rendered when product requires tracking) */}
              {trackingMode !== "none" ? (
                <div className="mt-3 pt-3 border-t border-border/40">
                  {trackingMode === "serial" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.serialNo", "Serial No")}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder={t("inventory.enterSerialNo", "Enter serial #")}
                        onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : trackingMode === "lot" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.lotNo", "Lot No")}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder={t("inventory.enterLotNo", "Enter lot #")}
                        onChange={(event) => updateLine(line.id, { lotNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={lines.some((l) => !l.productId)}
        onClick={addLine}
        className="w-full sm:w-auto gap-2 border-dashed border-[#0B5D4B]/50 bg-emerald-500/5 text-[#0B5D4B] dark:text-emerald-300 font-semibold hover:bg-emerald-500/10 hover:border-[#0B5D4B] transition-all py-2.5 px-5 rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="size-4" />
        {t("action.addAnotherItemLine", "Add Another Item Line")}
      </Button>
    </div>
  );
}

export function InventoryAdjustmentForm({
  action,
  owners,
  locations,
  products,
  balances,
  returnPath,
  onCancel,
  isModal,
  initialLocationId: propLocationId,
  initialOwnerId: propOwnerId,
  initialProductId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  returnPath?: string;
  onCancel?: () => void;
  isModal?: boolean;
  initialLocationId?: string;
  initialOwnerId?: string;
  initialProductId?: string;
}) {
  const { t } = useTranslation();
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const initialLocationId = propLocationId ?? (selectedLocationId && locations.some((l) => l.id === selectedLocationId) ? selectedLocationId : (locations[0]?.id ?? ""));
  const [locationId, setLocationId] = useState(initialLocationId);

  const initialOwnerId = useMemo(() => {
    if (propOwnerId) return propOwnerId;
    return findOwnerForLocation(initialLocationId, owners, balances);
  }, [balances, initialLocationId, owners, propOwnerId]);

  const [ownerId, setOwnerId] = useState(initialOwnerId);

  useEffect(() => {
    if (!propOwnerId && initialLocationId) {
      const autoOwnerId = findOwnerForLocation(initialLocationId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }, [balances, initialLocationId, owners, propOwnerId]);

  const ADJUSTMENT_STORAGE_KEY = "syncpos_draft_inventory_adjustment";
  const [hasDraft, setHasDraft] = useState(false);
  const [isSubmittedOrFinished, setIsSubmittedOrFinished] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADJUSTMENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.ownerId || parsed.locationId)) {
          setHasDraft(true);
        }
      }
    } catch {}
  }, []);

  function handleRestoreDraft() {
    try {
      const raw = localStorage.getItem(ADJUSTMENT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.ownerId) setOwnerId(draft.ownerId);
      if (draft.locationId) setLocationId(draft.locationId);
      setHasDraft(false);
    } catch {
      localStorage.removeItem(ADJUSTMENT_STORAGE_KEY);
      setHasDraft(false);
    }
  }

  function handleDiscardDraft() {
    localStorage.removeItem(ADJUSTMENT_STORAGE_KEY);
    setHasDraft(false);
  }

  useEffect(() => {
    if (isSubmittedOrFinished) return;
    if (ownerId || locationId) {
      localStorage.setItem(ADJUSTMENT_STORAGE_KEY, JSON.stringify({ ownerId, locationId }));
    }
  }, [ownerId, locationId, isSubmittedOrFinished]);

  function handleLocationChange(nextLocId: string) {
    setLocationId(nextLocId);
    if (nextLocId) {
      const autoOwnerId = findOwnerForLocation(nextLocId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }

  async function handleFormAction(formData: FormData) {
    setIsSubmittedOrFinished(true);
    localStorage.removeItem(ADJUSTMENT_STORAGE_KEY);
    setHasDraft(false);
    try {
      await action(formData);
    } catch (err) {
      setIsSubmittedOrFinished(false);
      throw err;
    }
  }

  return (
    <form action={handleFormAction} className={cn(isModal ? "space-y-4" : "rounded-lg border border-border bg-card p-5")}>
      <RestoreDraftBanner
        hasDraft={hasDraft}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />
      {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-2xs">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.owner", "Owner")}</span>
            <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
              <option value="">{t("field.selectOwner", "Select owner")}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.stockLocation", "Stock Location")}</span>
            <select name="locationId" required value={locationId} onChange={(event) => handleLocationChange(event.target.value)} className={inputClass}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <Notebook
        className="mt-4"
        items={[
          {
            value: "lines",
            label: (
              <span className="flex items-center gap-2">
                <Package className="size-4 text-[#0B5D4B]" />
                <span>{t("inventory.productLines", "Product Lines")}</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <AdjustmentLinesEditor products={products} balances={balances} locationId={locationId} ownerId={ownerId} initialProductId={initialProductId} />
              </div>
            ),
          },
          {
            value: "notes",
            label: (
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span>{t("inventory.termsAndNotes", "Terms & Notes")}</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 text-[#0B5D4B]" />
                    <span>{t("inventory.termsAndInternalNotes", "Terms & Internal Notes")}</span>
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder={t("inventory.notesPlaceholderAdjustment", "Specify delivery timeline, shipping instructions, or terms agreed for this operation...")}
                    className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-all font-sans resize-y leading-relaxed"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-border/60">
        {onCancel ? (
          <Button type="button" variant="outline" className="w-full sm:w-auto rounded-xl border-border text-xs font-semibold hover:bg-muted whitespace-nowrap justify-center" onClick={onCancel}>
            {t("action.cancel", "Cancel")}
          </Button>
        ) : null}
        <Button type="submit" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-xs text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110 whitespace-nowrap justify-center">
          {t("action.postAdjustment", "Post Adjustment")}
        </Button>
      </div>
    </form>
  );
}

export function ScrapLinesEditor({
  products,
  balances,
  locationId,
  ownerId,
  initialProductId,
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  locationId: string;
  ownerId: string;
  initialProductId?: string;
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<ScrapLine[]>(() => [
    { ...createScrapLine(), productId: initialProductId ?? "" },
  ]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productSelectOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      })),
    [products],
  );
  const balanceByKey = useMemo(
    () => new Map(balances.map((balance) => [lineKey(balance.locationId, balance.ownerId ?? "", balance.productId, balance.serialNo, balance.lotNo), balance])),
    [balances],
  );
  const productBalanceByKey = useMemo(() => aggregateProductBalance(balances), [balances]);

  const [editingLineIds, setEditingLineIds] = useState<Set<string>>(() => new Set([lines[0]?.id ?? ""]));

  function toggleEdit(id: string) {
    setEditingLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addLine() {
    if (lines.some((l) => !l.productId)) {
      return;
    }
    const newLine = createScrapLine();
    setLines((current) => [...current, newLine]);
    setEditingLineIds(new Set([newLine.id]));
  }

  function updateLine(id: string, values: Partial<ScrapLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) {
          return line;
        }

        const next = { ...line, ...values };
        const product = values.productId ? productById.get(values.productId) : productById.get(next.productId);

        if (values.productId && product?.trackingMode === "serial") {
          next.quantity = next.quantity || "1";
          next.lotNo = "";
        }

        if (values.productId && product?.trackingMode === "lot") {
          next.serialNo = "";
        }

        if (values.productId && product?.trackingMode === "none") {
          next.serialNo = "";
          next.lotNo = "";
        }

        return next;
      }),
    );
  }

  function currentBalance(line: ScrapLine) {
    const product = productById.get(line.productId);
    return findBalance(balances, products, {
      locationId,
      ownerId,
      productId: line.productId,
      serialNo: product?.trackingMode === "serial" ? line.serialNo || null : null,
      lotNo: product?.trackingMode === "lot" ? line.lotNo || null : null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5">
        {lines.map((line, index) => {
          const product = productById.get(line.productId);
          const trackingMode = product?.trackingMode ?? "none";
          const balance = currentBalance(line);
          const isEditing = editingLineIds.has(line.id) || !line.productId;

          if (!isEditing) {
            return (
              <div
                key={line.id}
                className="group relative rounded-xl border border-border/70 bg-card/80 px-3.5 py-2.5 shadow-xs transition-all duration-200 hover:border-rose-500/40 hover:bg-card flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-rose-500/10 font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {product ? product.name : <span className="text-muted-foreground italic">{t("inventory.noProductSelected", "No product selected")}</span>}
                      </h4>
                      {product?.code ? (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                          {product.code}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                      <span>{t("table.onHand", "On Hand")}: <strong className="text-foreground">{formatQuantity(balance?.quantityOnHand ?? 0)}</strong></span>
                      <span>•</span>
                      <span>{t("inventory.scrapQty", "Scrap Qty")}: <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatQuantity(line.quantity)}</strong></span>
                      {line.serialNo ? (
                        <>
                          <span>•</span>
                          <span>Serial: <strong className="text-foreground">{line.serialNo}</strong></span>
                        </>
                      ) : null}
                      {line.lotNo ? (
                        <>
                          <span>•</span>
                          <span>Lot: <strong className="text-foreground">{line.lotNo}</strong></span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleEdit(line.id)}
                    className="size-7 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 active:scale-95 transition-all"
                    title={t("action.editItem", "Edit item")}
                  >
                    <Pencil className="size-3.5" />
                    <span className="sr-only">{t("action.editItem", "Edit item")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createScrapLine()]))
                    }
                    className="size-7 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-20 transition-all"
                    title={t("action.removeItem", "Remove item")}
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only">{t("action.removeItem", "Remove item")}</span>
                  </Button>
                </div>

                {/* Hidden inputs to ensure form data submission includes line values */}
                <input type="hidden" name="productId" value={line.productId} />
                <input type="hidden" name="quantity" value={line.quantity} />
                <input type="hidden" name="lineNotes" value={line.notes} />
                <input type="hidden" name="serialNo" value={line.serialNo} />
                <input type="hidden" name="lotNo" value={line.lotNo} />
              </div>
            );
          }

          return (
            <div
              key={line.id}
              style={{ zIndex: lines.length - index + 10 }}
              className="group relative rounded-2xl border border-border/80 bg-card px-3.5 pt-3 pb-2.5 shadow-2xs transition-all duration-200 hover:border-rose-500/30 hover:shadow-xs focus-within:!z-50"
            >
              {/* Card Header: Product Name + Scrap Quantity */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 sm:gap-3">
                <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 font-mono text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <input type="hidden" name="productId" value={line.productId} />
                  <RelatedModelSelect
                    value={line.productId}
                    options={productSelectOptions}
                    placeholder={t("action.searchProducts", "Search product by name, SKU, or brand...")}
                    emptyLabel={t("inventory.noProductsFound", "No products found.")}
                    onValueChange={(val) => updateLine(line.id, { productId: val })}
                    inputClassName="h-10 rounded-xl text-xs font-semibold w-full"
                  />
                  {line.productId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground pl-0.5">
                      <span>{t("table.onHand", "On Hand")}: <strong className="text-foreground">{formatQuantity(balance?.quantityOnHand ?? 0)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>{t("table.avail", "Avail")}: <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatQuantity(balance?.quantityAvailable ?? 0)}</strong></span>
                    </div>
                  ) : null}
                </div>

                {/* Scrap Quantity Field: SAME LINE with Product Name */}
                <div className="w-28 sm:w-36 shrink-0 space-y-1">
                  <div className="relative flex items-center h-10">
                    <input
                      name="quantity"
                      type="number"
                      min="0.000001"
                      max={balance?.quantityAvailable ?? undefined}
                      step="0.000001"
                      value={line.quantity}
                      placeholder={t("inventory.scrapQty", "Scrap Qty")}
                      onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                      className={cn(inputClass, "font-mono font-bold text-rose-600 dark:text-rose-400 pr-10 text-right h-10")}
                    />
                    <span className="pointer-events-none absolute right-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="flex h-10 items-center gap-1 shrink-0">
                  {line.productId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleEdit(line.id)}
                      className="size-8 rounded-lg text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      title={t("action.done", "Done")}
                    >
                      <Check className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    className="size-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createScrapLine()]))}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Hidden tracking & note inputs for index alignment */}
              <input type="hidden" name="lineNotes" value={line.notes} />
              {trackingMode !== "serial" ? <input type="hidden" name="serialNo" value="" /> : null}
              {trackingMode !== "lot" ? <input type="hidden" name="lotNo" value="" /> : null}

              {/* Serial / Lot tracking inputs (only rendered when product requires tracking) */}
              {trackingMode !== "none" ? (
                <div className="mt-3 pt-3 border-t border-border/40">
                  {trackingMode === "serial" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.serialNo", "Serial No")}</span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder={t("inventory.enterSerialNo", "Enter serial #")}
                        onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : trackingMode === "lot" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.lotNo", "Lot No")}</span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder={t("inventory.enterLotNo", "Enter lot #")}
                        onChange={(event) => updateLine(line.id, { lotNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={lines.some((l) => !l.productId)}
        onClick={addLine}
        className="w-full sm:w-auto gap-2 border-dashed border-rose-500/50 bg-rose-500/5 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-500/10 hover:border-rose-500 transition-all py-2.5 px-5 rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="size-4" />
        {t("action.addAnotherScrapLine", "Add Another Scrap Line")}
      </Button>
    </div>
  );
}

export function InventoryScrapForm({
  action,
  owners,
  locations,
  products,
  balances,
  returnPath,
  onCancel,
  isModal,
  initialLocationId: propLocationId,
  initialOwnerId: propOwnerId,
  initialProductId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  returnPath?: string;
  onCancel?: () => void;
  isModal?: boolean;
  initialLocationId?: string;
  initialOwnerId?: string;
  initialProductId?: string;
}) {
  const { t } = useTranslation();
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const initialLocationId = propLocationId ?? (selectedLocationId && locations.some((l) => l.id === selectedLocationId) ? selectedLocationId : (locations[0]?.id ?? ""));
  const [locationId, setLocationId] = useState(initialLocationId);

  const initialOwnerId = useMemo(() => {
    if (propOwnerId) return propOwnerId;
    return findOwnerForLocation(initialLocationId, owners, balances);
  }, [balances, initialLocationId, owners, propOwnerId]);

  const [ownerId, setOwnerId] = useState(initialOwnerId);

  useEffect(() => {
    if (!propOwnerId && initialLocationId) {
      const autoOwnerId = findOwnerForLocation(initialLocationId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }, [balances, initialLocationId, owners, propOwnerId]);

  const SCRAP_STORAGE_KEY = "syncpos_draft_inventory_scrap";
  const [hasDraft, setHasDraft] = useState(false);
  const [isSubmittedOrFinished, setIsSubmittedOrFinished] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCRAP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.ownerId || parsed.locationId)) {
          setHasDraft(true);
        }
      }
    } catch {}
  }, []);

  function handleRestoreDraft() {
    try {
      const raw = localStorage.getItem(SCRAP_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.ownerId) setOwnerId(draft.ownerId);
      if (draft.locationId) setLocationId(draft.locationId);
      setHasDraft(false);
    } catch {
      localStorage.removeItem(SCRAP_STORAGE_KEY);
      setHasDraft(false);
    }
  }

  function handleDiscardDraft() {
    localStorage.removeItem(SCRAP_STORAGE_KEY);
    setHasDraft(false);
  }

  useEffect(() => {
    if (isSubmittedOrFinished) return;
    if (ownerId || locationId) {
      localStorage.setItem(SCRAP_STORAGE_KEY, JSON.stringify({ ownerId, locationId }));
    }
  }, [ownerId, locationId, isSubmittedOrFinished]);

  function handleLocationChange(nextLocId: string) {
    setLocationId(nextLocId);
    if (nextLocId) {
      const autoOwnerId = findOwnerForLocation(nextLocId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }

  async function handleFormAction(formData: FormData) {
    setIsSubmittedOrFinished(true);
    localStorage.removeItem(SCRAP_STORAGE_KEY);
    setHasDraft(false);
    try {
      await action(formData);
    } catch (err) {
      setIsSubmittedOrFinished(false);
      throw err;
    }
  }

  return (
    <form action={handleFormAction} className={cn(isModal ? "space-y-4" : "rounded-lg border border-border bg-card p-5")}>
      <RestoreDraftBanner
        hasDraft={hasDraft}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />
      {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-2xs">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.owner", "Owner")}</span>
            <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
              <option value="">{t("field.selectOwner", "Select owner")}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.sourceLocation", "Source Location")}</span>
            <select name="locationId" required value={locationId} onChange={(event) => handleLocationChange(event.target.value)} className={inputClass}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <Notebook
        className="mt-4"
        items={[
          {
            value: "lines",
            label: (
              <span className="flex items-center gap-2">
                <Package className="size-4 text-rose-600" />
                <span>{t("inventory.productLines", "Product Lines")}</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <ScrapLinesEditor products={products} balances={balances} locationId={locationId} ownerId={ownerId} initialProductId={initialProductId} />
              </div>
            ),
          },
          {
            value: "notes",
            label: (
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span>{t("inventory.termsAndNotes", "Terms & Notes")}</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 text-rose-600" />
                    <span>{t("inventory.writeOffRationale", "Write-off Rationale & Internal Notes")}</span>
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder={t("inventory.notesPlaceholderScrap", "Specify write-off approval details, damage inspection notes, or disposal terms...")}
                    className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 focus-visible:border-rose-500 transition-all font-sans resize-y leading-relaxed"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-border/60">
        {onCancel ? (
          <Button type="button" variant="outline" className="w-full sm:w-auto rounded-xl border-border text-xs font-semibold hover:bg-muted whitespace-nowrap justify-center" onClick={onCancel}>
            {t("action.cancel", "Cancel")}
          </Button>
        ) : null}
        <Button type="submit" className="w-full sm:w-auto rounded-xl bg-rose-600 font-semibold text-xs text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 whitespace-nowrap justify-center">
          {t("action.postScrap", "Post Scrap / Write-off")}
        </Button>
      </div>
    </form>
  );
}

export function InternalTransferLinesEditor({
  products,
  balances,
  fromLocationId,
  ownerId,
  initialProductId,
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  fromLocationId: string;
  ownerId: string;
  initialProductId?: string;
}) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<InternalTransferLine[]>(() => [
    { ...createInternalTransferLine(), productId: initialProductId ?? "" },
  ]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productSelectOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      })),
    [products],
  );
  const balanceByKey = useMemo(
    () => new Map(balances.map((balance) => [lineKey(balance.locationId, balance.ownerId ?? "", balance.productId, balance.serialNo, balance.lotNo), balance])),
    [balances],
  );
  const productBalanceByKey = useMemo(() => aggregateProductBalance(balances), [balances]);
  const validationValues = useMemo(
    () => ({ lines, products, balances, fromLocationId, ownerId, t }),
    [balances, fromLocationId, lines, ownerId, products, t],
  );
  const validateLines = useCallback((values: InternalTransferValidationValues) => validateInternalTransferLines(values), []);
  const { fieldErrors } = useFormValidation(validationValues, validateLines);

  const [editingLineIds, setEditingLineIds] = useState<Set<string>>(() => new Set([lines[0]?.id ?? ""]));

  function toggleEdit(id: string) {
    setEditingLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addLine() {
    if (lines.some((l) => !l.productId)) {
      return;
    }
    const newLine = createInternalTransferLine();
    setLines((current) => [...current, newLine]);
    setEditingLineIds(new Set([newLine.id]));
  }

  function updateLine(id: string, values: Partial<InternalTransferLine>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) {
          return line;
        }

        const next = { ...line, ...values };
        const product = values.productId ? productById.get(values.productId) : productById.get(next.productId);

        if (values.productId && product?.trackingMode === "serial") {
          next.quantity = next.quantity || "1";
          next.lotNo = "";
        }

        if (values.productId && product?.trackingMode === "lot") {
          next.serialNo = "";
        }

        if (values.productId && product?.trackingMode === "none") {
          next.serialNo = "";
          next.lotNo = "";
        }

        return next;
      }),
    );
  }

  function currentBalance(line: InternalTransferLine) {
    const product = productById.get(line.productId);
    return findBalance(balances, products, {
      locationId: fromLocationId,
      ownerId,
      productId: line.productId,
      serialNo: product?.trackingMode === "serial" ? line.serialNo || null : null,
      lotNo: product?.trackingMode === "lot" ? line.lotNo || null : null,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5">
        {lines.map((line, index) => {
          const product = productById.get(line.productId);
          const trackingMode = product?.trackingMode ?? "none";
          const balance = currentBalance(line);
          const productError = fieldErrors[fieldKey("productId", line.id)];
          const serialError = fieldErrors[fieldKey("serialNo", line.id)];
          const lotError = fieldErrors[fieldKey("lotNo", line.id)];
          const quantityError = fieldErrors[fieldKey("quantity", line.id)];
          const isEditing = editingLineIds.has(line.id) || !line.productId;

          if (!isEditing) {
            return (
              <div
                key={line.id}
                className="group relative rounded-xl border border-border/70 bg-card/80 px-3.5 py-2.5 shadow-xs transition-all duration-200 hover:border-[#0B5D4B]/40 hover:bg-card flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 font-mono text-[11px] font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {product ? product.name : <span className="text-muted-foreground italic">{t("inventory.noProductSelected", "No product selected")}</span>}
                      </h4>
                      {product?.code ? (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                          {product.code}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                      <span>{t("table.onHand", "On Hand")}: <strong className="text-foreground">{formatQuantity(balance?.quantityOnHand ?? 0)}</strong></span>
                      <span>•</span>
                      <span>{t("inventory.transferQty", "Transfer Qty")}: <strong className="text-[#0B5D4B] dark:text-emerald-400 font-bold">{formatQuantity(line.quantity)}</strong></span>
                      {line.serialNo ? (
                        <>
                          <span>•</span>
                          <span>Serial: <strong className="text-foreground">{line.serialNo}</strong></span>
                        </>
                      ) : null}
                      {line.lotNo ? (
                        <>
                          <span>•</span>
                          <span>Lot: <strong className="text-foreground">{line.lotNo}</strong></span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleEdit(line.id)}
                    className="size-7 text-[#0B5D4B] hover:bg-emerald-500/10 hover:text-[#0B5D4B] active:scale-95 transition-all"
                    title={t("action.editItem", "Edit item")}
                  >
                    <Pencil className="size-3.5" />
                    <span className="sr-only">{t("action.editItem", "Edit item")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createInternalTransferLine()]))
                    }
                    className="size-7 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-20 transition-all"
                    title={t("action.removeItem", "Remove item")}
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only">{t("action.removeItem", "Remove item")}</span>
                  </Button>
                </div>

                {/* Hidden inputs to ensure form data submission includes line values */}
                <input type="hidden" name="productId" value={line.productId} />
                <input type="hidden" name="quantity" value={line.quantity} />
                <input type="hidden" name="lineNotes" value={line.notes} />
                <input type="hidden" name="serialNo" value={line.serialNo} />
                <input type="hidden" name="lotNo" value={line.lotNo} />
              </div>
            );
          }

          return (
            <div
              key={line.id}
              style={{ zIndex: lines.length - index + 10 }}
              className="group relative rounded-2xl border border-border/80 bg-card px-3.5 pt-3 pb-2.5 shadow-2xs transition-all duration-200 hover:border-[#0B5D4B]/30 hover:shadow-xs focus-within:!z-50"
            >
              {/* Card Header: Product Name + Transfer Quantity */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 sm:gap-3">
                <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <input type="hidden" name="productId" value={line.productId} />
                  <RelatedModelSelect
                    value={line.productId}
                    options={productSelectOptions}
                    placeholder={t("action.searchProducts", "Search product by name, SKU, or brand...")}
                    emptyLabel={t("inventory.noProductsFound", "No products found.")}
                    onValueChange={(val) => updateLine(line.id, { productId: val })}
                    inputClassName="h-10 rounded-xl text-xs font-semibold w-full"
                    error={productError}
                  />
                  {productError ? (
                    <p id={`transfer-product-error-${line.id}`} className="mt-1 text-[11px] font-medium text-destructive">
                      {productError}
                    </p>
                  ) : null}
                  {line.productId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground pl-0.5">
                      <span>{t("table.onHand", "On Hand")}: <strong className="text-foreground">{formatQuantity(balance?.quantityOnHand ?? 0)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>{t("table.avail", "Avail")}: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatQuantity(balance?.quantityAvailable ?? 0)}</strong></span>
                    </div>
                  ) : null}
                </div>

                {/* Transfer Quantity Field: SAME LINE with Product Name */}
                <div className="w-28 sm:w-36 shrink-0 space-y-1">
                  <div className="relative flex items-center h-10">
                    <input
                      name="quantity"
                      type="number"
                      min="0.000001"
                      max={balance?.quantityAvailable ?? undefined}
                      step="0.000001"
                      value={line.quantity}
                      placeholder={t("inventory.transferQty", "Transfer Qty")}
                      onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                      className={cn(
                        inputClass,
                        "font-mono font-bold text-foreground pr-10 text-right h-10",
                        quantityError && "border-destructive",
                      )}
                    />
                    <span className="pointer-events-none absolute right-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Qty
                    </span>
                  </div>
                  {quantityError ? (
                    <p id={`transfer-quantity-error-${line.id}`} className="mt-1 text-[11px] font-medium text-destructive">
                      {quantityError}
                    </p>
                  ) : null}
                </div>

                <div className="flex h-10 items-center gap-1 shrink-0">
                  {line.productId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleEdit(line.id)}
                      className="size-8 rounded-lg text-[#0B5D4B] hover:bg-emerald-500/10 dark:text-emerald-400"
                      title={t("action.done", "Done")}
                    >
                      <Check className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    className="size-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createInternalTransferLine()]))}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Hidden tracking & note inputs for index alignment */}
              <input type="hidden" name="lineNotes" value={line.notes} />
              {trackingMode !== "serial" ? <input type="hidden" name="serialNo" value="" /> : null}
              {trackingMode !== "lot" ? <input type="hidden" name="lotNo" value="" /> : null}

              {/* Serial / Lot tracking inputs (only rendered when product requires tracking) */}
              {trackingMode !== "none" ? (
                <div className="mt-3 pt-3 border-t border-border/40">
                  {trackingMode === "serial" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.serialNo", "Serial No")}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder={t("inventory.enterSerialNo", "Enter serial #")}
                        onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                        className={cn(inputClass, serialError && "border-destructive")}
                      />
                      {serialError ? (
                        <p id={`transfer-serial-error-${line.id}`} className="mt-1 text-[11px] font-medium text-destructive">
                          {serialError}
                        </p>
                      ) : null}
                    </div>
                  ) : trackingMode === "lot" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.lotNo", "Lot No")}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder={t("inventory.enterLotNo", "Enter lot #")}
                        onChange={(event) => updateLine(line.id, { lotNo: event.target.value })}
                        className={cn(inputClass, lotError && "border-destructive")}
                      />
                      {lotError ? (
                        <p id={`transfer-lot-error-${line.id}`} className="mt-1 text-[11px] font-medium text-destructive">
                          {lotError}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={lines.some((l) => !l.productId)}
        onClick={addLine}
        className="w-full sm:w-auto gap-2 border-dashed border-[#0B5D4B]/50 bg-emerald-500/5 text-[#0B5D4B] dark:text-emerald-300 font-semibold hover:bg-emerald-500/10 hover:border-[#0B5D4B] transition-all py-2.5 px-5 rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="size-4" />
        {t("action.addAnotherTransferLine", "Add Another Transfer Line")}
      </Button>
    </div>
  );
}

export function InventoryInternalTransferForm({
  action,
  owners,
  locations,
  products,
  balances,
  returnPath,
  onCancel,
  isModal,
  initialLocationId: propLocationId,
  initialOwnerId: propOwnerId,
  initialProductId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  returnPath?: string;
  onCancel?: () => void;
  isModal?: boolean;
  initialLocationId?: string;
  initialOwnerId?: string;
  initialProductId?: string;
}) {
  const { t } = useTranslation();
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const initialFromLocationId = propLocationId ?? (selectedLocationId && locations.some((l) => l.id === selectedLocationId) ? selectedLocationId : (locations[0]?.id ?? ""));
  const [fromLocationId, setFromLocationId] = useState(initialFromLocationId);

  const initialOwnerId = useMemo(() => {
    if (propOwnerId) return propOwnerId;
    return findOwnerForLocation(initialFromLocationId, owners, balances);
  }, [balances, initialFromLocationId, owners, propOwnerId]);

  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [toLocationId, setToLocationId] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!propOwnerId && initialFromLocationId) {
      const autoOwnerId = findOwnerForLocation(initialFromLocationId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }, [balances, initialFromLocationId, owners, propOwnerId]);

  function changeFromLocation(value: string) {
    setFromLocationId(value);

    if (toLocationId === value) {
      setToLocationId("");
    }

    if (value) {
      const autoOwnerId = findOwnerForLocation(value, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }

  function validateBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const selectedOwnerId = String(formData.get("ownerId") ?? "");
    const selectedFromLocationId = String(formData.get("fromLocationId") ?? "");
    const selectedToLocationId = String(formData.get("toLocationId") ?? "");
    const productIds = formDataValues(formData, "productId");
    const quantities = formDataValues(formData, "quantity");
    const serialNumbers = formDataValues(formData, "serialNo");
    const lotNumbers = formDataValues(formData, "lotNo");
    const activeLines = productIds
      .map((productId, index) => ({
        lineNo: index + 1,
        productId,
        quantity: Number(quantities[index] ?? 0),
        serialNo: String(serialNumbers[index] ?? "").trim(),
        lotNo: String(lotNumbers[index] ?? "").trim(),
      }))
      .filter((line) => line.productId && line.quantity > 0);

    const errors: string[] = [];

    if (!selectedOwnerId) {
      errors.push(t("inventory.errSelectOwner", "Select an owner."));
    }

    if (!selectedFromLocationId || !selectedToLocationId) {
      errors.push(t("inventory.errSelectBothLocations", "Select both source and destination locations."));
    }

    if (selectedFromLocationId === selectedToLocationId) {
      errors.push(t("inventory.errLocationsDifferent", "Source and destination locations must be different."));
    }

    if (activeLines.length === 0) {
      errors.push(t("inventory.errAddTransferLine", "Add at least one transfer line."));
    }

    for (const line of activeLines) {
      const product = products.find((item) => item.id === line.productId);

      if (!product) {
        errors.push(t("inventory.errLineProduct", "Select a product on line {lineNo}.").replace("{lineNo}", String(line.lineNo)));
        continue;
      }

      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        const message = t("inventory.errQuantityGreaterThanZero", "Enter a quantity greater than zero.");
        errors.push(`${t("inventory.linePrefix", "Line")} ${line.lineNo}: ${message}`);
        continue;
      }

      if (product.trackingMode === "serial" && (!line.serialNo || line.quantity !== 1)) {
        errors.push(t("inventory.errLineSerialRequired", "Line {lineNo}: serialized products require quantity 1 and a serial number.").replace("{lineNo}", String(line.lineNo)));
        continue;
      }

      if (product.trackingMode === "lot" && !line.lotNo) {
        errors.push(t("inventory.errLineLotRequired", "Line {lineNo}: lot tracked products require a lot number.").replace("{lineNo}", String(line.lineNo)));
        continue;
      }

      const balance = findBalance(balances, products, {
        locationId: selectedFromLocationId,
        ownerId: selectedOwnerId,
        productId: line.productId,
        serialNo: line.serialNo || null,
        lotNo: line.lotNo || null,
      });

      if (!balance || Number(balance.quantityAvailable) < line.quantity) {
        const available = balance ? formatQuantity(balance.quantityAvailable) : "0";
        errors.push(
          t("inventory.errLineInsufficientStock", "Line {lineNo}: insufficient available stock for {productName} (available: {available}).")
            .replace("{lineNo}", String(line.lineNo))
            .replace("{productName}", product.name)
            .replace("{available}", available),
        );
      }
    }

    if (errors.length > 0) {
      event.preventDefault();
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
  }

  const TRANSFER_STORAGE_KEY = "syncpos_draft_inventory_transfer";
  const [hasDraft, setHasDraft] = useState(false);
  const [isSubmittedOrFinished, setIsSubmittedOrFinished] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRANSFER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.ownerId || parsed.fromLocationId || parsed.toLocationId)) {
          setHasDraft(true);
        }
      }
    } catch {}
  }, []);

  function handleRestoreDraft() {
    try {
      const raw = localStorage.getItem(TRANSFER_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.ownerId) setOwnerId(draft.ownerId);
      if (draft.fromLocationId) setFromLocationId(draft.fromLocationId);
      if (draft.toLocationId) setToLocationId(draft.toLocationId);
      setHasDraft(false);
    } catch {
      localStorage.removeItem(TRANSFER_STORAGE_KEY);
      setHasDraft(false);
    }
  }

  function handleDiscardDraft() {
    localStorage.removeItem(TRANSFER_STORAGE_KEY);
    setHasDraft(false);
  }

  useEffect(() => {
    if (isSubmittedOrFinished) return;
    if (ownerId || fromLocationId || toLocationId) {
      localStorage.setItem(TRANSFER_STORAGE_KEY, JSON.stringify({ ownerId, fromLocationId, toLocationId }));
    }
  }, [ownerId, fromLocationId, toLocationId, isSubmittedOrFinished]);

  async function handleFormAction(formData: FormData) {
    setIsSubmittedOrFinished(true);
    localStorage.removeItem(TRANSFER_STORAGE_KEY);
    setHasDraft(false);
    try {
      await action(formData);
    } catch (err) {
      setIsSubmittedOrFinished(false);
      throw err;
    }
  }

  return (
    <form action={handleFormAction} onSubmit={validateBeforeSubmit} className={cn(isModal ? "space-y-4" : "rounded-lg border border-border bg-card p-5")}>
      <RestoreDraftBanner
        hasDraft={hasDraft}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
      />
      {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
      {formErrors.length > 0 ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive shadow-xs">
          <p className="font-semibold uppercase tracking-wider">{t("inventory.resolveTransferErrors", "Please resolve these errors before transferring:")}</p>
          <ul className="mt-1.5 list-disc pl-4 space-y-0.5 font-medium">
            {formErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-2xs">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.owner", "Owner")}</span>
            <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
              <option value="">{t("field.selectOwner", "Select owner")}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.fromLocation", "From Location")}</span>
            <select name="fromLocationId" required value={fromLocationId} onChange={(event) => changeFromLocation(event.target.value)} className={inputClass}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("field.toLocation", "To Location")}</span>
            <select name="toLocationId" required value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} className={inputClass}>
              <option value="">{t("field.selectDestination", "Select destination")}</option>
              {locations
                .filter((location) => location.id !== fromLocationId)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>

      <Notebook
        className="mt-4"
        items={[
          {
            value: "lines",
            label: (
              <span className="flex items-center gap-2">
                <Package className="size-4 text-[#0B5D4B]" />
                <span>{t("inventory.productLines", "Product Lines")}</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <InternalTransferLinesEditor products={products} balances={balances} fromLocationId={fromLocationId} ownerId={ownerId} initialProductId={initialProductId} />
              </div>
            ),
          },
          {
            value: "notes",
            label: (
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                <span>{t("inventory.termsAndNotes", "Terms & Notes")}</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 text-[#0B5D4B]" />
                    <span>{t("inventory.transferTermsNotes", "Transfer Terms & Internal Notes")}</span>
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder={t("inventory.notesPlaceholderTransfer", "Specify dispatch instructions, driver name, or transfer terms...")}
                    className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-all font-sans resize-y leading-relaxed"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-border/60">
        {onCancel ? (
          <Button type="button" variant="outline" className="w-full sm:w-auto rounded-xl border-border text-xs font-semibold hover:bg-muted whitespace-nowrap justify-center" onClick={onCancel}>
            {t("action.cancel", "Cancel")}
          </Button>
        ) : null}
        <Button type="submit" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-xs text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110 whitespace-nowrap justify-center">
          {t("action.postTransfer", "Post Internal Transfer")}
        </Button>
      </div>
    </form>
  );
}
