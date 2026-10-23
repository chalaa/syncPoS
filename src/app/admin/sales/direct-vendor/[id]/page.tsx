import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  DollarSign,
  Package,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
} from "lucide-react";

import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { DetailStatCard } from "@/components/ui/detail-stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { displaySalesMoney } from "@/lib/catalog-utils";
import { requirePermission } from "@/server/auth/session";
import { getDirectVendorSaleDetail } from "@/server/direct-vendor-sales/direct-vendor-sales";
import { getActivePaymentAccounts } from "@/server/payments/payments";
import { PERMISSIONS } from "@/server/iam/permissions";

import {
  cancelDirectVendorSale,
  postDirectVendorSale,
  registerDirectVendorCustomerPayment,
  registerDirectVendorVendorPayment,
} from "../actions";

export const dynamic = "force-dynamic";

type DirectVendorSaleDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function DirectVendorSaleDetailPage({
  params,
  searchParams,
}: DirectVendorSaleDetailPageProps) {
  await requirePermission(PERMISSIONS.SALES.ORDERS_VIEW);
  const [{ id }, query, inboundPaymentAccounts, outboundPaymentAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("inbound"),
    getActivePaymentAccounts("outbound"),
  ]);
  const sale = await getDirectVendorSaleDetail(id);

  if (!sale) {
    notFound();
  }

  const customerResidualMinor = Math.max(sale.customerTotalMinor - sale.customerPaidMinor, 0);
  const vendorResidualMinor = Math.max(sale.vendorCostTotalMinor - sale.vendorPaidMinor, 0);
  const canRegisterCustomerPayment = sale.status === "posted" && customerResidualMinor > 0;
  const canRegisterVendorPayment = sale.status === "posted" && vendorResidualMinor > 0;

  const customerPaidStatus =
    sale.customerPaidMinor >= sale.customerTotalMinor && sale.customerTotalMinor > 0
      ? "Fully Paid"
      : sale.customerPaidMinor > 0
      ? "Partially Paid"
      : "Not Paid";

  const vendorPaidStatus =
    sale.vendorPaidMinor >= sale.vendorCostTotalMinor && sale.vendorCostTotalMinor > 0
      ? "Fully Paid"
      : sale.vendorPaidMinor > 0
      ? "Partially Paid"
      : "Not Paid";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales Workspace"
        title={sale.saleNo}
        description={`Direct vendor drop-shipment: ${sale.customerName} (Client) · ${sale.vendorName} (Vendor)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/admin/sales/direct-vendor" variant="outline" className="gap-1.5 font-semibold">
              <ArrowLeft className="size-4" />
              <span>Back to Direct Sales</span>
            </ButtonLink>

            {sale.status === "draft" ? (
              <>
                <form action={postDirectVendorSale}>
                  <input type="hidden" name="directVendorSaleId" value={sale.id} />
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110"
                  >
                    Post Direct Sale
                  </Button>
                </form>
                <form action={cancelDirectVendorSale}>
                  <input type="hidden" name="directVendorSaleId" value={sale.id} />
                  <Button type="submit" variant="danger">
                    Cancel Sale
                  </Button>
                </form>
              </>
            ) : null}

            {canRegisterCustomerPayment ? (
              <PaymentFormDialog
                title="Register Customer Payment"
                description={`Register received payment from ${sale.customerName} for ${sale.saleNo}.`}
                triggerLabel="Customer Payment"
                submitLabel="Post Customer Payment"
                action={registerDirectVendorCustomerPayment}
                hiddenFieldName="directVendorSaleId"
                hiddenFieldValue={sale.id}
                paymentAccounts={inboundPaymentAccounts}
                currencyCode={sale.currencyCode}
                amountMinor={customerResidualMinor}
              />
            ) : null}

            {canRegisterVendorPayment ? (
              <PaymentFormDialog
                title="Register Vendor Payment"
                description={`Disburse payment to vendor ${sale.vendorName} for ${sale.saleNo}.`}
                triggerLabel="Vendor Payment"
                submitLabel="Post Vendor Payment"
                action={registerDirectVendorVendorPayment}
                hiddenFieldName="directVendorSaleId"
                hiddenFieldValue={sale.id}
                paymentAccounts={outboundPaymentAccounts}
                currencyCode={sale.currencyCode}
                amountMinor={vendorResidualMinor}
                triggerVariant="outline"
              />
            ) : null}

            <StatusBadge status={sale.status} size="lg" />
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      {/* Linked Payments Quick Stat Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          <DetailStatCard
            href={`/admin/sales?view=payments&directVendorSaleId=${sale.id}`}
            count={sale.customerPaymentCount}
            label="Customer Payments"
          />
          <DetailStatCard
            href={`/admin/purchasing?view=payments&directVendorSaleId=${sale.id}`}
            count={sale.vendorPaymentCount}
            label="Vendor Payments"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-muted/80 border border-border px-3 py-1 font-medium text-muted-foreground">
            Customer Settlement: <strong className="text-foreground">{customerPaidStatus}</strong>
          </span>
          <span className="rounded-full bg-muted/80 border border-border px-3 py-1 font-medium text-muted-foreground">
            Vendor Settlement: <strong className="text-foreground">{vendorPaidStatus}</strong>
          </span>
        </div>
      </div>

      {/* KPI Financial Highlight Cards */}
      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        <KpiStat
          icon={<DollarSign className="size-4" />}
          label="Customer Total"
          value={displaySalesMoney(sale.customerTotalMinor, sale.currencyCode)}
          subtitle={`Paid: ${displaySalesMoney(sale.customerPaidMinor, sale.currencyCode)}`}
          variant="emerald"
        />
        <KpiStat
          icon={<TrendingUp className="size-4" />}
          label="Net Profit Margin"
          value={displaySalesMoney(sale.marginMinor, sale.currencyCode)}
          subtitle={
            sale.customerTotalMinor > 0
              ? `${((sale.marginMinor / sale.customerTotalMinor) * 100).toFixed(1)}% gross return`
              : "0.0%"
          }
          variant="gold"
        />
        <KpiStat
          icon={<Truck className="size-4" />}
          label="Vendor Sourcing Cost"
          value={displaySalesMoney(sale.vendorCostTotalMinor, sale.currencyCode)}
          subtitle={`Paid: ${displaySalesMoney(sale.vendorPaidMinor, sale.currencyCode)}`}
          variant="blue"
        />
        <KpiStat
          icon={<Wallet className="size-4" />}
          label="Customer Balance"
          value={displaySalesMoney(customerResidualMinor, sale.currencyCode)}
          subtitle={`Vendor balance: ${displaySalesMoney(vendorResidualMinor, sale.currencyCode)}`}
          variant={customerResidualMinor > 0 ? "amber" : "neutral"}
        />
      </section>

      {/* Commercial Parties & Dual-Payment Details */}
      <section className="mb-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-foreground">Order Parties & Dates</h2>
            </div>
          </div>
          <dl className="grid gap-3.5 text-xs sm:grid-cols-2">
            <Info label="Customer" value={sale.customerName} />
            <Info label="Vendor" value={sale.vendorName} />
            <Info label="Sales Owner" value={sale.ownerName ?? "-"} />
            <Info label="Sale Date" value={sale.saleDate} />
          </dl>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="size-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-foreground">Both-Way Payment Terms</h2>
            </div>
          </div>
          <dl className="grid gap-3.5 text-xs sm:grid-cols-2">
            <Info
              label="Customer Term"
              value={
                <span className="capitalize font-semibold text-primary">{sale.customerPaymentTerm}</span>
              }
            />
            <Info
              label="Customer Method"
              value={sale.customerPaymentTerm === "cash" ? sale.customerPaymentName ?? "-" : "Credit"}
            />
            <Info
              label="Vendor Term"
              value={
                <span className="capitalize font-semibold text-blue-600 dark:text-blue-400">
                  {sale.vendorPaymentTerm}
                </span>
              }
            />
            <Info
              label="Vendor Method"
              value={sale.vendorPaymentTerm === "cash" ? sale.vendorPaymentName ?? "-" : "Credit"}
            />
            <Info
              label="Customer Paid / Unpaid"
              value={`${displaySalesMoney(sale.customerPaidMinor, sale.currencyCode)} / ${displaySalesMoney(
                customerResidualMinor,
                sale.currencyCode,
              )}`}
            />
            <Info
              label="Vendor Paid / Unpaid"
              value={`${displaySalesMoney(sale.vendorPaidMinor, sale.currencyCode)} / ${displaySalesMoney(
                vendorResidualMinor,
                sale.currencyCode,
              )}`}
            />
          </dl>
        </div>
      </section>

      {/* Product Lines Section */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Package className="size-3.5" />
            </span>
            <h2 className="text-sm font-bold tracking-tight text-foreground">Sold Products & Pricing</h2>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-primary">
              {sale.lines.length}
            </span>
          </div>
        </div>

        {/* Mobile View: Clean Card List (< md) */}
        <div className="divide-y divide-border/60 md:hidden p-3 space-y-3">
          {sale.lines.map((line, idx) => (
            <div key={line.id} className="rounded-xl border border-border/80 bg-background/50 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-foreground">{line.productName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                </div>
                <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                  {line.quantity} {line.unitCode}
                </span>
              </div>

              {line.description ? (
                <p className="text-xs text-muted-foreground">{line.description}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Sale Price:</span>{" "}
                  <strong className="font-mono text-foreground">
                    {displaySalesMoney(line.customerUnitPriceMinor, line.currencyCode)}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Vendor Cost:</span>{" "}
                  <span className="font-mono text-muted-foreground">
                    {displaySalesMoney(line.vendorLineTotalMinor, line.currencyCode)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                <div className="text-muted-foreground">
                  Line Total:{" "}
                  <strong className="font-mono text-foreground font-bold">
                    {displaySalesMoney(line.customerLineTotalMinor, line.currencyCode)}
                  </strong>
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  Margin: {displaySalesMoney(line.lineMarginMinor, line.currencyCode)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Full Data Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Vendor Cost</th>
                <th className="px-4 py-3 text-right">Sale Price</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Customer Total</th>
                <th className="px-4 py-3 text-right">Line Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sale.lines.map((line) => (
                <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-foreground">{line.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                    {line.description ? <div className="text-xs text-muted-foreground">{line.description}</div> : null}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">
                    {line.quantity} {line.unitCode}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                    {displaySalesMoney(line.vendorLineTotalMinor, line.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">
                    {displaySalesMoney(line.customerUnitPriceMinor, line.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                    {displaySalesMoney(line.taxAmountMinor, line.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                    {displaySalesMoney(line.customerLineTotalMinor, line.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {displaySalesMoney(line.lineMarginMinor, line.currencyCode)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes Section */}
      {sale.notes ? (
        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Order Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{sale.notes}</p>
        </section>
      ) : null}
    </PageShell>
  );
}

function KpiStat({
  icon,
  label,
  value,
  subtitle,
  variant = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  subtitle?: string;
  variant?: "emerald" | "gold" | "blue" | "amber" | "neutral";
}) {
  const styles = {
    emerald: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card text-emerald-600 dark:text-emerald-400",
    gold: "border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-background to-card text-amber-600 dark:text-amber-400",
    blue: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-background to-card text-blue-600 dark:text-blue-400",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
    neutral: "border-border/80 bg-card text-muted-foreground",
  };

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-3 sm:p-4 shadow-xs transition-all ${styles[variant]}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-2xs">
          {icon}
        </div>
      </div>
      <div className="mt-1.5 min-w-0 sm:mt-2">
        <p className="truncate font-mono text-base sm:text-xl font-extrabold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[10px] sm:text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
