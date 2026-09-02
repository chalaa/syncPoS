import Link from "next/link";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
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
      <PurchasingLayout title="Receipts" notice={params.notice} error={params.error}>
        <ReceiptList receipts={receipts} />
      </PurchasingLayout>
    );
  }

  if (view === "landed-costs") {
    const landedCosts = await getPurchaseLandedCostList(params.purchaseOrderId);

    return (
      <PurchasingLayout
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
      <PurchasingLayout title="Supplier Payments" notice={params.notice} error={params.error}>
        <PaymentList payments={payments} />
      </PurchasingLayout>
    );
  }

  if (view === "returns") {
    const returns = await getSupplierReturnList(params.purchaseOrderId);

    return (
      <PurchasingLayout
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
      title="Purchase Orders"
      notice={params.notice}
      error={params.error}
      actions={<ButtonLink href="/admin/purchasing/new" variant="default">New RFQ</ButtonLink>}
    >
      <PurchaseOrderList orders={orders} />
    </PurchasingLayout>
  );
}

function SupplierReturnList({ returns }: { returns: SupplierReturnListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
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
          <tbody>
            {returns.map((record) => (
              <tr key={record.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/purchasing/returns/${record.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {record.returnNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{record.receiptNo}</td>
                <td className="px-4 py-3">{record.supplierName}</td>
                <td className="px-4 py-3 capitalize">{record.status.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{record.returnDate}</td>
                <td className="px-4 py-3 text-right">{record.lineCount}</td>
                <td className="px-4 py-3 text-right">{displayReturnMoney(record.refundAmountMinor, record.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/purchasing/returns/${record.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No supplier returns found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PurchasingLayout({
  title,
  notice,
  error,
  actions,
  children,
}: {
  title: string;
  notice?: string;
  error?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader eyebrow="Purchasing" title={title} actions={actions} />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      {children}
    </PageShell>
  );
}

function LandedCostList({ landedCosts }: { landedCosts: PurchaseLandedCostListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
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
          <tbody>
            {landedCosts.map((cost) => (
              <tr key={cost.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{cost.costNo}</td>
                <td className="px-4 py-3 capitalize">{cost.costType}</td>
                <td className="px-4 py-3 capitalize">{cost.status}</td>
                <td className="px-4 py-3">
                  {cost.purchaseOrderId ? (
                    <Link href={`/admin/purchasing/${cost.purchaseOrderId}`} className="text-primary underline-offset-4 hover:underline">
                      {cost.orderNo}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3">{cost.receiptNo ?? "-"}</td>
                <td className="px-4 py-3">{cost.vendorName ?? "-"}</td>
                <td className="px-4 py-3 capitalize">{cost.allocationMethod}</td>
                <td className="px-4 py-3 text-right">{cost.allocationCount}</td>
                <td className="px-4 py-3 text-right">{displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ButtonLink href={`/admin/purchasing/landed-costs/${cost.id}`} size="sm">
                      Details
                    </ButtonLink>
                  </div>
                </td>
              </tr>
            ))}
            {landedCosts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  No landed costs found.
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
    <section className="rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
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
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/purchasing/${order.id}`} className="text-primary underline-offset-4 hover:underline">
                      {order.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{order.supplierName}</div>
                    <div className="text-xs text-muted-foreground">Ref {order.vendorReference ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">{order.status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <div>{order.orderDate}</div>
                    <div className="text-xs text-muted-foreground">ETA {order.expectedDate ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="capitalize">{order.paymentTerm}</div>
                    <div className="text-xs text-muted-foreground">
                      Unpaid {displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{order.deliverToLocationCode ?? "-"}</td>
                  <td className="px-4 py-3 text-right">{order.quantityOrdered}</td>
                  <td className="px-4 py-3 text-right">{order.quantityReceived}</td>
                  <td className="px-4 py-3 text-right">
                    {displayPurchaseMoney(order.totalMinor, order.currencyCode)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ButtonLink href={`/admin/purchasing/${order.id}`} size="sm">
                        Open
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    No purchase orders yet.{" "}
                    <Link href="/admin/purchasing/new" className="text-primary underline-offset-4 hover:underline">
                      Create the first PO.
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
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Purchase Order</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{receipt.receiptNo}</div>
                  <div className="text-xs text-muted-foreground">
                    {receipt.status.replace(/_/g, " ")} / Invoice {receipt.supplierInvoiceNo ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/purchasing/${receipt.purchaseOrderId}`} className="text-primary underline-offset-4 hover:underline">
                    {receipt.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{receipt.supplierName}</td>
                <td className="px-4 py-3">{receipt.receiptDate}</td>
                <td className="px-4 py-3">{receipt.locationCode ?? "-"}</td>
                <td className="px-4 py-3 text-right">{receipt.lineCount}</td>
                <td className="px-4 py-3 text-right">{receipt.quantityReceived}</td>
                <td className="px-4 py-3 text-right">{displayPurchaseMoney(receipt.totalMinor, receipt.currencyCode)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ButtonLink href={`/admin/purchasing/receipts/${receipt.id}`} size="sm">
                      Details
                    </ButtonLink>
                  </div>
                </td>
              </tr>
            ))}
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No receipts found.
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
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Allocated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{payment.paymentNo}</div>
                  <div className="text-xs capitalize text-muted-foreground">{payment.status}</div>
                </td>
                <td className="px-4 py-3">{payment.partnerName ?? "-"}</td>
                <td className="px-4 py-3">{payment.paymentDate}</td>
                <td className="px-4 py-3">{payment.paymentMethodName}</td>
                <td className="px-4 py-3">{payment.paymentAccountName}</td>
                <td className="px-4 py-3">{payment.reference ?? "-"}</td>
                <td className="px-4 py-3 text-right">{displayPaymentMoney(payment.amountMinor, payment.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayPaymentMoney(payment.allocatedAmountMinor, payment.currencyCode)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ButtonLink href={`/admin/purchasing/payments/${payment.id}`} size="sm">
                      Details
                    </ButtonLink>
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No supplier payments found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
