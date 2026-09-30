"use client";

import { Check, Pencil, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { cn } from "@/lib/utils";
import type { TransferFormOptions } from "@/server/transfers/types";
import { useTranslation } from "@/lib/i18n/use-translation";

type TransferLineDraft = {
  id: string;
  productId: string;
  quantityRequested: string;
  serialNo: string;
  lotNo: string;
  notes: string;
};

const inputClass =
  "h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-medium outline-none focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 transition-all font-sans";

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
  const { t } = useTranslation();
  const [lines, setLines] = useState<TransferLineDraft[]>(() => [createLine()]);
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

  const [editingLineIds, setEditingLineIds] = useState<Set<string>>(() => new Set([lines[0]?.id ?? ""]));

  function toggleEdit(id: string) {
    setEditingLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    if (lines.some((l) => !l.productId)) {
      return;
    }
    const newLine = createLine();
    setLines((current) => [...current, newLine]);
    setEditingLineIds(new Set([newLine.id]));
  }

  function removeLine(id: string) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : [createLine()]));
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="grid gap-3.5">
        {lines.map((line, index) => {
          const product = productById.get(line.productId);
          const trackingMode = product?.trackingMode ?? "none";
          const isEditing = editingLineIds.has(line.id) || !line.productId;

          if (!isEditing) {
            return (
              <div
                key={line.id}
                className="group relative rounded-xl border border-border/70 bg-card/80 px-3.5 py-2.5 shadow-xs transition-all duration-200 hover:border-[#0B5D4B]/40 hover:bg-card flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 font-mono text-[11px] font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {product ? product.name : <span className="text-muted-foreground italic">{t("inventory.noProductSelected", "No product selected")}</span>}
                      </h4>
                      {product?.code ? (
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                          {product.code}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                      <span>{t("table.qty", "Quantity")}: <strong className="text-[#0B5D4B] dark:text-emerald-400 font-bold">{line.quantityRequested || "0"}</strong></span>
                      {line.serialNo ? (
                        <>
                          <span>•</span>
                          <span>Serial: <strong className="text-foreground">{line.serialNo}</strong></span>
                        </>
                      ) : null}
                      {line.lotNo ? (
                        <>
                          <span>•</span>
                          <span>Lot: <strong className="text-foreground">{line.lotNo}</strong></span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleEdit(line.id)}
                    className="size-7 text-[#0B5D4B] hover:bg-emerald-500/10 hover:text-[#0B5D4B] active:scale-95 transition-all"
                    title={t("action.editItem", "Edit item")}
                  >
                    <Pencil className="size-3.5" />
                    <span className="sr-only">{t("action.editItem", "Edit item")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(line.id)}
                    className="size-7 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-20 transition-all"
                    title={t("action.removeItem", "Remove item")}
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only">{t("action.removeItem", "Remove item")}</span>
                  </Button>
                </div>

                {/* Hidden inputs to ensure form data submission includes line values */}
                <input type="hidden" name="productId" value={line.productId} />
                <input type="hidden" name="quantityRequested" value={line.quantityRequested} />
                <input type="hidden" name="lineNotes" value={line.notes} />
                <input type="hidden" name="serialNo" value={line.serialNo} />
                <input type="hidden" name="lotNo" value={line.lotNo} />
              </div>
            );
          }

          return (
            <div
              key={line.id}
              style={{ zIndex: lines.length - index + 10 }}
              className="group relative rounded-2xl border border-border/80 bg-card px-3.5 pt-3 pb-2.5 shadow-2xs transition-all duration-200 hover:border-[#0B5D4B]/30 hover:shadow-xs focus-within:!z-50"
            >
              {/* Card Header: Product Name + Quantity */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 sm:gap-3">
                <span className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-bold text-[#0B5D4B] dark:text-emerald-300 border border-emerald-500/20">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <input type="hidden" name="productId" value={line.productId} />
                  <RelatedModelSelect
                    value={line.productId}
                    options={productSelectOptions}
                    placeholder={t("action.searchProducts", "Search product by name, SKU, or brand...")}
                    emptyLabel={t("inventory.noProductsFound", "No products found.")}
                    onValueChange={(val) => updateLine(line.id, { productId: val })}
                    inputClassName="h-10 rounded-xl text-xs font-semibold w-full"
                  />
                  {line.productId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground pl-0.5">
                      <span>{t("field.trackingMode", "Tracking")}: <strong className="text-foreground">{trackingMode}</strong></span>
                    </div>
                  ) : null}
                </div>

                {/* Quantity Field */}
                <div className="w-28 sm:w-36 shrink-0 space-y-1">
                  <div className="relative flex items-center h-10">
                    <input
                      name="quantityRequested"
                      type="number"
                      min="0"
                      step="0.000001"
                      value={line.quantityRequested}
                      readOnly={trackingMode === "serial"}
                      placeholder="0"
                      onChange={(event) => updateLine(line.id, { quantityRequested: event.target.value })}
                      className={cn(inputClass, "font-mono font-bold text-foreground pr-10 text-right h-10")}
                    />
                    <span className="pointer-events-none absolute right-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Qty
                    </span>
                  </div>
                </div>

                <div className="flex h-10 items-center gap-1 shrink-0">
                  {line.productId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleEdit(line.id)}
                      className="size-8 rounded-lg text-[#0B5D4B] hover:bg-emerald-500/10 dark:text-emerald-400"
                      title={t("action.done", "Done")}
                    >
                      <Check className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove transfer line"
                    className="size-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Hidden tracking & note inputs for index alignment */}
              <input type="hidden" name="lineNotes" value={line.notes} />
              {trackingMode !== "serial" ? <input type="hidden" name="serialNo" value="" /> : null}
              {trackingMode !== "lot" ? <input type="hidden" name="lotNo" value="" /> : null}

              {/* Serial / Lot tracking inputs */}
              {trackingMode !== "none" ? (
                <div className="mt-3 pt-3 border-t border-border/40">
                  {trackingMode === "serial" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.serialNo", "Serial No")}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="serialNo"
                        value={line.serialNo}
                        placeholder={t("inventory.enterSerialNo", "Enter serial #")}
                        onChange={(event) => updateLine(line.id, { serialNo: event.target.value })}
                        className={inputClass}
                      />
                    </div>
                  ) : trackingMode === "lot" ? (
                    <div className="space-y-1 max-w-xs">
                      <span className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                        <span>{t("field.lotNo", "Lot No")}</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("field.required", "Required")}</span>
                      </span>
                      <input
                        name="lotNo"
                        value={line.lotNo}
                        placeholder={t("inventory.enterLotNo", "Enter lot #")}
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
        disabled={lines.some((l) => !l.productId)}
        onClick={addLine}
        className="w-full sm:w-auto gap-2 border-dashed border-[#0B5D4B]/50 bg-emerald-500/5 text-[#0B5D4B] dark:text-emerald-300 font-semibold hover:bg-emerald-500/10 hover:border-[#0B5D4B] transition-all py-2.5 px-5 rounded-xl text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="size-4" />
        {t("action.addAnotherItemLine", "Add Another Item Line")}
      </Button>
    </div>
  );
}
