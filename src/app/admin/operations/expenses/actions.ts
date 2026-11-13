"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { majorToMinor } from "@/server/catalog/products";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  employees,
  expenseCategories,
  expenses,
  paymentAccounts,
  paymentAllocations,
  paymentMethods,
  payments,
  users,
} from "@/server/db/schema";
import { getUserPermissionCodes, requirePermission, requireUser } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
import { getSelectedShopId } from "@/server/locations/shop-options";
import { parseValidLocationId } from "@/server/reports/reports";

const expenseCategorySchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().optional(),
  name: z.string().trim().min(1, "Category name is required."),
  description: z.string().trim().optional(),
  isActive: z.boolean().default(true),
  returnPath: z.string().trim().startsWith("/admin/operations/expenses").default("/admin/operations/expenses/categories"),
});

const expenseSchema = z.object({
  categoryId: z.string().uuid("Expense category is required."),
  expenseDate: z.string().trim().min(1, "Expense date is required."),
  amount: z.coerce.number().positive("Expense amount must be greater than zero."),
  employeeId: z
    .string()
    .trim()
    .refine(
      (val) => z.string().uuid().safeParse(val).success || /^user:[0-9a-f-]{36}$/i.test(val),
      "Invalid employee selection.",
    )
    .optional()
    .nullable(),
  locationId: z.string().uuid().optional().nullable(),
  description: z.string().trim().optional(),
  returnPath: z.string().trim().startsWith("/admin/operations/expenses").default("/admin/operations/expenses"),
});

const payExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  paymentAccountId: z.string().uuid().optional(),
  amount: z.coerce.number().positive().optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const idSchema = z.object({
  id: z.string().uuid(),
  returnPath: z.string().trim().startsWith("/admin/operations/expenses").default("/admin/operations/expenses"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function expenseNo() {
  return `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function paymentNo() {
  return `PAY-EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

export async function createExpenseCategory(formData: FormData) {
  const user = await requirePermission("company.manage");
  const parsed = expenseCategorySchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    isActive: checkboxValue(formData, "isActive"),
    returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses/categories",
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/categories", "error", parsed.error.issues[0]?.message ?? "Invalid expense category.");
  }

  const company = await getDefaultCompany();
  const code = formValue(formData, "code") || `EXPCAT-${randomUUID().slice(0, 6).toUpperCase()}`;

  try {
    const [inserted] = await db
      .insert(expenseCategories)
      .values({
        companyId: company.id,
        code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive,
      })
      .returning({ id: expenseCategories.id });

    await db.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "expense_category.create",
      entityType: "expense_category",
      entityId: inserted.id,
      severity: "info",
      metadata: { code, name: parsed.data.name },
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", error instanceof Error ? error.message : "Could not create expense category.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category created");
}

export async function updateExpenseCategory(formData: FormData) {
  const user = await requirePermission("company.manage");
  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/operations/expenses/categories";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Expense category ID, code, and name are required.");
  }

  const parsed = expenseCategorySchema.safeParse({
    id,
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    isActive: checkboxValue(formData, "isActive"),
    returnPath,
  });

  if (!parsed.success) {
    redirectWithMessage(returnPath, "error", parsed.error.issues[0]?.message ?? "Invalid expense category.");
  }

  const company = await getDefaultCompany();

  try {
    await db
      .update(expenseCategories)
      .set({
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseCategories.id, id), eq(expenseCategories.companyId, company.id)));

    await db.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "expense_category.update",
      entityType: "expense_category",
      entityId: id,
      severity: "info",
      metadata: { name: parsed.data.name },
    });
  } catch (error) {
    redirectWithMessage(returnPath, "error", error instanceof Error ? error.message : "Could not update expense category.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(returnPath, "notice", "Expense category updated");
}

export async function softDeleteExpenseCategory(formData: FormData) {
  const user = await requirePermission("company.manage");
  const parsed = idSchema.safeParse({ id: formValue(formData, "id"), returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses/categories" });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/categories", "error", "Expense category ID is missing.");
  }

  const company = await getDefaultCompany();

  try {
    await db
      .update(expenseCategories)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(expenseCategories.id, parsed.data.id), eq(expenseCategories.companyId, company.id)));

    await db.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "expense_category.delete",
      entityType: "expense_category",
      entityId: parsed.data.id,
      severity: "warning",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", error instanceof Error ? error.message : "Could not delete expense category.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category deleted");
}

