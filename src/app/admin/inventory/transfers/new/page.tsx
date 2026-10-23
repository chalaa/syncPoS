import { TransferCreateForm } from "@/app/admin/inventory/transfers/new/transfer-create-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import { getTransferFormOptions } from "@/server/transfers/transfers";

export const dynamic = "force-dynamic";

type NewTransferPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewTransferPage({ searchParams }: NewTransferPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getTransferFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.Operations" fallback="Inventory" />}
        title={<T k="inventory.newTransfer" fallback="New Transfer" />}
        actions={
          <ButtonLink href="/admin/inventory/transfers" variant="outline">
            <T k="action.backToTransfers" fallback="Back to transfers" />
          </ButtonLink>
        }
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <TransferCreateForm options={options} />
    </PageShell>
  );
}
