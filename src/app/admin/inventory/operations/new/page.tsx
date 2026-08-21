import { createInventoryOperation } from "@/app/admin/inventory/operations/actions";
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
        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Operation Type</span>
            <select name="movementType" required defaultValue="adjustment" className={inputClass()}>
              <option value="adjustment">Adjustment</option>
              <option value="scrap">Scrap</option>
              <option value="customer_return">Customer Return</option>
              <option value="supplier_return">Supplier Return</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">From Location</span>
            <select name="fromLocationId" defaultValue="" className={inputClass()}>
              <option value="">Select source</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">To Location</span>
            <select name="toLocationId" defaultValue="" className={inputClass()}>
              <option value="">Select destination</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Source Reference</span>
            <input name="sourceNo" className={inputClass()} />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2 text-right">Quantity</th>
                <th className="px-2 py-2 text-right">Unit Cost</th>
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
                        <option key={product.id} value={product.id}>
                          {product.code} - {product.name} ({product.trackingMode})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <input name="quantity" type="number" step="0.000001" defaultValue={index === 0 ? "1" : ""} className={`${inputClass()} text-right`} />
                  </td>
                  <td className="px-2 py-3">
                    <input name="unitCost" defaultValue="0" className={`${inputClass()} text-right`} />
                  </td>
                  <td className="px-2 py-3">
                    <input name="serialNo" className={inputClass()} />
                  </td>
                  <td className="px-2 py-3">
                    <input name="lotNo" className={inputClass()} />
                  </td>
                  <td className="px-2 py-3">
                    <input name="lineNotes" className={inputClass()} />
                  </td>
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
