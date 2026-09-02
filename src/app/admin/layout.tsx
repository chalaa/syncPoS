import type { ReactNode } from "react";

import { AdminShell } from "@/components/app/admin-top-nav";
import { getUserPermissionCodes, requireUser } from "@/server/auth/session";
import { getUserShopOptions } from "@/server/locations/shop-options";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [permissionCodes, shopLocations] = await Promise.all([
    getUserPermissionCodes(user.id),
    getUserShopOptions(user.id, user.companyId),
  ]);

  return (
    <AdminShell username={user.username} permissionCodes={Array.from(permissionCodes)} shopLocations={shopLocations}>
      {children}
    </AdminShell>
  );
}
