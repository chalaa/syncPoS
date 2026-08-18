import { createLandedCost } from "@/app/admin/purchasing/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getPurchaseLandedCostFormOptions } from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type NewLandedCostPageProps = {
  searchParams: Promise<{
    receiptId?: string;
    error?: string;
  }>;
};

const inputClass = "h-9 rounded-md border border-input bg-background px-2 text-sm";

export default async function NewLandedCostPage({ searchParams }: NewLandedCostPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getPurchaseLandedCostFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Landed Cost"
        title="New Landed Cost"
        actions={<ButtonLink href="/admin/purchasing?view=landed-costs" variant="outline">Back to landed costs</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <form action={createLandedCost} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Receipt
              <select name="goodsReceiptId" required defaultValue={query.receiptId ?? ""} className={inputClass}>
                <option value="">Select receipt</option>
                {options.receipts.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.receiptNo} / {receipt.orderNo} / {receipt.supplierName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vendor
              <select name="vendorId" defaultValue="" className={inputClass}>
                <option value="">No separate vendor</option>
                {options.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.code} / {vendor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Cost Type
              <select name="costType" defaultValue="freight" className={inputClass}>
                <option value="freight">Freight</option>
                <option value="customs">Customs</option>
                <option value="insurance">Insurance</option>
                <option value="handling">Handling</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Allocation
              <select name="allocationMethod" defaultValue="value" className={inputClass}>
                <option value="value">By value</option>
                <option value="quantity">By quantity</option>
                <option value="weight">By quantity until product weights exist</option>
                <option value="manual">By value until manual split exists</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Amount
              <input name="amount" required inputMode="decimal" placeholder="0.00" className={inputClass} />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Notes
            <textarea name="notes" rows={4} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>

          <div className="flex justify-end">
            <Button>Allocate Cost</Button>
          </div>
        </form>
      </section>
    </PageShell>
  );
}
