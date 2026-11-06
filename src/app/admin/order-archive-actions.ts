"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { archiveOrderInTransaction } from "@/server/archived/order-archive";
import { db } from "@/server/db/client";
import { PERMISSIONS } from "@/server/iam/permissions";

const archiveSchema = z.object({ entityType: z.enum(["sales_order", "purchase_order"]), entityId: z.string().uuid() });

export async function archiveOrder(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.OWNER.ALL);
  const parsed = archiveSchema.safeParse({ entityType: formData.get("entityType"), entityId: formData.get("entityId") });
  if (!parsed.success) redirect("/admin?error=Invalid%20order");
  const { entityType, entityId } = parsed.data;
  const listPath = entityType === "sales_order" ? "/admin/sales" : "/admin/purchasing";

  try {
    await db.transaction((tx) => archiveOrderInTransaction(tx, { entityType, entityId, companyId: user.companyId, userId: user.id }), { isolationLevel: "serializable" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not archive order.";
    redirect(`${listPath}/${entityId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin", "layout");
  redirect(`${listPath}?notice=${encodeURIComponent("Order and linked documents archived. Stock movements reversed.")}`);
}
