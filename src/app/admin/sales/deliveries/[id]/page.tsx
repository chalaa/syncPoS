import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelDelivery, createCustomerInvoiceFromDelivery, postDelivery } from "@/app/admin/sales/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";
import { displaySalesMoney, getDeliveryDetail } from "@/server/sales/sales";

export const dynamic = "force-dynamic";

type DeliveryDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function inputClass() {
  return "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function DeliveryDetailPage({ params, searchParams }: DeliveryDetailPageProps) {
  await requireUser();

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const delivery = await getDeliveryDetail(id);

  if (!delivery) {
    notFound();
  }

  const isDraft = delivery.status === "draft";
  const totalCostMinor = delivery.lines.reduce((sum, line) => sum + line.totalCostMinor, 0);
  const currencyCode = delivery.lines[0]?.currencyCode ?? "ETB";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales / Delivery"
        title={delivery.deliveryNo}
        actions={<ButtonLink href="/admin/sales?view=deliveries" variant="outline">Back to deliveries</ButtonLink>}
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/sales/${delivery.salesOrderId}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{delivery.orderNo}</span>
            <span className="text-muted-foreground">Sales Order</span>
          </Link>
          {delivery.stockMovementId ? (
            <Link href={`/admin/inventory/operations/${delivery.stockMovementId}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
              <span className="block text-lg font-semibold">1</span>
              <span className="text-muted-foreground">Inventory Move</span>
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-border bg-muted px-3 py-2 text-sm capitalize">
            {statusLabel(delivery.status)}
          </span>
          {isDraft ? (
            <form action={cancelDelivery}>
              <input type="hidden" name="deliveryId" value={delivery.id} />
              <Button type="submit" variant="outline">Cancel</Button>
            </form>
          ) : null}
          {delivery.status === "posted" ? (
            <form action={createCustomerInvoiceFromDelivery}>
              <input type="hidden" name="deliveryId" value={delivery.id} />
              <Button type="submit">Create Invoice</Button>
            </form>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Customer" value={delivery.customerName} />
          <Info label="Source Location" value={delivery.sourceLocationCode} />
          <Info label="Delivery Date" value={delivery.deliveryDate} />
          <Info label="Posted At" value={delivery.postedAt ?? "-"} />
          <Info label="Total Cost" value={displaySalesMoney(totalCostMinor, currencyCode)} />
        </div>

        <form action={postDelivery}>
          <input type="hidden" name="deliveryId" value={delivery.id} />
          <Notebook
            defaultValue="operations"
            items={[
              {
                value: "operations",
                label: "Operations",
                content: (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1040px] text-left text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-2 py-2">Product</th>
                          <th className="px-2 py-2 text-right">Ordered</th>
                          <th className="px-2 py-2 text-right">Already Delivered</th>
                          <th className="px-2 py-2 text-right">Deliver</th>
                          <th className="px-2 py-2">Serial</th>
                          <th className="px-2 py-2">Lot</th>
                          <th className="px-2 py-2 text-right">Unit Cost</th>
                          <th className="px-2 py-2 text-right">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {delivery.lines.map((line) => (
                          <tr key={line.id} className="border-b border-border/70">
                            <td className="px-2 py-3">
                              <input type="hidden" name="deliveryLineId" value={line.id} />
                              <div className="font-medium">{line.productName}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.sku} / {line.trackingMode}
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right">{line.quantityOrdered ?? "-"}</td>
                            <td className="px-2 py-3 text-right">{line.quantityAlreadyDelivered ?? "-"}</td>
                            <td className="px-2 py-3">
                              <input
                                name="quantityDelivered"
                                type="number"
                                min="0"
                                step="0.000001"
                                defaultValue={line.quantityDelivered}
                                readOnly={!isDraft}
                                className={`${inputClass()} text-right`}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <input
                                name="serialNo"
                                defaultValue={line.serialNo ?? ""}
                                readOnly={!isDraft || line.trackingMode !== "serial"}
                                placeholder={line.trackingMode === "serial" ? "Serial number" : "-"}
                                className={inputClass()}
                              />
                            </td>
                            <td className="px-2 py-3">
                              <input
                                name="lotNo"
                                defaultValue={line.lotNo ?? ""}
                                readOnly={!isDraft || line.trackingMode !== "lot"}
                                placeholder={line.trackingMode === "lot" ? "Lot number" : "-"}
                                className={inputClass()}
                              />
                            </td>
                            <td className="px-2 py-3 text-right">{displaySalesMoney(line.unitCostMinor, line.currencyCode)}</td>
                            <td className="px-2 py-3 text-right">{displaySalesMoney(line.totalCostMinor, line.currencyCode)}</td>
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
                content: <p className="text-sm text-muted-foreground">{delivery.notes || "No notes"}</p>,
              },
            ]}
          />

          {isDraft ? (
            <div className="mt-5 flex justify-end">
              <Button type="submit">Post Delivery</Button>
            </div>
          ) : null}
        </form>
      </section>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
