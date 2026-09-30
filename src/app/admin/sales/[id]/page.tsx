import { notFound } from "next/navigation";

import {
  approveSalesOrderLine,
  createDeliveryFromSalesOrder,
  registerCustomerPayment,
  rejectSalesOrderLine,
  updateSalesOrder,
} from "@/app/admin/sales/actions";
import { CreateDeliveryLinesEditor } from "@/app/admin/sales/[id]/create-delivery-lines-editor";
import { SalesOrderForm } from "@/app/admin/sales/sales-order-form";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { DetailStatCard } from "@/components/ui/detail-stat-card";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import { getActivePaymentAccounts } from "@/server/payments/payments";
import { getSalesLineApprovalSummary } from "@/server/sales/line-approvals";
import {
  displaySalesMoney,
  getSalesFormOptions,
  getSalesOrderDetail,
} from "@/server/sales/sales";

export const dynamic = "force-dynamic";

type SalesOrderDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function paymentStatusLabel(order: NonNullable<Awaited<ReturnType<typeof getSalesOrderDetail>>>) {
  if (order.status === "cancelled") {
    return "Cancelled";
  }

  if (order.totalMinor <= 0 || order.residualAmountMinor <= 0) {
    return "Fully Paid";
  }

  if (order.paidMinor <= 0) {
    return "Not Paid";
  }

  return "Partial";
}

function CreateDeliveryDialog({
  order,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getSalesOrderDetail>>>;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><T k="action.createDelivery">Create Delivery</T></Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle><T k="modal.createDelivery.title">Create Delivery</T></DialogTitle>
          <DialogDescription>
            <T k="modal.createDelivery.desc">Create a draft delivery for</T> {order.orderNo}.
          </DialogDescription>
        </DialogHeader>
        <CreateDeliveryLinesEditor action={createDeliveryFromSalesOrder} order={order} />
      </DialogContent>
    </Dialog>
  );
}

