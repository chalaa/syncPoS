import { ClipboardCheck } from "lucide-react";

import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  await requirePermission("company:settings:manage");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations Management"
        title="Operations Hub"
        description="Manage administrative workflows, operational approval queues, and core task controls."
      />

      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border border-l-4 border-l-gold bg-card p-6 shadow-xs transition-all hover:shadow-md">
          <div className="flex size-11 items-center justify-center rounded-lg bg-gold/10 text-dark dark:text-gold">
            <ClipboardCheck className="size-5" />
          </div>
          <h2 className="mt-4 text-base font-bold tracking-tight text-foreground">
            Workflow Approvals
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Operational approval queues and financial threshold controls for pending transactions.
          </p>
          <div className="mt-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Ready for Queue Rules
            </span>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
