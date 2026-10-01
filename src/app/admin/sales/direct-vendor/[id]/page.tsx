import type { ReactNode } from "react";
import { notFound } from "next/navigation";

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

export default async function DirectVendorSaleDetailPage({ params, searchParams }: DirectVendorSaleDetailPageProps) {
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Direct Vendor Sales"
        title={sale.saleNo}
        description={`${sale.customerName} / ${sale.vendorName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href="/admin/sales/direct-vendor" variant="outline">Back</ButtonLink>
            {sale.status === "draft" ? (
              <>
                <form action={postDirectVendorSale}>
                  <input type="hidden" name="directVendorSaleId" value={sale.id} />
                  <Button type="submit">Post</Button>
                </form>
                <form action={cancelDirectVendorSale}>
                  <input type="hidden" name="directVendorSaleId" value={sale.id} />
                  <Button type="submit" variant="danger">Cancel</Button>
                </form>
              </>
            ) : null}
            {canRegisterCustomerPayment ? (
              <PaymentFormDialog
                title="Register Customer Payment"
                description={`Register customer payment for ${sale.saleNo}.`}
                triggerLabel="Register Customer Payment"
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
                description={`Register vendor payment for ${sale.saleNo}.`}
                triggerLabel="Register Vendor Payment"
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
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-6 flex flex-wrap gap-2.5">
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

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Status" value={<StatusBadge status={sale.status} />} />
        <Stat label="Customer Total" value={displaySalesMoney(sale.customerTotalMinor, sale.currencyCode)} />
        <Stat label="Vendor Cost" value={displaySalesMoney(sale.vendorCostTotalMinor, sale.currencyCode)} />
        <Stat label="Margin" value={displaySalesMoney(sale.marginMinor, sale.currencyCode)} />
        <Stat label="Customer Paid" value={displaySalesMoney(sale.customerPaidMinor, sale.currencyCode)} />
        <Stat label="Vendor Paid" value={displaySalesMoney(sale.vendorPaidMinor, sale.currencyCode)} />
        <Stat label="Customer Unpaid" value={displaySalesMoney(customerResidualMinor, sale.currencyCode)} />
        <Stat label="Vendor Unpaid" value={displaySalesMoney(vendorResidualMinor, sale.currencyCode)} />
      </section>

      <section className="mb-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Parties</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Customer" value={sale.customerName} />
            <Info label="Vendor" value={sale.vendorName} />
            <Info label="Owner" value={sale.ownerName ?? "-"} />
            <Info label="Sale Date" value={sale.saleDate} />
          </dl>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Payments</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Customer Term" value={<span className="capitalize">{sale.customerPaymentTerm}</span>} />
            <Info label="Customer Payment" value={sale.customerPaymentTerm === "cash" ? sale.customerPaymentName ?? "-" : "Credit"} />
            <Info label="Customer Ref" value={sale.customerPaymentReference ?? "-"} />
            <Info label="Vendor Term" value={<span className="capitalize">{sale.vendorPaymentTerm}</span>} />
            <Info label="Vendor Payment" value={sale.vendorPaymentTerm === "cash" ? sale.vendorPaymentName ?? "-" : "Credit"} />
            <Info label="Vendor Ref" value={sale.vendorPaymentReference ?? "-"} />
            <Info label="Customer Paid" value={displaySalesMoney(sale.customerPaidMinor, sale.currencyCode)} />
            <Info label="Customer Unpaid" value={displaySalesMoney(customerResidualMinor, sale.currencyCode)} />
            <Info label="Vendor Paid" value={displaySalesMoney(sale.vendorPaidMinor, sale.currencyCode)} />
            <Info label="Vendor Unpaid" value={displaySalesMoney(vendorResidualMinor, sale.currencyCode)} />
          </dl>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="border-b border-border bg-muted/20 p-4">
          <h2 className="text-base font-semibold text-foreground">Lines</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Vendor Cost</th>
                <th className="px-4 py-3 text-right">Sale Price</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Customer Total</th>
                <th className="px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sale.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-foreground">{line.productName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{line.sku}</div>
                    {line.description ? <div className="text-xs text-muted-foreground">{line.description}</div> : null}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{line.quantity} {line.unitCode}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{displaySalesMoney(line.vendorLineTotalMinor, line.currencyCode)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{displaySalesMoney(line.customerUnitPriceMinor, line.currencyCode)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{displaySalesMoney(line.discountMinor, line.currencyCode)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{displaySalesMoney(line.taxAmountMinor, line.currencyCode)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold">{displaySalesMoney(line.customerLineTotalMinor, line.currencyCode)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold">{displaySalesMoney(line.lineMarginMinor, line.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sale.notes ? (
        <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="text-base font-semibold text-foreground">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{sale.notes}</p>
        </section>
      ) : null}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}
