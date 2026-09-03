import { PurchaseOrderForm } from "@/app/admin/purchasing/purchase-order-form";
import { createPurchaseOrder } from "@/app/admin/purchasing/actions";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getPurchaseFormOptions } from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type NewPurchaseOrderPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewPurchaseOrderPage({ searchParams }: NewPurchaseOrderPageProps) {
  await requirePermission("inventory.receive");

  const params = await searchParams;
  const options = await getPurchaseFormOptions();

  return (
    <PageShell>
      <PageHeader eyebrow="Purchasing" title="New Request for Quotation" />
      <PurchaseOrderForm
        action={createPurchaseOrder}
        suppliers={options.suppliers}
        owners={options.owners}
        products={options.products}
        locations={options.locations}
        taxes={options.taxes}
        error={params.error}
        defaultDate={todayDate()}
      />
    </PageShell>
  );
}
