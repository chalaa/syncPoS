"use client";

import {
  BanknoteIcon,
  BarChart3Icon,
  BoxesIcon,
  CalendarIcon,
  ClipboardListIcon,
  FilterIcon,
  LayoutGridIcon,
  ReceiptIcon,
  RotateCcwIcon,
  SearchIcon,
  ShoppingCartIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { displayReportMoney } from "@/lib/report-formatters";
import type { ReportSummary } from "@/server/reports/types";

const REPORT_TABS = [
  { id: "overview", label: "Overview", href: "/admin/reports", icon: LayoutGridIcon },
  { id: "sales", label: "Sales", href: "/admin/reports/sales", icon: ShoppingCartIcon },
  { id: "expenses", label: "Expenses", href: "/admin/reports/expenses", icon: ReceiptIcon },
  { id: "payment-accounts", label: "Accounts", href: "/admin/reports/payment-accounts", icon: BanknoteIcon },
  { id: "payments", label: "Payments", href: "/admin/reports/payments", icon: BanknoteIcon },
  { id: "stock", label: "Stock", href: "/admin/reports/stock", icon: BoxesIcon },
  { id: "receivables", label: "Receivables", href: "/admin/reports/receivables", icon: BarChart3Icon },
  { id: "payables", label: "Payables", href: "/admin/reports/payables", icon: ClipboardListIcon },
];

export function ReportNavTabs({ current }: { current: string }) {
  return (
    <div className="mb-6 border-b border-border">
      <div className="flex flex-wrap gap-1">
        {REPORT_TABS.map((tab) => {
          const isActive = tab.id === current;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "border-primary bg-primary/5 font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ReportFilters({
  query,
  dateFrom,
  dateTo,
  status,
  paymentType,
  children,
}: {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  paymentType?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set(name, value.trim());
    } else {
      params.delete(name);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-xs md:grid-cols-5">
      <div className="space-y-1 md:col-span-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <SearchIcon className="size-3.5" />
          Search
        </span>
        <TableSearchInput defaultValue={query ?? ""} placeholder="Filter keywords..." />
      </div>

      <label className="space-y-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarIcon className="size-3.5" />
          From
        </span>
        <input
          name="dateFrom"
          type="date"
          defaultValue={dateFrom ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
        />
      </label>

      <label className="space-y-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarIcon className="size-3.5" />
          To
        </span>
        <input
          name="dateTo"
          type="date"
          defaultValue={dateTo ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
        />
      </label>

      {status !== undefined ? (
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FilterIcon className="size-3.5" />
            Status
          </span>
          <input
            name="status"
            defaultValue={status}
            onChange={(e) => updateParam("status", e.target.value)}
            placeholder="posted, draft..."
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
          />
        </label>
      ) : null}

      {paymentType !== undefined ? (
        <label className="space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FilterIcon className="size-3.5" />
            Type
          </span>
          <select
            name="paymentType"
            defaultValue={paymentType}
            onChange={(e) => updateParam("paymentType", e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-ring"
          >
            <option value="">All Types</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </label>
      ) : null}

      {children}

      <div className="flex items-end gap-2 md:col-span-5 md:justify-end">
        <Button asChild variant="outline" className="h-9 gap-1.5">
          <Link href={pathname}>
            <RotateCcwIcon className="size-3.5" />
            Reset Filters
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  return (
    <>
      {/* Mobile View: Compact Micro-Metric Bar (sm:hidden) */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar touch-pan-x snap-x snap-mandatory sm:hidden">
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Records</div>
            <div className="font-mono text-xs font-bold text-foreground">{summary.count}</div>
          </div>
        </div>
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-primary/30 bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gross Total</div>
            <div className="font-mono text-xs font-bold text-primary">
              {displayReportMoney(summary.totalMinor, summary.currencyCode)}
            </div>
          </div>
        </div>
        {summary.paidMinor !== undefined ? (
          <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-emerald-500/30 bg-card px-2.5 py-1.5 shadow-2xs">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Settled / Paid</div>
              <div className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {displayReportMoney(summary.paidMinor, summary.currencyCode)}
              </div>
            </div>
          </div>
        ) : null}
        {summary.residualMinor !== undefined ? (
          <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-amber-500/30 bg-card px-2.5 py-1.5 shadow-2xs">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Residual</div>
              <div className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                {displayReportMoney(summary.residualMinor, summary.currencyCode)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Desktop/Tablet Summary Cards (hidden on mobile) */}
      <div className="hidden mb-6 sm:grid sm:grid-cols-2 md:grid-cols-4 sm:gap-3">
        <SummaryCard label="Total Records" value={String(summary.count)} border="border-l-slate-400" />
        <SummaryCard
          label="Gross Total"
          value={displayReportMoney(summary.totalMinor, summary.currencyCode)}
          border="border-l-primary"
          highlight="text-primary font-bold"
        />
        {summary.paidMinor !== undefined ? (
          <SummaryCard
            label="Settled / Paid"
            value={displayReportMoney(summary.paidMinor, summary.currencyCode)}
            border="border-l-emerald-600"
            highlight="text-emerald-700 dark:text-emerald-400 font-bold"
          />
        ) : null}
        {summary.residualMinor !== undefined ? (
          <SummaryCard
            label="Open Balance / Residual"
            value={displayReportMoney(summary.residualMinor, summary.currencyCode)}
            border="border-l-accent"
            highlight="text-amber-700 dark:text-amber-400 font-bold"
          />
        ) : null}
      </div>
    </>
  );
}

export function SummaryCard({
  label,
  value,
  border = "border-l-primary",
  highlight = "font-bold text-foreground",
}: {
  label: string;
  value: string;
  border?: string;
  highlight?: string;
}) {
  return (
    <article className={`flex w-[68vw] min-w-[190px] max-w-[240px] shrink-0 snap-start flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-xs transition-all hover:shadow-sm sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4 ${border} border-l-4`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate sm:text-xs">{label}</p>
      <p className={`mt-1 font-mono text-lg tracking-tight sm:text-xl ${highlight}`}>{value}</p>
    </article>
  );
}

export function EmptyRows({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No records found</p>
        <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search keywords, status, or date range.</p>
      </td>
    </tr>
  );
}
