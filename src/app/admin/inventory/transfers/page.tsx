import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getTransferList } from "@/server/transfers/transfers";
import type { TransferListRow } from "@/server/transfers/types";

export const dynamic = "force-dynamic";

type TransfersPageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  await requirePermission("inventory.view");

  const [query, transfers] = await Promise.all([searchParams, getTransferList()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory"
        title="Transfers"
        actions={<ButtonLink href="/admin/inventory/transfers/new">New Transfer</ButtonLink>}
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <TransferList transfers={transfers} />
    </PageShell>
  );
}

function TransferList({ transfers }: { transfers: TransferListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Transfer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Transit</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Requested</th>
              <th className="px-4 py-3 text-right">Dispatched</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/inventory/transfers/${transfer.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {transfer.transferNo}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{label(transfer.status)}</td>
                <td className="px-4 py-3">{transfer.ownerName ?? "-"}</td>
                <td className="px-4 py-3">{transfer.transferDate}</td>
                <td className="px-4 py-3">{transfer.fromLocationCode}</td>
                <td className="px-4 py-3">{transfer.transitLocationCode}</td>
                <td className="px-4 py-3">{transfer.toLocationCode}</td>
                <td className="px-4 py-3 text-right">{transfer.lineCount}</td>
                <td className="px-4 py-3 text-right">{transfer.quantityRequested}</td>
                <td className="px-4 py-3 text-right">{transfer.quantityDispatched}</td>
                <td className="px-4 py-3 text-right">{transfer.quantityReceived}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/inventory/transfers/${transfer.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">
                  No transfers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
