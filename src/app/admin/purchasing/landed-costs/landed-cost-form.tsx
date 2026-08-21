"use client";

import { CalculatorIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import type {
  PurchaseLandedCostDetail,
  PurchaseLandedCostFormOptions,
  PurchaseLandedCostFormReceiptLine,
} from "@/server/purchasing/types";

type LandedCostMutation = (formData: FormData) => Promise<void>;

type LandedCostFormProps = {
  action: LandedCostMutation;
  options: PurchaseLandedCostFormOptions;
  cost?: PurchaseLandedCostDetail;
  initialReceiptId?: string;
  submitLabel: string;
};

const inputClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function minorToInput(value: number) {
  return (value / 100).toFixed(2);
}

function parseAmountMinor(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function displayMinor(value: number, currencyCode: string) {
  return `${currencyCode} ${(value / 100).toFixed(2)}`;
}

function allocateAutomatic(
  amountMinor: number,
  lines: PurchaseLandedCostFormReceiptLine[],
  method: "quantity" | "value",
) {
  const basisValues = lines.map((line) => (method === "quantity" ? Number(line.quantityReceived) : line.lineTotalMinor));
  const totalBasis = basisValues.reduce((sum, value) => sum + value, 0);
  let allocatedTotal = 0;

  return lines.map((line, index) => {
    const allocatedAmountMinor =
      index === lines.length - 1
        ? amountMinor - allocatedTotal
        : totalBasis > 0
          ? Math.floor((amountMinor * basisValues[index]) / totalBasis)
          : 0;
    allocatedTotal += allocatedAmountMinor;

    return {
      lineId: line.id,
      basis: basisValues[index],
      allocatedAmountMinor,
    };
  });
}

export function LandedCostForm({
  action,
  options,
  cost,
  initialReceiptId,
  submitLabel,
}: LandedCostFormProps) {
  const initialManualAmounts = useMemo(() => {
    const entries = cost?.allocations.map((allocation) => [
      allocation.goodsReceiptLineId,
      minorToInput(allocation.allocatedAmountMinor),
    ]);

    return Object.fromEntries(entries ?? []) as Record<string, string>;
  }, [cost]);
  const [receiptId, setReceiptId] = useState(cost?.goodsReceiptId ?? initialReceiptId ?? "");
  const [allocationMethod, setAllocationMethod] = useState<"quantity" | "value" | "manual">(
    (cost?.allocationMethod as "quantity" | "value" | "manual" | undefined) ?? "value",
  );
  const [amount, setAmount] = useState(cost ? minorToInput(cost.amountMinor) : "");
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(initialManualAmounts);
  const receipt = options.receipts.find((row) => row.id === receiptId);
  const amountMinor = parseAmountMinor(amount);
  const automaticAllocations = receipt && allocationMethod !== "manual"
    ? allocateAutomatic(amountMinor, receipt.lines, allocationMethod)
    : [];
  const manualTotalMinor = receipt
    ? receipt.lines.reduce((sum, line) => sum + parseAmountMinor(manualAmounts[line.id] ?? "0"), 0)
    : 0;
  const previewTotalMinor =
    allocationMethod === "manual"
      ? manualTotalMinor
      : automaticAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmountMinor, 0);
  const currencyCode = receipt?.currencyCode ?? cost?.currencyCode ?? "ETB";

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <form action={action} className="grid gap-5">
        {cost ? <input type="hidden" name="landedCostId" value={cost.id} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Receipt
            <select
              name="goodsReceiptId"
              required
              value={receiptId}
              onChange={(event) => setReceiptId(event.target.value)}
              className={inputClass}
              disabled={cost?.status === "posted"}
            >
              <option value="">Select receipt</option>
              {options.receipts.map((receiptOption) => (
                <option key={receiptOption.id} value={receiptOption.id}>
                  {receiptOption.receiptNo} / {receiptOption.orderNo} / {receiptOption.supplierName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Vendor
            <select name="vendorId" defaultValue={cost?.vendorId ?? ""} className={inputClass} disabled={cost?.status === "posted"}>
              <option value="">No separate vendor</option>
              {options.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.code} / {vendor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Cost Type
            <select name="costType" defaultValue={cost?.costType ?? "freight"} className={inputClass} disabled={cost?.status === "posted"}>
              <option value="freight">Freight</option>
              <option value="customs">Customs</option>
              <option value="insurance">Insurance</option>
              <option value="handling">Handling</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Allocation
            <select
              name="allocationMethod"
              value={allocationMethod}
              onChange={(event) => setAllocationMethod(event.target.value as "quantity" | "value" | "manual")}
              className={inputClass}
              disabled={cost?.status === "posted"}
            >
              <option value="value">By value</option>
              <option value="quantity">By quantity</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Amount
            <input
              name="amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className={inputClass}
              disabled={cost?.status === "posted"}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Notes
          <textarea
            name="notes"
            rows={4}
            defaultValue={cost?.notes ?? ""}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={cost?.status === "posted"}
          />
        </label>

        {receipt ? (
          <div className="rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div className="flex items-center gap-2">
                <CalculatorIcon className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Allocation Preview</h2>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Preview total </span>
                <span className="font-semibold">{displayMinor(previewTotalMinor, currencyCode)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Receipt Value</th>
                    <th className="px-3 py-2 text-right">Basis</th>
                    <th className="px-3 py-2 text-right">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.lines.map((line) => {
                    const automatic = automaticAllocations.find((allocation) => allocation.lineId === line.id);
                    const allocationMinor =
                      allocationMethod === "manual"
                        ? parseAmountMinor(manualAmounts[line.id] ?? "0")
                        : automatic?.allocatedAmountMinor ?? 0;

                    return (
                      <tr key={line.id} className="border-b border-border/70">
                        <td className="px-3 py-3">
                          <input type="hidden" name="manualGoodsReceiptLineId" value={line.id} />
                          <div className="font-medium">{line.productName}</div>
                          <div className="text-xs text-muted-foreground">{line.sku}</div>
                        </td>
                        <td className="px-3 py-3 text-right">{line.quantityReceived}</td>
                        <td className="px-3 py-3 text-right">{displayMinor(line.lineTotalMinor, line.currencyCode)}</td>
                        <td className="px-3 py-3 text-right">
                          {allocationMethod === "quantity" ? line.quantityReceived : allocationMethod === "value" ? line.lineTotalMinor : "-"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {allocationMethod === "manual" ? (
                            <input
                              name="manualAllocationAmount"
                              inputMode="decimal"
                              value={manualAmounts[line.id] ?? ""}
                              onChange={(event) =>
                                setManualAmounts((current) => ({ ...current, [line.id]: event.target.value }))
                              }
                              className="h-9 w-32 rounded-md border border-input bg-background px-2 text-right text-sm"
                              disabled={cost?.status === "posted"}
                            />
                          ) : (
                            displayMinor(allocationMinor, line.currencyCode)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <ButtonLink href={cost ? `/admin/purchasing/landed-costs/${cost.id}` : "/admin/purchasing?view=landed-costs"} variant="outline">
            Cancel
          </ButtonLink>
          {cost?.status === "posted" ? null : <Button disabled={!receipt || receipt.lines.length === 0}>{submitLabel}</Button>}
        </div>
      </form>
    </section>
  );
}
