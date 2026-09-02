import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelDelivery, postDelivery, updateDeliverySourceLocation } from "@/app/admin/sales/actions";
import { DeliverySourceLocationAutosave } from "@/app/admin/sales/deliveries/[id]/delivery-source-location-autosave";
import { DeliveryOperationsForm } from "@/app/admin/sales/deliveries/[id]/delivery-operations-form";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displaySalesMoney, getDeliveryDetail, getSalesFormOptions } from "@/server/sales/sales";
import type { SalesFormOption } from "@/server/sales/types";

export const dynamic = "force-dynamic";

type DeliveryDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function DeliveryDetailPage({ params, searchParams }: DeliveryDetailPageProps) {
  await requirePermission("sales:orders:create");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [delivery, options] = await Promise.all([getDeliveryDetail(id), getSalesFormOptions()]);

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
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Customer" value={delivery.customerName} />
          <SourceLocationInfo delivery={delivery} locations={options.locations} isDraft={isDraft} />
          <Info label="Destination Location" value={delivery.destinationLocationCode ?? "CUSTOMERS"} />
          <Info label="Delivery Date" value={delivery.deliveryDate} />
          <Info label="Posted At" value={delivery.postedAt ?? "-"} />
          <Info label="Total Cost" value={displaySalesMoney(totalCostMinor, currencyCode)} />
        </div>

        <Notebook
          defaultValue="operations"
          items={[
            {
              value: "operations",
              label: "Operations",
              content: <DeliveryOperationsForm delivery={delivery} isDraft={isDraft} action={postDelivery} />,
            },
            {
              value: "other-information",
              label: "Other Information",
              content: <p className="text-sm text-muted-foreground">{delivery.notes || "No notes"}</p>,
            },
          ]}
        />
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

function SourceLocationInfo({
  delivery,
  locations,
  isDraft,
}: {
  delivery: NonNullable<Awaited<ReturnType<typeof getDeliveryDetail>>>;
  locations: SalesFormOption[];
  isDraft: boolean;
}) {
  if (!isDraft) {
    return <Info label="Source Location" value={delivery.sourceLocationCode} />;
  }

  return (
    <DeliverySourceLocationAutosave
      deliveryId={delivery.id}
      sourceLocationId={delivery.sourceLocationId}
      locations={locations}
      action={updateDeliverySourceLocation}
    />
  );
}
