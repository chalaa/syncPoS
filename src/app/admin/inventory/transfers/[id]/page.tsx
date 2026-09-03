import Link from "next/link";
import { notFound } from "next/navigation";

import {
  approveTransfer,
  cancelTransfer,
  dispatchTransfer,
  receiveTransfer,
} from "@/app/admin/inventory/transfers/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getTransferDetail } from "@/server/transfers/transfers";
import type { TransferDetail, TransferDetailLine } from "@/server/transfers/types";

export const dynamic = "force-dynamic";

type TransferDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

function remaining(line: TransferDetailLine) {
  return Math.max(Number(line.quantityDispatched) - Number(line.quantityReceived), 0);
}

function Actions({ transfer }: { transfer: TransferDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href="/admin/inventory/transfers" variant="outline">Back to transfers</ButtonLink>
      {transfer.status === "draft" ? (
        <>
          <form action={approveTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit">Approve</Button>
          </form>
          <form action={cancelTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit" variant="danger">Cancel</Button>
          </form>
        </>
      ) : null}
      {transfer.status === "approved" ? (
        <>
          <form action={dispatchTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit">Dispatch</Button>
          </form>
          <form action={cancelTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit" variant="danger">Cancel</Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label: metricLabel, value }: { label: string; value: string }) {
  return (
    <div className="min-w-32 rounded-md border border-border bg-card px-4 py-3">
      <div className="text-xs font-medium uppercase text-muted-foreground">{metricLabel}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function DetailGrid({ transfer }: { transfer: TransferDetail }) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-3">
      <Field label="From" value={transfer.fromLocationCode} />
      <Field label="Transit" value={transfer.transitLocationCode} />
      <Field label="To" value={transfer.toLocationCode} />
      <Field label="Owner" value={transfer.ownerName ?? "-"} />
      <Field label="Transfer Date" value={transfer.transferDate} />
      <Field label="Approved" value={transfer.approvedAt ?? "-"} />
      <Field label="Dispatched" value={transfer.dispatchedAt ?? "-"} />
      <Field label="Received" value={transfer.receivedAt ?? "-"} />
      <Field label="Notes" value={transfer.notes ?? "-"} className="md:col-span-2" />
    </div>
  );
}

function Field({ label: fieldLabel, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-medium uppercase text-muted-foreground">{fieldLabel}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function SmartButtons({ transfer }: { transfer: TransferDetail }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {transfer.dispatchMovementId ? (
        <ButtonLink href={`/admin/inventory/operations/${transfer.dispatchMovementId}`} variant="secondary">
          Dispatch Movement
        </ButtonLink>
      ) : null}
      {transfer.receiptMovementId ? (
        <ButtonLink href={`/admin/inventory/operations/${transfer.receiptMovementId}`} variant="secondary">
          Receipt Movement
        </ButtonLink>
      ) : null}
    </div>
  );
}

function LinesTable({ lines }: { lines: TransferDetailLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Owner</th>
            <th className="px-3 py-2">Tracking</th>
            <th className="px-3 py-2">Serial / Lot</th>
            <th className="px-3 py-2 text-right">Requested</th>
            <th className="px-3 py-2 text-right">Dispatched</th>
            <th className="px-3 py-2 text-right">Received</th>
            <th className="px-3 py-2 text-right">Remaining</th>
            <th className="px-3 py-2">Discrepancy</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-t border-border">
              <td className="px-3 py-3">
                <div className="font-medium">{line.productName}</div>
                <div className="text-xs text-muted-foreground">{line.sku}</div>
              </td>
              <td className="px-3 py-3">{line.ownerName ?? "-"}</td>
              <td className="px-3 py-3 capitalize">{line.trackingMode}</td>
              <td className="px-3 py-3">{line.serialNo ?? line.lotNo ?? "-"}</td>
              <td className="px-3 py-3 text-right">{line.quantityRequested}</td>
              <td className="px-3 py-3 text-right">{line.quantityDispatched}</td>
              <td className="px-3 py-3 text-right">{line.quantityReceived}</td>
              <td className="px-3 py-3 text-right">{remaining(line)}</td>
              <td className="px-3 py-3 capitalize">{label(line.discrepancy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReceiptForm({ transfer }: { transfer: TransferDetail }) {
  const receivableLines = transfer.lines.filter((line) => remaining(line) > 0);

  if (receivableLines.length === 0) {
    return <p className="text-sm text-muted-foreground">No remaining dispatched quantity to receive.</p>;
  }

  return (
    <form action={receiveTransfer}>
      <input type="hidden" name="transferId" value={transfer.id} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Serial / Lot</th>
              <th className="px-3 py-2 text-right">Remaining</th>
              <th className="px-3 py-2 text-right">Receive Now</th>
              <th className="px-3 py-2">Discrepancy</th>
            </tr>
          </thead>
          <tbody>
            {receivableLines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <input type="hidden" name="transferLineId" value={line.id} />
                  <div className="font-medium">{line.productName}</div>
                  <div className="text-xs text-muted-foreground">{line.sku}</div>
                </td>
                <td className="px-3 py-3">{line.serialNo ?? line.lotNo ?? "-"}</td>
                <td className="px-3 py-3 text-right">{remaining(line)}</td>
                <td className="px-3 py-3">
                  <input
                    name="quantityReceivedNow"
                    type="number"
                    min="0"
                    max={remaining(line)}
                    step="0.000001"
                    defaultValue={remaining(line)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-right text-sm outline-none focus:border-primary"
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    name="discrepancy"
                    defaultValue="none"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="none">None</option>
                    <option value="shortage">Shortage</option>
                    <option value="overage">Overage</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit">Post Receipt</Button>
      </div>
    </form>
  );
}

export default async function TransferDetailPage({ params, searchParams }: TransferDetailPageProps) {
  await requirePermission("inventory.view");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const transfer = await getTransferDetail(id);

  if (!transfer) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Transfer"
        title={transfer.transferNo}
        actions={<Actions transfer={transfer} />}
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <SmartButtons transfer={transfer} />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-md border border-border bg-muted px-2 py-1 text-sm capitalize">{label(transfer.status)}</span>
          <span className="rounded-md border border-border bg-muted px-2 py-1 text-sm">{transfer.fromLocationCode} to {transfer.toLocationCode}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Metric label="Lines" value={String(transfer.lineCount)} />
          <Metric label="Requested" value={transfer.quantityRequested} />
          <Metric label="Dispatched" value={transfer.quantityDispatched} />
          <Metric label="Received" value={transfer.quantityReceived} />
        </div>
      </div>

      <DetailGrid transfer={transfer} />

      <Notebook
        className="mt-5"
        defaultValue="lines"
        items={[
          {
            value: "lines",
            label: "Operations",
            content: <LinesTable lines={transfer.lines} />,
          },
          {
            value: "receipt",
            label: "Receipt",
            content:
              transfer.status === "dispatched" || transfer.status === "partially_received" ? (
                <ReceiptForm transfer={transfer} />
              ) : (
                <p className="text-sm text-muted-foreground">Dispatch the transfer before receiving stock.</p>
              ),
          },
          {
            value: "notes",
            label: "Notes",
            content: <p className="whitespace-pre-wrap text-sm text-muted-foreground">{transfer.notes ?? "No notes."}</p>,
          },
        ]}
      />

      <div className="mt-5 text-sm text-muted-foreground">
        <Link href="/admin/inventory/transfers" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to transfer list
        </Link>
      </div>
    </PageShell>
  );
}
