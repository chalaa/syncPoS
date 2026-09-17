import { removeLocationApprover, assignLocationApprover } from "@/app/admin/settings/location-approvers/actions";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { getLocationApproverManagementData } from "@/server/inventory/location-approvers";

export const dynamic = "force-dynamic";

type LocationApproversPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export default async function LocationApproversPage({ searchParams }: LocationApproversPageProps) {
  await requirePermission("company:settings:manage");

  const params = await searchParams;
  const company = await getDefaultCompany();
  const data = await getLocationApproverManagementData(company.id);

  return (
    <PageShell maxWidth="max-w-5xl">
      <PageHeader eyebrow="Settings" title="Location Approvers" />

      <div className="grid gap-4">
        {params.notice ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {params.notice}
          </p>
        ) : null}
        {params.error ? (
          <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <form action={assignLocationApprover} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium">
            Location
            <select name="locationId" className={inputClass} defaultValue="">
              <option value="" disabled>Select location</option>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} / {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Approver
            <select name="userId" className={inputClass} defaultValue="">
              <option value="" disabled>Select user</option>
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}{user.email ? ` / ${user.email}` : ""}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Assign</Button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Approver</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-32 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.approvers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No approval-controlled locations yet.
                  </td>
                </tr>
              ) : (
                data.approvers.map((approver) => (
                  <tr key={approver.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{approver.locationName}</div>
                      <div className="text-xs text-muted-foreground">{approver.locationCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{approver.username}</div>
                      <div className="text-xs text-muted-foreground">{approver.userEmail ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">{approver.isActive ? "Active" : "Inactive"}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteConfirmationDialog
                        title="Remove Location Approver"
                        description={`Are you sure you want to remove ${approver.username} from location ${approver.locationName}?`}
                        action={removeLocationApprover}
                        hiddenInputs={{ approverId: approver.id }}
                        triggerLabel="Remove"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
