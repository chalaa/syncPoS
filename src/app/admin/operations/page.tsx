import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  await requirePermission("company:settings:manage");

  return (
    <PageShell>
      <PageHeader eyebrow="Operations" title="Operations Workspace" />
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Expense Registration</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Capture non-inventory costs and register outbound payments.
          </p>
          <div className="mt-4">
            <ButtonLink href="/admin/operations/expenses">Open expenses</ButtonLink>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Approvals</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Approval queues will be connected as workflow rules are finalized.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
