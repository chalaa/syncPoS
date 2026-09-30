"use client";

import {
  ArrowLeftRight,
  Boxes,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Layers,
  MapPin,
  Package,
  Sliders,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";

import { NewInventoryOperationModal } from "@/app/admin/inventory/operations/new-operation-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  displayMoneyMinor,
  displayQuantity,
  type InventoryOperationFormOptions,
  type StockByLocationRow,
} from "@/server/inventory/stock-types";

export function StockProductDrawer({
  row,
  onClose,
  formOptions,
}: {
  row: StockByLocationRow | null;
  onClose: () => void;
  formOptions?: InventoryOperationFormOptions & { balances: any[] };
}) {
  const { t } = useTranslation();

  if (!row) return null;

  const onHand = Number(row.quantityOnHand);
  const available = Number(row.quantityAvailable);
  const reserved = Number(row.quantityReserved);
  const totalValuationMinor = Math.round(onHand * row.averageCostMinor);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-over panel */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border/80 bg-card shadow-2xl transition-transform animate-in slide-in-from-right duration-300">
        {/* Accent top banner */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441] shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/80 bg-background/90 p-5 backdrop-blur-sm">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/20">
              <Package className="size-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-primary">{row.sku}</span>
                <span className="rounded-md border border-border/80 bg-secondary px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {row.trackingMode}
                </span>
              </div>
              <h2 className="text-base font-bold tracking-tight text-foreground truncate mt-0.5">
                {row.productName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={t("action.closePanel")}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Location & Owner Card */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <MapPin className="size-3.5 text-primary" />
                {t("field.storageLocation")}
              </span>
              <span className="font-semibold text-foreground">
                {row.locationCode} · {row.locationName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2.5">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <User className="size-3.5 text-primary" />
                {t("field.stockOwner")}
              </span>
              <span className="font-semibold text-foreground">
                {row.ownerName || t("inventory.internalDefault")}
              </span>
            </div>
            {(row.serialNo || row.lotNo) && (
              <div className="flex items-center justify-between text-xs border-t border-border/50 pt-2.5">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <Layers className="size-3.5 text-primary" />
                  {row.serialNo ? t("field.serialNumber") : t("field.lotNumber")}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {row.serialNo || row.lotNo}
                </span>
              </div>
            )}
          </div>

          {/* Quantities Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              {t("inventory.balanceBreakdown")}
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-border/80 bg-background p-3 text-center">
                <span className="text-[11px] font-medium text-muted-foreground">{t("inventory.onHand")}</span>
                <p className="font-mono text-lg font-extrabold text-foreground mt-0.5">
                  {displayQuantity(row.quantityOnHand)}
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-background p-3 text-center">
                <span className="text-[11px] font-medium text-muted-foreground">{t("inventory.reserved")}</span>
                <p className="font-mono text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                  {displayQuantity(row.quantityReserved)}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{t("inventory.available")}</span>
                <p className="font-mono text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {displayQuantity(row.quantityAvailable)}
                </p>
              </div>
            </div>
          </div>

          {/* Valuation Card */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              {t("inventory.costValuation")}
            </h3>
            <div className="rounded-xl border border-border/80 bg-background p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t("inventory.avgUnitCost")}</span>
                <span className="font-mono font-bold text-foreground">
                  {displayMoneyMinor(row.averageCostMinor, row.currencyCode)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2.5">
                <span className="font-semibold text-foreground">{t("inventory.totalLocationValuation")}</span>
                <span className="font-mono text-sm font-extrabold text-primary">
                  {displayMoneyMinor(totalValuationMinor, row.currencyCode)}
                </span>
              </div>
            </div>
          </div>

          {/* Last movement info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
            <Clock className="size-3.5 shrink-0" />
            <span>
              {t("inventory.lastActivityRecordedOn")}{" "}
              <strong className="text-foreground">
                {row.lastMovementAt ? row.lastMovementAt.toLocaleDateString() : "N/A"}
              </strong>
            </span>
          </div>

          {/* Quick Actions Links */}
          <div className="pt-2 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
              {t("inventory.quickOperations")}
            </h3>

            <Button asChild variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold">
              <Link href={`/admin/inventory/stock-card?productId=${row.productId}`}>
                <FileSpreadsheet className="size-4 text-emerald-600" />
                {t("inventory.viewFullStockCard")}
                <ExternalLink className="size-3.5 ml-auto text-muted-foreground" />
              </Link>
            </Button>

            {formOptions ? (
              <>
                <NewInventoryOperationModal
                  defaultType="transfer"
                  owners={formOptions.owners}
                  locations={formOptions.locations}
                  products={formOptions.products}
                  balances={formOptions.balances}
                  returnPath="/admin/inventory"
                  initialProductId={row.productId}
                  initialLocationId={row.locationId}
                  initialOwnerId={row.ownerId ?? undefined}
                  trigger={
                    <Button variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold cursor-pointer">
                      <ArrowLeftRight className="size-4 text-blue-600" />
                      {t("inventory.transferItemToLocation")}
                    </Button>
                  }
                />

                <NewInventoryOperationModal
                  defaultType="adjustment"
                  owners={formOptions.owners}
                  locations={formOptions.locations}
                  products={formOptions.products}
                  balances={formOptions.balances}
                  returnPath="/admin/inventory"
                  initialProductId={row.productId}
                  initialLocationId={row.locationId}
                  initialOwnerId={row.ownerId ?? undefined}
                  trigger={
                    <Button variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold cursor-pointer">
                      <Sliders className="size-4 text-amber-600" />
                      {t("inventory.performPhysicalCount")}
                    </Button>
                  }
                />

                <NewInventoryOperationModal
                  defaultType="scrap"
                  owners={formOptions.owners}
                  locations={formOptions.locations}
                  products={formOptions.products}
                  balances={formOptions.balances}
                  returnPath="/admin/inventory"
                  initialProductId={row.productId}
                  initialLocationId={row.locationId}
                  initialOwnerId={row.ownerId ?? undefined}
                  trigger={
                    <Button variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold hover:text-destructive hover:bg-destructive/10 cursor-pointer">
                      <Trash2 className="size-4 text-destructive" />
                      {t("inventory.scrapDamagedUnits")}
                    </Button>
                  }
                />
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold">
                  <Link href={`/admin/inventory/operations/internal-transfers/new`}>
                    <ArrowLeftRight className="size-4 text-blue-600" />
                    {t("inventory.transferItemToLocation")}
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold">
                  <Link href={`/admin/inventory/operations/adjustments/new`}>
                    <Sliders className="size-4 text-amber-600" />
                    {t("inventory.performPhysicalCount")}
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start gap-2.5 h-10 font-semibold hover:text-destructive hover:bg-destructive/10">
                  <Link href={`/admin/inventory/operations/scrap/new`}>
                    <Trash2 className="size-4 text-destructive" />
                    {t("inventory.scrapDamagedUnits")}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/80 bg-background/90 p-4">
          <Button onClick={onClose} variant="outline" className="w-full font-semibold">
            {t("action.closePanel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
