import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/session";
import {
  displayPurchaseMoney,
  getPurchaseLandedCostList,
  getPurchaseOrderList,
  getPurchaseReceiptList,
} from "@/server/purchasing/purchasing";
import {
  displayPaymentMoney,
  getPaymentList,
} from "@/server/payments/payments";
import { displayReturnMoney, getSupplierReturnList } from "@/server/returns/returns";
import type {
  PurchaseLandedCostListRow,
  PurchaseOrderListRow,
  PurchaseReceiptListRow,
} from "@/server/purchasing/types";
import type { PaymentListRow } from "@/server/payments/types";
import type { SupplierReturnListRow } from "@/server/returns/types";

export const dynamic = "force-dynamic";

type PurchasingPageProps = {
  searchParams: Promise<{
    view?: string;
    purchaseOrderId?: string;
    vendorBillId?: string;
    partnerId?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function PurchasingPage({ searchParams }: PurchasingPageProps) {
  await requirePermission("inventory.receive");

  const params = await searchParams;
  const view = params.view ?? "orders";

  if (view === "receipts") {
    const receipts = await getPurchaseReceiptList(params.purchaseOrderId);

    return (
      <PurchasingLayout currentView={view} title="Receipts" notice={params.notice} error={params.error}>
        <ReceiptList receipts={receipts} />
      </PurchasingLayout>
    );
  }

  if (view === "landed-costs") {
    const landedCosts = await getPurchaseLandedCostList(params.purchaseOrderId);

    return (
      <PurchasingLayout
        currentView={view}
        title="Landed Costs"
        notice={params.notice}
        error={params.error}
        actions={<ButtonLink href="/admin/purchasing/landed-costs/new">New Landed Cost</ButtonLink>}
      >
        <LandedCostList landedCosts={landedCosts} />
      </PurchasingLayout>
    );
  }

  if (view === "payments") {
    const payments = await getPaymentList({
      paymentType: "outbound",
      purchaseOrderId: params.purchaseOrderId,
      vendorBillId: params.vendorBillId,
    });

    return (
      <PurchasingLayout currentView={view} title="Supplier Payments" notice={params.notice} error={params.error}>
        <PaymentList payments={payments} />
      </PurchasingLayout>
    );
  }

  if (view === "returns") {
    const returns = await getSupplierReturnList(params.purchaseOrderId);

    return (
      <PurchasingLayout
        currentView={view}
        title="Supplier Returns"
        notice={params.notice}
        error={params.error}
        actions={<ButtonLink href="/admin/purchasing/returns/new">New Supplier Return</ButtonLink>}
      >
        <SupplierReturnList returns={returns} />
      </PurchasingLayout>
    );
  }

  const orders = await getPurchaseOrderList();

  return (
    <PurchasingLayout
      currentView={view}
      title="Purchase Orders"
      notice={params.notice}
      error={params.error}
      actions={<ButtonLink href="/admin/purchasing/new" variant="default">New RFQ</ButtonLink>}
    >
      <PurchaseOrderList orders={orders} />
    </PurchasingLayout>
  );
}

const purchasingTabs = [
  { label: "RFQs / Orders", href: "/admin/purchasing", key: "orders" },
  { label: "Receipts", href: "/admin/purchasing?view=receipts", key: "receipts" },
  { label: "Landed Costs", href: "/admin/purchasing?view=landed-costs", key: "landed-costs" },
  { label: "Payments", href: "/admin/purchasing?view=payments", key: "payments" },
  { label: "Returns", href: "/admin/purchasing?view=returns", key: "returns" },
];

function PurchasingLayout({
  title,
  currentView = "orders",
  notice,
  error,
  actions,
  children,
}: {
  title: string;
  currentView?: string;
  notice?: string;
  error?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader eyebrow="Purchasing Workspace" title={title} actions={actions} />

      {/* Sub-navigation tabs */}
      <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
        {purchasingTabs.map((tab) => {
          const isActive = currentView === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {isActive ? <span className="size-1.5 rounded-full bg-gold" /> : null}
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      {children}
    </PageShell>
  );
}

function SupplierReturnList({ returns }: { returns: SupplierReturnListRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Return</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Vendor Refund</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {returns.map((record) => (
              <tr key={record.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/returns/${record.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {record.returnNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">{record.receiptNo}</td>
                <td className="px-4 py-3.5 font-medium text-foreground">{record.supplierName}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{record.returnDate}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{record.lineCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/purchasing/returns/${record.id}`} size="sm" variant="outline">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No supplier returns recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LandedCostList({ landedCosts }: { landedCosts: PurchaseLandedCostListRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Purchase Order</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Allocation</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {landedCosts.map((cost) => (
              <tr key={cost.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3.5 font-semibold text-foreground">{cost.costNo}</td>
                <td className="px-4 py-3.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{cost.costType}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={cost.status} />
                </td>
                <td className="px-4 py-3.5">
                  {cost.purchaseOrderId ? (
                    <Link href={`/admin/purchasing/${cost.purchaseOrderId}`} className="text-xs text-primary underline-offset-4 hover:underline">
                      {cost.orderNo}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{cost.receiptNo ?? "-"}</td>
                <td className="px-4 py-3.5 font-medium text-foreground">{cost.vendorName ?? "-"}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground capitalize">{cost.allocationMethod}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{cost.allocationCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/purchasing/landed-costs/${cost.id}`} size="sm" variant="outline">
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {landedCosts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No landed costs recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PurchaseOrderList({ orders }: { orders: PurchaseOrderListRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Deliver To</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {orders.map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/${order.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {order.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-medium text-foreground">{order.supplierName}</div>
                  <div className="text-xs text-muted-foreground">Ref {order.vendorReference ?? "-"}</div>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-xs text-muted-foreground">{order.orderDate}</div>
                  {order.paymentTerm === "credit" ? (
                    <div className="text-[11px] text-muted-foreground">Due {order.paymentDueDate ?? "-"}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold capitalize text-foreground">{order.paymentTerm}</span>
                    {order.residualAmountMinor === 0 ? (
                      <StatusBadge status="paid" label="Fully Paid" />
                    ) : order.residualAmountMinor < order.totalMinor ? (
                      <StatusBadge
                        status="partially_paid"
                        label={`Due ${displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}`}
                      />
                    ) : (
                      <StatusBadge
                        status="unpaid"
                        label={`Unpaid ${displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}`}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{order.deliverToLocationCode ?? "-"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{order.quantityOrdered}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-medium">{order.quantityReceived}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displayPurchaseMoney(order.totalMinor, order.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/purchasing/${order.id}`} size="sm" variant="outline">
                    Open
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No purchase orders recorded yet.{" "}
                  <Link href="/admin/purchasing/new" className="font-semibold text-primary underline-offset-4 hover:underline">
                    Create the first PO →
                  </Link>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceiptList({ receipts }: { receipts: PurchaseReceiptListRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Purchase Order</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/receipts/${receipt.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {receipt.receiptNo}
                  </Link>
                  {receipt.supplierInvoiceNo ? (
                    <div className="text-xs text-muted-foreground">Invoice: {receipt.supplierInvoiceNo}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/${receipt.purchaseOrderId}`} className="text-xs text-primary underline-offset-4 hover:underline">
                    {receipt.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{receipt.supplierName}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={receipt.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{receipt.receiptDate}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{receipt.locationCode ?? "-"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{receipt.lineCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-medium">{receipt.quantityReceived}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {displayPurchaseMoney(receipt.totalMinor, receipt.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/purchasing/receipts/${receipt.id}`} size="sm" variant="outline">
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No goods receipts recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentList({ payments }: { payments: PaymentListRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Allocated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {payments.map((payment) => (
              <tr key={payment.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/payments/${payment.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {payment.paymentNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{payment.partnerName ?? "-"}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={payment.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{payment.paymentDate}</td>
                <td className="px-4 py-3.5 text-xs font-medium text-foreground">{payment.paymentMethodName}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{payment.paymentAccountName}</td>
                <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{payment.reference ?? "-"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {displayPaymentMoney(payment.amountMinor, payment.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-primary font-medium">
                  {displayPaymentMoney(payment.allocatedAmountMinor, payment.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/purchasing/payments/${payment.id}`} size="sm" variant="outline">
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No supplier payments recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

