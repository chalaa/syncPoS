import type { ReactNode } from "react";

import { AdminShell } from "@/components/app/admin-top-nav";
import { getUserPermissionCodes, requireUser } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const permissionCodes = Array.from(await getUserPermissionCodes(user.id));

  return <AdminShell username={user.username} permissionCodes={permissionCodes}>{children}</AdminShell>;
}
