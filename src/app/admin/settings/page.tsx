import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser();

  return (
    <PageShell>
      <PageHeader eyebrow="Settings" title="Company Settings" />
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Settings screens for company profile, users, roles, locations, devices,
          and audit logs will be implemented as separate vertical slices.
        </p>
      </section>
    </PageShell>
  );
}
