import { createCustomerReturn } from "@/app/admin/returns/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getReturnFormOptions } from "@/server/returns/returns";

export const dynamic = "force-dynamic";

type NewCustomerReturnPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function inputClass() {
  return "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

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

      <form action={createCustomerReturn} className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Original Sales Order</span>
            <select name="salesOrderId" required defaultValue="" className={inputClass()}>
              <option value="" disabled>Select sales order</option>
              {options.salesOrders.map((order) => (
                <option key={order.id} value={order.id}>{order.code} - {order.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Return Location</span>
            <select name="destinationLocationId" required defaultValue="" className={inputClass()}>
              <option value="" disabled>Select location</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Refund Placeholder</span>
            <input name="refundAmount" defaultValue="0" className={inputClass()} />
          </label>
        </div>

        <ReturnLines products={options.products} />

        <label className="mt-5 block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Notes</span>
          <textarea name="notes" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>

        <div className="mt-5 flex justify-end">
          <Button type="submit">Create Return</Button>
        </div>
      </form>
    </PageShell>
  );
}

function ReturnLines({ products }: { products: { id: string; code: string; name: string; trackingMode: string }[] }) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2">Product</th>
            <th className="px-2 py-2 text-right">Quantity</th>
            <th className="px-2 py-2">Condition</th>
            <th className="px-2 py-2 text-right">Line Refund</th>
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
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.code} - {product.name} ({product.trackingMode})</option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-3"><input name="quantity" type="number" min="0" step="0.000001" className={`${inputClass()} text-right`} /></td>
              <td className="px-2 py-3">
                <select name="condition" defaultValue="returned" className={inputClass()}>
                  <option value="available">Available</option>
                  <option value="returned">Returned</option>
                  <option value="damaged">Damaged</option>
                  <option value="scrapped">Scrapped</option>
                </select>
              </td>
              <td className="px-2 py-3"><input name="lineRefundAmount" defaultValue="0" className={`${inputClass()} text-right`} /></td>
              <td className="px-2 py-3"><input name="serialNo" className={inputClass()} /></td>
              <td className="px-2 py-3"><input name="lotNo" className={inputClass()} /></td>
              <td className="px-2 py-3"><input name="lineNotes" className={inputClass()} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
