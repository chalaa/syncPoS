"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { InventoryOperationFormOptions } from "@/server/inventory/stock-types";

type BalanceOption = {
  locationId: string;
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
  unitCost: string;
  serialNo: string;
  lotNo: string;
  notes: string;
};

type ScrapLine = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  serialNo: string;
  lotNo: string;
  notes: string;
};

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function createAdjustmentLine(): AdjustmentLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    countedQuantity: "",
    unitCost: "0",
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
    unitCost: "0",
    serialNo: "",
    lotNo: "",
    notes: "",
  };
}

function lineKey(locationId: string, productId: string, serialNo: string | null, lotNo: string | null) {
  return `${locationId}:${productId}:${serialNo ?? ""}:${lotNo ?? ""}`;
}

function productLocationKey(locationId: string, productId: string) {
  return `${locationId}:${productId}`;
}

function formatQuantity(value: string | number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "0";
}

function formatMoney(valueMinor: number, currencyCode: string) {
  return `${currencyCode} ${(valueMinor / 100).toFixed(2)}`;
}

function aggregateProductBalance(balances: BalanceOption[]) {
  const grouped = new Map<string, BalanceOption>();

  for (const balance of balances) {
    const key = productLocationKey(balance.locationId, balance.productId);
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

export function AdjustmentLinesEditor({
  products,
  balances,
  locationId,
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  locationId: string;
}) {
  const [lines, setLines] = useState<AdjustmentLine[]>(() => [createAdjustmentLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const balanceByKey = useMemo(
    () => new Map(balances.map((balance) => [lineKey(balance.locationId, balance.productId, balance.serialNo, balance.lotNo), balance])),
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
        line.productId,
        product?.trackingMode === "serial" ? line.serialNo || null : null,
        product?.trackingMode === "lot" ? line.lotNo || null : null,
      ),
    );

    return exactBalance ?? productBalanceByKey.get(productLocationKey(locationId, line.productId));
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
            <th className="px-2 py-2 text-right">Unit Cost</th>
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
                  <input name="unitCost" value={line.unitCost || (balance ? String(balance.averageCostMinor / 100) : "0")} onChange={(event) => updateLine(line.id, { unitCost: event.target.value })} className={`${inputClass} text-right`} />
                  {balance ? <p className="mt-1 text-xs text-muted-foreground">{formatMoney(balance.averageCostMinor, balance.currencyCode)}</p> : null}
                </td>
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
  locations,
  products,
  balances,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-3">
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

      <AdjustmentLinesEditor products={products} balances={balances} locationId={locationId} />

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
}: {
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  locationId: string;
}) {
  const [lines, setLines] = useState<ScrapLine[]>(() => [createScrapLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const balanceByKey = useMemo(
    () => new Map(balances.map((balance) => [lineKey(balance.locationId, balance.productId, balance.serialNo, balance.lotNo), balance])),
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
        line.productId,
        product?.trackingMode === "serial" ? line.serialNo || null : null,
        product?.trackingMode === "lot" ? line.lotNo || null : null,
      ),
    );

    return exactBalance ?? productBalanceByKey.get(productLocationKey(locationId, line.productId));
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
            <th className="px-2 py-2 text-right">Unit Cost</th>
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
                  <input name="quantity" type="number" min="0.000001" step="0.000001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className={`${inputClass} text-right`} />
                </td>
                <td className="px-2 py-3">
                  <input name="unitCost" value={line.unitCost || (balance ? String(balance.averageCostMinor / 100) : "0")} onChange={(event) => updateLine(line.id, { unitCost: event.target.value })} className={`${inputClass} text-right`} />
                  {balance ? <p className="mt-1 text-xs text-muted-foreground">{formatMoney(balance.averageCostMinor, balance.currencyCode)}</p> : null}
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
  locations,
  products,
  balances,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-3">
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

      <ScrapLinesEditor products={products} balances={balances} locationId={locationId} />

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
