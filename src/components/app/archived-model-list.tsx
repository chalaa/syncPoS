import Link from "next/link";
import { Archive, RotateCcw } from "lucide-react";

import { restoreArchivedItem } from "@/app/admin/settings/archived/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TablePagination } from "@/components/ui/table-pagination";
import { displaySalesMoney } from "@/lib/catalog-utils";
import { paginateRows } from "@/lib/pagination";
import { db } from "@/server/db/client";
import { getArchivedModelRows, type ArchivedModel, type ArchiveListParams, type ExpenseArchiveScope } from "@/server/archived/model-archives";

type Props = {
  model: ArchivedModel; title: string; companyId: string; params: ArchiveListParams;
  canRestore: boolean; expenseScope?: ExpenseArchiveScope;
};

export async function ArchivedModelList({ model, title, companyId, params, canRestore, expenseScope }: Props) {
  const records = await getArchivedModelRows(model, companyId, params, db, expenseScope);
  const page = paginateRows(records, params);
  const modelStatuses = model === "sales_order" ? ["quotation", "confirmed", "partially_delivered", "delivered", "invoiced", "cancelled"]
    : model === "purchase_order" ? ["draft", "confirmed", "partially_received", "received", "cancelled"]
    : model === "role" ? ["active", "inactive"] : ["draft", "posted", "cancelled"];
  const statuses = [...new Set([...modelStatuses, ...records.map((row) => row.status)])];
  const orderModel = model === "sales_order" || model === "purchase_order";
  const showAmount = model !== "role";
  const showParentOrder = !["sales_order", "purchase_order", "direct_vendor_sale", "expense", "role"].includes(model);
  const paymentStatuses = orderModel
    ? [{ value: "not_paid", label: "Unpaid" }, { value: "partially_paid", label: "Partially Paid" }, { value: "fully_paid", label: "Fully Paid" }]
    : [{ value: "unpaid", label: "Unpaid" }, { value: "partial", label: "Partially Paid" }, { value: "paid", label: "Fully Paid" }];

  return (
    <PageShell>
      <PageHeader eyebrow="Archived" title={title} />
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <TableFilterBar archiveFilter archiveFilterCancelled={model === "expense"} searchPlaceholder="Search reference, partner, or order..." filterParamNames={["status", "paymentTerm", "paymentStatus", "customerPaymentTerm", "vendorPaymentTerm", "costType", "category", "locationId"]}>
          <TableFilterSelect paramName="status" label="Status" allLabel="All Statuses" options={statuses.map((status) => ({ value: status, label: status.replace(/_/g, " ") }))} />
          {["sales_order", "purchase_order"].includes(model) ? <TableFilterSelect paramName="paymentTerm" label="Payment Term" allLabel="All Terms" options={[{ value: "cash", label: "Cash" }, { value: "credit", label: "Credit" }]} /> : null}
          {["sales_order", "purchase_order", "customer_invoice", "expense"].includes(model) ? <TableFilterSelect paramName="paymentStatus" label="Payment Status" allLabel="All Payments" options={paymentStatuses} /> : null}
          {model === "direct_vendor_sale" ? <>
            <TableFilterSelect paramName="customerPaymentTerm" label="Customer Term" allLabel="All Customer Terms" options={[{ value: "cash", label: "Cash" }, { value: "credit", label: "Credit" }]} />
            <TableFilterSelect paramName="vendorPaymentTerm" label="Vendor Term" allLabel="All Vendor Terms" options={[{ value: "cash", label: "Cash" }, { value: "credit", label: "Credit" }]} />
          </> : null}
        </TableFilterBar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">{model === "role" ? "Name" : "Partner"}</th><th className="px-4 py-3">Status</th>{showAmount ? <th className="px-4 py-3 text-right">Amount</th> : null}{showParentOrder ? <th className="px-4 py-3">Parent Order</th> : null}<th className="px-4 py-3">Archived On</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.rows.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{record.reference}</td>
                  <td className="px-4 py-3">{record.party || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
                  {showAmount ? <td className="px-4 py-3 text-right font-mono text-xs">{record.amountMinor == null || !record.currencyCode ? "-" : displaySalesMoney(record.amountMinor, record.currencyCode)}</td> : null}
                  {showParentOrder ? <td className="px-4 py-3 font-mono text-xs">{record.parentReference || "-"}</td> : null}
                  <td className="px-4 py-3 text-xs">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Addis_Ababa" }).format(new Date(record.archivedAt))}</td>
                  <td className="px-4 py-3 text-right">
                    {canRestore && ["sales_order", "purchase_order", "expense"].includes(model) ? (
                      <form action={restoreArchivedItem}>
                        <input type="hidden" name="entityType" value={model} />
                        <input type="hidden" name="entityId" value={record.id} />
                        <input type="hidden" name="returnPath" value={`/admin/settings/archived?q=${encodeURIComponent(record.reference)}`} />
                        <Button type="submit" size="sm" variant="outline"><RotateCcw data-icon="inline-start" />Restore</Button>
                      </form>
                    ) : canRestore && record.parentId && record.parentReference && record.parentType ? (
                      <Link className="text-xs font-medium text-primary hover:underline" href={record.parentArchived
                        ? `/admin/settings/archived?group=${record.parentType === "sales_order" ? "sales_orders" : "purchase_orders"}&q=${encodeURIComponent(record.parentReference)}`
                        : `/admin/${record.parentType === "sales_order" ? "sales" : "purchasing"}/${record.parentId}`}>
                        {record.parentArchived ? "Order Archive" : "Order"}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!page.rows.length ? <tr><td colSpan={5 + Number(showAmount) + Number(showParentOrder)} className="px-4 py-12 text-center text-muted-foreground"><Archive className="mx-auto mb-2 size-6" />No archived records found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <TablePagination pagination={page.pagination} />
      </section>
    </PageShell>
  );
}
