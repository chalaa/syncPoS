import {
  ArrowLeftRight,
  Sliders,
  Trash2,
} from "lucide-react";

import { NewInventoryOperationModal } from "@/app/admin/inventory/operations/new-operation-modal";
import { OperationsTableClient } from "@/app/admin/inventory/operations/operations-table-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import {
  getInventoryAdjustmentFormOptions,
  getInventoryOperationList,
  parseInventoryOperationView,
} from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type InventoryOperationsPageProps = {
  searchParams: Promise<{
    view?: string;
    q?: string;
    notice?: string;
    error?: string;
    selectedId?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function InventoryOperationsPage({ searchParams }: InventoryOperationsPageProps) {
  await requirePermission("inventory.view");

  const params = await searchParams;
  const view = parseInventoryOperationView(params.view);
  const query = params.q ?? "";

  const [rows, formOptions] = await Promise.all([
    getInventoryOperationList({ view, query }),
    getInventoryAdjustmentFormOptions(),
  ]);
  const operationPage = paginateRows(rows, params);

  const currentReturnPath = `/admin/inventory/operations${view !== "all" ? `?view=${view}` : ""}`;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="Operations Ledger & History"
        description="Chronological record of receipts, dispatches, internal transfers, adjustments, and write-offs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NewInventoryOperationModal
              defaultType="transfer"
              owners={formOptions.owners}
              locations={formOptions.locations}
              products={formOptions.products}
              balances={formOptions.balances}
              returnPath={currentReturnPath}
              trigger={
                <Button className="gap-1.5 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110">
                  <ArrowLeftRight className="size-3.5 text-emerald-200" />
                  New Transfer
                </Button>
              }
            />

            <NewInventoryOperationModal
              defaultType="adjustment"
              owners={formOptions.owners}
              locations={formOptions.locations}
              products={formOptions.products}
              balances={formOptions.balances}
              returnPath={currentReturnPath}
              trigger={
                <Button variant="outline" className="gap-1.5 font-semibold text-foreground">
                  <Sliders className="size-3.5 text-amber-600" />
                  New Adjustment
                </Button>
              }
            />

            <NewInventoryOperationModal
              defaultType="scrap"
              owners={formOptions.owners}
              locations={formOptions.locations}
              products={formOptions.products}
              balances={formOptions.balances}
              returnPath={currentReturnPath}
              trigger={
                <Button variant="outline" className="gap-1.5 font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="size-3.5 text-destructive" />
                  New Scrap
                </Button>
              }
            />
          </div>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <OperationsTableClient
        rows={operationPage.rows}
        view={view}
        query={query}
        formOptions={formOptions}
        initialSelectedId={params.selectedId}
      />
      <TablePagination pagination={operationPage.pagination} />
    </PageShell>
  );
}
