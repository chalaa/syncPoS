import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Package,
  Wallet,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney } from "@/lib/report-formatters";
import { getDashboardReport } from "@/server/reports/reports";
import { PERMISSIONS } from "@/server/iam/permissions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [user, report] = await Promise.all([requirePermission(PERMISSIONS.REPORTS.HUB_VIEW), getDashboardReport()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Operations Overview"
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="size-2 rounded-full bg-primary" />
              Live Operations
            </span>
          </div>
        }
      />

      {/* Welcome & Context Banner */}
      <div className="mb-6 flex flex-col justify-between gap-2 rounded-lg border border-border border-l-4 border-l-primary bg-card px-5 py-4 text-sm shadow-xs sm:flex-row sm:items-center">
        <div className="text-muted-foreground">
          Signed in as <span className="font-semibold text-foreground">{user.username}</span>.
          {" "}Real-time figures calculated from posted documents and payment ledgers.
        </div>
        <div className="text-xs text-muted-foreground">
          Base Currency: <span className="font-semibold text-primary">{report.paymentAccounts[0]?.currencyCode ?? "ETB"}</span>
        </div>
      </div>

      {/* Mobile View: Compact Micro-Metric Bar (sm:hidden) */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar touch-pan-x snap-x snap-mandatory sm:hidden">
        {report.metrics.map((metric) => {
          const toneDot =
            metric.tone === "success"
              ? "bg-primary"
              : metric.tone === "warning"
                ? "bg-gold"
                : metric.tone === "danger"
                  ? "bg-destructive"
                  : "bg-muted-foreground";

          return (
            <Link
              key={metric.label}
              href={metric.href}
              className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs active:bg-secondary/50"
            >
              <span className={`size-2 shrink-0 rounded-full ${toneDot}`} />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</div>
                <div className="font-mono text-xs font-bold text-foreground">{metric.value}</div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Desktop/Tablet KPI Metrics Grid (hidden on mobile) */}
      <section className="hidden mb-6 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
        {report.metrics.map((metric) => {
          const toneBorder =
            metric.tone === "success"
              ? "border-t-primary"
              : metric.tone === "warning"
                ? "border-t-gold"
                : metric.tone === "danger"
                  ? "border-t-destructive"
                  : "border-t-border";

          const toneDot =
            metric.tone === "success"
              ? "bg-primary"
              : metric.tone === "warning"
                ? "bg-gold"
                : metric.tone === "danger"
                  ? "bg-destructive"
                  : "bg-muted-foreground";

          return (
            <Link
              key={metric.label}
              href={metric.href}
              className={`group relative flex flex-col justify-between rounded-xl border border-border ${toneBorder} border-t-3 bg-card p-4 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`size-2 shrink-0 rounded-full ${toneDot}`} />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    {metric.label}
                  </p>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {metric.value}
              </p>
            </Link>
          );
        })}
      </section>

      {/* Accounts and Low Stock Sections */}
      <section className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Payment Account Summary */}
        <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Wallet className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Payment Account Balances</h2>
                <p className="text-xs text-muted-foreground">Cash, bank, card, and mobile-money accounts</p>
              </div>
            </div>
            <Link
              href="/admin/reports/payment-accounts"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              View Report →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Opening</th>
                  <th className="px-4 py-3 text-right">Inbound</th>
                  <th className="px-4 py-3 text-right">Outbound</th>
                  <th className="px-5 py-3 text-right">Net Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {report.paymentAccounts.map((account) => {
                  const netIsPositive = account.netBalanceMinor >= 0;
                  return (
                    <tr key={account.id} className="transition-colors hover:bg-secondary/40">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/reports/payment-accounts?paymentAccountId=${account.id}`}
                          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                        >
                          {account.name}
                        </Link>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {account.code}
                          {account.institutionName ? ` · ${account.institutionName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                        {displayReportMoney(account.openingBalanceMinor, account.currencyCode)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-medium text-primary">
                        +{displayReportMoney(account.inboundMinor, account.currencyCode)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                        -{displayReportMoney(account.outboundMinor, account.currencyCode)}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-mono text-xs font-bold ${netIsPositive ? "text-primary" : "text-destructive"}`}>
                        {displayReportMoney(account.netBalanceMinor, account.currencyCode)}
                      </td>
                    </tr>
                  );
                })}
                {report.paymentAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No payment accounts configured yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        {/* Low / Empty Stock Alert Card */}
        <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-gold/15 text-dark">
                <AlertTriangle className="size-4 text-gold" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Stock Alerts</h2>
                <p className="text-xs text-muted-foreground">Zero or negative stock items by location</p>
              </div>
            </div>
            <Link
              href="/admin/inventory"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Inventory →
            </Link>
          </div>
          <div className="divide-y divide-border/60">
            {report.lowStock.map((row) => (
              <Link
                key={`${row.productId}-${row.locationCode}`}
                href={`/admin/reports/stock?q=${encodeURIComponent(row.sku)}`}
                className="flex items-center justify-between px-5 py-3.5 text-sm transition-colors hover:bg-secondary/40"
              >
                <div>
                  <div className="font-medium text-foreground">{row.productName}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    SKU: {row.sku} · Location: <span className="font-medium text-foreground">{row.locationCode}</span>
                  </div>
                </div>
                <StatusBadge status="out_of_stock" label={`${row.quantityAvailable} available`} />
              </Link>
            ))}
            {report.lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-12 text-center text-sm text-muted-foreground">
                <Package className="mb-2 size-8 text-primary/40" />
                <p className="font-medium text-foreground">Healthy Inventory</p>
                <p className="text-xs text-muted-foreground">No stockouts detected across active locations.</p>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      {/* Recent Activity Section */}
      <section className="mt-7 overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Activity className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent Ledger & Document Activity</h2>
              <p className="text-xs text-muted-foreground">Latest invoices, bills, and payment records</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {report.recentActivity.map((activity) => (
                <tr key={`${activity.activityType}-${activity.id}`} className="transition-colors hover:bg-secondary/40">
                  <td className="px-5 py-3.5">
                    <Link
                      href={activity.href}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {activity.documentNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge
                      status={
                        activity.activityType.toLowerCase().includes("invoice")
                          ? "posted"
                          : activity.activityType.toLowerCase().includes("payment")
                            ? "confirmed"
                            : "warning"
                      }
                      label={activity.activityType}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{activity.activityDate}</td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{activity.partyName ?? "—"}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-sm font-semibold text-foreground">
                    {displayReportMoney(activity.amountMinor, activity.currencyCode)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={activity.href}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Open <ArrowRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {report.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No recent transaction activity recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
