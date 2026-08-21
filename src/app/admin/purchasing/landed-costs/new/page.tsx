import { createLandedCost } from "@/app/admin/purchasing/actions";
import { LandedCostForm } from "@/app/admin/purchasing/landed-costs/landed-cost-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getPurchaseLandedCostFormOptions } from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type NewLandedCostPageProps = {
  searchParams: Promise<{
    purchaseOrderId?: string;
    receiptId?: string;
    error?: string;
  }>;
};

export default async function NewLandedCostPage({ searchParams }: NewLandedCostPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getPurchaseLandedCostFormOptions()]);
  const initialReceiptId =
    query.receiptId ??
    options.receipts.find((receipt) => receipt.purchaseOrderId === query.purchaseOrderId)?.id ??
    "";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Landed Cost"
        title="New Landed Cost"
        actions={<ButtonLink href="/admin/purchasing?view=landed-costs" variant="outline">Back to landed costs</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <LandedCostForm
        action={createLandedCost}
        options={options}
        initialReceiptId={initialReceiptId}
        submitLabel="Allocate Cost"
      />
    </PageShell>
  );
}
