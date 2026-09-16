"use client";

import { FileText, Package, PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppStore } from "@/stores/app-store";

import { Button } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { cn } from "@/lib/utils";
import { useFormValidation, type FormValidationResult } from "@/hooks/use-form-validation";
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
    ownerId: string;
    productId: string;
    serialNo: string | null;
    lotNo: string | null;
  },
) {
  const product = products.find((item) => item.id === params.productId);
  const balanceByKey = new Map(
    balances.map((balance) => [
      lineKey(balance.locationId, balance.ownerId ?? "", balance.productId, balance.serialNo, balance.lotNo),
      balance,
    ]),
  );
  const productBalanceByKey = aggregateProductBalance(balances);
  const exactBalance = balanceByKey.get(
    lineKey(
      params.locationId,
      params.ownerId,
      params.productId,
      product?.trackingMode === "serial" ? params.serialNo : null,
      product?.trackingMode === "lot" ? params.lotNo : null,
    ),
  );

  return exactBalance ?? productBalanceByKey.get(productLocationKey(params.locationId, params.ownerId, params.productId));
}

type InternalTransferValidationValues = {
  lines: InternalTransferLine[];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  fromLocationId: string;
  ownerId: string;
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
      fieldErrors[fieldKey("productId", line.id)] = "Select a product.";
      continue;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      fieldErrors[fieldKey("quantity", line.id)] = "Enter a quantity greater than zero.";
    }

    if (product.trackingMode === "serial" && !line.serialNo.trim()) {
      fieldErrors[fieldKey("serialNo", line.id)] = "Enter the serial number.";
    }

    if (product.trackingMode === "serial" && Number.isFinite(quantity) && quantity !== 1) {
      fieldErrors[fieldKey("quantity", line.id)] = "Serial products require quantity 1.";
    }

    if (product.trackingMode === "lot" && !line.lotNo.trim()) {
      fieldErrors[fieldKey("lotNo", line.id)] = "Enter the lot number.";
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
        fieldErrors[fieldKey("quantity", line.id)] = `Only ${formatQuantity(availableQuantity)} available.`;
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
          const bal =
            balanceByKey.get(
              lineKey(
                locationId,
                ownerId,
                values.productId,
                product?.trackingMode === "serial" ? next.serialNo || null : null,
                product?.trackingMode === "lot" ? next.lotNo || null : null,
              ),
            ) ?? productBalanceByKey.get(productLocationKey(locationId, ownerId, values.productId));

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
    const exactBalance = balanceByKey.get(
      lineKey(
        locationId,
        ownerId,
        line.productId,
        product?.trackingMode === "serial" ? line.serialNo || null : null,
        product?.trackingMode === "lot" ? line.lotNo || null : null,
      ),
    );

    return exactBalance ?? productBalanceByKey.get(productLocationKey(locationId, ownerId, line.productId));
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
                    placeholder="Search product by name, SKU, or brand..."
                    emptyLabel="No products found."
                    onValueChange={(val) => updateLine(line.id, { productId: val })}
                    inputClassName="h-10 rounded-xl text-xs font-semibold w-full"
                  />
                  {line.productId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground pl-0.5">
                      <span>On Hand: <strong className="text-foreground">{formatQuantity(onHand)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>Avail: <strong className="text-foreground">{formatQuantity(balance?.quantityAvailable ?? onHand)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>
                        Var:{" "}
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
                      placeholder="Counted Qty"
                      onChange={(event) => updateLine(line.id, { countedQuantity: event.target.value })}
                      className={cn(inputClass, "font-mono font-bold text-foreground pr-10 text-right h-10")}
                    />
                    <span className="pointer-events-none absolute right-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="flex h-10 items-center shrink-0">
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
                        <span>Serial No</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Required</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder="Enter serial #"
                        onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : trackingMode === "lot" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>Lot No</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Required</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder="Enter lot #"
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
        onClick={() => setLines((current) => [...current, createAdjustmentLine()])}
        className="w-full sm:w-auto gap-2 border-dashed border-[#0B5D4B]/50 bg-emerald-500/5 text-[#0B5D4B] dark:text-emerald-300 font-semibold hover:bg-emerald-500/10 hover:border-[#0B5D4B] transition-all py-2.5 px-5 rounded-xl text-xs"
      >
        <PlusIcon className="size-4" />
        Add Another Item Line
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

  function handleLocationChange(nextLocId: string) {
    setLocationId(nextLocId);
    if (nextLocId) {
      const autoOwnerId = findOwnerForLocation(nextLocId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }

  return (
    <form action={action} className={cn(isModal ? "space-y-4" : "rounded-lg border border-border bg-card p-5")}>
      {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-2xs">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</span>
            <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
              <option value="">Select owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Location</span>
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
                <span>Product Lines</span>
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
                <span>Terms & Notes</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 text-[#0B5D4B]" />
                    <span>Terms & Internal Notes</span>
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Specify delivery timeline, shipping instructions, or terms agreed for this operation..."
                    className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-all font-sans resize-y leading-relaxed"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-border/60">
        {onCancel ? (
          <Button type="button" variant="outline" className="rounded-xl border-border text-xs font-semibold hover:bg-muted" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-xs text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110">
          Post Adjustment
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
    const exactBalance = balanceByKey.get(
      lineKey(
        locationId,
        ownerId,
        line.productId,
        product?.trackingMode === "serial" ? line.serialNo || null : null,
        product?.trackingMode === "lot" ? line.lotNo || null : null,
      ),
    );

    return exactBalance ?? productBalanceByKey.get(productLocationKey(locationId, ownerId, line.productId));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3.5">
        {lines.map((line, index) => {
          const product = productById.get(line.productId);
          const trackingMode = product?.trackingMode ?? "none";
          const balance = currentBalance(line);

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
                    placeholder="Search product by name, SKU, or brand..."
                    emptyLabel="No products found."
                    onValueChange={(val) => updateLine(line.id, { productId: val })}
                    inputClassName="h-10 rounded-xl text-xs font-semibold w-full"
                  />
                  {line.productId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground pl-0.5">
                      <span>On Hand: <strong className="text-foreground">{formatQuantity(balance?.quantityOnHand ?? 0)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>Avail: <strong className="text-rose-600 dark:text-rose-400 font-bold">{formatQuantity(balance?.quantityAvailable ?? 0)}</strong></span>
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
                      placeholder="Scrap Qty"
                      onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                      className={cn(inputClass, "font-mono font-bold text-rose-600 dark:text-rose-400 pr-10 text-right h-10")}
                    />
                    <span className="pointer-events-none absolute right-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="flex h-10 items-center shrink-0">
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
                        <span>Serial No</span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Required</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder="Enter serial #"
                        onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : trackingMode === "lot" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>Lot No</span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Required</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder="Enter lot #"
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
        onClick={() => setLines((current) => [...current, createScrapLine()])}
        className="w-full sm:w-auto gap-2 border-dashed border-rose-500/50 bg-rose-500/5 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-500/10 hover:border-rose-500 transition-all py-2.5 px-5 rounded-xl text-xs"
      >
        <PlusIcon className="size-4" />
        Add Another Scrap Line
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

  function handleLocationChange(nextLocId: string) {
    setLocationId(nextLocId);
    if (nextLocId) {
      const autoOwnerId = findOwnerForLocation(nextLocId, owners, balances);
      if (autoOwnerId) {
        setOwnerId(autoOwnerId);
      }
    }
  }

  return (
    <form action={action} className={cn(isModal ? "space-y-4" : "rounded-lg border border-border bg-card p-5")}>
      {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 shadow-2xs">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</span>
            <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
              <option value="">Select owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source Location</span>
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
                <span>Product Lines</span>
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
                <span>Terms & Notes</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 text-rose-600" />
                    <span>Write-off Rationale & Internal Notes</span>
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Specify write-off approval details, damage inspection notes, or disposal terms..."
                    className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 focus-visible:border-rose-500 transition-all font-sans resize-y leading-relaxed"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-border/60">
        {onCancel ? (
          <Button type="button" variant="outline" className="rounded-xl border-border text-xs font-semibold hover:bg-muted" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="rounded-xl bg-rose-600 font-semibold text-xs text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700">
          Post Scrap / Write-off
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
    () => ({ lines, products, balances, fromLocationId, ownerId }),
    [balances, fromLocationId, lines, ownerId, products],
  );
  const validateLines = useCallback((values: InternalTransferValidationValues) => validateInternalTransferLines(values), []);
  const { fieldErrors } = useFormValidation(validationValues, validateLines);

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
    const exactBalance = balanceByKey.get(
      lineKey(
        fromLocationId,
        ownerId,
        line.productId,
        product?.trackingMode === "serial" ? line.serialNo || null : null,
        product?.trackingMode === "lot" ? line.lotNo || null : null,
      ),
    );

    return exactBalance ?? productBalanceByKey.get(productLocationKey(fromLocationId, ownerId, line.productId));
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
                    placeholder="Search product by name, SKU, or brand..."
                    emptyLabel="No products found."
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
                      <span>On Hand: <strong className="text-foreground">{formatQuantity(balance?.quantityOnHand ?? 0)}</strong></span>
                      <span className="text-border/80">•</span>
                      <span>Avail: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatQuantity(balance?.quantityAvailable ?? 0)}</strong></span>
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
                      placeholder="Transfer Qty"
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

                <div className="flex h-10 items-center shrink-0">
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
                        <span>Serial No</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Required</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder="Enter serial #"
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
                        <span>Lot No</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Required</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder="Enter lot #"
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
        onClick={() => setLines((current) => [...current, createInternalTransferLine()])}
        className="w-full sm:w-auto gap-2 border-dashed border-[#0B5D4B]/50 bg-emerald-500/5 text-[#0B5D4B] dark:text-emerald-300 font-semibold hover:bg-emerald-500/10 hover:border-[#0B5D4B] transition-all py-2.5 px-5 rounded-xl text-xs"
      >
        <PlusIcon className="size-4" />
        Add Another Transfer Line
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
      errors.push("Select an owner.");
    }

    if (!selectedFromLocationId || !selectedToLocationId) {
      errors.push("Select both source and destination locations.");
    }

    if (selectedFromLocationId === selectedToLocationId) {
      errors.push("Source and destination locations must be different.");
    }

    if (activeLines.length === 0) {
      errors.push("Add at least one transfer line.");
    }

    for (const line of activeLines) {
      const product = products.find((item) => item.id === line.productId);

      if (!product) {
        errors.push(`Select a product on line ${line.lineNo}.`);
        continue;
      }

      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        const message = "Enter a quantity greater than zero.";
        errors.push(`Line ${line.lineNo}: ${message}`);
        continue;
      }

      if (product.trackingMode === "serial" && (!line.serialNo || line.quantity !== 1)) {
        errors.push(`Line ${line.lineNo}: serialized products require quantity 1 and a serial number.`);
        continue;
      }

      if (product.trackingMode === "lot" && !line.lotNo) {
        errors.push(`Line ${line.lineNo}: lot tracked products require a lot number.`);
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
        errors.push(`Line ${line.lineNo}: insufficient available stock for ${product.name} (available: ${available}).`);
      }
    }

    if (errors.length > 0) {
      event.preventDefault();
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);
  }

  return (
    <form action={action} onSubmit={validateBeforeSubmit} className={cn(isModal ? "space-y-4" : "rounded-lg border border-border bg-card p-5")}>
      {returnPath ? <input type="hidden" name="returnPath" value={returnPath} /> : null}
      {formErrors.length > 0 ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive shadow-xs">
          <p className="font-semibold uppercase tracking-wider">Please resolve these errors before transferring:</p>
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
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</span>
            <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
              <option value="">Select owner</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From Location</span>
            <select name="fromLocationId" required value={fromLocationId} onChange={(event) => changeFromLocation(event.target.value)} className={inputClass}>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To Location</span>
            <select name="toLocationId" required value={toLocationId} onChange={(event) => setToLocationId(event.target.value)} className={inputClass}>
              <option value="">Select destination</option>
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
                <span>Product Lines</span>
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
                <span>Terms & Notes</span>
              </span>
            ),
            content: (
              <div className="p-4">
                <label className="flex flex-col gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="size-3.5 text-[#0B5D4B]" />
                    <span>Transfer Terms & Internal Notes</span>
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Specify dispatch instructions, driver name, or transfer terms..."
                    className="w-full rounded-xl border border-input bg-background/80 p-3.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-all font-sans resize-y leading-relaxed"
                  />
                </label>
              </div>
            ),
          },
        ]}
      />

      <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-border/60">
        {onCancel ? (
          <Button type="button" variant="outline" className="rounded-xl border-border text-xs font-semibold hover:bg-muted" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="rounded-xl bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-xs text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110">
          Post Internal Transfer
        </Button>
      </div>
    </form>
  );
}
