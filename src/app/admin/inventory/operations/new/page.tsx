import { createInventoryOperation } from "@/app/admin/inventory/operations/actions";
import { OperationLinesEditor } from "@/app/admin/inventory/operations/operation-lines-editor";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getInventoryOperationFormOptions } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type NewInventoryOperationPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function inputClass() {
  return "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

export default async function NewInventoryOperationPage({ searchParams }: NewInventoryOperationPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getInventoryOperationFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory"
        title="New Inventory Operation"
        actions={<ButtonLink href="/admin/inventory/operations" variant="outline">Back to operations</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <form action={createInventoryOperation} className="rounded-lg border border-border bg-card p-5">
        <OperationLinesEditor products={options.products} />

        <label className="mt-5 block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>

        <div className="mt-5 flex justify-end">
          <Button type="submit">Create Draft</Button>
        </div>
      </form>
    </PageShell>
  );
}
