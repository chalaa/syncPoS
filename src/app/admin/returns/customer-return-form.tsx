"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CustomerReturnableLine, ReturnFormOption } from "@/server/returns/types";

type CustomerReturnRow = CustomerReturnableLine & {
  key: string;
  returnQuantity: string;
  condition: "available" | "returned" | "damaged" | "scrapped";
  notes: string;
};

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function money(valueMinor: number, currencyCode: string) {
  return `${currencyCode} ${(valueMinor / 100).toFixed(2)}`;
}

function createRow(line: CustomerReturnableLine): CustomerReturnRow {
  return {
    ...line,
    key: line.id,
    returnQuantity: "0",
    condition: "returned",
    notes: "",
  };
}

function splitRow(row: CustomerReturnRow): CustomerReturnRow {
  return {
    ...row,
    key: crypto.randomUUID(),
    returnQuantity: "0",
    condition: "returned",
    notes: "",
  };
}

export function CustomerReturnForm({
  action,
  salesOrders,
  locations,
  lines,
  initialSalesOrderId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  salesOrders: ReturnFormOption[];
  locations: ReturnFormOption[];
  lines: CustomerReturnableLine[];
  initialSalesOrderId?: string;
}) {
  const validInitialSalesOrderId = salesOrders.some((order) => order.id === initialSalesOrderId) ? initialSalesOrderId ?? "" : "";
  const [salesOrderId, setSalesOrderId] = useState(validInitialSalesOrderId);
  const [rows, setRows] = useState<CustomerReturnRow[]>(() =>
    validInitialSalesOrderId
      ? lines.filter((line) => line.salesOrderId === validInitialSalesOrderId).map(createRow)
      : [],
  );

  const selectedOrder = salesOrders.find((order) => order.id === salesOrderId);

  function changeOrder(nextSalesOrderId: string) {
    setSalesOrderId(nextSalesOrderId);
    setRows(lines.filter((line) => line.salesOrderId === nextSalesOrderId).map(createRow));
  }

  function updateRow(key: string, patch: Partial<CustomerReturnRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addSplit(row: CustomerReturnRow) {
    setRows((current) => {
      const index = current.findIndex((candidate) => candidate.key === row.key);
      const next = [...current];
      next.splice(index + 1, 0, splitRow(row));
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const positiveRows = rows.filter((row) => Number(row.returnQuantity) > 0);
    const quantityByLine = new Map<string, number>();

    if (!salesOrderId) {
      errors.push("Original sales order is required.");
    }

    if (salesOrderId && positiveRows.length === 0) {
      errors.push("At least one return quantity is required.");
    }

    for (const row of positiveRows) {
      const quantity = Number(row.returnQuantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(`${row.sku} has an invalid return quantity.`);
        continue;
      }

      quantityByLine.set(row.id, (quantityByLine.get(row.id) ?? 0) + quantity);

      if (row.trackingMode === "serial" && quantity !== 1) {
        errors.push(`${row.sku} serial return quantity must be 1.`);
      }
    }

    for (const [lineId, quantity] of quantityByLine) {
      const row = rows.find((candidate) => candidate.id === lineId);

      if (row && quantity > Number(row.quantityRemaining)) {
        errors.push(`${row.sku} total return quantity cannot exceed remaining ${row.quantityRemaining}.`);
      }
    }

    return [...new Set(errors)];
  }, [rows, salesOrderId]);

  const refundTotalMinor = rows.reduce((total, row) => total + Math.round(row.unitRefundMinor * Number(row.returnQuantity || 0)), 0);
  const currencyCode = rows[0]?.currencyCode ?? "ETB";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validationErrors.length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Original Sales Order</span>
          <select name="salesOrderId" required value={salesOrderId} className={inputClass} onChange={(event) => changeOrder(event.target.value)}>
            <option value="">Select sales order</option>
            {salesOrders.map((order) => (
              <option key={order.id} value={order.id}>{order.code} - {order.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Return Location</span>
          <select name="destinationLocationId" required defaultValue="" className={inputClass}>
            <option value="" disabled>Select location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
            ))}
          </select>
        </label>
      </div>

      {validationErrors.length > 0 ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {validationErrors[0]}
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2">Tracking</th>
              <th className="px-2 py-2 text-right">Delivered</th>
              <th className="px-2 py-2 text-right">Returned</th>
              <th className="px-2 py-2 text-right">Remaining</th>
              <th className="w-32 px-2 py-2 text-right">Return</th>
              <th className="px-2 py-2">Condition</th>
              <th className="px-2 py-2">Serial/Lot</th>
              <th className="px-2 py-2 text-right">Refund</th>
              <th className="w-28 px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border/70">
                <td className="px-2 py-3">
                  <input type="hidden" name="deliveryLineId" value={row.id} />
                  <div className="font-medium">{row.productName}</div>
                  <div className="text-xs text-muted-foreground">{row.sku}</div>
                </td>
                <td className="px-2 py-3 capitalize">{row.trackingMode}</td>
                <td className="px-2 py-3 text-right">{row.quantityDelivered}</td>
                <td className="px-2 py-3 text-right">{row.quantityReturned}</td>
                <td className="px-2 py-3 text-right">{row.quantityRemaining}</td>
                <td className="px-2 py-3">
                  <input
                    name="returnQuantity"
                    type="number"
                    min="0"
                    max={row.quantityRemaining}
                    step="0.000001"
                    value={row.returnQuantity}
                    className={`${inputClass} text-right`}
                    onChange={(event) => updateRow(row.key, { returnQuantity: event.target.value })}
                  />
                </td>
                <td className="px-2 py-3">
                  <select
                    name="condition"
                    value={row.condition}
                    className={inputClass}
                    onChange={(event) => updateRow(row.key, { condition: event.target.value as CustomerReturnRow["condition"] })}
                  >
                    <option value="available">Available</option>
                    <option value="returned">Returned</option>
                    <option value="damaged">Damaged</option>
                    <option value="scrapped">Scrapped</option>
                  </select>
                </td>
                <td className="px-2 py-3">{row.serialNo ?? row.lotNo ?? "Bulk"}</td>
                <td className="px-2 py-3 text-right">{money(Math.round(row.unitRefundMinor * Number(row.returnQuantity || 0)), row.currencyCode)}</td>
                <td className="px-2 py-3">
                  <div className="flex justify-end gap-2">
                    {row.trackingMode !== "serial" ? (
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
                <td colSpan={10} className="px-2 py-8 text-center text-muted-foreground">
                  {selectedOrder ? "No returnable lines remain for this sales order." : "Select a sales order to load returnable lines."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Calculated refund </span>
          <span className="font-semibold">{money(refundTotalMinor, currencyCode)}</span>
        </div>
      </div>

      <label className="mt-5 block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </label>

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={validationErrors.length > 0}>Create Return</Button>
      </div>
    </form>
  );
}
