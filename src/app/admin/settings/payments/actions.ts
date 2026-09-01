"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDefaultCompany, majorToMinor, uniqueViolationMessage } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { generateCompanyCode } from "@/server/db/code-generator";
import { paymentAccounts, paymentMethods } from "@/server/db/schema";

const methodTypeSchema = z.enum(["cash", "bank_transfer", "mobile_money", "card"]);

const paymentMethodSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  methodType: methodTypeSchema,
  allowInbound: z.boolean(),
  allowOutbound: z.boolean(),
  requiresReference: z.boolean(),
  isActive: z.boolean(),
  notes: z.string().trim().optional(),
  returnPath: z.string().trim().startsWith("/admin/settings/payments").default("/admin/settings/payments"),
}).refine((data) => data.allowInbound || data.allowOutbound, {
  message: "Payment method must allow inbound, outbound, or both.",
  path: ["allowInbound"],
});

const paymentAccountSchema = z.object({
  id: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid(),
  code: z.string().trim().max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  institutionName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(80).optional(),
  openingBalance: z.string().trim().default("0"),
  isActive: z.boolean(),
  notes: z.string().trim().optional(),
  returnPath: z.string().trim().startsWith("/admin/settings/payments").default("/admin/settings/payments"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function methodPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: formValue(formData, "code"),
    name: formValue(formData, "name"),
    methodType: formValue(formData, "methodType"),
    allowInbound: checkboxValue(formData, "allowInbound"),
    allowOutbound: checkboxValue(formData, "allowOutbound"),
    requiresReference: checkboxValue(formData, "requiresReference"),
    isActive: checkboxValue(formData, "isActive"),
    notes: formValue(formData, "notes"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings/payments",
  };
}

function accountPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    paymentMethodId: formValue(formData, "paymentMethodId"),
    code: formValue(formData, "code"),
    name: formValue(formData, "name"),
    institutionName: formValue(formData, "institutionName"),
    accountNumber: formValue(formData, "accountNumber"),
    openingBalance: formValue(formData, "openingBalance") || "0",
    isActive: checkboxValue(formData, "isActive"),
    notes: formValue(formData, "notes"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings/payments?tab=accounts",
  };
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  const separator = path.includes("?") ? "&" : "?";

  redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

export async function createPaymentMethod(formData: FormData) {
  await requirePermission("company.manage");

  const parsed = paymentMethodSchema.safeParse(methodPayload(formData));
  if (!parsed.success) {
    redirectWithMessage("/admin/settings/payments", "error", parsed.error.issues[0]?.message ?? "Invalid payment method.");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(paymentMethods).values({
      companyId: company.id,
      code: parsed.data.code || await generateCompanyCode(db, {
        companyId: company.id,
        table: "payment_methods",
        prefix: "PM",
      }),
      name: parsed.data.name,
      methodType: parsed.data.methodType,
      allowInbound: parsed.data.allowInbound,
      allowOutbound: parsed.data.allowOutbound,
      requiresReference: parsed.data.requiresReference,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes || null,
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create payment method."));
  }

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment method created");
}

export async function updatePaymentMethod(formData: FormData) {
  await requirePermission("company.manage");

  const parsed = paymentMethodSchema.safeParse(methodPayload(formData));
  if (!parsed.success || !parsed.data.id || !parsed.data.code) {
    redirectWithMessage("/admin/settings/payments", "error", "Payment method ID, code, name, and type are required.");
  }

  const company = await getDefaultCompany();

  try {
    await db
      .update(paymentMethods)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        methodType: parsed.data.methodType,
        allowInbound: parsed.data.allowInbound,
        allowOutbound: parsed.data.allowOutbound,
        requiresReference: parsed.data.requiresReference,
        isActive: parsed.data.isActive,
        notes: parsed.data.notes || null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(paymentMethods.id, parsed.data.id), eq(paymentMethods.companyId, company.id)));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update payment method."));
  }

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment method updated");
}

export async function softDeletePaymentMethod(formData: FormData) {
  await requirePermission("company.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings/payments";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Payment method ID is missing.");
  }

  await db
    .update(paymentMethods)
    .set({
      isActive: false,
      deletedAt: sql`now()`,
      deleteReason: "Deleted from payment configuration.",
      updatedAt: sql`now()`,
    })
    .where(eq(paymentMethods.id, id));

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(returnPath, "notice", "Payment method deleted");
}

export async function restorePaymentMethod(formData: FormData) {
  await requirePermission("company.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings/payments?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Payment method ID is missing.");
  }

  await db
    .update(paymentMethods)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(paymentMethods.id, id));

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(returnPath, "notice", "Payment method restored");
}

