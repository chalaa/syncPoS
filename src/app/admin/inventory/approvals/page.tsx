import Link from "next/link";

import { approveStockOutRequest, rejectStockOutRequest } from "@/app/admin/inventory/approvals/actions";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { getStockOutApprovalRows } from "@/server/inventory/stock-approvals";

export const dynamic = "force-dynamic";

type InventoryApprovalsPageProps = {
  searchParams: Promise<{
    status?: string;
    notice?: string;
    error?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function sourceHref(row: Awaited<ReturnType<typeof getStockOutApprovalRows>>[number]) {
  if (row.sourceType === "sales_delivery" && row.sourceId) {
    return `/admin/sales/deliveries/${row.sourceId}`;
  }

  if (row.stockMovementId) {
    return `/admin/inventory/operations/${row.stockMovementId}`;
  }

  return null;
}

export default async function InventoryApprovalsPage({ searchParams }: InventoryApprovalsPageProps) {
  await requirePermission("inventory:stock:view");

  const params = await searchParams;
  const status = params.status ?? "pending";
  const company = await getDefaultCompany();
  const rows = await getStockOutApprovalRows(company.id, status);
  const approvalPage = paginateRows(rows, params);

  return (
    <PageShell>
      <PageHeader eyebrow="Inventory" title="Stock-Out Approvals" />

      <div className="grid gap-4">
        {params.notice ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {params.notice}
          </p>
        ) : null}
        {params.error ? (
          <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant={status === "pending" ? "default" : "secondary"}>
            <Link href="/admin/inventory/approvals">Pending</Link>
          </Button>
          <Button asChild variant={status === "approved" ? "default" : "secondary"}>
            <Link href="/admin/inventory/approvals?status=approved">Approved</Link>
          </Button>
          <Button asChild variant={status === "rejected" ? "default" : "secondary"}>
            <Link href="/admin/inventory/approvals?status=rejected">Rejected</Link>
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Requested At</th>
                <th className="px-4 py-3">Reason</th>
                <th className="w-80 px-4 py-3 text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {approvalPage.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No stock-out approval requests found.
                  </td>
                </tr>
              ) : (
                approvalPage.rows.map((row) => {
                  const href = sourceHref(row);

                  return (
                    <tr key={row.id} className="border-b border-border/70 align-top last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium capitalize">{row.sourceType.replace(/_/g, " ")}</div>
                        {href ? (
                          <Link href={href} className="text-xs text-primary underline-offset-4 hover:underline">
                            {row.sourceNo ?? "Open document"}
                          </Link>
                        ) : (
                          <div className="text-xs text-muted-foreground">{row.sourceNo ?? "-"}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.sourceLocationName}</div>
                        <div className="text-xs text-muted-foreground">{row.sourceLocationCode}</div>
                      </td>
                      <td className="px-4 py-3">{row.requestedByUsername ?? "-"}</td>
                      <td className="px-4 py-3">{row.requestedAt.toLocaleString()}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.reason ?? "-"}</td>
                      <td className="px-4 py-3">
                        {row.status === "pending" ? (
                          <div className="grid gap-2">
                            <form action={approveStockOutRequest} className="flex gap-2">
                              <input type="hidden" name="approvalId" value={row.id} />
                              <input name="notes" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" placeholder="Note" />
                              <Button type="submit" size="sm">Approve</Button>
                            </form>
                            <form action={rejectStockOutRequest} className="flex justify-end gap-2">
                              <input type="hidden" name="approvalId" value={row.id} />
                              <input name="notes" className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" placeholder="Reason" />
                              <Button type="submit" variant="destructive" size="sm">Reject</Button>
                            </form>
                          </div>
                        ) : (
                          <div className="text-right">
                            <div className="font-medium capitalize">{row.status}</div>
                            <div className="text-xs text-muted-foreground">{row.notes ?? "-"}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <TablePagination pagination={approvalPage.pagination} />
        </div>
      </div>
    </PageShell>
  );
}
