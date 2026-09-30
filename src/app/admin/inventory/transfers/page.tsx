import Link from "next/link";
import { ArrowLeftRight, Eye, Plus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/ui/t";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { getTransferList } from "@/server/transfers/transfers";
import type { TransferListRow } from "@/server/transfers/types";

export const dynamic = "force-dynamic";

type TransfersPageProps = {
  searchParams: Promise<{ notice?: string; error?: string; page?: string; pageSize?: string }>;
};

function label(value: string) {
  return value.replace(/_/g, " ");
}

export default async function TransfersPage({ searchParams }: TransfersPageProps) {
  await requirePermission("inventory.view");

  const [query, transfers] = await Promise.all([searchParams, getTransferList()]);
  const transferPage = paginateRows(transfers, query);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.inventoryWorkspace" fallback="Inventory Workspace" />}
        title={<T k="header.title.transitTransfers" fallback="Multi-Stage Transit Transfers" />}
        description={<T k="inventory.transitTransfersDesc" fallback="Shipments and transfers moving between locations through an in-transit staging state." />}
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink
              href="/admin/inventory/transfers/new"
              className="gap-1.5 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110"
            >
              <Plus className="size-4 text-emerald-200" />
              <T k="action.newTransitTransfer" fallback="New Transit Transfer" />
            </ButtonLink>
            <ButtonLink
              href="/admin/inventory/operations/internal-transfers/new"
              variant="outline"
              className="gap-1.5 font-semibold text-foreground"
            >
              <ArrowLeftRight className="size-3.5 text-blue-600" />
              <T k="action.instantTransfer" fallback="Instant 1-Step Transfer" />
            </ButtonLink>
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <TransferList transfers={transferPage.rows} />
      <TablePagination pagination={transferPage.pagination} />
    </PageShell>
  );
}

function TransferList({ transfers }: { transfers: TransferListRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3.5"><T k="table.transferNo" fallback="Transfer No" /></th>
              <th className="px-4 py-3.5"><T k="table.status" fallback="Status" /></th>
              <th className="px-4 py-3.5"><T k="table.owner" fallback="Owner" /></th>
              <th className="px-4 py-3.5"><T k="table.date" fallback="Date" /></th>
              <th className="px-4 py-3.5"><T k="field.from" fallback="From" /></th>
              <th className="px-4 py-3.5"><T k="field.transit" fallback="Transit" /></th>
              <th className="px-4 py-3.5"><T k="field.to" fallback="To" /></th>
              <th className="px-4 py-3.5 text-right"><T k="table.lines" fallback="Lines" /></th>
              <th className="px-4 py-3.5 text-right"><T k="table.requested" fallback="Requested" /></th>
              <th className="px-4 py-3.5 text-right"><T k="table.dispatched" fallback="Dispatched" /></th>
              <th className="px-4 py-3.5 text-right"><T k="table.received" fallback="Received" /></th>
              <th className="px-4 py-3.5 text-right"><T k="action.actions" fallback="Actions" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {transfers.map((transfer) => (
              <ClickableTableRow
                key={transfer.id}
                href={`/admin/inventory/transfers/${transfer.id}`}
              >
                <td className="px-4 py-3.5 font-mono text-xs font-bold text-primary">
                  <Link
                    href={`/admin/inventory/transfers/${transfer.id}`}
                    className="group-hover:underline"
                  >
                    {transfer.transferNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={transfer.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{transfer.ownerName ?? "—"}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">{transfer.transferDate}</td>
                <td className="px-4 py-3.5 font-medium text-xs text-foreground">{transfer.fromLocationCode}</td>
                <td className="px-4 py-3.5 font-medium text-xs text-muted-foreground">{transfer.transitLocationCode}</td>
                <td className="px-4 py-3.5 font-medium text-xs text-foreground">{transfer.toLocationCode}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{transfer.lineCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {transfer.quantityRequested}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                  {transfer.quantityDispatched}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {transfer.quantityReceived}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink
                    href={`/admin/inventory/transfers/${transfer.id}`}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 px-2.5 text-xs font-semibold"
                  >
                    <Eye className="size-3" />
                    <T k="action.details" fallback="Details" />
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-16 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                    <ArrowLeftRight className="size-6" />
                  </div>
                  <p className="font-bold text-sm text-foreground">
                    <T k="inventory.noTransfersFound" fallback="No transit transfers found" />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    <T k="inventory.noTransfersHint" fallback="Multi-stage transfers between locations will appear here once initiated." />
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
