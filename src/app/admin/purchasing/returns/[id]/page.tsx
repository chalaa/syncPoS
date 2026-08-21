import Link from "next/link";
import { notFound } from "next/navigation";

import { postSupplierReturn } from "@/app/admin/returns/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayReturnMoney, getSupplierReturnDetail } from "@/server/returns/returns";
import type { ReturnDetailLine } from "@/server/returns/types";

export const dynamic = "force-dynamic";

type SupplierReturnPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

export default async function SupplierReturnPage({ params, searchParams }: SupplierReturnPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const record = await getSupplierReturnDetail(id);

  if (!record) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Supplier Return"
        title={record.returnNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/purchasing?view=returns" variant="outline">Back to returns</ButtonLink>
            {record.status === "draft" ? (
              <form action={postSupplierReturn}>
                <input type="hidden" name="id" value={record.id} />
                <Button>Post Supplier Return</Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/admin/purchasing/receipts/${record.goodsReceiptId}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
          <span className="block text-lg font-semibold">{record.receiptNo}</span>
          <span className="text-muted-foreground">Original Receipt</span>
        </Link>
        {record.stockMovementId ? (
          <Link href={`/admin/inventory/operations/${record.stockMovementId}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">1</span>
            <span className="text-muted-foreground">Supplier Return Move</span>
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Supplier" value={record.supplierName} />
          <Info label="Status" value={label(record.status)} />
          <Info label="Return Date" value={record.returnDate} />
          <Info label="Source" value={record.sourceLocationCode} />
          <Info label="Vendor Refund Placeholder" value={displayReturnMoney(record.refundAmountMinor, record.currencyCode)} />
        </div>

        <ReturnLines lines={record.lines} />

        <Notebook
          defaultValue="other"
          items={[
            {
              value: "other",
              label: "Other Information",
              content: <p className="text-sm text-muted-foreground">{record.notes || "No notes"}</p>,
            },
          ]}
        />
      </section>
    </PageShell>
  );
}

function ReturnLines({ lines }: { lines: ReturnDetailLine[] }) {
  return (
    <div className="mb-5 overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-right">Quantity</th>
            <th className="px-3 py-2">Condition</th>
            <th className="px-3 py-2">Tracking</th>
            <th className="px-3 py-2 text-right">Refund</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-border/70">
              <td className="px-3 py-3">
                <div className="font-medium">{line.productName}</div>
                <div className="text-xs text-muted-foreground">{line.sku}</div>
              </td>
              <td className="px-3 py-3 text-right">{line.quantityReturned}</td>
              <td className="px-3 py-3 capitalize">{label(line.condition)}</td>
              <td className="px-3 py-3">{line.serialNo ?? line.lotNo ?? "Bulk"}</td>
              <td className="px-3 py-3 text-right">{displayReturnMoney(line.refundAmountMinor, line.currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Info({ label: name, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{name}</p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
