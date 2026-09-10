import {
  BarChart3Icon,
  BanknoteIcon,
  BoxesIcon,
  ClipboardListIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  ArrowUpRightIcon,
} from "lucide-react";
import Link from "next/link";

import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const reports = [
  {
    title: "Sales Report",
    description: "Invoices, sales totals, taxes, paid amounts, residuals, customers, and locations.",
    href: "/admin/reports/sales",
    icon: ShoppingCartIcon,
    accent: "border-l-primary",
  },
  {
    title: "Expense Report",
    description: "Expenses by category, date, vendor, employee, location, paid amount, and residual.",
    href: "/admin/reports/expenses",
    icon: ReceiptIcon,
    accent: "border-l-rose-500",
  },
  {
    title: "Payment Account Statement",
    description: "Inbound and outbound payment movement by cash, bank, card, or mobile-money account.",
    href: "/admin/reports/payment-accounts",
    icon: BanknoteIcon,
    accent: "border-l-accent",
  },
  {
    title: "Payment Report",
    description: "All customer invoice, vendor bill, and expense payments with account, source, and status.",
    href: "/admin/reports/payments",
    icon: BanknoteIcon,
    accent: "border-l-primary",
  },
  {
    title: "Stock Report",
    description: "Current stock by product, location, serial, lot, available quantity, and stock value.",
    href: "/admin/reports/stock",
    icon: BoxesIcon,
    accent: "border-l-teal-600",
  },
  {
    title: "Receivables",
    description: "Open customer invoices and unpaid balances with aging and customer breakdowns.",
    href: "/admin/reports/receivables",
    icon: BarChart3Icon,
    accent: "border-l-amber-500",
  },
  {
    title: "Payables",
    description: "Open vendor bills and unpaid supplier balances with due date tracking.",
    href: "/admin/reports/payables",
    icon: ClipboardListIcon,
    accent: "border-l-indigo-500",
  },
];

export default async function ReportsPage() {
  await requirePermission("report.profit.view");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Financial & Operational Intelligence"
        title="Reports & Analytics"
        description="Monitor real-time ledger records, cash movements, sales velocities, and stock valuations."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;

          return (
            <Link
              key={report.href}
              href={report.href}
              className={`group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md ${report.accent} border-l-4`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="rounded-lg border border-primary/15 bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </div>
                  <ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <h2 className="mt-4 text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  {report.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {report.description}
                </p>
              </div>

              <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>View Analytics</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
              </div>
            </Link>
          );
        })}
      </section>
    </PageShell>
  );
}
