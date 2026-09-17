"use client";

import {
  ArrowLeftRight,
  Boxes,
  Plus,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import {
  createInternalTransferOperation,
  createInventoryAdjustment,
  createScrapOperation,
} from "@/app/admin/inventory/operations/actions";
import {
  InventoryAdjustmentForm,
  InventoryInternalTransferForm,
  InventoryScrapForm,
} from "@/app/admin/inventory/operations/adjustment-lines-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { InventoryOperationFormOptions } from "@/server/inventory/stock-types";

export type OperationModalType = "transfer" | "adjustment" | "scrap";

type BalanceOption = {
  locationId: string;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  serialNo: string | null;
  lotNo: string | null;
  quantityOnHand: string;
  quantityAvailable: string;
  averageCostMinor: number;
  currencyCode: string;
};

export type NewInventoryOperationModalProps = {
  owners: InventoryOperationFormOptions["owners"];
  locations: InventoryOperationFormOptions["locations"];
  products: InventoryOperationFormOptions["products"];
  balances: BalanceOption[];
  defaultType?: OperationModalType;
  returnPath?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialProductId?: string;
  initialLocationId?: string;
  initialOwnerId?: string;
};

const OPERATION_CONFIG = {
  transfer: {
    label: "Internal Transfer",
    icon: ArrowLeftRight,
    color: "from-blue-600 to-indigo-700",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    title: "New Internal Transfer",
    description: "Transfer available inventory between warehouse locations and storage areas.",
  },
  adjustment: {
    label: "Stock Adjustment",
    icon: Sliders,
    color: "from-[#0B5D4B] to-[#073B35]",
    badgeColor: "bg-emerald-500/10 text-[#0B5D4B] dark:text-emerald-300 border-[#0B5D4B]/20",
    title: "New Inventory Adjustment",
    description: "Reconcile system balance with physical count to correct discrepancies.",
  },
  scrap: {
    label: "Scrap & Write-off",
    icon: Trash2,
    color: "from-rose-600 to-rose-800",
    badgeColor: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
    title: "New Scrap Operation",
    description: "Decommission damaged, expired, or obsolete stock from the warehouse.",
  },
};

export function NewInventoryOperationModal({
  owners,
  locations,
  products,
  balances,
  defaultType = "transfer",
  returnPath,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialProductId,
  initialLocationId,
  initialOwnerId,
}: NewInventoryOperationModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeType, setActiveType] = useState<OperationModalType>(defaultType);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    setActiveType(defaultType);
  }, [defaultType]);

  function setOpen(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    controlledOnOpenChange?.(nextOpen);
  }

  function handleCloseRequest() {
    setOpen(false);
  }

  const currentConfig = OPERATION_CONFIG[activeType];
  const Icon = currentConfig.icon;

  return (
    <Dialog open={open} onOpenChange={(val) => (val ? setOpen(true) : handleCloseRequest())}>
      {trigger ? (
        <DialogTrigger asChild>
          <span className="inline-flex">{trigger}</span>
        </DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99]">
            <Plus className="size-4 text-emerald-200" />
            New Operation
          </Button>
        </DialogTrigger>
      ) : null}

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
        {/* Top Brand Accent Line - Identical to Purchase & Sales Modals */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441]" />

        {/* Modal Header */}
        <DialogHeader className="border-b border-border/70 bg-background/95 px-4 sm:px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <Boxes className="h-5 w-5 text-emerald-200" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  {currentConfig.title}
                </DialogTitle>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                    currentConfig.badgeColor,
                  )}
                >
                  {currentConfig.label}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {currentConfig.description}
              </DialogDescription>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseRequest}
            className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
            aria-label="Close"
          >
            <X className="size-4 sm:size-4.5" />
          </button>
        </DialogHeader>

        {/* Operation Selector Pill Tabs */}
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 px-4 sm:px-6 py-3 backdrop-blur-md overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              Operation Mode:
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1 shadow-2xs shrink-0">
              {(["transfer", "adjustment", "scrap"] as const).map((type) => {
                const cfg = OPERATION_CONFIG[type];
                const TabIcon = cfg.icon;
                const isActive = activeType === type;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                      isActive
                        ? "bg-gradient-to-r from-[#0B5D4B] to-[#073B35] text-white shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <TabIcon className="size-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Form Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {activeType === "transfer" && (
            <InventoryInternalTransferForm
              action={createInternalTransferOperation}
              owners={owners}
              locations={locations}
              products={products}
              balances={balances}
              returnPath={returnPath}
              isModal={true}
              onCancel={handleCloseRequest}
              initialLocationId={initialLocationId}
              initialOwnerId={initialOwnerId}
              initialProductId={initialProductId}
            />
          )}

          {activeType === "adjustment" && (
            <InventoryAdjustmentForm
              action={createInventoryAdjustment}
              owners={owners}
              locations={locations}
              products={products}
              balances={balances}
              returnPath={returnPath}
              isModal={true}
              onCancel={handleCloseRequest}
              initialLocationId={initialLocationId}
              initialOwnerId={initialOwnerId}
              initialProductId={initialProductId}
            />
          )}

          {activeType === "scrap" && (
            <InventoryScrapForm
              action={createScrapOperation}
              owners={owners}
              locations={locations}
              products={products}
              balances={balances}
              returnPath={returnPath}
              isModal={true}
              onCancel={handleCloseRequest}
              initialLocationId={initialLocationId}
              initialOwnerId={initialOwnerId}
              initialProductId={initialProductId}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
