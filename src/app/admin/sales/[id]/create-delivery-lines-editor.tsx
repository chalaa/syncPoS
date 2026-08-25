"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import type { DeliveryLotOption, DeliverySerialOption, SalesOrderDetail } from "@/server/sales/types";

type DeliveryDraftRow = {
  key: string;
  salesOrderLineId: string;
  productId: string;
  productName: string;
  sku: string;
  trackingMode: "none" | "lot" | "serial";
  remainingQuantity: number;
  deliveryQuantity: string;
  serialNo: string;
  lotNo: string;
};

const inputClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function optionLabel(value: string, quantityAvailable: string) {
  return `${value} / Available ${quantityAvailable}`;
}

function createRow(line: SalesOrderDetail["lines"][number]): DeliveryDraftRow | null {
  const remainingQuantity = Math.max(Number(line.quantityOrdered) - Number(line.quantityDelivered), 0);

  if (remainingQuantity <= 0) {
    return null;
  }

  return {
    key: crypto.randomUUID(),
    salesOrderLineId: line.id,
    productId: line.productId,
    productName: line.productName,
    sku: line.sku,
    trackingMode: line.trackingMode,
    remainingQuantity,
    deliveryQuantity: line.trackingMode === "serial" ? "1" : String(remainingQuantity),
    serialNo: "",
    lotNo: "",
  };
}

function splitRow(row: DeliveryDraftRow): DeliveryDraftRow {
  return {
    ...row,
    key: crypto.randomUUID(),
    deliveryQuantity: row.trackingMode === "serial" ? "1" : "0",
    serialNo: "",
    lotNo: "",
  };
}

