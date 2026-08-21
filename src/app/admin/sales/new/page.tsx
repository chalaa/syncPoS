import { createSalesOrder } from "@/app/admin/sales/actions";
import { SalesOrderForm } from "@/app/admin/sales/sales-order-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";
import { getSalesFormOptions } from "@/server/sales/sales";

export const dynamic = "force-dynamic";

type NewSalesOrderPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewSalesOrderPage({ searchParams }: NewSalesOrderPageProps) {
  await requireUser();

  const [query, options] = await Promise.all([searchParams, getSalesFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales"
        title="New Quotation"
        actions={<ButtonLink href="/admin/sales" variant="outline">Back to sales</ButtonLink>}
      />

      <SalesOrderForm
        action={createSalesOrder}
        customers={options.customers}
        products={options.products}
        locations={options.locations}
        taxes={options.taxes}
        error={query.error}
      />
    </PageShell>
  );
}
