"use me"; // Server Actions
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { EntityType } from "@/server/archived/archived-service";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  brands,
  expenseCategories,
  expenses,
  locations,
  owners,
  partners,
  paymentAccounts,
  paymentTerms,
  productCategories,
  products,
  purchaseOrders,
  salesOrders,
  taxes,
} from "@/server/db/schema";

const restoreSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  returnPath: z.string().optional(),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  const joiner = path.includes("?") ? "&" : "?";
  redirect(`${path}${joiner}${key}=${encodeURIComponent(message)}`);
}

export async function restoreArchivedItem(formData: FormData) {
  await requirePermission("company:settings:manage");
  const company = await getDefaultCompany();

  const entityType = formValue(formData, "entityType") as EntityType;
  const entityId = formValue(formData, "entityId");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings/archived";

  const parsed = restoreSchema.safeParse({ entityType, entityId, returnPath });
  if (!parsed.success) {
    redirectWithMessage(returnPath, "error", "Invalid restore parameters.");
  }

  try {
    switch (entityType) {
      case "product":
        await db
          .update(products)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(products.id, entityId), eq(products.companyId, company.id)));
        break;

      case "sales_order":
        await db
          .update(salesOrders)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(salesOrders.id, entityId), eq(salesOrders.companyId, company.id)));
        break;

      case "purchase_order":
        await db
          .update(purchaseOrders)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(purchaseOrders.id, entityId), eq(purchaseOrders.companyId, company.id)));
        break;

      case "expense":
        await db
          .update(expenses)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(expenses.id, entityId), eq(expenses.companyId, company.id)));
        break;

      case "partner":
        await db
          .update(partners)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(partners.id, entityId), eq(partners.companyId, company.id)));
        break;

      case "location":
        await db
          .update(locations)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(locations.id, entityId), eq(locations.companyId, company.id)));
        break;

      case "product_category":
        await db
          .update(productCategories)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(productCategories.id, entityId), eq(productCategories.companyId, company.id)));
        break;

      case "expense_category":
        await db
          .update(expenseCategories)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(expenseCategories.id, entityId), eq(expenseCategories.companyId, company.id)));
        break;

      case "brand":
        await db
          .update(brands)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(brands.id, entityId), eq(brands.companyId, company.id)));
        break;

      case "payment_term":
        await db
          .update(paymentTerms)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(paymentTerms.id, entityId), eq(paymentTerms.companyId, company.id)));
        break;

      case "owner":
        await db
          .update(owners)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(owners.id, entityId), eq(owners.companyId, company.id)));
        break;

      case "payment_account":
        await db
          .update(paymentAccounts)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(paymentAccounts.id, entityId), eq(paymentAccounts.companyId, company.id)));
        break;

      case "tax":
        await db
          .update(taxes)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(taxes.id, entityId), eq(taxes.companyId, company.id)));
        break;

      default:
        redirectWithMessage(returnPath, "error", "Unsupported entity type.");
    }
  } catch (err) {
    console.error("Failed to restore archived item:", err);
    redirectWithMessage(returnPath, "error", "Database error occurred while restoring item.");
  }

  // Revalidate relevant paths
  revalidatePath("/admin/settings/archived");
  revalidatePath("/admin/products");
  revalidatePath("/admin/sales");
  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/operations/expenses");
  revalidatePath("/admin/partners");
  revalidatePath("/admin/inventory/locations");
  revalidatePath("/admin/settings/owners");
  revalidatePath("/admin/settings/payments");

  redirectWithMessage(returnPath, "notice", "Item successfully restored from archive!");
}
