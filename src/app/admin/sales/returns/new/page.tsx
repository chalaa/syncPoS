import { createCustomerReturn } from "@/app/admin/returns/actions";
import { CustomerReturnForm } from "@/app/admin/returns/customer-return-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getReturnFormOptions } from "@/server/returns/returns";

export const dynamic = "force-dynamic";

type NewCustomerReturnPageProps = {
  searchParams: Promise<{ error?: string; salesOrderId?: string }>;
};

export default async function NewCustomerReturnPage({ searchParams }: NewCustomerReturnPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getReturnFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales"
        title="New Customer Return"
        actions={<ButtonLink href="/admin/sales?view=returns" variant="outline">Back to returns</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <CustomerReturnForm
        action={createCustomerReturn}
        salesOrders={options.salesOrders}
        locations={options.locations}
        lines={options.customerReturnableLines}
        initialSalesOrderId={query.salesOrderId}
      />
    </PageShell>
  );
}