export default async function SalesOrderDetailPage({ params, searchParams }: SalesOrderDetailPageProps) {
  const user = await requirePermission("sales:orders:create");

  const [{ id }, query, options] = await Promise.all([
    params,
    searchParams,
    getSalesFormOptions(),
  ]);
  const [order, paymentAccounts] = await Promise.all([
    getSalesOrderDetail(id),
    getActivePaymentAccounts("inbound"),
  ]);

  if (!order) {
    notFound();
  }

  const isQuotation = order.status === "quotation";
  const lineApprovals = isQuotation
    ? await getSalesLineApprovalSummary(options.company.id, order.id, user.id)
    : [];
  const pendingApprovalCount = lineApprovals.filter((approval) => approval.status === "pending").length;
  const rejectedApprovalCount = lineApprovals.filter((approval) => approval.status === "rejected").length;
  const approvedApprovalCount = lineApprovals.filter((approval) => approval.status === "approved").length;
  const confirmationBlockedReason = rejectedApprovalCount > 0
    ? `${rejectedApprovalCount} line approval${rejectedApprovalCount === 1 ? " was" : "s were"} rejected. Edit and save the quotation to request approval again.`
    : pendingApprovalCount > 0
      ? `${pendingApprovalCount} line approval${pendingApprovalCount === 1 ? " is" : "s are"} still pending.`
      : undefined;
  const hasRemainingDeliveryQuantity = order.lines.some(
    (line) => Number(line.quantityOrdered) - Number(line.quantityDelivered) > 0,
  );
  const canCreateDelivery =
    ["confirmed", "partially_delivered", "delivered", "invoiced"].includes(order.status) &&
    hasRemainingDeliveryQuantity;
  const canRegisterPayment =
    !isQuotation && order.status !== "cancelled" && order.totalMinor > 0 && order.residualAmountMinor > 0;
  const canCreateReturn = !isQuotation && order.status !== "cancelled" && order.deliveryCount > 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales"
        title={order.orderNo}
        actions={<ButtonLink href="/admin/sales" variant="outline"><T k="action.backToSales">Back to sales</T></ButtonLink>}
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2.5">
          <DetailStatCard
            href={`/admin/sales?view=deliveries&salesOrderId=${order.id}`}
            count={order.deliveryCount}
            label="Deliveries"
          />
          <DetailStatCard
            href={`/admin/sales?view=payments&salesOrderId=${order.id}`}
            count={order.paymentCount}
            label="Payments"
          />
          <DetailStatCard
            href={`/admin/sales?view=returns&salesOrderId=${order.id}`}
            count={order.returnCount}
            label="Returns"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={order.status} size="lg" />
          {!isQuotation || order.totalMinor === 0 ? (
            <StatusBadge
              status={order.totalMinor === 0 || order.residualAmountMinor === 0 ? "paid" : order.residualAmountMinor < order.totalMinor ? "partially_paid" : "unpaid"}
              label={paymentStatusLabel(order)}
              size="lg"
            />
          ) : null}

          {canCreateDelivery ? (
            <CreateDeliveryDialog order={order} />
          ) : null}
          {canRegisterPayment ? (
            <PaymentFormDialog
              title="Register Payment"
              description={`Register and post payment for ${order.orderNo}.`}
              triggerLabel="Register Payment"
              submitLabel="Post Payment"
              action={registerCustomerPayment}
              hiddenFieldName="salesOrderId"
              hiddenFieldValue={order.id}
              paymentAccounts={paymentAccounts}
              currencyCode={order.currencyCode}
              amountMinor={order.residualAmountMinor}
            />
          ) : null}
          {canCreateReturn ? (
            <ButtonLink href={`/admin/sales/returns/new?salesOrderId=${order.id}`} variant="outline">
              <T k="action.addReturn">Add Return</T>
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {isQuotation ? (
        <div className="grid gap-4">
          {lineApprovals.length > 0 ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold"><T k="field.lineApprovals">Line approvals</T></h2>
                  <p className="text-xs text-muted-foreground">
                    {approvedApprovalCount} of {lineApprovals.length} required lines approved
                  </p>
                </div>
                <StatusBadge
                  status={rejectedApprovalCount > 0 ? "rejected" : pendingApprovalCount > 0 ? "pending" : "approved"}
                  label={rejectedApprovalCount > 0 ? "Approval rejected" : pendingApprovalCount > 0 ? "Approval pending" : "Ready to confirm"}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2"><T k="sales.form.line">Line</T></th>
                      <th className="px-2 py-2"><T k="delivery.product">Product</T></th>
                      <th className="px-2 py-2"><T k="field.sourceLocation">Location</T></th>
                      <th className="px-2 py-2"><T k="sales.col.status">Status</T></th>
                      <th className="px-2 py-2">Decision</th>
                      <th className="px-2 py-2 text-right"><T k="delivery.actions">Action</T></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineApprovals.map((approval) => (
                      <tr key={approval.id} className="border-b border-border/70 last:border-0">
                        <td className="px-2 py-3">{approval.lineNo}</td>
                        <td className="px-2 py-3 font-medium">{approval.productName}</td>
                        <td className="px-2 py-3">
                          <div>{approval.locationName}</div>
                          <div className="text-xs text-muted-foreground">{approval.locationCode}</div>
                        </td>
                        <td className="px-2 py-3">
                          <StatusBadge status={approval.status} label={statusLabel(approval.status)} />
                        </td>
                        <td className="px-2 py-3 text-xs text-muted-foreground">
                          {approval.decidedByName ?? "-"}
                          {approval.notes ? <div className="mt-1">{approval.notes}</div> : null}
                        </td>
                        <td className="px-2 py-3">
                          {approval.status === "pending" && approval.canApprove ? (
                            <div className="flex justify-end gap-2">
                              <form action={rejectSalesOrderLine}>
                                <input type="hidden" name="salesOrderId" value={order.id} />
                                <input type="hidden" name="approvalId" value={approval.id} />
                                <Button type="submit" size="sm" variant="outline">Reject</Button>
                              </form>
                              <form action={approveSalesOrderLine}>
                                <input type="hidden" name="salesOrderId" value={order.id} />
                                <input type="hidden" name="approvalId" value={approval.id} />
                                <Button type="submit" size="sm">Approve</Button>
                              </form>
                            </div>
                          ) : (
                            <div className="text-right text-xs text-muted-foreground">
                              {approval.status === "pending" ? "Assigned approver required" : "-"}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {confirmationBlockedReason ? (
                <p className="mt-3 text-xs font-medium text-amber-700">{confirmationBlockedReason}</p>
              ) : null}
            </section>
          ) : null}

          <SalesOrderForm
            action={updateSalesOrder}
            customers={options.customers}
            owners={options.owners}
            products={options.products}
            productCategories={options.productCategories}
            productBrands={options.productBrands}
            productUnits={options.productUnits}
            locations={options.locations}
            taxes={options.taxes}
            availableStock={options.availableStock}
            error={query.error}
            order={order}
            submitLabel="Save Quotation"
            defaultDate={todayDate()}
            confirmationBlockedReason={confirmationBlockedReason}
          />
        </div>
      ) : (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <Info label="Customer" labelKey="field.customer" value={order.customerName} />
            <Info label="Owner" labelKey="field.stockOwner" value={order.ownerName ?? "-"} />
            <Info label="Reference" labelKey="sales.col.reference" value={order.customerReference ?? "-"} />
            <Info label="FS Number" labelKey="field.fsNumber" value={order.fsNumber ?? "-"} />
            <Info label="Payment Term" labelKey="sales.form.paymentTerm" value={order.paymentTerm === "cash" ? "Cash" : "Credit"} />
            <Info label="Order Date" labelKey="sales.col.orderDate" value={order.orderDate} />
            {order.paymentTerm === "credit" ? (
              <Info label="Last Payment Date" labelKey="field.lastPaymentDate" value={order.validUntil ?? "-"} />
            ) : null}
            <Info label="Subtotal" labelKey="sales.form.subtotal" value={displaySalesMoney(order.subtotalMinor, order.currencyCode)} />
            {order.taxAmountMinor > 0 ? (
              <Info label="Tax" labelKey="sales.form.taxes" value={displaySalesMoney(order.taxAmountMinor, order.currencyCode)} />
            ) : null}
            <Info label="Total" labelKey="sales.form.total" value={displaySalesMoney(order.totalMinor, order.currencyCode)} />
            <Info label="Paid" labelKey="field.paid" value={displaySalesMoney(order.paidMinor, order.currencyCode)} />
            <Info label="Unpaid" labelKey="field.unpaid" value={displaySalesMoney(order.residualAmountMinor, order.currencyCode)} />
            <Info label="Reserve Policy" labelKey="field.reservePolicy" value={order.reserveOnConfirm ? "Reserve on confirm" : "No reservation"} />
          </div>

          {(() => {
            const hasTaxInLines = order.lines.some((l) => (l.taxAmountMinor ?? 0) > 0 || Boolean(l.taxNames));
            return (
              <Notebook
                defaultValue="order-lines"
                items={[
                  {
                    value: "order-lines",
                    label: <T k="field.orderLines">Order Lines</T>,
                    content: (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                          <thead className="text-xs uppercase text-muted-foreground">
                            <tr className="border-b border-border">
                              <th className="px-2 py-2"><T k="delivery.product">Product</T></th>
                              <th className="px-2 py-2 text-right"><T k="delivery.ordered">Ordered</T></th>
                              <th className="px-2 py-2 text-right"><T k="kpi.reserved">Reserved</T></th>
                              <th className="px-2 py-2 text-right"><T k="sales.col.delivered">Delivered</T></th>
                              <th className="px-2 py-2 text-right"><T k="sales.tab.invoices">Invoiced</T></th>
                              <th className="px-2 py-2 text-right"><T k="sales.form.unitPrice">Unit Price</T></th>
                              {hasTaxInLines ? <th className="px-2 py-2 text-right"><T k="sales.form.taxes">Tax</T></th> : null}
                              <th className="px-2 py-2 text-right"><T k="sales.form.total">Total</T></th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.lines.map((line) => (
                              <tr key={line.id} className="border-b border-border/70">
                                <td className="px-2 py-3">
                                  <div className="font-medium">{line.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {line.sku} / {line.trackingMode}{line.taxNames ? ` / Taxes ${line.taxNames}` : ""}
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-right">{line.quantityOrdered}</td>
                                <td className="px-2 py-3 text-right">{line.quantityReserved}</td>
                                <td className="px-2 py-3 text-right">{line.quantityDelivered}</td>
                                <td className="px-2 py-3 text-right">{line.quantityInvoiced}</td>
                                <td className="px-2 py-3 text-right">{displaySalesMoney(line.unitPriceMinor, line.currencyCode)}</td>
                                {hasTaxInLines ? (
                                  <td className="px-2 py-3 text-right">{displaySalesMoney(line.taxAmountMinor, line.currencyCode)}</td>
                                ) : null}
                                <td className="px-2 py-3 text-right">{displaySalesMoney(line.lineTotalMinor, line.currencyCode)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ),
                  },
                  {
                    value: "other-information",
                    label: <T k="field.otherInformation">Other Information</T>,
                    content: <p className="text-sm text-muted-foreground">{order.notes || <T k="field.noNotes">No notes</T>}</p>,
                  },
                ]}
              />
            );
          })()}
        </section>
      )}
    </PageShell>
  );
}

function Info({ label, labelKey, value }: { label: string; labelKey?: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground"><T k={labelKey ?? label}>{label}</T></p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
