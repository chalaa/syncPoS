import Link from "next/link";

import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney, getDashboardReport } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [user, report] = await Promise.all([requirePermission("reports:profit:view"), getDashboardReport()]);

  return (
    <PageShell>
      <PageHeader eyebrow="Dashboard" title="Operations Overview" />

      <div className="mb-5 rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.username}</span>. Dashboard totals use posted documents and operational payment records, not full accounting journals.
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {report.metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent"
          >
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Payment Account Summary</h2>
            <p className="text-sm text-muted-foreground">Cash, bank, card, and mobile-money movement by account.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3 text-right">Opening</th>
                  <th className="px-4 py-3 text-right">Inbound</th>
                  <th className="px-4 py-3 text-right">Outbound</th>
                  <th className="px-4 py-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {report.paymentAccounts.map((account) => (
                  <tr key={account.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/admin/reports/payment-accounts?paymentAccountId=${account.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {account.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{account.code}{account.institutionName ? ` / ${account.institutionName}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{displayReportMoney(account.openingBalanceMinor, account.currencyCode)}</td>
                    <td className="px-4 py-3 text-right">{displayReportMoney(account.inboundMinor, account.currencyCode)}</td>
                    <td className="px-4 py-3 text-right">{displayReportMoney(account.outboundMinor, account.currencyCode)}</td>
                    <td className="px-4 py-3 text-right">{displayReportMoney(account.netBalanceMinor, account.currencyCode)}</td>
                  </tr>
                ))}
                {report.paymentAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No payment accounts configured.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold">Low / Empty Stock</h2>
            <p className="text-sm text-muted-foreground">Products with no available stock in a location.</p>
          </div>
          <div className="divide-y divide-border">
            {report.lowStock.map((row) => (
              <Link key={`${row.productId}-${row.locationCode}`} href={`/admin/reports/stock?q=${encodeURIComponent(row.sku)}`} className="block px-4 py-3 text-sm hover:bg-accent">
                <div className="font-medium">{row.productName}</div>
                <div className="text-muted-foreground">{row.sku} / {row.locationCode} / Available {row.quantityAvailable}</div>
              </Link>
            ))}
            {report.lowStock.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No empty stock rows found.</div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">Latest invoices, bills, and payments.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {report.recentActivity.map((activity) => (
                <tr key={`${activity.activityType}-${activity.id}`} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={activity.href} className="font-medium text-primary underline-offset-4 hover:underline">
                      {activity.documentNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{activity.activityType}</td>
                  <td className="px-4 py-3">{activity.activityDate}</td>
                  <td className="px-4 py-3">{activity.partyName ?? "-"}</td>
                  <td className="px-4 py-3 text-right">{displayReportMoney(activity.amountMinor, activity.currencyCode)}</td>
                </tr>
              ))}
              {report.recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No recent activity yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