export async function createPaymentAccount(formData: FormData) {
  await requirePermission("company.manage");

  const parsed = paymentAccountSchema.safeParse(accountPayload(formData));
  if (!parsed.success) {
    redirectWithMessage("/admin/settings/payments?tab=accounts", "error", parsed.error.issues[0]?.message ?? "Invalid payment account.");
  }

  const company = await getDefaultCompany();
  const openingBalanceMinor = majorToMinor(parsed.data.openingBalance);

  try {
    const [method] = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, parsed.data.paymentMethodId),
          eq(paymentMethods.companyId, company.id),
          isNull(paymentMethods.deletedAt),
        ),
      )
      .limit(1);

    if (!method) {
      throw new Error("Select an active payment method.");
    }

    await db.insert(paymentAccounts).values({
      companyId: company.id,
      paymentMethodId: parsed.data.paymentMethodId,
      code: parsed.data.code || await generateCompanyCode(db, {
        companyId: company.id,
        table: "payment_accounts",
        prefix: "PA",
      }),
      name: parsed.data.name,
      institutionName: parsed.data.institutionName || null,
      accountNumber: parsed.data.accountNumber || null,
      openingBalanceMinor,
      currencyCode: company.baseCurrencyCode,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes || null,
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create payment account."));
  }

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment account created");
}

export async function updatePaymentAccount(formData: FormData) {
  await requirePermission("company.manage");

  const parsed = paymentAccountSchema.safeParse(accountPayload(formData));
  if (!parsed.success || !parsed.data.id || !parsed.data.code) {
    redirectWithMessage("/admin/settings/payments?tab=accounts", "error", "Payment account ID, method, code, and name are required.");
  }

  const company = await getDefaultCompany();
  const openingBalanceMinor = majorToMinor(parsed.data.openingBalance);

  try {
    const [method] = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.id, parsed.data.paymentMethodId),
          eq(paymentMethods.companyId, company.id),
          isNull(paymentMethods.deletedAt),
        ),
      )
      .limit(1);

    if (!method) {
      throw new Error("Select an active payment method.");
    }

    await db
      .update(paymentAccounts)
      .set({
        paymentMethodId: parsed.data.paymentMethodId,
        code: parsed.data.code,
        name: parsed.data.name,
        institutionName: parsed.data.institutionName || null,
        accountNumber: parsed.data.accountNumber || null,
        openingBalanceMinor,
        isActive: parsed.data.isActive,
        notes: parsed.data.notes || null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(paymentAccounts.id, parsed.data.id), eq(paymentAccounts.companyId, company.id)));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update payment account."));
  }

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(parsed.data.returnPath, "notice", "Payment account updated");
}

export async function softDeletePaymentAccount(formData: FormData) {
  await requirePermission("company.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings/payments?tab=accounts";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Payment account ID is missing.");
  }

  await db
    .update(paymentAccounts)
    .set({
      isActive: false,
      deletedAt: sql`now()`,
      deleteReason: "Deleted from payment configuration.",
      updatedAt: sql`now()`,
    })
    .where(eq(paymentAccounts.id, id));

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(returnPath, "notice", "Payment account deleted");
}

export async function restorePaymentAccount(formData: FormData) {
  await requirePermission("company.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings/payments?tab=accounts&show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Payment account ID is missing.");
  }

  await db
    .update(paymentAccounts)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(paymentAccounts.id, id));

  revalidatePath("/admin/settings/payments");
  redirectWithMessage(returnPath, "notice", "Payment account restored");
}
