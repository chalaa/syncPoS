import type { ReactNode } from "react";

import { AdminShell } from "@/components/app/admin-top-nav";
import { requireUser } from "@/server/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return <AdminShell username={user.username}>{children}</AdminShell>;
}
