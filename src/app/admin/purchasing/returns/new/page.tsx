import { createSupplierReturn } from "@/app/admin/returns/actions";
import { SupplierReturnForm } from "@/app/admin/returns/supplier-return-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getReturnFormOptions } from "@/server/returns/returns";

export const dynamic = "force-dynamic";

type NewSupplierReturnPageProps = {
  searchParams: Promise<{ error?: string; goodsReceiptId?: string; purchaseOrderId?: string }>;
};

export default async function NewSupplierReturnPage({ searchParams }: NewSupplierReturnPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getReturnFormOptions()]);
  const initialGoodsReceiptId =
    query.goodsReceiptId ??
    (query.purchaseOrderId
      ? options.receipts.find((receipt) =>
          receipt.purchaseOrderId === query.purchaseOrderId &&
          options.supplierReturnableLines.some((line) => line.goodsReceiptId === receipt.id),
        )?.id
      : undefined);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing"
        title="New Supplier Return"
        actions={<ButtonLink href="/admin/purchasing?view=returns" variant="outline">Back to returns</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <SupplierReturnForm
        action={createSupplierReturn}
        purchaseOrders={options.purchaseOrders}
        receipts={options.receipts}
        locations={options.locations}
        lines={options.supplierReturnableLines}
        initialPurchaseOrderId={query.purchaseOrderId}
        initialGoodsReceiptId={initialGoodsReceiptId}
      />
    </PageShell>
  );
}
