"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Barcode,
  Boxes,
  Building2,
  CalendarClock,
  Check,
  Coins,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  History,
  Info,
  Layers,
  Loader2,
  Package,
  Pencil,
  Percent,
  QrCode,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";

import { getProductDetailAction } from "@/app/admin/products/actions";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/server/catalog/types";

export type ProductDetailModalProps = {
  productId: string | null;
  initialProduct?: ProductDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TabKey = "overview" | "pricing" | "inventory" | "tracking" | "moves";

function trackingLabel(value: string | undefined | null) {
  if (!value) return "Standard Bulk";
  if (value === "none") return "Standard Bulk";
  if (value === "serial") return "Serial Numbered";
  if (value === "lot") return "Batch / Lot Tracked";
  return value.replace(/_/g, " ");
}

function trackingDescription(mode: string | undefined | null) {
  if (mode === "serial") {
    return "Each item requires a unique serial number for warranty, trace-back, and inventory tracking.";
  }
  if (mode === "lot") {
    return "Items are managed in batches with designated lot numbers, manufacturing dates, and shelf-life tracking.";
  }
  return "Inventory is counted strictly by aggregate quantity without unique serials or individual expiration lots.";
}

function specificationLabel(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function specificationValue(value: string | number | boolean | null) {
  if (value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function displayQuantity(qty: string | number | null | undefined): string {
  if (qty === null || qty === undefined || qty === "") return "0";
  const n = Number(qty);
  if (!Number.isFinite(n)) return String(qty);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatMoneyMinor(minor: number | null | undefined, currency: string = "ETB"): string {
  if (minor === null || minor === undefined) return `${currency} 0.00`;
  const major = minor / 100;
  return `${currency} ${major.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateVal: Date | string | undefined | null): string {
  if (!dateVal) return "-";
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
}

export function ProductDetailModal({
  productId,
  initialProduct,
  open,
  onOpenChange,
}: ProductDetailModalProps) {
  const [product, setProduct] = useState<ProductDetail | null>(
    initialProduct && initialProduct.id === productId ? initialProduct : null,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [copiedSku, setCopiedSku] = useState(false);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !productId) {
      return;
    }

    if (initialProduct && initialProduct.id === productId) {
      setProduct(initialProduct);
      return;
    }

    startTransition(async () => {
      try {
        const fetched = await getProductDetailAction(productId);
        setProduct(fetched);
      } catch (err) {
        console.error("Failed to fetch product details:", err);
      }
    });
  }, [open, productId, initialProduct]);

  function handleCopySku(sku: string) {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 1800);
  }

  // Financial calculations
  const listPrice = (product?.listPriceMinor ?? 0) / 100;
  const standardCost = (product?.standardCostMinor ?? 0) / 100;
  const unitProfit = listPrice - standardCost;
  const marginPercent = listPrice > 0 ? (unitProfit / listPrice) * 100 : 0;
  const qtyOnHand = Number(product?.quantityOnHand ?? 0);
  const totalValuationMinor = Math.round(qtyOnHand * (product?.standardCostMinor ?? 0));

  const tabs: { id: TabKey; label: string; shortLabel: string; icon: typeof FileText; count?: number }[] = [
    { id: "overview", label: "Overview", shortLabel: "Overview", icon: FileText },
    { id: "pricing", label: "Pricing & Margin", shortLabel: "Pricing", icon: Coins },
    {
      id: "inventory",
      label: "Inventory Locations",
      shortLabel: "Locations",
      icon: Warehouse,
      count: product?.stockRows?.length,
    },
    {
      id: "tracking",
      label: "Lots / Serials",
      shortLabel: "Tracking",
      icon: QrCode,
      count: product?.trackingRows?.length,
    },
    {
      id: "moves",
      label: "Stock Movements",
      shortLabel: "Movements",
      icon: History,
      count: product?.movementCount,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex max-h-[92vh] sm:max-h-[90vh] w-[calc(100%-1rem)] sm:w-full max-w-5xl flex-col overflow-y-auto rounded-2xl border border-border/80 bg-card p-0 shadow-2xl transition-all outline-none"
        showCloseButton={false}
      >
        {/* Top Ethiopian Accent Gradient Stripe */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441]" />

        {/* Modal Header */}
        <DialogHeader className="border-b border-border/70 bg-gradient-to-b from-muted/30 to-background px-4 py-3 sm:px-6 sm:py-4.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: Product Icon & Titles */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/10">
                <Boxes className="size-6 text-emerald-200" />
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground sm:text-2xl truncate">
                    {isLoading && !product ? "Loading Product..." : product?.name ?? "Product Details"}
                  </DialogTitle>
                  {product ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        product.isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          product.isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground",
                        )}
                      />
                      {product.isActive ? "Active in Catalog" : "Inactive"}
                    </span>
                  ) : null}
                </div>

                {product ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {/* Copyable SKU */}
                    <button
                      type="button"
                      onClick={() => handleCopySku(product.sku)}
                      className="group inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-xs font-bold text-primary transition-colors hover:bg-primary/10 hover:border-primary/40"
                      title="Click to copy SKU"
                    >
                      <span>{product.sku}</span>
                      {copiedSku ? (
                        <Check className="size-3 text-emerald-600 animate-in zoom-in-50" />
                      ) : (
                        <Copy className="size-3 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>

                    <span className="text-border">•</span>

                    {/* Category & Brand Pills */}
                    {product.brandName && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        <Tag className="size-3 text-muted-foreground" />
                        {product.brandName}
                      </span>
                    )}

                    {product.categoryName && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        {product.categoryName}
                      </span>
                    )}

                    {product.model && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        Mod: {product.model}
                      </span>
                    )}

                    {product.country && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                        <Globe className="size-3 text-muted-foreground" />
                        {product.country}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Retrieving catalog records...</p>
                )}
              </div>
            </div>

            {/* Right: Quick Action Buttons & Close */}
            <div className="flex items-center gap-2 self-start">
              {product ? (
                <ButtonLink
                  href={`/admin/products/${product.id}/edit`}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 font-medium border-border/80 hover:border-[#0B5D4B]/40 hover:text-[#0B5D4B]"
                >
                  <Pencil className="size-3.5" />
                  Edit Product
                </ButtonLink>
              ) : null}

              <DialogClose
                type="button"
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Content */}
        <div>
          {isLoading && !product ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-muted-foreground">
              <Loader2 className="size-9 animate-spin text-[#0B5D4B]" />
              <p className="text-sm font-medium">Loading catalog data...</p>
            </div>
          ) : !product ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Product details are currently unavailable.
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5 p-4 sm:p-6">
              {/* Mobile View: Compact 3-Column Grid (No Horizontal Scroll) */}
              <div className="grid grid-cols-3 gap-1.5 sm:hidden">
                {/* 1. Selling Price */}
                <button
                  type="button"
                  onClick={() => setActiveTab("pricing")}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border p-2 text-left shadow-2xs transition-colors min-w-0",
                    activeTab === "pricing"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    <Coins className="size-3 text-emerald-600 shrink-0" />
                    <span className="truncate">Price</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                    {formatMoneyMinor(product.listPriceMinor, product.currencyCode)}
                  </div>
                </button>

                {/* 2. Standard Cost */}
                <button
                  type="button"
                  onClick={() => setActiveTab("pricing")}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border p-2 text-left shadow-2xs transition-colors min-w-0",
                    activeTab === "pricing"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    <Receipt className="size-3 text-amber-600 shrink-0" />
                    <span className="truncate">Cost</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                    {formatMoneyMinor(product.standardCostMinor, product.currencyCode)}
                  </div>
                </button>

                {/* 3. Gross Margin */}
                <button
                  type="button"
                  onClick={() => setActiveTab("pricing")}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border p-2 text-left shadow-2xs transition-colors min-w-0",
                    activeTab === "pricing"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/10"
                      : "border border-[#0B5D4B]/20 bg-[#0B5D4B]/5",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#0B5D4B] truncate">
                    <Sparkles className="size-3 text-[#D9A441] shrink-0" />
                    <span className="truncate">Margin</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-[#0B5D4B] truncate">
                    {marginPercent.toFixed(1)}%
                  </div>
                </button>

                {/* 4. On Hand Stock */}
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border p-2 text-left shadow-2xs transition-colors min-w-0",
                    activeTab === "inventory"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    <Package className="size-3 text-[#0B5D4B] shrink-0" />
                    <span className="truncate">On Hand</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                    {displayQuantity(product.quantityOnHand)} {product.unitCode}
                  </div>
                </button>

                {/* 5. Incoming Stock */}
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className={cn(
                    "flex flex-col justify-between rounded-lg border p-2 text-left shadow-2xs transition-colors min-w-0",
                    activeTab === "inventory"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    <TrendingUp className="size-3 text-blue-600 shrink-0" />
                    <span className="truncate">Incoming</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                    {displayQuantity(product.incomingQuantity)} {product.unitCode}
                  </div>
                </button>

                {/* 6. Inventory Valuation */}
                <div className="flex flex-col justify-between rounded-lg border border-border bg-secondary/30 p-2 text-left shadow-2xs min-w-0">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    <Building2 className="size-3 text-muted-foreground shrink-0" />
                    <span className="truncate">Valuation</span>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                    {formatMoneyMinor(totalValuationMinor, product.currencyCode)}
                  </div>
                </div>
              </div>

              {/* Desktop/Tablet View: Executive Commercial & Stock Highlights Strip (hidden on mobile) */}
              <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                {/* 1. Selling Price Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab("pricing")}
                  className={cn(
                    "group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                    activeTab === "pricing"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5 shadow-xs"
                      : "border-border bg-card hover:border-[#0B5D4B]/40 hover:bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Selling Price
                    </span>
                    <Coins className="size-4 text-emerald-600 opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-bold tracking-tight text-foreground font-mono">
                      {formatMoneyMinor(product.listPriceMinor, product.currencyCode)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {product.saleTaxNames || "Tax Exempt / Included"}
                    </span>
                  </div>
                </button>

                {/* 2. Standard Cost Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab("pricing")}
                  className={cn(
                    "group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                    activeTab === "pricing"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5 shadow-xs"
                      : "border-border bg-card hover:border-[#0B5D4B]/40 hover:bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Std Cost
                    </span>
                    <Receipt className="size-4 text-amber-600 opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-bold tracking-tight text-foreground font-mono">
                      {formatMoneyMinor(product.standardCostMinor, product.currencyCode)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {product.purchaseTaxNames || "No purchase tax"}
                    </span>
                  </div>
                </button>

                {/* 3. On Hand Stock Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className={cn(
                    "group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                    activeTab === "inventory"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5 shadow-xs"
                      : "border-border bg-card hover:border-[#0B5D4B]/40 hover:bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      On Hand
                    </span>
                    <Package className="size-4 text-[#0B5D4B] opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-bold tracking-tight text-foreground">
                      {displayQuantity(product.quantityOnHand)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {product.unitCode}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {displayQuantity(product.quantityAvailable)} available
                    </span>
                  </div>
                </button>

                {/* 4. Incoming Stock Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className={cn(
                    "group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                    activeTab === "inventory"
                      ? "border-[#0B5D4B] bg-[#0B5D4B]/5 shadow-xs"
                      : "border-border bg-card hover:border-[#0B5D4B]/40 hover:bg-secondary/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Incoming
                    </span>
                    <TrendingUp className="size-4 text-blue-600 opacity-80 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-bold tracking-tight text-foreground">
                      {displayQuantity(product.incomingQuantity)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {product.unitCode}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      On active purchase orders
                    </span>
                  </div>
                </button>

                {/* 5. Inventory Valuation */}
                <div className="flex flex-col justify-between rounded-xl border border-border bg-secondary/30 p-3.5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Inventory Value
                    </span>
                    <Building2 className="size-4 text-muted-foreground/70" />
                  </div>
                  <div className="mt-2">
                    <div className="text-lg font-bold tracking-tight text-foreground font-mono">
                      {formatMoneyMinor(totalValuationMinor, product.currencyCode)}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Qty On Hand × Std Cost
                    </span>
                  </div>
                </div>
              </div>

              {/* Segmented Navigation Tab Bar */}
              <div className="grid grid-cols-5 gap-1 rounded-xl border border-border/80 bg-muted/50 p-1 w-full">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 rounded-lg px-1 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold transition-all outline-none cursor-pointer min-w-0",
                        isActive
                          ? "bg-card text-[#0B5D4B] shadow-xs ring-1 ring-black/5 font-bold"
                          : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                      )}
                    >
                      <div className="relative flex items-center justify-center">
                        <Icon
                          className={cn("size-3.5 shrink-0", isActive ? "text-[#0B5D4B]" : "text-muted-foreground")}
                        />
                        {tab.count !== undefined && tab.count > 0 ? (
                          <span
                            className={cn(
                              "sm:hidden absolute -top-1.5 -right-2 rounded-full px-1 py-0.2 text-[9px] font-mono leading-none",
                              isActive
                                ? "bg-[#0B5D4B] text-white font-bold"
                                : "bg-muted-foreground/30 text-foreground",
                            )}
                          >
                            {tab.count}
                          </span>
                        ) : null}
                      </div>
                      <span className="hidden sm:inline truncate">{tab.label}</span>
                      <span className="sm:hidden truncate text-[10px] leading-tight">{tab.shortLabel}</span>
                      {tab.count !== undefined && tab.count > 0 ? (
                        <span
                          className={cn(
                            "hidden sm:inline-block rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none",
                            isActive
                              ? "bg-[#0B5D4B]/10 text-[#0B5D4B] font-bold"
                              : "bg-background/80 text-muted-foreground",
                          )}
                        >
                          {tab.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Tab Panel 1: Overview & Identity */}
              {activeTab === "overview" && (
                <div className="grid gap-5 lg:grid-cols-12 animate-in fade-in-50 duration-150">
                  {/* Left: Identity & Classification (7 cols) */}
                  <div className="space-y-4 lg:col-span-7">
                    <div className="rounded-xl border border-border bg-card p-4.5 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <Tag className="size-3.5 text-[#0B5D4B]" />
                          Product Classification
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          ID: {product.id.slice(0, 8)}...
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <FieldBlock label="Product Name" value={product.name} />
                        <FieldBlock
                          label="Standard Catalog Name"
                          value={product.standardName || "-"}
                          subtitle="Normalized title"
                        />
                        <FieldBlock label="Category" value={product.categoryName || "Uncategorized"} />
                        <FieldBlock label="Brand / Manufacturer" value={product.brandName || "Generic"} />
                        <FieldBlock label="Model / Spec Reference" value={product.model || "-"} />
                        <FieldBlock label="Country of Origin" value={product.country || "Not specified"} />
                        <FieldBlock
                          label="Unit of Measure (UoM)"
                          value={`${product.unitCode} (${product.unitName})`}
                        />
                        <FieldBlock
                          label="Tracking Policy"
                          value={trackingLabel(product.trackingMode)}
                        />
                      </div>
                    </div>

                    {/* Description Card */}
                    <div className="rounded-xl border border-border bg-card p-4.5 space-y-2 shadow-2xs">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Product Description & Notes
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {product.description || "No specific product notes or description provided."}
                      </p>
                    </div>
                  </div>

                  {/* Right: Specs & Tracking Policy (5 cols) */}
                  <div className="space-y-4 lg:col-span-5">
                    {/* Technical Specifications */}
                    <div className="rounded-xl border border-border bg-card p-4.5 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <SlidersHorizontal className="size-3.5 text-[#0B5D4B]" />
                          Technical Specifications
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Object.keys(product.specifications || {}).length} Attributes
                        </span>
                      </div>

                      {product.specifications &&
                      Object.keys(product.specifications).length > 0 ? (
                        <div className="grid gap-2.5">
                          {Object.entries(product.specifications).map(([key, val]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between rounded-lg border border-border/70 bg-secondary/20 px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-muted-foreground">
                                {specificationLabel(key)}
                              </span>
                              <span className="font-semibold text-foreground">
                                {specificationValue(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                          No category-specific technical attributes registered.
                        </div>
                      )}
                    </div>

                    {/* Tracking Policy Explainer Card */}
                    <div className="rounded-xl border border-[#0B5D4B]/20 bg-[#0B5D4B]/5 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#0B5D4B]">
                        <ShieldCheck className="size-4 text-[#0B5D4B]" />
                        <span>Tracking: {trackingLabel(product.trackingMode)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {trackingDescription(product.trackingMode)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Panel 2: Pricing & Commercial Margin */}
              {activeTab === "pricing" && (
                <div className="space-y-4 sm:space-y-5 animate-in fade-in-50 duration-150">
                  {/* Mobile View: Compact 3-Column Grid (No Horizontal Scroll) */}
                  <div className="grid grid-cols-3 gap-1.5 sm:hidden">
                    {/* Sales Price */}
                    <div className="flex flex-col justify-between rounded-lg border border-emerald-500/20 bg-card p-2 text-left shadow-2xs min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                        <Tag className="size-3 text-emerald-600 shrink-0" />
                        <span className="truncate">List Price</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                        {formatMoneyMinor(product.listPriceMinor, product.currencyCode)}
                      </div>
                    </div>

                    {/* Purchase Cost */}
                    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-2 text-left shadow-2xs min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                        <Receipt className="size-3 text-amber-600 shrink-0" />
                        <span className="truncate">Std Cost</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                        {formatMoneyMinor(product.standardCostMinor, product.currencyCode)}
                      </div>
                    </div>

                    {/* Gross Margin */}
                    <div className="flex flex-col justify-between rounded-lg border border-[#0B5D4B]/30 bg-[#0B5D4B]/5 p-2 text-left shadow-2xs min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#0B5D4B] truncate">
                        <Sparkles className="size-3 text-[#D9A441] shrink-0" />
                        <span className="truncate">Margin</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-[#0B5D4B] truncate">
                        {marginPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Desktop/Tablet View (hidden on mobile) */}
                  <div className="hidden sm:grid sm:grid-cols-3 sm:gap-4">
                    {/* Sales Pricing Card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Customer Sales
                        </span>
                        <Tag className="size-4 text-emerald-600" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Standard List Price</span>
                        <div className="text-2xl font-bold font-mono text-foreground mt-1">
                          {formatMoneyMinor(product.listPriceMinor, product.currencyCode)}
                        </div>
                      </div>
                      {Boolean(product.saleTaxNames && product.saleTaxNames !== "No sales tax configured" && product.saleTaxNames !== "Tax Exempt / Included") ? (
                        <div className="rounded-lg bg-secondary/30 p-3 text-xs space-y-1">
                          <div className="text-muted-foreground font-medium">Customer Taxes</div>
                          <div className="font-semibold text-foreground">
                            {product.saleTaxNames}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Purchase Costing Card */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Vendor Purchasing
                        </span>
                        <Receipt className="size-4 text-amber-600" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Standard Purchase Cost</span>
                        <div className="text-2xl font-bold font-mono text-foreground mt-1">
                          {formatMoneyMinor(product.standardCostMinor, product.currencyCode)}
                        </div>
                      </div>
                      {Boolean(product.purchaseTaxNames && product.purchaseTaxNames !== "No purchase tax configured") ? (
                        <div className="rounded-lg bg-secondary/30 p-3 text-xs space-y-1">
                          <div className="text-muted-foreground font-medium">Vendor Purchase Taxes</div>
                          <div className="font-semibold text-foreground">
                            {product.purchaseTaxNames}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Profitability & Margin Card */}
                    <div className="rounded-xl border border-[#0B5D4B]/30 bg-gradient-to-br from-card to-[#0B5D4B]/5 p-5 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0B5D4B]">
                          Profit & Margin
                        </span>
                        <Sparkles className="size-4 text-[#D9A441]" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Unit Gross Margin</span>
                        <div className="text-2xl font-bold font-mono text-foreground mt-1">
                          {product.currencyCode} {unitProfit.toFixed(2)}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-muted-foreground">Gross Margin %</span>
                          <span
                            className={cn(
                              "font-bold",
                              marginPercent >= 20
                                ? "text-emerald-600"
                                : marginPercent > 0
                                  ? "text-amber-600"
                                  : "text-muted-foreground",
                            )}
                          >
                            {marginPercent.toFixed(1)}%
                          </span>
                        </div>
                        {/* Margin Health Bar */}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              marginPercent >= 20
                                ? "bg-emerald-600"
                                : marginPercent > 0
                                  ? "bg-amber-500"
                                  : "bg-muted-foreground/30",
                            )}
                            style={{
                              width: `${Math.min(100, Math.max(0, marginPercent))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price Lists & Custom Tiers Link Card */}
                  <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 sm:p-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary shrink-0">
                        <Coins className="size-4" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground">Customer Price Lists & Volume Tiers</div>
                        <p className="text-muted-foreground hidden sm:block">
                          Assign this product to custom wholesale pricing, VIP discounts, or customer-specific tiers.
                        </p>
                      </div>
                    </div>
                    <ButtonLink
                      href="/admin/products/price-lists"
                      variant="outline"
                      size="sm"
                      className="gap-1 shrink-0"
                    >
                      <span>Manage Price Lists</span>
                      <ArrowRight className="size-3" />
                    </ButtonLink>
                  </div>
                </div>
              )}

              {/* Tab Panel 3: Inventory by Location */}
              {activeTab === "inventory" && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  {/* Mobile View: Compact 3-Column Grid (No Horizontal Scroll) */}
                  <div className="grid grid-cols-3 gap-1.5 sm:hidden">
                    {/* On Hand */}
                    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-2 text-left shadow-2xs min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                        <Package className="size-3 text-[#0B5D4B] shrink-0" />
                        <span className="truncate">Total On Hand</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                        {displayQuantity(product.quantityOnHand)} {product.unitCode}
                      </div>
                    </div>

                    {/* Reserved */}
                    <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-2 text-left shadow-2xs min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                        <Activity className="size-3 text-amber-600 shrink-0" />
                        <span className="truncate">Reserved</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-foreground truncate">
                        {displayQuantity(product.quantityReserved)} {product.unitCode}
                      </div>
                    </div>

                    {/* Available to Sell */}
                    <div className="flex flex-col justify-between rounded-lg border border-[#0B5D4B]/30 bg-[#0B5D4B]/5 p-2 text-left shadow-2xs min-w-0">
                      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#0B5D4B] truncate">
                        <Check className="size-3 text-[#0B5D4B] shrink-0" />
                        <span className="truncate">Available</span>
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-[#0B5D4B] truncate">
                        {displayQuantity(product.quantityAvailable)} {product.unitCode}
                      </div>
                    </div>
                  </div>

                  {/* Desktop/Tablet View (hidden on mobile) */}
                  <div className="hidden sm:grid sm:grid-cols-3 sm:gap-3">
                    <MetricCard
                      title="Total On Hand"
                      value={`${displayQuantity(product.quantityOnHand)} ${product.unitCode}`}
                      subtitle="Physically in storage"
                    />
                    <MetricCard
                      title="Reserved for Orders"
                      value={`${displayQuantity(product.quantityReserved)} ${product.unitCode}`}
                      subtitle="Pending delivery / POS"
                    />
                    <MetricCard
                      title="Available to Sell"
                      value={`${displayQuantity(product.quantityAvailable)} ${product.unitCode}`}
                      subtitle="Net uncommitted stock"
                      highlight
                    />
                  </div>

                  {/* Stock by Location Table */}
                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
                    <div className="border-b border-border bg-muted/20 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Warehouse & Retail Location Balances
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="px-4 py-2.5">Location</th>
                            <th className="px-4 py-2.5">Tracking Key</th>
                            <th className="px-4 py-2.5 text-right">On Hand</th>
                            <th className="px-4 py-2.5 text-right">Reserved</th>
                            <th className="px-4 py-2.5 text-right">Available</th>
                            <th className="px-4 py-2.5 text-right">Average Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {product.stockRows.map((row) => (
                            <tr key={row.stockBalanceId} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-foreground">{row.locationCode}</div>
                                <div className="text-xs text-muted-foreground">{row.locationName}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {row.serialNo ?? row.lotNo ?? (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                                    Bulk
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-foreground">
                                {displayQuantity(row.quantityOnHand)}
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground">
                                {displayQuantity(row.quantityReserved)}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-[#0B5D4B]">
                                {displayQuantity(row.quantityAvailable)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                {formatMoneyMinor(row.averageCostMinor, row.currencyCode)}
                              </td>
                            </tr>
                          ))}
                          {product.stockRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                                No stock balances recorded for this item across company warehouses.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Panel 4: Lots / Serials */}
              {activeTab === "tracking" && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">
                        Registered Lots & Serial Identifiers
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {product.trackingRows.length} total tracking units recorded in the system.
                      </p>
                    </div>

                    <span className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                      Mode: {trackingLabel(product.trackingMode)}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="px-4 py-2.5">Type</th>
                            <th className="px-4 py-2.5">Identifier / Ref #</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">Current Location</th>
                            <th className="px-4 py-2.5 text-right">Quantity</th>
                            <th className="px-4 py-2.5 text-right">Landed Unit Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {product.trackingRows.map((row) => (
                            <tr key={`${row.kind}-${row.id}`} className="hover:bg-secondary/30 transition-colors">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold capitalize text-secondary-foreground">
                                  {row.kind}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-primary">
                                {row.referenceNo}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={row.status} />
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {row.currentLocationCode ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {displayQuantity(row.quantityOnHand)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                {row.landedUnitCostMinor === null
                                  ? "-"
                                  : formatMoneyMinor(row.landedUnitCostMinor, product.currencyCode)}
                              </td>
                            </tr>
                          ))}
                          {product.trackingRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-xs text-muted-foreground">
                                No lots or serial numbers have been received or recorded for this item.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Panel 5: Stock Movement Ledger */}
              {activeTab === "moves" && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Stock Movements Ledger</h4>
                      <p className="text-xs text-muted-foreground">
                        Chronological audit log of physical receipts, transfers, and shipments.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {product.movementCount} Movements Recorded
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[840px] text-left text-sm">
                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="px-4 py-2.5">Movement #</th>
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">From</th>
                            <th className="px-4 py-2.5">To</th>
                            <th className="px-4 py-2.5">Tracking Key</th>
                            <th className="px-4 py-2.5 text-right">Quantity</th>
                            <th className="px-4 py-2.5 text-right">Total Valuation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {product.movementRows.map((row) => (
                            <tr
                              key={`${row.movementId}-${row.serialNo ?? row.lotNo ?? row.quantity}`}
                              className="hover:bg-secondary/30 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="font-semibold text-foreground">{row.movementNo}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {trackingLabel(row.movementType)} {row.sourceNo ? `• ${row.sourceNo}` : ""}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(row.movementDate)}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {row.fromLocationCode ? (
                                  <span className="font-medium text-foreground">{row.fromLocationCode}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {row.toLocationCode ? (
                                  <span className="font-medium text-foreground">{row.toLocationCode}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {row.serialNo ?? row.lotNo ?? (
                                  <span className="text-muted-foreground">Bulk</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {displayQuantity(row.quantity)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                {formatMoneyMinor(row.totalCostMinor, row.currencyCode)}
                              </td>
                            </tr>
                          ))}
                          {product.movementRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                                No stock movement records logged for this item yet.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-border/70 bg-background/95 px-6 py-3.5 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {product ? (
              <>
                <span className="font-mono text-[11px]">System ID: {product.id}</span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            {product ? (
              <ButtonLink
                href={`/admin/products/${product.id}/edit`}
                variant="default"
                className="gap-1.5 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-sm hover:brightness-110"
              >
                <Pencil className="size-3.5" />
                Edit Product
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldBlock({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/15 p-2.5 space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {subtitle && <span className="text-[10px] text-muted-foreground/80">{subtitle}</span>}
      </div>
      <div className="font-medium text-foreground text-sm truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  highlight = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 space-y-1 shadow-2xs",
        highlight
          ? "border-[#0B5D4B]/30 bg-[#0B5D4B]/5"
          : "border-border bg-card",
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      <div
        className={cn(
          "text-xl font-bold tracking-tight",
          highlight ? "text-[#0B5D4B]" : "text-foreground",
        )}
      >
        {value}
      </div>
      <p className="text-[10px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}