export async function restoreExpenseCategory(formData: FormData) {
  const user = await requirePermission("company.manage");
  const parsed = idSchema.safeParse({ id: formValue(formData, "id"), returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses/categories?show=deleted" });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/categories?show=deleted", "error", "Expense category ID is missing.");
  }

  const company = await getDefaultCompany();

  try {
    await db
      .update(expenseCategories)
      .set({
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(expenseCategories.id, parsed.data.id), eq(expenseCategories.companyId, company.id)));

    await db.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "expense_category.restore",
      entityType: "expense_category",
      entityId: parsed.data.id,
      severity: "info",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", error instanceof Error ? error.message : "Could not restore expense category.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category restored");
}

function expensePayload(formData: FormData) {
  return {
    categoryId: formValue(formData, "categoryId"),
    expenseDate: formValue(formData, "expenseDate"),
    amount: formValue(formData, "amount"),
    employeeId: formValue(formData, "employeeId") || null,
    locationId: formValue(formData, "locationId") || null,
    description: formValue(formData, "description"),
  };
}

export async function createExpense(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.EXPENSES.CREATE);
  const returnPath = formValue(formData, "returnPath") || "/admin/operations/expenses";
  const parsed = expenseSchema.safeParse(expensePayload(formData));

  if (!parsed.success) {
    redirectWithMessage(returnPath, "error", parsed.error.issues[0]?.message ?? "Invalid expense.");
  }

  const amountMinor = majorToMinor(String(parsed.data.amount));
  if (amountMinor <= 0) {
    redirectWithMessage(returnPath, "error", "Expense amount must be greater than zero.");
  }

  const company = await getDefaultCompany();
  const fallbackLocationId = parseValidLocationId(await getSelectedShopId());
  const resolvedLocationId = parsed.data.locationId ?? fallbackLocationId;
  let createdExpenseId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [category] = await tx
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(and(eq(expenseCategories.id, parsed.data.categoryId), eq(expenseCategories.companyId, company.id), eq(expenseCategories.isActive, true), isNull(expenseCategories.deletedAt)))
        .limit(1);

      if (!category) {
        throw new Error("Select an active expense category.");
      }

      let resolvedEmployeeId = parsed.data.employeeId ?? null;
      if (resolvedEmployeeId?.startsWith("user:")) {
        const userId = resolvedEmployeeId.slice("user:".length);
        const [targetUser] = await tx
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            employeeId: users.employeeId,
          })
          .from(users)
          .where(and(eq(users.id, userId), eq(users.companyId, company.id), isNull(users.deletedAt)))
          .limit(1);

        if (!targetUser) {
          throw new Error("Selected employee user was not found.");
        }

        if (targetUser.employeeId) {
          resolvedEmployeeId = targetUser.employeeId;
        } else {
          const [createdEmp] = await tx
            .insert(employees)
            .values({
              companyId: company.id,
              employeeNo: `EMP-${targetUser.username.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)}-${randomUUID().slice(0, 4).toUpperCase()}`,
              fullName: targetUser.username,
              email: targetUser.email,
              status: "active",
            })
            .returning({ id: employees.id });

          await tx
            .update(users)
            .set({ employeeId: createdEmp.id, updatedAt: new Date() })
            .where(eq(users.id, targetUser.id));

          resolvedEmployeeId = createdEmp.id;
        }
      }

      const [expense] = await tx
        .insert(expenses)
        .values({
          companyId: company.id,
          categoryId: parsed.data.categoryId,
          employeeId: resolvedEmployeeId,
          vendorId: null,
          locationId: resolvedLocationId,
          expenseNo: expenseNo(),
          status: "posted",
          paymentStatus: "unpaid",
          expenseDate: parsed.data.expenseDate,
          amountMinor,
          currencyCode: company.baseCurrencyCode,
          description: parsed.data.description || null,
          createdBy: user.id,
        })
        .returning({ id: expenses.id, expenseNo: expenses.expenseNo });
      createdExpenseId = expense.id;

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "expense.create",
        entityType: "expense",
        entityId: expense.id,
        severity: "info",
        metadata: { expenseNo: expense.expenseNo, paymentStatus: "unpaid" },
      });
    });
  } catch (error) {
    redirectWithMessage(returnPath, "error", error instanceof Error ? error.message : "Could not create expense.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(`/admin/operations/expenses/${createdExpenseId}`, "notice", "Expense created");
}

export async function registerExpensePayment(formData: FormData) {
  const user = await requireUser();
  const permissions = await getUserPermissionCodes(user.id);
  if (
    !userHasPermission(permissions, PERMISSIONS.EXPENSES.PAYMENTS_MANAGE) &&
    !userHasPermission(permissions, PERMISSIONS.COMPANY.MANAGE)
  ) {
    redirect("/unauthorized");
  }
  const parsed = payExpenseSchema.safeParse({
    expenseId: formValue(formData, "expenseId"),
    paymentAccountId: formValue(formData, "paymentAccountId") || formValue(formData, "linePaymentAccountId") || undefined,
    amount: formValue(formData, "amount") || formValue(formData, "lineAmount") || undefined,
    reference: formValue(formData, "reference") || formValue(formData, "lineReference") || undefined,
    notes: formValue(formData, "notes") || formValue(formData, "lineNote") || undefined,
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses", "error", parsed.error.issues[0]?.message ?? "Invalid payment.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [expense] = await tx
        .select({
          id: expenses.id,
          amountMinor: expenses.amountMinor,
          currencyCode: expenses.currencyCode,
          paymentStatus: expenses.paymentStatus,
          status: expenses.status,
        })
        .from(expenses)
        .where(and(eq(expenses.id, parsed.data.expenseId), eq(expenses.companyId, company.id)))
        .limit(1);

      if (!expense) {
        throw new Error("Expense record not found.");
      }

      if (expense.status === "cancelled") {
        throw new Error("Cannot pay a cancelled expense.");
      }

      if (expense.paymentStatus === "paid") {
        throw new Error("Expense is already fully paid.");
      }

      const [paidRow] = await tx
        .select({
          paidMinor: sql<number>`coalesce(sum(${paymentAllocations.amountMinor}), 0)::bigint`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(paymentAllocations.expenseId, expense.id),
            eq(payments.status, "posted"),
            isNull(paymentAllocations.deletedAt),
            isNull(payments.deletedAt),
          ),
        );

      const alreadyPaidMinor = Number(paidRow?.paidMinor ?? 0);
      const residualMinor = Math.max(expense.amountMinor - alreadyPaidMinor, 0);
      if (residualMinor <= 0) {
        throw new Error("Expense is already fully paid.");
      }

      const payMinor = parsed.data.amount !== undefined
        ? majorToMinor(String(parsed.data.amount))
        : residualMinor;

      if (payMinor <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }
      if (payMinor > residualMinor) {
        throw new Error("Payment amount cannot exceed remaining expense balance.");
      }

      const [account] = parsed.data.paymentAccountId
        ? await tx
            .select({ id: paymentAccounts.id, paymentMethodId: paymentAccounts.paymentMethodId })
            .from(paymentAccounts)
            .where(and(eq(paymentAccounts.id, parsed.data.paymentAccountId), eq(paymentAccounts.companyId, company.id), isNull(paymentAccounts.deletedAt)))
            .limit(1)
        : await tx
            .select({ id: paymentAccounts.id, paymentMethodId: paymentAccounts.paymentMethodId })
            .from(paymentAccounts)
            .where(and(eq(paymentAccounts.companyId, company.id), isNull(paymentAccounts.deletedAt)))
            .limit(1);

      if (!account) {
        throw new Error("A payment account must be configured in settings to record payments.");
      }

      const [method] = await tx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(and(eq(paymentMethods.id, account.paymentMethodId), eq(paymentMethods.companyId, company.id), isNull(paymentMethods.deletedAt)))
        .limit(1);

      if (!method) {
        throw new Error("A payment method must be configured in settings to record payments.");
      }

      const now = new Date();
      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: company.id,
          paymentType: "outbound",
          paymentNo: paymentNo(),
          status: "posted",
          paymentDate: now,
          postedAt: now,
          postedBy: user.id,
          paymentMethodId: method.id,
          paymentAccountId: account.id,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
          amountMinor: payMinor,
          currencyCode: expense.currencyCode,
        })
        .returning({ id: payments.id });

      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        expenseId: expense.id,
        amountMinor: payMinor,
      });

      const nextPaymentStatus = alreadyPaidMinor + payMinor >= expense.amountMinor ? "paid" : "unpaid";

      await tx
        .update(expenses)
        .set({
          paymentStatus: nextPaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, expense.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "expense.pay",
        entityType: "expense",
        entityId: expense.id,
        severity: "info",
      });
    });
  } catch (error) {
    redirectWithMessage(`/admin/operations/expenses/${parsed.data.expenseId}`, "error", error instanceof Error ? error.message : "Could not register expense payment.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(`/admin/operations/expenses/${parsed.data.expenseId}`, "notice", "Expense payment registered");
}

export async function cancelExpense(formData: FormData) {
  const user = await requirePermission("company.manage");
  const parsed = idSchema.safeParse({ id: formValue(formData, "id"), returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses" });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses", "error", "Expense ID is missing.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [expense] = await tx
        .select({ id: expenses.id, paymentStatus: expenses.paymentStatus })
        .from(expenses)
        .where(and(eq(expenses.id, parsed.data.id), eq(expenses.companyId, company.id)))
        .limit(1);

      if (!expense) {
        throw new Error("Expense record not found.");
      }

      if (expense.paymentStatus === "paid") {
        throw new Error("Cannot cancel a paid expense.");
      }

      await tx
        .update(expenses)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, parsed.data.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "expense.cancel",
        entityType: "expense",
        entityId: parsed.data.id,
        severity: "warning",
      });
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", error instanceof Error ? error.message : "Could not cancel expense.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense cancelled");
}