export function CreateDeliveryLinesEditor({
  action,
  order,
}: {
  action: (formData: FormData) => void | Promise<void>;
  order: SalesOrderDetail;
}) {
  const [rows, setRows] = useState<DeliveryDraftRow[]>(() =>
    order.lines
      .map(createRow)
      .filter((row): row is DeliveryDraftRow => Boolean(row)),
  );
  const serialOptionsByProduct = useMemo(() => {
    const map = new Map<string, DeliverySerialOption[]>();
    for (const option of order.serialOptions) {
      map.set(option.productId, [...(map.get(option.productId) ?? []), option]);
    }
    return map;
  }, [order.serialOptions]);
  const lotOptionsByProduct = useMemo(() => {
    const map = new Map<string, DeliveryLotOption[]>();
    for (const option of order.lotOptions) {
      map.set(option.productId, [...(map.get(option.productId) ?? []), option]);
    }
    return map;
  }, [order.lotOptions]);

  function updateRow(key: string, patch: Partial<DeliveryDraftRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addSplit(row: DeliveryDraftRow) {
    setRows((current) => {
      const index = current.findIndex((currentRow) => currentRow.key === row.key);
      const next = [...current];
      next.splice(index + 1, 0, splitRow(row));
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const positiveRows = rows.filter((row) => Number(row.deliveryQuantity) > 0);
    const quantityBySalesLine = new Map<string, number>();
    const serials = new Set<string>();

    if (!order.sourceLocationId) {
      errors.push("Sales order source location is required before delivery.");
    }

    if (positiveRows.length === 0) {
      errors.push("At least one delivery quantity is required.");
    }

    for (const row of positiveRows) {
      const quantity = Number(row.deliveryQuantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(`${row.sku} has an invalid delivery quantity.`);
        continue;
      }

      quantityBySalesLine.set(row.salesOrderLineId, (quantityBySalesLine.get(row.salesOrderLineId) ?? 0) + quantity);

      if (row.trackingMode === "serial") {
        if (quantity !== 1) {
          errors.push(`${row.sku} serial rows must have quantity 1.`);
        }

        if (!row.serialNo.trim()) {
          errors.push(`${row.sku} requires a serial selection.`);
        } else if (serials.has(row.serialNo.trim())) {
          errors.push(`Serial ${row.serialNo.trim()} is duplicated in this delivery.`);
        }

        serials.add(row.serialNo.trim());
      }

      if (row.trackingMode === "lot" && !row.lotNo.trim()) {
        errors.push(`${row.sku} requires a lot selection.`);
      }
    }

    for (const [salesOrderLineId, quantity] of quantityBySalesLine) {
      const row = rows.find((candidate) => candidate.salesOrderLineId === salesOrderLineId);

      if (row && quantity > row.remainingQuantity) {
        errors.push(`${row.sku} total split quantity cannot exceed remaining quantity ${row.remainingQuantity}.`);
      }
    }

    return [...new Set(errors)];
  }, [order.sourceLocationId, rows]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validationErrors.length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="grid gap-5" onSubmit={handleSubmit}>
      <input type="hidden" name="salesOrderId" value={order.id} />

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Customer</p>
          <p className="mt-1 text-sm font-medium">{order.customerName}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Source Location</p>
          <p className="mt-1 text-sm font-medium">{order.sourceLocationId ? "Configured" : "Missing"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Deliverable Lines</p>
          <p className="mt-1 text-sm font-medium">{rows.length}</p>
        </div>
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
              <th className="w-32 px-2 py-2 text-right">Deliver</th>
              <th className="w-44 px-2 py-2">Serial Number</th>
              <th className="w-44 px-2 py-2">Lot Number</th>
              <th className="w-28 px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selectedSerials = new Set(
                rows
                  .filter((candidate) => candidate.key !== row.key && candidate.productId === row.productId)
                  .map((candidate) => candidate.serialNo)
                  .filter(Boolean),
              );
              const serialOptions = (serialOptionsByProduct.get(row.productId) ?? []).filter(
                (option) => option.serialNo === row.serialNo || !selectedSerials.has(option.serialNo),
              );
              const lotOptions = lotOptionsByProduct.get(row.productId) ?? [];

              return (
                <tr key={row.key} className="border-b border-border/70">
                  <td className="px-2 py-3">
                    <input type="hidden" name="salesOrderLineId" value={row.salesOrderLineId} />
                    <div className="font-medium">{row.productName}</div>
                    <div className="text-xs text-muted-foreground">{row.sku} / {row.trackingMode}</div>
                  </td>
                  <td className="px-2 py-3 text-right">{row.remainingQuantity}</td>
                  <td className="px-2 py-3">
                    <input
                      name="deliveryQuantity"
                      type="number"
                      min="0"
                      max={row.remainingQuantity}
                      step="0.000001"
                      value={row.deliveryQuantity}
                      readOnly={row.trackingMode === "serial"}
                      className={`${inputClass} w-full text-right`}
                      onChange={(event) => updateRow(row.key, { deliveryQuantity: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-3">
                    {row.trackingMode === "serial" ? (
                      <select
                        name="serialNo"
                        required
                        value={row.serialNo}
                        className={`${inputClass} w-full`}
                        onChange={(event) => updateRow(row.key, { serialNo: event.target.value })}
                      >
                        <option value="">Select serial</option>
                        {serialOptions.map((option) => (
                          <option key={option.id} value={option.serialNo}>
                            {optionLabel(option.serialNo, option.quantityAvailable)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input type="hidden" name="serialNo" value="" />
                        <span className="text-muted-foreground">-</span>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {row.trackingMode === "lot" ? (
                      <select
                        name="lotNo"
                        required
                        value={row.lotNo}
                        className={`${inputClass} w-full`}
                        onChange={(event) => updateRow(row.key, { lotNo: event.target.value })}
                      >
                        <option value="">Select lot</option>
                        {lotOptions.map((option) => (
                          <option key={option.id} value={option.lotNo}>
                            {optionLabel(option.lotNo, option.quantityAvailable)}
                          </option>
                        ))}
                      </select>
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
              );
            })}
          </tbody>
        </table>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={validationErrors.length > 0}>
          Create Draft Delivery
        </Button>
      </DialogFooter>
    </form>
  );
}
