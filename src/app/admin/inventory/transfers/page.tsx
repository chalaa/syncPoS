import Link from "next/link";
import { ArrowLeftRight, Eye, Plus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
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
        eyebrow="Inventory Workspace"
        title="Multi-Stage Transit Transfers"
        description="Shipments and transfers moving between locations through an in-transit staging state."
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink
              href="/admin/inventory/transfers/new"
              className="gap-1.5 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110"
            >
              <Plus className="size-4 text-emerald-200" />
              New Transit Transfer
            </ButtonLink>
            <ButtonLink
              href="/admin/inventory/operations/internal-transfers/new"
              variant="outline"
              className="gap-1.5 font-semibold text-foreground"
            >
              <ArrowLeftRight className="size-3.5 text-blue-600" />
              Instant 1-Step Transfer
            </ButtonLink>
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <TransferList transfers={transfers} />
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
              <th className="px-4 py-3.5">Transfer No</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Owner</th>
              <th className="px-4 py-3.5">Date</th>
              <th className="px-4 py-3.5">From</th>
              <th className="px-4 py-3.5">Transit</th>
              <th className="px-4 py-3.5">To</th>
              <th className="px-4 py-3.5 text-right">Lines</th>
              <th className="px-4 py-3.5 text-right">Requested</th>
              <th className="px-4 py-3.5 text-right">Dispatched</th>
              <th className="px-4 py-3.5 text-right">Received</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {transfers.map((transfer) => (
              <tr
                key={transfer.id}
                className="group transition-colors hover:bg-[#0B5D4B]/5 dark:hover:bg-[#0B5D4B]/10"
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
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-16 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                    <ArrowLeftRight className="size-6" />
                  </div>
                  <p className="font-bold text-sm text-foreground">No transit transfers found</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Multi-stage transfers between locations will appear here once initiated.
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
