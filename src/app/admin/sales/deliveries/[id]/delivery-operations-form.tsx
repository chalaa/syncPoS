"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DeliveryDetail, DeliveryLotOption, DeliverySerialOption } from "@/server/sales/types";

type DeliveryRow = {
  key: string;
  deliveryLineId: string | null;
  salesOrderLineId: string;
  productId: string;
  productName: string;
  sku: string;
  trackingMode: "none" | "lot" | "serial";
  quantityOrdered: string | null;
  quantityAlreadyDelivered: string | null;
  quantityDelivered: string;
  serialNo: string;
  lotNo: string;
};

function inputClass() {
  return "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

function optionLabel(value: string, quantityAvailable: string) {
  return `${value} / Available ${quantityAvailable}`;
}

function newSplitRow(line: DeliveryRow): DeliveryRow {
  return {
    ...line,
    key: crypto.randomUUID(),
    deliveryLineId: null,
    quantityDelivered: line.trackingMode === "serial" ? "1" : "0",
    serialNo: "",
    lotNo: "",
  };
}

export function DeliveryOperationsForm({
  delivery,
  isDraft,
  action,
}: {
  delivery: DeliveryDetail;
  isDraft: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const { serialOptions, lotOptions } = delivery;
  const [rows, setRows] = useState<DeliveryRow[]>(() =>
    delivery.lines.map((line) => ({
      key: line.id,
      deliveryLineId: line.id,
      salesOrderLineId: line.salesOrderLineId ?? "",
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      trackingMode: line.trackingMode,
      quantityOrdered: line.quantityOrdered,
      quantityAlreadyDelivered: line.quantityAlreadyDelivered,
      quantityDelivered: line.trackingMode === "serial" ? "1" : line.quantityDelivered,
      serialNo: line.serialNo ?? "",
      lotNo: line.lotNo ?? "",
    })),
  );
  const serialOptionsByProduct = useMemo(() => {
    const map = new Map<string, DeliverySerialOption[]>();
    for (const option of serialOptions) {
      map.set(option.productId, [...(map.get(option.productId) ?? []), option]);
    }
    return map;
  }, [serialOptions]);
  const lotOptionsByProduct = useMemo(() => {
    const map = new Map<string, DeliveryLotOption[]>();
    for (const option of lotOptions) {
      map.set(option.productId, [...(map.get(option.productId) ?? []), option]);
    }
    return map;
  }, [lotOptions]);

  function updateRow(key: string, patch: Partial<DeliveryRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addSplit(line: DeliveryRow) {
    setRows((current) => {
      const index = current.findIndex((row) => row.key === line.key);
      const next = [...current];
      next.splice(index + 1, 0, newSplitRow(line));
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  const validationErrors = useMemo(() => {
    if (!isDraft) {
      return [];
    }

    const errors: string[] = [];
    const positiveRows = rows.filter((row) => Number(row.quantityDelivered) > 0);
    const quantityBySalesLine = new Map<string, number>();
    const serials = new Set<string>();

    if (positiveRows.length === 0) {
      errors.push("At least one delivery quantity is required.");
    }

    for (const row of positiveRows) {
      const quantity = Number(row.quantityDelivered);
      const ordered = Number(row.quantityOrdered ?? 0);
      const alreadyDelivered = Number(row.quantityAlreadyDelivered ?? 0);
      const remaining = Math.max(ordered - alreadyDelivered, 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(`${row.sku} has an invalid delivery quantity.`);
        continue;
      }

      quantityBySalesLine.set(
        row.salesOrderLineId,
        (quantityBySalesLine.get(row.salesOrderLineId) ?? 0) + quantity,
      );

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

      if (quantity > remaining) {
        errors.push(`${row.sku} delivery quantity cannot exceed remaining quantity ${remaining}.`);
      }
    }

    for (const [salesOrderLineId, quantity] of quantityBySalesLine) {
      const row = rows.find((candidate) => candidate.salesOrderLineId === salesOrderLineId);
      const remaining = Math.max(
        Number(row?.quantityOrdered ?? 0) - Number(row?.quantityAlreadyDelivered ?? 0),
        0,
      );

      if (row && quantity > remaining) {
        errors.push(`${row.sku} total split quantity cannot exceed remaining quantity ${remaining}.`);
      }
    }

    return [...new Set(errors)];
  }, [isDraft, rows]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validationErrors.length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit}>
      <input type="hidden" name="deliveryId" value={delivery.id} />
      {validationErrors.length > 0 ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {validationErrors[0]}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 text-right">Ordered</th>
              <th className="px-2 py-2 text-right">Already Delivered</th>
              <th className="px-2 py-2 text-right">Deliver</th>
              <th className="px-2 py-2">Serial</th>
              <th className="px-2 py-2">Lot</th>
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
                    <input type="hidden" name="deliveryLineId" value={row.deliveryLineId ?? ""} />
                    <input type="hidden" name="salesOrderLineId" value={row.salesOrderLineId} />
                    <div className="font-medium">{row.productName}</div>
                    <div className="text-xs text-muted-foreground">{row.sku} / {row.trackingMode}</div>
                  </td>
                  <td className="px-2 py-3 text-right">{row.quantityOrdered ?? "-"}</td>
                  <td className="px-2 py-3 text-right">{row.quantityAlreadyDelivered ?? "-"}</td>
                  <td className="px-2 py-3">
                    <input
                      name="quantityDelivered"
                      type="number"
                      min="0"
                      step="0.000001"
                      value={row.quantityDelivered}
                      readOnly={!isDraft || row.trackingMode === "serial"}
                      className={`${inputClass()} text-right`}
                      onChange={(event) => updateRow(row.key, { quantityDelivered: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-3">
                    {row.trackingMode === "serial" ? (
                      <select
                        name="serialNo"
                        required={isDraft}
                        value={row.serialNo}
                        disabled={!isDraft}
                        className={inputClass()}
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
                        required={isDraft}
                        value={row.lotNo}
                        disabled={!isDraft}
                        className={inputClass()}
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
                    {isDraft ? (
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
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isDraft ? (
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={validationErrors.length > 0}>
            Post Delivery
          </Button>
        </div>
      ) : null}
    </form>
  );
}
