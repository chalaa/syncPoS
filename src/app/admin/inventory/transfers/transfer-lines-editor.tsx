"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { TransferFormOptions } from "@/server/transfers/types";

type TransferLineDraft = {
  id: string;
  productId: string;
  quantityRequested: string;
  serialNo: string;
  lotNo: string;
  notes: string;
};

function inputClass() {
  return "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

function createLine(): TransferLineDraft {
  return {
    id: crypto.randomUUID(),
    productId: "",
    quantityRequested: "",
    serialNo: "",
    lotNo: "",
    notes: "",
  };
}

export function TransferLinesEditor({ products }: { products: TransferFormOptions["products"] }) {
  const [lines, setLines] = useState<TransferLineDraft[]>(() => [createLine()]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  function updateLine(id: string, values: Partial<TransferLineDraft>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== id) {
          return line;
        }

        const next = { ...line, ...values };
        const selectedProduct = values.productId ? productById.get(values.productId) : productById.get(next.productId);

        if (values.productId && selectedProduct?.trackingMode === "serial") {
          next.quantityRequested = "1";
          next.lotNo = "";
        }

        if (values.productId && selectedProduct?.trackingMode === "lot") {
          next.serialNo = "";
        }

        if (values.productId && selectedProduct?.trackingMode === "none") {
          next.serialNo = "";
          next.lotNo = "";
        }

        return next;
      }),
    );
  }

  function addLine() {
    setLines((current) => [...current, createLine()]);
  }

  function removeLine(id: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : [createLine()]));
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2">Product</th>
            <th className="px-2 py-2 text-right">Quantity</th>
            <th className="px-2 py-2">Serial</th>
            <th className="px-2 py-2">Lot</th>
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

            return (
              <tr key={line.id} className="border-b border-border/70 align-top">
                <td className="px-2 py-3">
                  <select
                    name="productId"
                    value={line.productId}
                    onChange={(event) => updateLine(line.id, { productId: event.target.value })}
                    className={inputClass()}
                  >
                    <option value="">Select product</option>
                    {products.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.code} - {option.name} ({option.trackingMode})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Tracking: {trackingMode}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <input
                    name="quantityRequested"
                    type="number"
                    min="0"
                    step="0.000001"
                    value={line.quantityRequested}
                    readOnly={trackingMode === "serial"}
                    onChange={(event) => updateLine(line.id, { quantityRequested: event.target.value })}
                    className={`${inputClass()} text-right`}
                  />
                </td>
                <td className="px-2 py-3">
                  <input
                    name="serialNo"
                    value={line.serialNo}
                    readOnly={trackingMode !== "serial"}
                    placeholder={trackingMode === "serial" ? "Serial number" : "-"}
                    onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                    className={inputClass()}
                  />
                </td>
                <td className="px-2 py-3">
                  <input
                    name="lotNo"
                    value={line.lotNo}
                    readOnly={trackingMode !== "lot"}
                    placeholder={trackingMode === "lot" ? "Lot number" : "-"}
                    onChange={(event) => updateLine(line.id, { lotNo: event.target.value })}
                    className={inputClass()}
                  />
                </td>
                <td className="px-2 py-3">
                  <input
                    name="lineNotes"
                    value={line.notes}
                    onChange={(event) => updateLine(line.id, { notes: event.target.value })}
                    className={inputClass()}
                  />
                </td>
                <td className="px-2 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove transfer line"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3">
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <PlusIcon data-icon="inline-start" />
          Add line
        </Button>
      </div>
    </div>
  );
}
