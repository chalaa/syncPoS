import Link from "next/link";
import { ArrowLeftRight, Eye, Plus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/ui/t";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { getTransferList } from "@/server/transfers/transfers";
import { TransferList } from "./transfer-list";

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
