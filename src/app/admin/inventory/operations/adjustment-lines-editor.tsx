"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";

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
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  locationId: string;
  ownerId: string;
}) {
  const [lines, setLines] = useState<AdjustmentLine[]>(() => [createAdjustmentLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
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
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2">Product</th>
            <th className="px-2 py-2">Serial</th>
            <th className="px-2 py-2">Lot</th>
            <th className="px-2 py-2 text-right">On Hand</th>
            <th className="px-2 py-2 text-right">Counted</th>
            <th className="px-2 py-2 text-right">Difference</th>
            <th className="px-2 py-2">Notes</th>
            <th className="w-12 px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const product = productById.get(line.productId);
            const trackingMode = product?.trackingMode ?? "none";
            const balance = currentBalance(line);
            const onHand = Number(balance?.quantityOnHand ?? 0);
            const counted = Number(line.countedQuantity || 0);
            const difference = counted - onHand;

            return (
              <tr key={line.id} className="border-b border-border/70 align-top">
                <td className="px-2 py-3">
                  <select name="productId" value={line.productId} onChange={(event) => updateLine(line.id, { productId: event.target.value })} className={inputClass}>
                    <option value="">Select product</option>
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.code} - {option.name} ({option.trackingMode})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-3">
                  <input name="serialNo" value={line.serialNo} readOnly={trackingMode !== "serial"} placeholder={trackingMode === "serial" ? "Serial" : "-"} onChange={(event) => updateLine(line.id, { serialNo: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3">
                  <input name="lotNo" value={line.lotNo} readOnly={trackingMode !== "lot"} placeholder={trackingMode === "lot" ? "Lot" : "-"} onChange={(event) => updateLine(line.id, { lotNo: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3 text-right">{formatQuantity(onHand)}</td>
                <td className="px-2 py-3">
                  <input name="countedQuantity" type="number" min="0" step="0.000001" value={line.countedQuantity} onChange={(event) => updateLine(line.id, { countedQuantity: event.target.value })} className={`${inputClass} text-right`} />
                </td>
                <td className="px-2 py-3 text-right font-medium">{formatQuantity(difference)}</td>
                <td className="px-2 py-3">
                  <input name="lineNotes" value={line.notes} onChange={(event) => updateLine(line.id, { notes: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3">
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createAdjustmentLine()]))}>
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, createAdjustmentLine()])}>
          <PlusIcon data-icon="inline-start" />
          Add line
        </Button>
      </div>
    </div>
  );
}

export function InventoryAdjustmentForm({
  action,
  owners,
  locations,
  products,
  balances,
}: {
  action: (formData: FormData) => void | Promise<void>;
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Owner</span>
          <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
            <option value="">Select owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Stock Location</span>
          <select name="locationId" required value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Reference</span>
          <input name="sourceNo" placeholder="Auto" className={inputClass} />
        </label>
      </div>

      <AdjustmentLinesEditor products={products} balances={balances} locationId={locationId} ownerId={ownerId} />

      <label className="mt-5 block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </label>

      <div className="mt-5 flex justify-end">
        <Button type="submit">Post Adjustment</Button>
      </div>
    </form>
  );
}

export function ScrapLinesEditor({
  products,
  balances,
  locationId,
  ownerId,
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  locationId: string;
  ownerId: string;
}) {
  const [lines, setLines] = useState<ScrapLine[]>(() => [createScrapLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
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
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2">Product</th>
            <th className="px-2 py-2">Serial</th>
            <th className="px-2 py-2">Lot</th>
            <th className="px-2 py-2 text-right">On Hand</th>
            <th className="px-2 py-2 text-right">Scrap Qty</th>
            <th className="px-2 py-2">Reason</th>
            <th className="w-12 px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const product = productById.get(line.productId);
            const trackingMode = product?.trackingMode ?? "none";
            const balance = currentBalance(line);

            return (
              <tr key={line.id} className="border-b border-border/70 align-top">
                <td className="px-2 py-3">
                  <select name="productId" value={line.productId} onChange={(event) => updateLine(line.id, { productId: event.target.value })} className={inputClass}>
                    <option value="">Select product</option>
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.code} - {option.name} ({option.trackingMode})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-3">
                  <input name="serialNo" value={line.serialNo} readOnly={trackingMode !== "serial"} placeholder={trackingMode === "serial" ? "Serial" : "-"} onChange={(event) => updateLine(line.id, { serialNo: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3">
                  <input name="lotNo" value={line.lotNo} readOnly={trackingMode !== "lot"} placeholder={trackingMode === "lot" ? "Lot" : "-"} onChange={(event) => updateLine(line.id, { lotNo: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3 text-right">{formatQuantity(balance?.quantityOnHand ?? 0)}</td>
                <td className="px-2 py-3">
                  <input name="quantity" type="number" min="0.000001" max={balance?.quantityAvailable ?? undefined} step="0.000001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className={`${inputClass} text-right`} />
                </td>
                <td className="px-2 py-3">
                  <input name="lineNotes" value={line.notes} onChange={(event) => updateLine(line.id, { notes: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3">
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createScrapLine()]))}>
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, createScrapLine()])}>
          <PlusIcon data-icon="inline-start" />
          Add line
        </Button>
      </div>
    </div>
  );
}

export function InventoryScrapForm({
  action,
  owners,
  locations,
  products,
  balances,
}: {
  action: (formData: FormData) => void | Promise<void>;
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Owner</span>
          <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
            <option value="">Select owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Source Location</span>
          <select name="locationId" required value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Reference</span>
          <input name="sourceNo" placeholder="Auto" className={inputClass} />
        </label>
      </div>

      <ScrapLinesEditor products={products} balances={balances} locationId={locationId} ownerId={ownerId} />

      <label className="mt-5 block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </label>

      <div className="mt-5 flex justify-end">
        <Button type="submit">Post Scrap</Button>
      </div>
    </form>
  );
}

export function InternalTransferLinesEditor({
  products,
  balances,
  fromLocationId,
  ownerId,
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  fromLocationId: string;
  ownerId: string;
}) {
  const [lines, setLines] = useState<InternalTransferLine[]>(() => [createInternalTransferLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
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
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2">Product</th>
            <th className="px-2 py-2">Serial</th>
            <th className="px-2 py-2">Lot</th>
            <th className="px-2 py-2 text-right">On Hand</th>
            <th className="px-2 py-2 text-right">Available</th>
            <th className="px-2 py-2 text-right">Transfer Qty</th>
            <th className="px-2 py-2">Notes</th>
            <th className="w-12 px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const product = productById.get(line.productId);
            const trackingMode = product?.trackingMode ?? "none";
            const balance = currentBalance(line);
            const productError = fieldErrors[fieldKey("productId", line.id)];
            const serialError = fieldErrors[fieldKey("serialNo", line.id)];
            const lotError = fieldErrors[fieldKey("lotNo", line.id)];
            const quantityError = fieldErrors[fieldKey("quantity", line.id)];

            return (
              <tr key={line.id} className="border-b border-border/70 align-top">
                <td className="px-2 py-3">
                  <select
                    name="productId"
                    value={line.productId}
                    aria-invalid={productError ? "true" : undefined}
                    aria-describedby={productError ? `transfer-product-error-${line.id}` : undefined}
                    onChange={(event) => updateLine(line.id, { productId: event.target.value })}
                    className={`${inputClass} ${productError ? "border-destructive focus:border-destructive" : ""}`}
                  >
                    <option value="">Select product</option>
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.code} - {option.name} ({option.trackingMode})
                      </option>
                    ))}
                  </select>
                  {productError ? (
                    <p id={`transfer-product-error-${line.id}`} className="mt-1 text-xs text-destructive">
                      {productError}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-3">
                  <input
                    name="serialNo"
                    value={line.serialNo}
                    readOnly={trackingMode !== "serial"}
                    placeholder={trackingMode === "serial" ? "Serial" : "-"}
                    aria-invalid={serialError ? "true" : undefined}
                    aria-describedby={serialError ? `transfer-serial-error-${line.id}` : undefined}
                    onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                    className={`${inputClass} ${serialError ? "border-destructive focus:border-destructive" : ""}`}
                  />
                  {serialError ? (
                    <p id={`transfer-serial-error-${line.id}`} className="mt-1 text-xs text-destructive">
                      {serialError}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-3">
                  <input
                    name="lotNo"
                    value={line.lotNo}
                    readOnly={trackingMode !== "lot"}
                    placeholder={trackingMode === "lot" ? "Lot" : "-"}
                    aria-invalid={lotError ? "true" : undefined}
                    aria-describedby={lotError ? `transfer-lot-error-${line.id}` : undefined}
                    onChange={(event) => updateLine(line.id, { lotNo: event.target.value })}
                    className={`${inputClass} ${lotError ? "border-destructive focus:border-destructive" : ""}`}
                  />
                  {lotError ? (
                    <p id={`transfer-lot-error-${line.id}`} className="mt-1 text-xs text-destructive">
                      {lotError}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-right">{formatQuantity(balance?.quantityOnHand ?? 0)}</td>
                <td className="px-2 py-3 text-right">{formatQuantity(balance?.quantityAvailable ?? 0)}</td>
                <td className="px-2 py-3">
                  <input
                    name="quantity"
                    type="number"
                    min="0.000001"
                    max={balance?.quantityAvailable ?? undefined}
                    step="0.000001"
                    value={line.quantity}
                    aria-invalid={quantityError ? "true" : undefined}
                    aria-describedby={quantityError ? `transfer-quantity-error-${line.id}` : undefined}
                    onChange={(event) => updateLine(line.id, { quantity: event.target.value })}
                    className={`${inputClass} text-right ${quantityError ? "border-destructive focus:border-destructive" : ""}`}
                  />
                  {quantityError ? (
                    <p id={`transfer-quantity-error-${line.id}`} className="mt-1 text-xs text-destructive">
                      {quantityError}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-3">
                  <input name="lineNotes" value={line.notes} onChange={(event) => updateLine(line.id, { notes: event.target.value })} className={inputClass} />
                </td>
                <td className="px-2 py-3">
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((item) => item.id !== line.id) : [createInternalTransferLine()]))}>
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, createInternalTransferLine()])}>
          <PlusIcon data-icon="inline-start" />
          Add line
        </Button>
      </div>
    </div>
  );
}

export function InventoryInternalTransferForm({
  action,
  owners,
  locations,
  products,
  balances,
}: {
  action: (formData: FormData) => void | Promise<void>;
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
}) {
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id ?? "");
  const [toLocationId, setToLocationId] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);

  function changeFromLocation(value: string) {
    setFromLocationId(value);

    if (toLocationId === value) {
      setToLocationId("");
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
        serialNo: serialNumbers[index]?.trim() || null,
        lotNo: lotNumbers[index]?.trim() || null,
      }))
      .filter((line) => line.productId || line.quantity > 0 || line.serialNo || line.lotNo);

    const errors: string[] = [];

    if (!selectedOwnerId) {
      errors.push("Select an owner before posting the transfer.");
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
        productId: product.id,
        serialNo: line.serialNo,
        lotNo: line.lotNo,
      });
      const availableQuantity = Number(balance?.quantityAvailable ?? 0);

      if (!balance || availableQuantity < line.quantity) {
        const message = `Only ${formatQuantity(availableQuantity)} available.`;
        errors.push(`Line ${line.lineNo}: ${message} Product: ${product.code}.`);
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
    <form action={action} onSubmit={validateBeforeSubmit} className="rounded-lg border border-border bg-card p-5">
      {formErrors.length > 0 ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ul className="list-disc space-y-1 pl-5">
            {formErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Owner</span>
          <select name="ownerId" required value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
            <option value="">Select owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">From Location</span>
          <select name="fromLocationId" required value={fromLocationId} onChange={(event) => changeFromLocation(event.target.value)} className={inputClass}>
            <option value="">Select source</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">To Location</span>
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
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Reference</span>
          <input name="sourceNo" placeholder="Auto" className={inputClass} />
        </label>
      </div>

      <InternalTransferLinesEditor products={products} balances={balances} fromLocationId={fromLocationId} ownerId={ownerId} />

      <label className="mt-5 block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </label>

      <div className="mt-5 flex justify-end">
        <Button type="submit">Post Internal Transfer</Button>
      </div>
    </form>
  );
}
