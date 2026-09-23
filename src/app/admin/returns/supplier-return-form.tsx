"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { ReturnFormOption, ReturnReceiptOption, SupplierReturnableLine } from "@/server/returns/types";

type SupplierReturnRow = SupplierReturnableLine & {
  key: string;
  returnQuantity: string;
  condition: "available" | "returned" | "damaged" | "scrapped";
  notes: string;
};

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";

function money(valueMinor: number, currencyCode: string) {
  return `${currencyCode} ${(valueMinor / 100).toFixed(2)}`;
}

function createRow(line: SupplierReturnableLine): SupplierReturnRow {
  return {
    ...line,
    key: line.id,
    returnQuantity: "0",
    condition: "returned",
    notes: "",
  };
}

function splitRow(row: SupplierReturnRow): SupplierReturnRow {
  return {
    ...row,
    key: crypto.randomUUID(),
    returnQuantity: "0",
    condition: "returned",
    notes: "",
  };
}

export function SupplierReturnForm({
  action,
  purchaseOrders,
  receipts,
  locations,
  lines,
  initialPurchaseOrderId,
  initialGoodsReceiptId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  purchaseOrders: ReturnFormOption[];
  receipts: ReturnReceiptOption[];
  locations: ReturnFormOption[];
  lines: SupplierReturnableLine[];
  initialPurchaseOrderId?: string;
  initialGoodsReceiptId?: string;
}) {
  const { t } = useTranslation();
  const validInitialGoodsReceiptId = receipts.some((receipt) => receipt.id === initialGoodsReceiptId) ? initialGoodsReceiptId ?? "" : "";
  const initialReceipt = receipts.find((receipt) => receipt.id === validInitialGoodsReceiptId);
  const validInitialPurchaseOrderId =
    purchaseOrders.some((order) => order.id === initialPurchaseOrderId)
      ? initialPurchaseOrderId ?? ""
      : initialReceipt?.purchaseOrderId ?? "";
  const initialLines = validInitialGoodsReceiptId
    ? lines.filter((line) => line.goodsReceiptId === validInitialGoodsReceiptId)
    : [];
  const [purchaseOrderId, setPurchaseOrderId] = useState(validInitialPurchaseOrderId);
  const [goodsReceiptId, setGoodsReceiptId] = useState(validInitialGoodsReceiptId);
  const [sourceLocationId, setSourceLocationId] = useState(initialLines[0]?.sourceLocationId ?? "");
  const [rows, setRows] = useState<SupplierReturnRow[]>(() => initialLines.map(createRow));

  const selectedReceipt = receipts.find((receipt) => receipt.id === goodsReceiptId);
  const filteredReceipts = useMemo(
    () => receipts.filter((receipt) => receipt.purchaseOrderId === purchaseOrderId),
    [purchaseOrderId, receipts],
  );

  function changePurchaseOrder(nextPurchaseOrderId: string) {
    setPurchaseOrderId(nextPurchaseOrderId);
    setGoodsReceiptId("");
    setSourceLocationId("");
    setRows([]);
  }

  function changeReceipt(nextGoodsReceiptId: string) {
    const nextLines = lines.filter((line) => line.goodsReceiptId === nextGoodsReceiptId);
    setGoodsReceiptId(nextGoodsReceiptId);
    setSourceLocationId(nextLines[0]?.sourceLocationId ?? "");
    setRows(nextLines.map(createRow));
  }

  function updateRow(key: string, patch: Partial<SupplierReturnRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addSplit(row: SupplierReturnRow) {
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

    if (!goodsReceiptId) {
      errors.push(t("return.error.receiptRequired", "Purchase receipt is required."));
    }

    if (!purchaseOrderId) {
      errors.push(t("return.error.purchaseRefRequired", "Purchase reference is required."));
    }

    if (!sourceLocationId) {
      errors.push(t("return.error.sourceLocationRequired", "Source location is required."));
    }

    if (goodsReceiptId && positiveRows.length === 0) {
      errors.push(t("return.error.quantityRequired", "At least one return quantity is required."));
    }

    for (const row of positiveRows) {
      const quantity = Number(row.returnQuantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(`${row.sku} ${t("return.error.invalidQuantitySuffix", "has an invalid return quantity.")}`);
        continue;
      }

      quantityByLine.set(row.id, (quantityByLine.get(row.id) ?? 0) + quantity);

      if (row.trackingMode === "serial" && quantity !== 1) {
        errors.push(`${row.sku} ${t("return.error.serialQuantitySuffix", "serial return quantity must be 1.")}`);
      }
    }

    for (const [lineId, quantity] of quantityByLine) {
      const row = rows.find((candidate) => candidate.id === lineId);

      if (row && quantity > Number(row.quantityRemaining)) {
        errors.push(
          `${row.sku} ${t("return.error.exceedsRemainingPrefix", "total return quantity cannot exceed remaining")} ${row.quantityRemaining}.`,
        );
      }
    }

    return [...new Set(errors)];
  }, [goodsReceiptId, purchaseOrderId, rows, sourceLocationId, t]);

  const refundTotalMinor = rows.reduce((total, row) => total + Math.round(row.unitRefundMinor * Number(row.returnQuantity || 0)), 0);
  const currencyCode = rows[0]?.currencyCode ?? "ETB";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (validationErrors.length > 0) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("return.purchaseReference", "Purchase Reference")}</span>
          <select required value={purchaseOrderId} className={inputClass} onChange={(event) => changePurchaseOrder(event.target.value)}>
            <option value="">{t("return.selectPurchaseOrder", "Select purchase order")}</option>
            {purchaseOrders.map((order) => (
              <option key={order.id} value={order.id}>{order.code} - {order.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("return.purchaseReceipt", "Purchase Receipt")}</span>
          <select name="goodsReceiptId" required value={goodsReceiptId} className={inputClass} onChange={(event) => changeReceipt(event.target.value)} disabled={!purchaseOrderId}>
            <option value="">{t("return.selectReceipt", "Select receipt")}</option>
            {filteredReceipts.map((receipt) => (
              <option key={receipt.id} value={receipt.id}>{receipt.code} - {receipt.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t("return.sourceLocation", "Source Location")}</span>
          <input type="hidden" name="sourceLocationId" value={sourceLocationId} />
          <select disabled value={sourceLocationId} className={inputClass}>
            <option value="">{t("return.selectReceiptFirst", "Select receipt first")}</option>
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
              <th className="px-2 py-2">{t("Product", "Product")}</th>
              <th className="px-2 py-2">{t("field.trackingMode", "Tracking")}</th>
              <th className="px-2 py-2 text-right">{t("status.received", "Received")}</th>
              <th className="px-2 py-2 text-right">{t("status.returned", "Returned")}</th>
              <th className="px-2 py-2 text-right">{t("return.remainingCol", "Remaining")}</th>
              <th className="w-32 px-2 py-2 text-right">{t("return.returnCol", "Return")}</th>
              <th className="px-2 py-2">{t("return.condition", "Condition")}</th>
              <th className="px-2 py-2">{t("return.serialLot", "Serial/Lot")}</th>
              <th className="px-2 py-2 text-right">{t("return.refund", "Refund")}</th>
              <th className="w-28 px-2 py-2 text-right">{t("action.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border/70">
                <td className="px-2 py-3">
                  <input type="hidden" name="goodsReceiptLineId" value={row.id} />
                  <div className="font-medium">{row.productName}</div>
                  <div className="text-xs text-muted-foreground">{row.sku}</div>
                </td>
                <td className="px-2 py-3 capitalize">{t(`status.${row.trackingMode}`, row.trackingMode)}</td>
                <td className="px-2 py-3 text-right">{row.quantityReceived}</td>
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
                    onChange={(event) => updateRow(row.key, { condition: event.target.value as SupplierReturnRow["condition"] })}
                  >
                    <option value="available">{t("status.available", "Available")}</option>
                    <option value="returned">{t("status.returned", "Returned")}</option>
                    <option value="damaged">{t("status.damaged", "Damaged")}</option>
                    <option value="scrapped">{t("status.scrapped", "Scrapped")}</option>
                  </select>
                </td>
                <td className="px-2 py-3">{row.serialNo ?? row.lotNo ?? t("return.bulk", "Bulk")}</td>
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
                  {selectedReceipt
                    ? t("return.noLinesForReceipt", "No returnable lines remain for this receipt.")
                    : t("return.selectReceiptHint", "Select a receipt to load returnable lines.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("return.calculatedRefund", "Calculated refund")} </span>
          <span className="font-semibold">{money(refundTotalMinor, currencyCode)}</span>
        </div>
      </div>

      <label className="mt-5 block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{t("field.notes", "Notes")}</span>
        <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
      </label>

      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={validationErrors.length > 0}>{t("action.createReturn", "Create Return")}</Button>
      </div>
    </form>
  );
}
