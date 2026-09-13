import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getAuditLogDetail, sanitizeAuditMetadata } from "@/server/audit/audit-logs";

export const dynamic = "force-dynamic";

type AuditLogDetailPageProps = {
  params: Promise<{ id: string }>;
};

function severityClass(severity: string) {
  if (severity === "critical") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

export default async function AuditLogDetailPage({ params }: AuditLogDetailPageProps) {
  await requirePermission("company:settings:manage");

  const { id } = await params;
  const log = await getAuditLogDetail(id);

  if (!log) {
    notFound();
  }

  return (
    <PageShell maxWidth="max-w-6xl">
      <PageHeader
        eyebrow="Settings / Audit Logs"
        title={log.action}
        actions={<ButtonLink href="/admin/settings/audit-logs" variant="outline">Back to audit logs</ButtonLink>}
      />

      <section className="mb-5 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="Time" value={log.occurredAt} />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Severity</p>
            <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-medium capitalize ${severityClass(log.severity)}`}>
              {log.severity}
            </span>
          </div>
          <Info label="Actor" value={log.actorUsername ?? "System"} />
          <Info label="Entity Type" value={log.entityType} />
          <Info label="Entity ID" value={log.entityId ?? "-"} />
          <Info label="Location" value={log.locationCode ?? "-"} />
          <Info label="IP Address" value={log.ipAddress ?? "-"} />
          <Info label="Audit ID" value={log.id} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold">Metadata</h2>
        <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
          {JSON.stringify(sanitizeAuditMetadata(log.metadata), null, 2)}
        </pre>
      </section>
    </PageShell>
  );
}
