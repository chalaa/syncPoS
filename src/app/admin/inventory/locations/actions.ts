"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDefaultCompany, normalizeCode, uniqueViolationMessage } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generateCompanyCode } from "@/server/db/code-generator";
import { locations } from "@/server/db/schema";
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

export async function createStockLocation(formData: FormData) {
  await requirePermission("location.manage");

  const parsed = locationSchema.safeParse(locationPayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/inventory/locations", "error", "Location code, name, and type are required.");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(locations).values({
      companyId: company.id,
      code: parsed.data.code || await generateCompanyCode(db, {
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
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create location."));
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/locations");
  redirectWithMessage(parsed.data.returnPath, "notice", "Location created");
}

export async function updateStockLocation(formData: FormData) {
  await requirePermission("location.manage");

  const parsed = locationSchema.safeParse(locationPayload(formData));

  if (!parsed.success || !parsed.data.id || !parsed.data.code) {
    redirectWithMessage("/admin/inventory/locations", "error", "Location ID, code, name, and type are required.");
  }

  try {
    await db
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
      .where(eq(locations.id, parsed.data.id));
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
