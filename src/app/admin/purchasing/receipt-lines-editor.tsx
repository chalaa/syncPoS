"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import type { PurchaseFormOption, PurchaseOrderDetailLine } from "@/server/purchasing/types";

type ReceiptRow = PurchaseOrderDetailLine & {
  key: string;
  receiveQuantity: string;
  serialNo: string;
  lotNo: string;
  remainingQuantity: number;
};

const inputClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function createRow(line: PurchaseOrderDetailLine, quantity: number): ReceiptRow {
  return {
    ...line,
    key: crypto.randomUUID(),
    remainingQuantity: quantity,
    receiveQuantity: line.trackingMode === "serial" ? "1" : String(quantity),
    serialNo: "",
    lotNo: "",
  };
}

function createSplit(row: ReceiptRow): ReceiptRow {
  return {
    ...row,
    key: crypto.randomUUID(),
    receiveQuantity: row.trackingMode === "serial" ? "1" : "0",
    serialNo: "",
    lotNo: "",
  };
}

export function ReceiptLinesEditor({
  action,
  purchaseOrderId,
  defaultLocationId,
  locations,
  lines,
}: {
  action: (formData: FormData) => void | Promise<void>;
  purchaseOrderId: string;
  defaultLocationId: string | null;
  locations: PurchaseFormOption[];
  lines: PurchaseOrderDetailLine[];
}) {
  const [locationId, setLocationId] = useState(defaultLocationId ?? "");
  const [rows, setRows] = useState<ReceiptRow[]>(() =>
    lines
      .map((line) => {
        const remaining = Math.max(Number(line.quantityOrdered) - Number(line.quantityReceived), 0);
        return remaining > 0 ? createRow(line, remaining) : null;
      })
      .filter((line): line is ReceiptRow => Boolean(line)),
  );

  function updateRow(key: string, patch: Partial<ReceiptRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addSplit(row: ReceiptRow) {
    setRows((current) => {
      const index = current.findIndex((currentRow) => currentRow.key === row.key);
      const next = [...current];
      next.splice(index + 1, 0, createSplit(row));
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const positiveRows = rows.filter((row) => Number(row.receiveQuantity) > 0);
    const quantityByPurchaseLine = new Map<string, number>();
    const serials = new Set<string>();

    if (!locationId) {
      errors.push("Receiving location is required.");
    }

    if (positiveRows.length === 0) {
      errors.push("At least one receipt line quantity is required.");
    }

    for (const row of positiveRows) {
      const quantity = Number(row.receiveQuantity);
      quantityByPurchaseLine.set(row.id, (quantityByPurchaseLine.get(row.id) ?? 0) + quantity);

      if (quantity < 0) {
        errors.push(`${row.sku} has an invalid quantity.`);
      }

      if (row.trackingMode === "serial") {
        if (quantity !== 1) {
          errors.push(`${row.sku} serial rows must have quantity 1.`);
        }

        if (!row.serialNo.trim()) {
          errors.push(`${row.sku} requires a serial number.`);
        } else if (serials.has(row.serialNo.trim())) {
          errors.push(`Serial ${row.serialNo.trim()} is duplicated in this receipt.`);
        }

        serials.add(row.serialNo.trim());
      }

      if (row.trackingMode === "lot" && !row.lotNo.trim()) {
        errors.push(`${row.sku} requires a lot number.`);
      }
    }

    for (const [purchaseLineId, quantity] of quantityByPurchaseLine) {
      const line = rows.find((row) => row.id === purchaseLineId);
      if (line && quantity > line.remainingQuantity) {
        errors.push(`${line.sku} total received quantity cannot exceed remaining quantity ${line.remainingQuantity}.`);
      }
    }

    return [...new Set(errors)];
  }, [locationId, rows]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validationErrors.length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="grid gap-5" onSubmit={handleSubmit}>
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Receive To
          <select
            name="locationId"
            required
            value={locationId}
            className={inputClass}
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">Select location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} / {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Supplier Invoice
          <input name="supplierInvoiceNo" className={inputClass} />
        </label>
      </div>

      {validationErrors.length > 0 ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {validationErrors[0]}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 text-right">Remaining</th>
              <th className="w-32 px-2 py-2 text-right">Receive</th>
              <th className="w-44 px-2 py-2">Serial Number</th>
              <th className="w-44 px-2 py-2">Lot Number</th>
              <th className="w-28 px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border/70">
                <td className="px-2 py-3">
                  <input type="hidden" name="purchaseOrderLineId" value={row.id} />
                  <div className="font-medium">{row.productName}</div>
                  <div className="text-xs text-muted-foreground">{row.sku} / {row.trackingMode}</div>
                </td>
                <td className="px-2 py-3 text-right">{row.remainingQuantity}</td>
                <td className="px-2 py-3">
                  <input
                    name="receiveQuantity"
                    type="number"
                    min="0"
                    max={row.remainingQuantity}
                    step="0.000001"
                    value={row.receiveQuantity}
                    readOnly={row.trackingMode === "serial"}
                    className={`${inputClass} w-full text-right`}
                    onChange={(event) => updateRow(row.key, { receiveQuantity: event.target.value })}
                  />
                </td>
                <td className="px-2 py-3">
                  {row.trackingMode === "serial" ? (
                    <input
                      name="serialNo"
                      required
                      value={row.serialNo}
                      className={`${inputClass} w-full`}
                      onChange={(event) => updateRow(row.key, { serialNo: event.target.value })}
                    />
                  ) : (
                    <>
                      <input type="hidden" name="serialNo" value="" />
                      <span className="text-muted-foreground">-</span>
                    </>
                  )}
                </td>
                <td className="px-2 py-3">
                  {row.trackingMode === "lot" ? (
                    <input
                      name="lotNo"
                      required
                      value={row.lotNo}
                      className={`${inputClass} w-full`}
                      onChange={(event) => updateRow(row.key, { lotNo: event.target.value })}
                    />
                  ) : (
                    <>
                      <input type="hidden" name="lotNo" value="" />
                      <span className="text-muted-foreground">-</span>
                    </>
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="flex justify-end gap-2">
                    {row.trackingMode !== "none" ? (
                      <Button type="button" variant="outline" size="icon" onClick={() => addSplit(row)}>
                        <PlusIcon />
                      </Button>
                    ) : null}
                    {rows.length > 1 ? (
                      <Button type="button" variant="danger" size="icon" onClick={() => removeRow(row.key)}>
                        <Trash2Icon />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                  No remaining quantity to receive.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={validationErrors.length > 0}>
          Post Receipt
        </Button>
      </DialogFooter>
    </form>
  );
}
