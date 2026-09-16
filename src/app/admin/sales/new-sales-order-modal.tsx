"use client";

import { PlusIcon, ShoppingBag, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CloseConfirmDialog } from "@/components/ui/close-confirm-dialog";
import { SalesOrderForm, type SalesOrderFormHandle } from "@/app/admin/sales/sales-order-form";
import { createSalesOrder } from "@/app/admin/sales/actions";
import type { ProductSelect } from "@/app/admin/products/product-select";
import type { OwnerOption } from "@/server/owners/types";
import type { SalesAvailableStockOption, SalesFormOption, SalesTaxOption } from "@/server/sales/types";

export type NewSalesOrderModalProps = {
  customers: SalesFormOption[];
  owners: OwnerOption[];
  products: SalesFormOption[];
  productCategories: Parameters<typeof ProductSelect>[0]["categories"];
  productBrands: Parameters<typeof ProductSelect>[0]["brands"];
  productUnits: Parameters<typeof ProductSelect>[0]["units"];
  locations: SalesFormOption[];
  taxes: SalesTaxOption[];
  availableStock: SalesAvailableStockOption[];
  initialOpen?: boolean;
  defaultDate?: string;
  trigger?: ReactNode;
};

export function NewSalesOrderModal({
  customers,
  owners,
  products,
  productCategories,
  productBrands,
  productUnits,
  locations,
  taxes,
  availableStock,
  initialOpen = false,
  defaultDate = "",
  trigger,
}: NewSalesOrderModalProps) {
  const [open, setOpen] = useState(initialOpen);
  const [prevInitialOpen, setPrevInitialOpen] = useState(initialOpen);
  const [confirmClose, setConfirmClose] = useState(false);
  const formRef = useRef<SalesOrderFormHandle>(null);

  if (prevInitialOpen !== initialOpen) {
    setPrevInitialOpen(initialOpen);
    if (initialOpen) {
      setOpen(true);
    }
  }

  /** Remove ?new= from the URL without navigation */
  function cleanUrl() {
    if (typeof window !== "undefined" && window.location.search.includes("new=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
    }
  }

  /** Directly close without saving */
  function closeImmediately() {
    setOpen(false);
    setConfirmClose(false);
    cleanUrl();
  }

  /** X button — show confirmation first */
  function handleCloseRequest() {
    setConfirmClose(true);
  }

  /** Confirmation: save draft then close */
  function handleSaveDraftAndClose() {
    formRef.current?.saveDraft();
    setConfirmClose(false);
    setOpen(false);
    cleanUrl();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
    }
    // All close attempts go through handleCloseRequest.
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99]">
              <PlusIcon className="size-4 text-emerald-200" />
              New Quotation
            </Button>
          )}
        </DialogTrigger>

        <DialogContent
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1rem)] sm:w-full max-w-6xl max-h-[92vh] sm:max-h-[90vh] p-0 gap-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-y-auto outline-none"
          showCloseButton={false}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            handleCloseRequest();
          }}
        >
          {/* Top Brand Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441]" />

          {/* Modal Header */}
          <DialogHeader className="border-b border-border/70 bg-background/95 px-4 sm:px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
                <ShoppingBag className="h-5 w-5 text-emerald-200" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                    New Sales Quotation
                  </DialogTitle>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0B5D4B] dark:text-emerald-300 border border-[#0B5D4B]/20">
                    Draft Quotation
                  </span>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Prepare specifications, sourcing warehouse, and order lines to fulfill customer orders.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseRequest}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#0B5D4B]/30"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </DialogHeader>

          {/* Modal Body */}
          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <SalesOrderForm
              ref={formRef}
              action={createSalesOrder}
              customers={customers}
              owners={owners}
              products={products}
              productCategories={productCategories}
              productBrands={productBrands}
              productUnits={productUnits}
              locations={locations}
              taxes={taxes}
              availableStock={availableStock}
              defaultDate={defaultDate}
              isModal={true}
              onCancel={handleCloseRequest}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Close confirmation overlay */}
      <CloseConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        draftLabel="Save as Draft Quotation"
        onSaveDraft={handleSaveDraftAndClose}
        onDiscard={closeImmediately}
      />
    </>
  );
}
