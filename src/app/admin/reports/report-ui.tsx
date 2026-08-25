import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { displayReportMoney } from "@/server/reports/reports";
import type { ReportSummary } from "@/server/reports/types";

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
    <form className="mb-5 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-5">
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase text-muted-foreground">Search</span>
        <input
          name="q"
          defaultValue={query ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase text-muted-foreground">From</span>
        <input
          name="dateFrom"
          type="date"
          defaultValue={dateFrom ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium uppercase text-muted-foreground">To</span>
        <input
          name="dateTo"
          type="date"
          defaultValue={dateTo ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      {status !== undefined ? (
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-muted-foreground">Status</span>
          <input
            name="status"
            defaultValue={status}
            placeholder="posted, draft..."
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
      ) : null}
      {paymentType !== undefined ? (
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase text-muted-foreground">Type</span>
          <select
            name="paymentType"
            defaultValue={paymentType}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </label>
      ) : null}
      {children}
      <div className="flex items-end gap-2">
        <Button type="submit">Apply</Button>
        <Button asChild variant="outline">
          <Link href=".">Reset</Link>
        </Button>
      </div>
    </form>
  );
}

export function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-4">
      <SummaryCard label="Rows" value={String(summary.count)} />
      <SummaryCard label="Total" value={displayReportMoney(summary.totalMinor, summary.currencyCode)} />
      {summary.paidMinor !== undefined ? (
        <SummaryCard label="Paid" value={displayReportMoney(summary.paidMinor, summary.currencyCode)} />
      ) : null}
      {summary.residualMinor !== undefined ? (
        <SummaryCard label="Residual" value={displayReportMoney(summary.residualMinor, summary.currencyCode)} />
      ) : null}
    </div>
  );
}

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </article>
  );
}

export function EmptyRows({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-muted-foreground">
        No rows match the selected filters.
      </td>
    </tr>
  );
}
