import { BarChart3Icon, BanknoteIcon, BoxesIcon, ClipboardListIcon, ReceiptIcon, ShoppingCartIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const reports = [
  {
    title: "Sales Report",
    description: "Invoices, sales totals, taxes, paid amounts, residuals, customers, and locations.",
    href: "/admin/reports/sales",
    icon: ShoppingCartIcon,
  },
  {
    title: "Expense Report",
    description: "Expenses by category, date, vendor, employee, location, paid amount, and residual.",
    href: "/admin/reports/expenses",
    icon: ReceiptIcon,
  },
  {
    title: "Payment Account Statement",
    description: "Inbound and outbound payment movement by cash, bank, card, or mobile-money account.",
    href: "/admin/reports/payment-accounts",
    icon: BanknoteIcon,
  },
  {
    title: "Payment Report",
    description: "All customer invoice, vendor bill, and expense payments with account, source, and status.",
    href: "/admin/reports/payments",
    icon: BanknoteIcon,
  },
  {
    title: "Stock Report",
    description: "Current stock by product, location, serial, lot, available quantity, and stock value.",
    href: "/admin/reports/stock",
    icon: BoxesIcon,
  },
  {
    title: "Receivables",
    description: "Open customer invoices and unpaid balances.",
    href: "/admin/reports/receivables",
    icon: BarChart3Icon,
  },
  {
    title: "Payables",
    description: "Open vendor bills and unpaid supplier balances.",
    href: "/admin/reports/payables",
    icon: ClipboardListIcon,
  },
];

export default async function ReportsPage() {
  await requirePermission("report.profit.view");

  return (
    <PageShell>
      <PageHeader eyebrow="Reports" title="Operational Reports" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;

          return (
            <article key={report.href} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-border bg-muted p-2">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{report.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
                </div>
              </div>
              <div className="mt-5">
                <ButtonLink href={report.href}>Open report</ButtonLink>
              </div>
            </article>
          );
        })}
      </section>
    </PageShell>
  );
}
