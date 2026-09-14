"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany, uniqueViolationMessage } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { auditLogs, locationApprovers, locations, users } from "@/server/db/schema";

const assignSchema = z.object({
  locationId: z.string().uuid("Location is required."),
  userId: z.string().uuid("User is required."),
});

const statusSchema = z.object({
  approverId: z.string().uuid(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function redirectWithMessage(key: "notice" | "error", message: string): never {
  redirect(`/admin/settings/location-approvers?${key}=${encodeURIComponent(message)}`);
}

export async function assignLocationApprover(formData: FormData) {
  const user = await requirePermission("company:settings:manage");
  const parsed = assignSchema.safeParse({
    locationId: formValue(formData, "locationId"),
    userId: formValue(formData, "userId"),
  });

  if (!parsed.success) {
    redirectWithMessage("error", parsed.error.issues[0]?.message ?? "Invalid approver assignment.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [location] = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.id, parsed.data.locationId), eq(locations.companyId, company.id), isNull(locations.deletedAt)))
        .limit(1);
      const [approverUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, parsed.data.userId), eq(users.companyId, company.id), eq(users.status, "active"), isNull(users.deletedAt)))
        .limit(1);

      if (!location || !approverUser) {
        throw new Error("Location or user is invalid.");
      }

      const [assignment] = await tx
        .insert(locationApprovers)
        .values({
          companyId: company.id,
          locationId: parsed.data.locationId,
          userId: parsed.data.userId,
        })
        .returning({ id: locationApprovers.id });

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "location_approver.assign",
        entityType: "location_approver",
        entityId: assignment.id,
        severity: "info",
        metadata: {
          locationId: parsed.data.locationId,
          userId: parsed.data.userId,
        },
      });
    });
  } catch (error) {
    redirectWithMessage("error", uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not assign approver."));
  }

  revalidatePath("/admin/settings/location-approvers");
  redirectWithMessage("notice", "Location approver assigned");
}

export async function removeLocationApprover(formData: FormData) {
  const user = await requirePermission("company:settings:manage");
  const parsed = statusSchema.safeParse({
    approverId: formValue(formData, "approverId"),
  });

  if (!parsed.success) {
    redirectWithMessage("error", "Approver assignment is required.");
  }

  const company = await getDefaultCompany();

  await db.transaction(async (tx) => {
    const [assignment] = await tx
      .update(locationApprovers)
      .set({
        deletedAt: new Date(),
        deletedBy: user.id,
        deleteReason: "Removed from location approver settings",
        updatedAt: sql`now()`,
      })
      .where(and(eq(locationApprovers.id, parsed.data.approverId), eq(locationApprovers.companyId, company.id), isNull(locationApprovers.deletedAt)))
      .returning({ id: locationApprovers.id, locationId: locationApprovers.locationId, userId: locationApprovers.userId });

    if (!assignment) {
      throw new Error("Approver assignment does not exist.");
    }

    await tx.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "location_approver.remove",
      entityType: "location_approver",
      entityId: assignment.id,
      severity: "info",
      metadata: {
        locationId: assignment.locationId,
        userId: assignment.userId,
      },
    });
  });

  revalidatePath("/admin/settings/location-approvers");
  redirectWithMessage("notice", "Location approver removed");
}
