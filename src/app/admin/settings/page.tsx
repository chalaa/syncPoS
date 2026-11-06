import { redirect } from "next/navigation";

import { IamManager } from "@/app/admin/settings/iam-manager";
import { ArchivedModelList } from "@/components/app/archived-model-list";
import { getUserPermissionCodes, requireUser } from "@/server/auth/session";
import { getIamManagementData } from "@/server/iam/iam";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ view?: string; notice?: string; error?: string; show?: string; q?: string; page?: string; pageSize?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();

  const params = await searchParams;
  const view = params.view === "roles" || params.view === "permissions" ? params.view : "users";
  const permissionCodes = await getUserPermissionCodes(user.id);
  const canViewUsers = userHasPermission(permissionCodes, PERMISSIONS.USERS.VIEW);
  const canManageUsers = userHasPermission(permissionCodes, PERMISSIONS.USERS.MANAGE);
  const canViewRoles = userHasPermission(permissionCodes, PERMISSIONS.ROLES.VIEW);
  const canManageRoles = userHasPermission(permissionCodes, PERMISSIONS.ROLES.MANAGE);

  if (view === "users" && !canViewUsers && canViewRoles && !params.view) {
    redirect("/admin/settings?view=roles");
  }

  if ((view === "users" && !canViewUsers) || ((view === "roles" || view === "permissions") && !canViewRoles)) {
    redirect("/unauthorized");
  }

  if (view === "roles" && params.show === "deleted") {
    return <ArchivedModelList model="role" title="Roles" companyId={user.companyId} params={params} canRestore={false} />;
  }

  const data = await getIamManagementData();
  const returnPath = `/admin/settings${view === "users" ? "" : `?view=${view}`}`;

  return (
    <IamManager
      {...data}
      view={view}
      canViewUsers={canViewUsers}
      canManageUsers={canManageUsers}
      canViewRoles={canViewRoles}
      canManageRoles={canManageRoles}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
    />
  );
}
