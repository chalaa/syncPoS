import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelInventoryOperation, postInventoryOperation } from "@/app/admin/inventory/operations/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  displayMoneyMinor,
  displayQuantity,
  getInventoryOperationDetail,
} from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type InventoryOperationDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

function sourceHref(operation: {
  movementType: string;
  sourceType: string | null;
  sourceId: string | null;
}) {
  if (!operation.sourceId) {
    return null;
  }

  if (operation.sourceType === "goods_receipt") {
    return `/admin/purchasing/receipts/${operation.sourceId}`;
  }

  if (operation.sourceType === "delivery") {
    return `/admin/sales/deliveries/${operation.sourceId}`;
  }

  if (operation.sourceType === "sales_return") {
    return `/admin/sales?view=returns`;
  }

  if (operation.sourceType === "supplier_return") {
    return `/admin/purchasing?view=returns`;
  }

  if (operation.sourceType === "transfer_dispatch" || operation.sourceType === "transfer_receipt") {
    return `/admin/inventory/transfers/${operation.sourceId}`;
  }

  return null;
}

export default async function InventoryOperationDetailPage({ params, searchParams }: InventoryOperationDetailPageProps) {
  await requirePermission("inventory.view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const operation = await getInventoryOperationDetail(id);

  if (!operation) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Operation"
        title={operation.movementNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/inventory/operations" variant="outline">Back to operations</ButtonLink>
            {operation.status === "draft" ? (
              <>
                <form action={postInventoryOperation}>
                  <input type="hidden" name="movementId" value={operation.id} />
                  <Button type="submit">Post</Button>
                </form>
                <form action={cancelInventoryOperation}>
                  <input type="hidden" name="movementId" value={operation.id} />
                  <Button type="submit" variant="danger">Cancel</Button>
                </form>
              </>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-border bg-muted px-2 py-1 capitalize">{label(operation.movementType)}</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1 capitalize">{operation.status}</span>
          </div>
          <div className="text-muted-foreground">
            Source {operation.sourceNo ?? operation.sourceType ?? "-"} / Date {operation.movementDate.toLocaleDateString()}
          </div>
          {sourceHref(operation) ? (
            <Link href={sourceHref(operation) ?? "#"} className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline">
              Open source document
            </Link>
          ) : null}
          {operation.status === "posted" ? (
            <div className="text-xs text-muted-foreground">
              Posted operations are locked. Create an explicit reversal operation for corrections.
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Metric label="Lines" value={String(operation.lineCount)} />
          <Metric label="Quantity" value={displayQuantity(operation.totalQuantity)} />
          <Metric
            label="Value"
            value={operation.currencyCode ? displayMoneyMinor(operation.totalCostMinor, operation.currencyCode) : "-"}
          />
        </div>
      </div>

      <Notebook
        defaultValue="moves"
        items={[
          {
            value: "moves",
            label: "Operations",
            content: (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Tracking</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Unit Cost</th>
                      <th className="px-3 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operation.lines.map((line) => (
                      <tr key={line.id} className="border-b border-border/70">
                        <td className="px-3 py-3">
                          <Link href={`/admin/products/${line.productId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                            {line.sku}
                          </Link>
                          <div className="text-xs text-muted-foreground">{line.productName} / {line.trackingMode}</div>
                        </td>
                        <td className="px-3 py-3">{line.fromLocationCode ?? operation.fromLocationCode ?? "-"}</td>
                        <td className="px-3 py-3">{line.toLocationCode ?? operation.toLocationCode ?? "-"}</td>
                        <td className="px-3 py-3">{line.serialNo ?? line.lotNo ?? "Bulk"}</td>
                        <td className="px-3 py-3 text-right">{displayQuantity(line.quantity)}</td>
                        <td className="px-3 py-3 text-right">{displayMoneyMinor(line.unitCostMinor, line.currencyCode)}</td>
                        <td className="px-3 py-3 text-right">{displayMoneyMinor(line.totalCostMinor, line.currencyCode)}</td>
                      </tr>
                    ))}
                    {operation.lines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          No movement lines found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            value: "other",
            label: "Other Information",
            content: (
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <Info label="Source Type" value={operation.sourceType ?? "-"} />
                <Info label="Source Number" value={operation.sourceNo ?? "-"} />
                <Info label="Posted At" value={operation.postedAt?.toLocaleString() ?? "-"} />
                <Info label="Notes" value={operation.notes ?? "-"} />
              </div>
            ),
          },
        ]}
      />
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 text-sm">
      <span className="block text-lg font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/70 pb-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
