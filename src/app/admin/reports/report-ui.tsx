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
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { displayReportMoney } from "@/server/reports/reports";
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
  return (
    <form className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-xs md:grid-cols-5">
      <label className="space-y-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <SearchIcon className="size-3.5" />
          Search
        </span>
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="Filter keywords..."
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <label className="space-y-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <CalendarIcon className="size-3.5" />
          From
        </span>
        <input
          name="dateFrom"
          type="date"
          defaultValue={dateFrom ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
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
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
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
            placeholder="posted, draft..."
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
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
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="">All Types</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </label>
      ) : null}
      {children}
      <div className="flex items-end gap-2">
        <Button type="submit" className="h-9 font-medium shadow-xs">
          Apply Filters
        </Button>
        <Button asChild variant="outline" className="h-9 gap-1.5">
          <Link href=".">
            <RotateCcwIcon className="size-3.5" />
            Reset
          </Link>
        </Button>
      </div>
    </form>
  );
}

export function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  return (
    <div className="mb-6 grid gap-3.5 sm:grid-cols-2 md:grid-cols-4">
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
    <article className={`rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:shadow-sm ${border} border-l-4`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-xl tracking-tight ${highlight}`}>{value}</p>
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
