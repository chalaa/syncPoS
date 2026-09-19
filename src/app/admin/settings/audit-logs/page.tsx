import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TablePagination } from "@/components/ui/table-pagination";
import { requirePermission } from "@/server/auth/session";
import { getAuditLogList } from "@/server/audit/audit-logs";

export const dynamic = "force-dynamic";

type AuditLogsPageProps = {
  searchParams: Promise<{
    q?: string;
    severity?: string;
    action?: string;
    entityType?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function severityClass(severity: string) {
  if (severity === "critical") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  await requirePermission("company:settings:manage");

  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const pageSize = Number.parseInt(params.pageSize ?? "50", 10);
  const result = await getAuditLogList({
    query: params.q,
    severity: params.severity,
    action: params.action,
    entityType: params.entityType,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  });

  return (
    <PageShell maxWidth="max-w-[1600px]">
      <PageHeader eyebrow="Settings" title="Audit Logs" />

      <section className="mb-5 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-end">
          <div className="grid gap-1 text-sm font-medium">
            Search
            <TableSearchInput defaultValue={params.q ?? ""} placeholder="Action, entity, actor, metadata..." />
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/admin/settings/audit-logs">Clear Filters</Link>
          </Button>
        </div>
      </section>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-3">{row.occurredAt}</td>
                <td className="px-4 py-3 font-medium">{row.action}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium capitalize ${severityClass(row.severity)}`}>
                    {row.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div>{row.entityType}</div>
                  <div className="max-w-48 truncate text-xs text-muted-foreground">{row.entityId ?? "-"}</div>
                </td>
                <td className="px-4 py-3">{row.actorUsername ?? "System"}</td>
                <td className="px-4 py-3">{row.locationCode ?? "-"}</td>
                <td className="px-4 py-3">{row.ipAddress ?? "-"}</td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/settings/audit-logs/${row.id}`}>View</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No audit logs found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <TablePagination
        pagination={{
          page: result.page,
          pageSize: result.pageSize,
          totalRows: result.total,
          totalPages: result.pageCount,
          from: result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1,
          to: Math.min(result.page * result.pageSize, result.total),
        }}
      />
    </PageShell>
  );
}
