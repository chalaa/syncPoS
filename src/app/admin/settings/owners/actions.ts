"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany, uniqueViolationMessage } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { auditLogs, owners } from "@/server/db/schema";

const ownerSchema = z.object({
  ownerId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Owner name is required.").max(160),
  returnPath: z.string().trim().startsWith("/admin/settings/owners").default("/admin/settings/owners"),
});

const ownerStatusSchema = z.object({
  ownerId: z.string().uuid(),
  returnPath: z.string().trim().startsWith("/admin/settings/owners").default("/admin/settings/owners"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  const separator = path.includes("?") ? "&" : "?";

  redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

export async function createOwner(formData: FormData) {
  const user = await requirePermission("company:settings:manage");
  const parsed = ownerSchema.safeParse({
    name: formValue(formData, "name"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings/owners",
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/settings/owners", "error", parsed.error.issues[0]?.message ?? "Invalid owner.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [owner] = await tx
        .insert(owners)
        .values({
          companyId: company.id,
          name: parsed.data.name,
        })
        .returning({ id: owners.id });

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "owner.create",
        entityType: "owner",
        entityId: owner.id,
        severity: "info",
        metadata: { name: parsed.data.name },
      });
    });
  } catch (error) {
    redirectWithMessage(
      parsed.data.returnPath,
      "error",
      uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not create owner."),
    );
  }

  revalidatePath("/admin/settings/owners");
  redirectWithMessage(parsed.data.returnPath, "notice", "Owner created");
}

export async function updateOwner(formData: FormData) {
  const user = await requirePermission("company:settings:manage");
  const parsed = ownerSchema.safeParse({
    ownerId: formValue(formData, "ownerId") || undefined,
    name: formValue(formData, "name"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings/owners",
  });

  if (!parsed.success || !parsed.data.ownerId) {
    redirectWithMessage("/admin/settings/owners", "error", parsed.error?.issues[0]?.message ?? "Owner ID and name are required.");
  }

  const ownerId = parsed.data.ownerId;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [owner] = await tx
        .update(owners)
        .set({
          name: parsed.data.name,
          updatedAt: sql`now()`,
        })
        .where(and(eq(owners.id, ownerId), eq(owners.companyId, company.id), isNull(owners.deletedAt)))
        .returning({ id: owners.id });

      if (!owner) {
        throw new Error("Owner does not exist.");
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "owner.update",
        entityType: "owner",
        entityId: owner.id,
        severity: "info",
        metadata: { name: parsed.data.name },
      });
    });
  } catch (error) {
    redirectWithMessage(
      parsed.data.returnPath,
      "error",
      uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not update owner."),
    );
  }

  revalidatePath("/admin/settings/owners");
  redirectWithMessage(parsed.data.returnPath, "notice", "Owner updated");
}

export async function softDeleteOwner(formData: FormData) {
  const user = await requirePermission("company:settings:manage");
  const parsed = ownerStatusSchema.safeParse({
    ownerId: formValue(formData, "ownerId"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings/owners",
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/settings/owners", "error", "Owner ID is required.");
  }

  const company = await getDefaultCompany();

  await db
    .update(owners)
    .set({
      deletedAt: new Date(),
      deletedBy: user.id,
      deleteReason: "Soft deleted from owner settings",
      updatedAt: sql`now()`,
    })
    .where(and(eq(owners.id, parsed.data.ownerId), eq(owners.companyId, company.id), isNull(owners.deletedAt)));

  revalidatePath("/admin/settings/owners");
  redirectWithMessage(parsed.data.returnPath, "notice", "Owner deleted");
}

export async function restoreOwner(formData: FormData) {
  await requirePermission("company:settings:manage");
  const parsed = ownerStatusSchema.safeParse({
    ownerId: formValue(formData, "ownerId"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings/owners?show=deleted",
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/settings/owners?show=deleted", "error", "Owner ID is required.");
  }

  const company = await getDefaultCompany();

  await db
    .update(owners)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(owners.id, parsed.data.ownerId), eq(owners.companyId, company.id)));

  revalidatePath("/admin/settings/owners");
  redirectWithMessage(parsed.data.returnPath, "notice", "Owner restored");
}
