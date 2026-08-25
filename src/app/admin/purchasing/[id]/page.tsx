import { notFound } from "next/navigation";

import {
  confirmPurchaseOrder,
  createVendorBillFromPurchaseOrder,
  postGoodsReceipt,
  updatePurchaseOrder,
} from "@/app/admin/purchasing/actions";
import { PurchaseOrderForm } from "@/app/admin/purchasing/purchase-order-form";
import { ReceiptLinesEditor } from "@/app/admin/purchasing/receipt-lines-editor";
import { Alert } from "@/components/ui/alert";
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
import { requirePermission } from "@/server/auth/session";
import {
  displayPurchaseMoney,
  getPurchaseFormOptions,
  getPurchaseOrderDetail,
} from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type PurchaseOrderDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function CreateReceiptDialog({
  order,
  locations,
}: {
  order: NonNullable<Awaited<ReturnType<typeof getPurchaseOrderDetail>>>;
  locations: Awaited<ReturnType<typeof getPurchaseFormOptions>>["locations"];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Receipt</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create Receipt</DialogTitle>
          <DialogDescription>Receive products against {order.orderNo}.</DialogDescription>
        </DialogHeader>
        <ReceiptLinesEditor
          action={postGoodsReceipt}
          purchaseOrderId={order.id}
          defaultLocationId={order.deliverToLocationId}
          locations={locations}
          lines={order.lines}
        />
      </DialogContent>
    </Dialog>
  );
}

export default async function PurchaseOrderDetailPage({ params, searchParams }: PurchaseOrderDetailPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query, options] = await Promise.all([
    params,
    searchParams,
    getPurchaseFormOptions(),
  ]);
  const order = await getPurchaseOrderDetail(id);

  if (!order) {
    notFound();
  }

  const isDraft = order.status === "draft";
  const canReceive = order.status === "confirmed" || order.status === "partially_received";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing"
        title={order.orderNo}
        actions={<ButtonLink href="/admin/purchasing" variant="outline">Back to orders</ButtonLink>}
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/purchasing?view=receipts&purchaseOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.receiptCount}</span>
            <span className="text-muted-foreground">Receipts</span>
          </a>
          <a href={`/admin/purchasing?view=supplier-bills&purchaseOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.vendorBillCount}</span>
            <span className="text-muted-foreground">Vendor Bills</span>
          </a>
          <a href={`/admin/purchasing?view=landed-costs&purchaseOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.landedCostCount}</span>
            <span className="text-muted-foreground">Landed Costs</span>
          </a>
          <a href={`/admin/purchasing?view=payments&purchaseOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.paymentCount}</span>
            <span className="text-muted-foreground">Payments</span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-border bg-muted px-3 py-2 text-sm capitalize">
            {statusLabel(order.status)}
          </span>
          {isDraft ? (
            <form action={confirmPurchaseOrder}>
              <input type="hidden" name="purchaseOrderId" value={order.id} />
              <input type="hidden" name="returnPath" value={`/admin/purchasing/${order.id}`} />
              <Button>Confirm Order</Button>
            </form>
          ) : null}
          {canReceive ? (
            <CreateReceiptDialog order={order} locations={options.locations} />
          ) : null}
          {!isDraft ? (
            <form action={createVendorBillFromPurchaseOrder}>
              <input type="hidden" name="purchaseOrderId" value={order.id} />
              <Button variant="outline">Create Vendor Bill</Button>
            </form>
          ) : null}
          {order.receiptCount > 0 ? (
            <ButtonLink href={`/admin/purchasing/landed-costs/new?purchaseOrderId=${order.id}`} variant="outline">
              Add Landed Cost
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {isDraft ? (
        <PurchaseOrderForm
          action={updatePurchaseOrder}
          suppliers={options.suppliers}
          products={options.products}
          locations={options.locations}
          taxes={options.taxes}
          error={query.error}
          order={order}
          submitLabel="Save RFQ"
        />
      ) : (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Supplier</p>
              <p className="mt-1 text-sm font-medium">{order.supplierName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Vendor Reference</p>
              <p className="mt-1 text-sm font-medium">{order.vendorReference ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Expected Arrival</p>
              <p className="mt-1 text-sm font-medium">{order.expectedDate ?? "-"}</p>
            </div>
          </div>

          <Notebook
            defaultValue="order-lines"
            items={[
              {
                value: "order-lines",
                label: "Order Lines",
                content: (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-2 py-2">Product</th>
                          <th className="px-2 py-2 text-right">Ordered</th>
                          <th className="px-2 py-2 text-right">Received</th>
                          <th className="px-2 py-2 text-right">Unit Cost</th>
                          <th className="px-2 py-2 text-right">Tax</th>
                          <th className="px-2 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.lines.map((line) => (
                          <tr key={line.id} className="border-b border-border/70">
                            <td className="px-2 py-3">
                              <div className="font-medium">{line.productName}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.sku} / {line.trackingMode} / Taxes {line.taxNames ?? "-"}
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right">{line.quantityOrdered}</td>
                            <td className="px-2 py-3 text-right">{line.quantityReceived}</td>
                            <td className="px-2 py-3 text-right">{displayPurchaseMoney(line.unitCostMinor, line.currencyCode)}</td>
                            <td className="px-2 py-3 text-right">{displayPurchaseMoney(line.taxAmountMinor, line.currencyCode)}</td>
                            <td className="px-2 py-3 text-right">{displayPurchaseMoney(line.lineTotalMinor, line.currencyCode)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
              },
              {
                value: "other-information",
                label: "Other Information",
                content: <p className="text-sm text-muted-foreground">{order.notes || "No notes"}</p>,
              },
            ]}
          />
        </section>
      )}

    </PageShell>
  );
}
