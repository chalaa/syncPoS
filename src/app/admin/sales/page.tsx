import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  await requireUser();

  return (
    <PageShell>
      <PageHeader eyebrow="Sales" title="Sales Workspace" />
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          POS, orders, and invoices will be implemented after catalog, partner,
          and inventory foundations are stable.
        </p>
      </section>
    </PageShell>
  );
}
