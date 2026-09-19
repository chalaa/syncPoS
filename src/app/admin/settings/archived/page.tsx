import Link from "next/link";
import {
  Archive,
  Boxes,
  Building2,
  PackageCheck,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
} from "lucide-react";

import { restoreArchivedItem } from "@/app/admin/settings/archived/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import {
  getArchivedSummary,
  type ArchivedItem,
  type TypeGroup,
} from "@/server/archived/archived-service";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type ArchivedPageProps = {
  searchParams: Promise<{
    q?: string;
    group?: string;
    notice?: string;
    error?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function getEntityBadgeProps(entityType: ArchivedItem["entityType"]) {
  switch (entityType) {
    case "product":
      return { label: "Product", icon: Boxes, variant: "secondary" as const, colorClass: "text-blue-600 bg-blue-500/10 border-blue-500/20" };
    case "sales_order":
      return { label: "Sales Order", icon: ShoppingCart, variant: "secondary" as const, colorClass: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" };
    case "purchase_order":
      return { label: "Purchase Order", icon: ShoppingBag, variant: "secondary" as const, colorClass: "text-purple-600 bg-purple-500/10 border-purple-500/20" };
    case "expense":
      return { label: "Expense", icon: Receipt, variant: "secondary" as const, colorClass: "text-amber-600 bg-amber-500/10 border-amber-500/20" };
    case "partner":
      return { label: "Partner", icon: Users, variant: "secondary" as const, colorClass: "text-teal-600 bg-teal-500/10 border-teal-500/20" };
    case "location":
      return { label: "Location", icon: Building2, variant: "secondary" as const, colorClass: "text-slate-600 bg-slate-500/10 border-slate-500/20" };
    default:
      return { label: "Setting / Config", icon: Settings, variant: "secondary" as const, colorClass: "text-slate-600 bg-slate-500/10 border-slate-500/20" };
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function ArchivedPage({ searchParams }: ArchivedPageProps) {
  await requirePermission("company:settings:manage");

  const params = await searchParams;
  const query = params.q ?? "";
  const group = (params.group as TypeGroup) || "all";
  const returnPath = `/admin/settings/archived${group !== "all" ? `?group=${group}` : ""}${query ? `${group !== "all" ? "&" : "?"}q=${encodeURIComponent(query)}` : ""}`;

  const { items, counts } = await getArchivedSummary({ query, group });
  const archivedPage = paginateRows(items, params);

  const tabs: { key: TypeGroup; label: string; count: number }[] = [
    { key: "all", label: "All Items", count: counts.all },
    { key: "products", label: "Products", count: counts.products },
    { key: "sales_orders", label: "Sales Orders", count: counts.sales_orders },
    { key: "purchase_orders", label: "Purchase Orders", count: counts.purchase_orders },
    { key: "expenses", label: "Expenses", count: counts.expenses },
    { key: "partners", label: "Partners", count: counts.partners },
    { key: "locations_config", label: "Locations & Config", count: counts.locations_config },
  ];

  return (
    <PageShell maxWidth="max-w-6xl">
      <PageHeader
        eyebrow="Settings"
        title="Archived & Soft-Deleted Items"
        description="Organized hub for all archived products, purchase orders, sales orders, expenses, partners, and configuration items. Easily search and restore records back to active state."
      />

      <div className="grid gap-5">
        {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
        {params.error ? <Alert kind="error">{params.error}</Alert> : null}

        <div className="rounded-xl border border-border bg-card shadow-xs">
          {/* Group Filter Tabs */}
          <div className="flex overflow-x-auto border-b border-border p-2 gap-1.5 text-xs font-medium scrollbar-none">
            {tabs.map((tab) => {
              const isActive = group === tab.key;
              const href = tab.key === "all" ? "/admin/settings/archived" : `/admin/settings/archived?group=${tab.key}`;
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.25 text-[10px] font-bold ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {tab.count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Search Input Bar */}
          <div className="border-b border-border p-4">
            <div className="max-w-md">
              <TableSearchInput
                placeholder="Search archived records by code, title, or reference..."
                defaultValue={query}
                paramName="q"
              />
            </div>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[768px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Item / Reference</th>
                  <th className="px-4 py-3">Amount / Context</th>
                  <th className="px-4 py-3">Archived On</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <div className="mx-auto flex max-w-xs flex-col items-center justify-center text-center">
                        <Archive className="size-10 text-muted-foreground/40 mb-2" />
                        <p className="font-semibold text-foreground">No archived items found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {query
                            ? `No records match "${query}". Try clearing your search.`
                            : "There are currently no soft-deleted records in this category."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  archivedPage.rows.map((item) => {
                    const badge = getEntityBadgeProps(item.entityType);
                    const BadgeIcon = badge.icon;

                    return (
                      <tr
                        key={`${item.entityType}-${item.id}`}
                        className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${badge.colorClass}`}
                          >
                            <BadgeIcon className="size-3.5" />
                            {item.typeName}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="font-semibold text-foreground">{item.title}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono font-medium text-foreground/80">
                              {item.codeOrNumber}
                            </span>
                            {item.details ? (
                              <>
                                <span>•</span>
                                <span>{item.details}</span>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {item.amountFormatted ? (
                            <span className="font-mono font-semibold text-foreground">
                              {item.amountFormatted}
                            </span>
                          ) : item.statusContext ? (
                            <span className="text-xs font-medium text-muted-foreground">
                              {item.statusContext}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle text-xs text-muted-foreground">
                          {formatDate(item.deletedAt)}
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                          <form action={restoreArchivedItem}>
                            <input type="hidden" name="entityType" value={item.entityType} />
                            <input type="hidden" name="entityId" value={item.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button type="submit" variant="outline" size="sm" className="h-8 text-xs gap-1">
                              <RotateCcw className="size-3.5" data-icon="inline-start" />
                              Restore
                            </Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={archivedPage.pagination} />
        </div>
      </div>
    </PageShell>
  );
}
