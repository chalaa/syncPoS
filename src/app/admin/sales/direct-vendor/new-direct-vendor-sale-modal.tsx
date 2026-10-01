"use client";

import { PlusIcon, ShoppingBag, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { createDirectVendorSale } from "@/app/admin/sales/direct-vendor/actions";
import { DirectVendorSaleForm } from "@/app/admin/sales/direct-vendor/direct-vendor-sale-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DirectVendorSaleFormOptions } from "@/server/direct-vendor-sales/types";

type NewDirectVendorSaleModalProps = DirectVendorSaleFormOptions & {
  initialOpen?: boolean;
  defaultDate?: string;
  trigger?: ReactNode;
};

export function NewDirectVendorSaleModal({
  initialOpen = false,
  defaultDate = "",
  trigger,
  ...options
}: NewDirectVendorSaleModalProps) {
  const [open, setOpen] = useState(initialOpen);
  const [prevInitialOpen, setPrevInitialOpen] = useState(initialOpen);

  if (prevInitialOpen !== initialOpen) {
    setPrevInitialOpen(initialOpen);
    if (initialOpen) {
      setOpen(true);
    }
  }

  function cleanUrl() {
    if (typeof window !== "undefined" && window.location.search.includes("new=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
    }
  }

  function handleCloseRequest() {
    setOpen(false);
    cleanUrl();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
    } else {
      handleCloseRequest();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99]">
            <PlusIcon className="size-4 text-emerald-200" />
            New Direct Sale
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-1rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-y-auto rounded-2xl border border-border/80 bg-card p-0 shadow-2xl outline-none sm:w-full sm:max-h-[90vh]"
        showCloseButton={false}
        onPointerDownOutside={() => handleCloseRequest()}
        onInteractOutside={() => handleCloseRequest()}
        onEscapeKeyDown={() => handleCloseRequest()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441]" />

        <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/70 bg-background/95 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <ShoppingBag className="size-5 text-emerald-200" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  New Direct Vendor Sale
                </DialogTitle>
                <span className="rounded-full border border-[#0B5D4B]/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#0B5D4B] dark:text-emerald-300">
                  No Inventory
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Prepare customer, vendor, product lines, and both payment sides without stock movement.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseRequest}
            className="rounded-lg bg-red-500 p-1.5 text-white shadow-2xs transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 sm:p-2"
            aria-label="Close"
          >
            <X className="size-4 sm:size-4.5" />
          </button>
        </DialogHeader>

        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <DirectVendorSaleForm
            action={createDirectVendorSale}
            defaultDate={defaultDate}
            isModal={true}
            onCancel={handleCloseRequest}
            {...options}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
