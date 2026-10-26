import { PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getDashboardReport } from "@/server/reports/reports";
import { PERMISSIONS } from "@/server/iam/permissions";
import { DashboardClient } from "@/app/admin/dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requirePermission(PERMISSIONS.REPORTS.HUB_VIEW);
  const report = await getDashboardReport();

  return (
    <PageShell>
      <DashboardClient report={report} />
    </PageShell>
  );
}
