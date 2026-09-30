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
import { T } from "@/components/ui/t";
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
      <ButtonLink href="/admin/inventory/transfers" variant="outline">
        <T k="action.backToTransfers" fallback="Back to transfers" />
      </ButtonLink>
      {transfer.status === "draft" ? (
        <>
          <form action={approveTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit"><T k="action.approve" fallback="Approve" /></Button>
          </form>
          <form action={cancelTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit" variant="danger"><T k="action.cancel" fallback="Cancel" /></Button>
          </form>
        </>
      ) : null}
      {transfer.status === "approved" ? (
        <>
          <form action={dispatchTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit"><T k="action.dispatch" fallback="Dispatch" /></Button>
          </form>
          <form action={cancelTransfer}>
            <input type="hidden" name="transferId" value={transfer.id} />
            <Button type="submit" variant="danger"><T k="action.cancel" fallback="Cancel" /></Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label: metricLabel, value }: { label: React.ReactNode; value: string }) {
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
      <Field label={<T k="field.from" fallback="From" />} value={transfer.fromLocationCode} />
      <Field label={<T k="field.transit" fallback="Transit" />} value={transfer.transitLocationCode} />
      <Field label={<T k="field.to" fallback="To" />} value={transfer.toLocationCode} />
      <Field label={<T k="table.owner" fallback="Owner" />} value={transfer.ownerName ?? "-"} />
      <Field label={<T k="table.date" fallback="Transfer Date" />} value={transfer.transferDate} />
      <Field label={<T k="inventory.approved" fallback="Approved" />} value={transfer.approvedAt ?? "-"} />
      <Field label={<T k="table.dispatched" fallback="Dispatched" />} value={transfer.dispatchedAt ?? "-"} />
      <Field label={<T k="table.received" fallback="Received" />} value={transfer.receivedAt ?? "-"} />
      <Field label={<T k="inventory.notes" fallback="Notes" />} value={transfer.notes ?? "-"} className="md:col-span-2" />
    </div>
  );
}

function Field({ label: fieldLabel, value, className }: { label: React.ReactNode; value: string; className?: string }) {
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
          <T k="inventory.dispatchMovement" fallback="Dispatch Movement" />
        </ButtonLink>
      ) : null}
      {transfer.receiptMovementId ? (
        <ButtonLink href={`/admin/inventory/operations/${transfer.receiptMovementId}`} variant="secondary">
          <T k="inventory.receiptMovement" fallback="Receipt Movement" />
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
            <th className="px-3 py-2"><T k="table.product" fallback="Product" /></th>
            <th className="px-3 py-2"><T k="table.owner" fallback="Owner" /></th>
            <th className="px-3 py-2"><T k="field.trackingMode" fallback="Tracking" /></th>
            <th className="px-3 py-2"><T k="table.serial" fallback="Serial / Lot" /></th>
            <th className="px-3 py-2 text-right"><T k="table.requested" fallback="Requested" /></th>
            <th className="px-3 py-2 text-right"><T k="table.dispatched" fallback="Dispatched" /></th>
            <th className="px-3 py-2 text-right"><T k="table.received" fallback="Received" /></th>
            <th className="px-3 py-2 text-right"><T k="table.remaining" fallback="Remaining" /></th>
            <th className="px-3 py-2"><T k="table.discrepancy" fallback="Discrepancy" /></th>
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
    return <p className="text-sm text-muted-foreground"><T k="inventory.noRemainingToReceive" fallback="No remaining dispatched quantity to receive." /></p>;
  }

  return (
    <form action={receiveTransfer}>
      <input type="hidden" name="transferId" value={transfer.id} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2"><T k="table.product" fallback="Product" /></th>
              <th className="px-3 py-2"><T k="table.serial" fallback="Serial / Lot" /></th>
              <th className="px-3 py-2 text-right"><T k="table.remaining" fallback="Remaining" /></th>
              <th className="px-3 py-2 text-right"><T k="table.receiveNow" fallback="Receive Now" /></th>
              <th className="px-3 py-2"><T k="table.discrepancy" fallback="Discrepancy" /></th>
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
                    <option value="none"><T k="discrepancy.none" fallback="None" /></option>
                    <option value="shortage"><T k="discrepancy.shortage" fallback="Shortage" /></option>
                    <option value="overage"><T k="discrepancy.overage" fallback="Overage" /></option>
                    <option value="damaged"><T k="discrepancy.damaged" fallback="Damaged" /></option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit"><T k="action.postReceipt" fallback="Post Receipt" /></Button>
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
        eyebrow={<T k="header.eyebrow.inventoryTransfer" fallback="Inventory Transfer" />}
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
          <Metric label={<T k="table.lines" fallback="Lines" />} value={String(transfer.lineCount)} />
          <Metric label={<T k="table.requested" fallback="Requested" />} value={transfer.quantityRequested} />
          <Metric label={<T k="table.dispatched" fallback="Dispatched" />} value={transfer.quantityDispatched} />
          <Metric label={<T k="table.received" fallback="Received" />} value={transfer.quantityReceived} />
        </div>
      </div>

      <DetailGrid transfer={transfer} />

      <Notebook
        className="mt-5"
        defaultValue="lines"
        items={[
          {
            value: "lines",
            label: <T k="header.eyebrow.Operations" fallback="Operations" />,
            content: <LinesTable lines={transfer.lines} />,
          },
          {
            value: "receipt",
            label: <T k="inventory.receipts" fallback="Receipt" />,
            content:
              transfer.status === "dispatched" || transfer.status === "partially_received" ? (
                <ReceiptForm transfer={transfer} />
              ) : (
                <p className="text-sm text-muted-foreground"><T k="inventory.dispatchBeforeReceiving" fallback="Dispatch the transfer before receiving stock." /></p>
              ),
          },
          {
            value: "notes",
            label: <T k="inventory.notes" fallback="Notes" />,
            content: <p className="whitespace-pre-wrap text-sm text-muted-foreground">{transfer.notes ?? <T k="inventory.noNotes" fallback="No notes." />}</p>,
          },
        ]}
      />

      <div className="mt-5 text-sm text-muted-foreground">
        <Link href="/admin/inventory/transfers" className="font-medium text-primary underline-offset-4 hover:underline">
          <T k="action.backToTransferList" fallback="Back to transfer list" />
        </Link>
      </div>
    </PageShell>
  );
}
