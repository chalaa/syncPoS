import Link from "next/link";
import { notFound } from "next/navigation";

import { postCustomerReturn } from "@/app/admin/returns/actions";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { DetailStatCard } from "@/components/ui/detail-stat-card";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import { displayReturnMoney, getCustomerReturnDetail } from "@/server/returns/returns";
import type { ReturnDetailLine } from "@/server/returns/types";

export const dynamic = "force-dynamic";

type CustomerReturnPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

export default async function CustomerReturnPage({ params, searchParams }: CustomerReturnPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const record = await getCustomerReturnDetail(id);

  if (!record) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.Sales / Customer Return">Sales / Customer Return</T>}
        title={record.returnNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/sales?view=returns" variant="outline"><T k="action.backToReturns">Back to returns</T></ButtonLink>
            {record.status === "draft" ? (
              <form action={postCustomerReturn}>
                <input type="hidden" name="id" value={record.id} />
                <Button><T k="action.postReturnReceipt">Post Return Receipt</T></Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          <DetailStatCard
            href={`/admin/sales/${record.salesOrderId}`}
            count={record.orderNo}
            label="Sales Order"
            labelKey="sales.order"
          />
          {record.stockMovementId ? (
            <Link
              href={`/admin/inventory/operations/${record.stockMovementId}`}
              className="group flex flex-col rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs transition-all hover:border-primary/50 hover:bg-secondary/40"
            >
              <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                1
              </span>
              <span className="text-xs font-medium text-muted-foreground"><T k="field.returnReceipt">Return Receipt</T></span>
            </Link>
          ) : null}
        </div>
        <StatusBadge status={record.status} size="lg" />
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Customer" labelKey="field.customer" value={record.customerName} />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.status">Status</T></p>
            <div className="mt-1">
              <StatusBadge status={record.status} size="sm" />
            </div>
          </div>
          <Info label="Return Date" labelKey="field.returnDate" value={record.returnDate} />
          <Info label="Destination" labelKey="field.destinationLocation" value={record.destinationLocationCode} />
          <Info label="Refund Amount" labelKey="field.refundAmount" value={displayReturnMoney(record.refundAmountMinor, record.currencyCode)} />
        </div>

        <ReturnLines lines={record.lines} />

        <Notebook
          defaultValue="other"
          items={[
            {
              value: "other",
              label: <T k="field.otherInformation">Other Information</T>,
              content: <p className="text-sm text-muted-foreground">{record.notes || <T k="field.noNotes">No notes</T>}</p>,
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
            <th className="px-3 py-2"><T k="sales.col.product">Product</T></th>
            <th className="px-3 py-2 text-right"><T k="sales.form.qty">Quantity</T></th>
            <th className="px-3 py-2"><T k="field.condition">Condition</T></th>
            <th className="px-3 py-2"><T k="field.trackingMode">Tracking</T></th>
            <th className="px-3 py-2 text-right"><T k="field.refund">Refund</T></th>
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

function Info({ label: name, labelKey, value }: { label: string; labelKey?: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground"><T k={labelKey ?? name}>{name}</T></p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
