import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
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
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground"><T k={label} /></p>
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
        actions={<ButtonLink href="/admin/settings/audit-logs" variant="outline"><T k="audit.backToLogs" fallback="Back to audit logs" /></ButtonLink>}
      />

      <section className="mb-5 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="audit.time" value={log.occurredAt} />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="audit.severity" fallback="Severity" /></p>
            <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-xs font-medium capitalize ${severityClass(log.severity)}`}>
              <T k={`status.${log.severity}`} fallback={log.severity} />
            </span>
          </div>
          <Info label="audit.actor" value={log.actorUsername ?? <T k="audit.system" fallback="System" />} />
          <Info label="audit.entityType" value={log.entityType} />
          <Info label="audit.entityId" value={log.entityId ?? "-"} />
          <Info label="field.location" value={log.locationCode ?? "-"} />
          <Info label="audit.ipAddress" value={log.ipAddress ?? "-"} />
          <Info label="audit.auditId" value={log.id} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-base font-semibold"><T k="Metadata" fallback="Metadata" /></h2>
        <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
          {JSON.stringify(sanitizeAuditMetadata(log.metadata), null, 2)}
        </pre>
      </section>
    </PageShell>
  );
}
