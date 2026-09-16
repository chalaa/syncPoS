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

      <section className="-mx-4 mb-6 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 no-scrollbar snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;

          return (
            <Link
              key={report.href}
              href={report.href}
              className={`group flex w-[78vw] min-w-[220px] max-w-[280px] shrink-0 snap-start flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-5 ${report.accent} border-l-4`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="rounded-lg border border-primary/15 bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:p-2.5">
                    <Icon className="size-4.5 sm:size-5" />
                  </div>
                  <ArrowUpRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                </div>
                <h2 className="mt-3 text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary sm:mt-4 sm:text-base">
                  {report.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2 sm:text-sm">
                  {report.description}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary sm:mt-5">
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
