import { createTransfer } from "@/app/admin/inventory/transfers/actions";
import { TransferLinesEditor } from "@/app/admin/inventory/transfers/transfer-lines-editor";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getTransferFormOptions } from "@/server/transfers/transfers";

export const dynamic = "force-dynamic";

type NewTransferPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function inputClass() {
  return "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

export default async function NewTransferPage({ searchParams }: NewTransferPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getTransferFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory"
        title="New Transfer"
        actions={<ButtonLink href="/admin/inventory/transfers" variant="outline">Back to transfers</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <form action={createTransfer} className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">From</span>
            <select name="fromLocationId" required defaultValue="" className={inputClass()}>
              <option value="" disabled>Select source</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Transit</span>
            <select name="transitLocationId" required defaultValue="" className={inputClass()}>
              <option value="" disabled>Select transit</option>
              {options.transitLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">To</span>
            <select name="toLocationId" required defaultValue="" className={inputClass()}>
              <option value="" disabled>Select destination</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
              ))}
            </select>
          </label>
        </div>

        <TransferLinesEditor products={options.products} />

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
