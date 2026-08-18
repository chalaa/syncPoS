import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requireUser();

  return (
    <PageShell>
      <PageHeader eyebrow="Dashboard" title="Operations Overview" />
      <section className="grid gap-5 lg:grid-cols-3">
        {[
          ["Signed in", user.username],
          ["Today", "Sales, stock, and sync widgets will be added here."],
          ["Next", "Products and partners are ready for admin testing."],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-semibold">{value}</p>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
