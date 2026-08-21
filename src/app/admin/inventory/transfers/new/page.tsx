import { createTransfer } from "@/app/admin/inventory/transfers/actions";
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

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2">Serial</th>
                <th className="px-2 py-2">Lot</th>
                <th className="px-2 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-border/70">
                  <td className="px-2 py-3">
                    <select name="productId" defaultValue="" className={inputClass()}>
                      <option value="">Select product</option>
                      {options.products.map((product) => (
                        <option key={product.id} value={product.id}>{product.code} - {product.name} ({product.trackingMode})</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <input name="quantityRequested" type="number" min="0" step="0.000001" className={`${inputClass()} text-right`} />
                  </td>
                  <td className="px-2 py-3"><input name="serialNo" className={inputClass()} /></td>
                  <td className="px-2 py-3"><input name="lotNo" className={inputClass()} /></td>
                  <td className="px-2 py-3"><input name="lineNotes" className={inputClass()} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
