"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Layers,
  MapPin,
  Package,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  cancelInventoryOperation,
  getOperationDetailAction,
  postInventoryOperation,
} from "@/app/admin/inventory/operations/actions";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { displayMoneyMinor, displayQuantity, type InventoryOperationDetail } from "@/server/inventory/stock-types";

function sourceHref(operation: {
  movementType: string;
  sourceType: string | null;
  sourceId: string | null;
}) {
  if (!operation.sourceId) {
    return null;
  }

  if (operation.sourceType === "goods_receipt") {
    return `/admin/purchasing/receipts/${operation.sourceId}`;
  }

  if (operation.sourceType === "delivery") {
    return `/admin/sales/deliveries/${operation.sourceId}`;
  }

  if (operation.sourceType === "sales_return") {
    return `/admin/sales?view=returns`;
  }

  if (operation.sourceType === "supplier_return") {
    return `/admin/purchasing?view=returns`;
  }

  if (operation.sourceType === "transfer_dispatch" || operation.sourceType === "transfer_receipt") {
    return `/admin/inventory/transfers/${operation.sourceId}`;
  }

  return null;
}

export function OperationDetailModal({
  operationId,
  onClose,
  returnPath,
}: {
  operationId: string | null;
  onClose: () => void;
  returnPath?: string;
}) {
  const [operation, setOperation] = useState<InventoryOperationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!operationId) {
      setOperation(null);
      return;
    }

    setLoading(true);
    getOperationDetailAction(operationId)
      .then((data) => {
        setOperation(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [operationId]);

  const open = Boolean(operationId);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-6xl sm:max-w-6xl max-h-[92vh] p-0 sm:p-0 gap-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden outline-none"
        showCloseButton={false}
      >
        {/* Top Brand Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441] shrink-0" />

        {/* Modal Header */}
        <DialogHeader className="shrink-0 border-b border-border/70 bg-background/95 px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <Boxes className="h-5 w-5 text-emerald-200" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground font-mono">
                  {operation?.movementNo ?? "Loading..."}
                </DialogTitle>
                {operation?.movementType && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground capitalize border border-border/60">
                    {operation.movementType.replace(/_/g, " ")}
                  </span>
                )}
                {operation?.status && <StatusBadge status={operation.status} />}
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {operation?.movementDate
                  ? `Recorded on ${new Date(operation.movementDate).toLocaleDateString()}`
                  : "Retrieving operation record..."}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {operation && (
              <Button asChild size="sm" variant="ghost" className="h-8 gap-1 px-2.5 text-xs text-muted-foreground">
                <Link href={`/admin/inventory/operations/${operation.id}`}>
                  <ExternalLink className="size-3.5" />
                  Full Page
                </Link>
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
              aria-label="Close"
            >
              <X className="size-4 sm:size-4.5" />
            </button>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-16 w-full animate-pulse rounded-xl bg-muted/60" />
              <div className="h-48 w-full animate-pulse rounded-xl bg-muted/40" />
            </div>
          ) : !operation ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Could not find operation details.
            </div>
          ) : (
            <>
              {/* Summary Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Origin</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {operation.fromLocationCode ?? "External / Direct"}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Destination</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {operation.toLocationCode ?? "Customer / Scrapped"}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Total Quantity</span>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {displayQuantity(operation.totalQuantity)} units
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20 p-3.5 space-y-1">
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Total Valuation</span>
                  <div className="font-mono text-sm font-extrabold text-foreground">
                    {operation.currencyCode ? displayMoneyMinor(operation.totalCostMinor, operation.currencyCode) : "—"}
                  </div>
                </div>
              </div>

              {/* Source Document Reference */}
              {operation.sourceNo && (
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-xs">
                  <span className="text-muted-foreground font-medium">Source Document: <strong className="text-foreground font-semibold">{operation.sourceNo}</strong> ({operation.sourceType ?? "custom"})</span>
                  {sourceHref(operation) && (
                    <Link
                      href={sourceHref(operation)!}
                      className="inline-flex items-center gap-1 font-semibold text-[#0B5D4B] dark:text-emerald-400 hover:underline"
                    >
                      Open Document
                      <ExternalLink className="size-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* Lines Table */}
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
                <div className="border-b border-border/80 bg-muted/40 px-4 py-2.5 text-xs font-semibold text-foreground">
                  Movement Lines ({operation.lines.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border/80 bg-muted/20 font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">#</th>
                        <th className="px-4 py-2.5">Product</th>
                        <th className="px-4 py-2.5">Owner</th>
                        <th className="px-4 py-2.5">From</th>
                        <th className="px-4 py-2.5">To</th>
                        <th className="px-4 py-2.5 text-right">Quantity</th>
                        <th className="px-4 py-2.5 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {operation.lines.map((line) => (
                        <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">{line.lineNo}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            <div>{line.productName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] text-muted-foreground">{line.sku}</span>
                              {line.serialNo && (
                                <span className="font-mono text-[11px] text-primary bg-primary/10 px-1 rounded">
                                  SN: {line.serialNo}
                                </span>
                              )}
                              {line.lotNo && (
                                <span className="font-mono text-[11px] text-amber-700 bg-amber-500/10 px-1 rounded">
                                  LOT: {line.lotNo}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{line.ownerName ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground font-medium">{line.fromLocationCode ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground font-medium">{line.toLocationCode ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-foreground">
                            {displayQuantity(line.quantity)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                            {displayMoneyMinor(line.totalCostMinor, line.currencyCode)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {operation.notes && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">Notes & Instructions</span>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{operation.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with Actions */}
        {operation && (
          <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {operation.status === "draft" && (
                <>
                  <form action={postInventoryOperation} className="flex-1 sm:flex-none">
                    <input type="hidden" name="movementId" value={operation.id} />
                    {returnPath && <input type="hidden" name="returnPath" value={returnPath} />}
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full sm:w-auto bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110 justify-center"
                    >
                      <CheckCircle2 className="size-3.5 mr-1" />
                      Post Operation
                    </Button>
                  </form>
                  <form action={cancelInventoryOperation} className="flex-1 sm:flex-none">
                    <input type="hidden" name="movementId" value={operation.id} />
                    {returnPath && <input type="hidden" name="returnPath" value={returnPath} />}
                    <Button type="submit" size="sm" variant="danger" className="w-full sm:w-auto justify-center">
                      Cancel Operation
                    </Button>
                  </form>
                </>
              )}
            </div>

            <Button onClick={onClose} variant="outline" size="sm" className="font-semibold w-full sm:w-auto">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
