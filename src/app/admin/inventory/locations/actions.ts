"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDefaultCompany, normalizeCode, uniqueViolationMessage } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generateCompanyCode } from "@/server/db/code-generator";
import { auditLogs, locationApprovers, locations, users } from "@/server/db/schema";
import { stockLocationTypeOptions } from "@/server/inventory/location-types";

const locationSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(20),
  name: z.string().trim().min(1).max(120),
  locationType: z.enum(stockLocationTypeOptions),
  addressText: z.string().trim().optional(),
  offlineSalesEnabled: z.enum(["on"]).optional(),
  allowNegativeStock: z.enum(["on"]).optional(),
  isActive: z.enum(["on"]).optional(),
  returnPath: z.string().trim().startsWith("/admin/inventory/locations").default("/admin/inventory/locations"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

function locationCodePrefix(locationType: string) {
  const prefixes: Record<string, string> = {
    warehouse: "WH",
    display_shop: "SHOP",
    transit: "TRANS",
    vendor: "VEND",
    customer: "CUSTLOC",
    adjustment: "ADJ",
    scrap: "SCRAP",
  };

  return prefixes[locationType] ?? "LOC";
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`);
}

function locationPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: normalizeCode(formValue(formData, "code")),
    name: formValue(formData, "name"),
    locationType: formValue(formData, "locationType"),
    addressText: formValue(formData, "addressText"),
    offlineSalesEnabled: formData.get("offlineSalesEnabled") === "on" ? "on" : undefined,
    allowNegativeStock: formData.get("allowNegativeStock") === "on" ? "on" : undefined,
    isActive: formData.get("isActive") === "on" ? "on" : undefined,
    returnPath: formValue(formData, "returnPath") || "/admin/inventory/locations",
  };
}

async function syncLocationApprovers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    companyId: string;
    locationId: string;
    approverIds: string[];
    actorUserId: string;
  },
) {
  const nextApproverIds = [...new Set(params.approverIds)];

  if (nextApproverIds.length > 0) {
    const validUsers = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.companyId, params.companyId),
          inArray(users.id, nextApproverIds),
          eq(users.status, "active"),
          isNull(users.deletedAt),
        ),
      );

    if (validUsers.length !== nextApproverIds.length) {
      throw new Error("One or more selected approvers are invalid.");
    }
  }

  const currentApprovers = await tx
    .select({
      id: locationApprovers.id,
      userId: locationApprovers.userId,
    })
    .from(locationApprovers)
    .where(
      and(
        eq(locationApprovers.companyId, params.companyId),
        eq(locationApprovers.locationId, params.locationId),
        isNull(locationApprovers.deletedAt),
      ),
    );
  const currentByUserId = new Map(currentApprovers.map((approver) => [approver.userId, approver]));
  const nextSet = new Set(nextApproverIds);
  const removedApprovers = currentApprovers.filter((approver) => !nextSet.has(approver.userId));
  const addedUserIds = nextApproverIds.filter((userId) => !currentByUserId.has(userId));

  if (removedApprovers.length > 0) {
    await tx
      .update(locationApprovers)
      .set({
        deletedAt: new Date(),
        deletedBy: params.actorUserId,
        deleteReason: "Removed from location approver field",
        updatedAt: sql`now()`,
      })
      .where(inArray(locationApprovers.id, removedApprovers.map((approver) => approver.id)));
  }

  if (addedUserIds.length > 0) {
    await tx.insert(locationApprovers).values(
      addedUserIds.map((userId) => ({
        companyId: params.companyId,
        locationId: params.locationId,
        userId,
      })),
    );
  }

  if (removedApprovers.length > 0 || addedUserIds.length > 0) {
    await tx.insert(auditLogs).values({
      companyId: params.companyId,
      actorUserId: params.actorUserId,
      action: "location.approvers.sync",
      entityType: "location",
      entityId: params.locationId,
      severity: "info",
      metadata: {
        addedUserIds,
        removedUserIds: removedApprovers.map((approver) => approver.userId),
      },
    });
  }
}

export async function createStockLocation(formData: FormData) {
  const user = await requirePermission("location.manage");

  const parsed = locationSchema.safeParse(locationPayload(formData));
  const approverIds = formValues(formData, "approverIds");

  if (!parsed.success) {
    redirectWithMessage("/admin/inventory/locations", "error", "Location code, name, and type are required.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [location] = await tx
        .insert(locations)
        .values({
          companyId: company.id,
          code: parsed.data.code || await generateCompanyCode(tx, {
            companyId: company.id,
            table: "locations",
            prefix: locationCodePrefix(parsed.data.locationType),
            padding: 3,
          }),
          name: parsed.data.name,
          locationType: parsed.data.locationType,
          addressJson: parsed.data.addressText ? { addressText: parsed.data.addressText } : null,
          offlineSalesEnabled: parsed.data.offlineSalesEnabled === "on",
          allowNegativeStock: parsed.data.allowNegativeStock === "on",
          isActive: parsed.data.isActive === "on",
        })
        .returning({ id: locations.id });

      await syncLocationApprovers(tx, {
        companyId: company.id,
        locationId: location.id,
        approverIds,
        actorUserId: user.id,
      });
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create location."));
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/locations");
  redirectWithMessage(parsed.data.returnPath, "notice", "Location created");
}

export async function updateStockLocation(formData: FormData) {
  const user = await requirePermission("location.manage");

  const parsed = locationSchema.safeParse(locationPayload(formData));
  const approverIds = formValues(formData, "approverIds");

  if (!parsed.success || !parsed.data.id || !parsed.data.code) {
    redirectWithMessage("/admin/inventory/locations", "error", "Location ID, code, name, and type are required.");
  }

  const company = await getDefaultCompany();
  const locationId = parsed.data.id;

  try {
    await db.transaction(async (tx) => {
      const [location] = await tx
        .update(locations)
        .set({
          code: parsed.data.code,
          name: parsed.data.name,
          locationType: parsed.data.locationType,
          addressJson: parsed.data.addressText ? { addressText: parsed.data.addressText } : null,
          offlineSalesEnabled: parsed.data.offlineSalesEnabled === "on",
          allowNegativeStock: parsed.data.allowNegativeStock === "on",
          isActive: parsed.data.isActive === "on",
          updatedAt: sql`now()`,
        })
        .where(and(eq(locations.id, locationId), eq(locations.companyId, company.id)))
        .returning({ id: locations.id });

      if (!location) {
        throw new Error("Location does not exist.");
      }

      await syncLocationApprovers(tx, {
        companyId: company.id,
        locationId: location.id,
        approverIds,
        actorUserId: user.id,
      });
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update location."));
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/locations");
  redirectWithMessage(parsed.data.returnPath, "notice", "Location updated");
}

export async function softDeleteStockLocation(formData: FormData) {
  await requirePermission("location.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/inventory/locations";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Location ID is missing.");
  }

  await db
    .update(locations)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from inventory location screen",
      updatedAt: sql`now()`,
    })
    .where(eq(locations.id, id));

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/locations");
  redirectWithMessage(returnPath, "notice", "Location deleted");
}

export async function restoreStockLocation(formData: FormData) {
  await requirePermission("location.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/inventory/locations?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Location ID is missing.");
  }

  await db
    .update(locations)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(locations.id, id));

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/locations");
  redirectWithMessage(returnPath, "notice", "Location restored");
}
