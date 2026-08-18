"use server";

import { randomUUID, createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDefaultCompany, majorToMinor, uniqueViolationMessage } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import {
  attachments,
  auditLogs,
  expenseCategories,
  expenses,
  paymentAccounts,
  paymentAllocations,
  paymentMethods,
  payments,
} from "@/server/db/schema";

const optionalUuid = z.string().uuid().or(z.literal("")).transform((value) => value || null);

const expenseCategorySchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().optional(),
  isActive: z.boolean(),
  returnPath: z.string().trim().startsWith("/admin/operations/expenses").default("/admin/operations/expenses/categories"),
});

const expenseSchema = z.object({
  categoryId: z.string().uuid(),
  expenseDate: z.string().trim().min(1),
  amount: z.string().trim().min(1),
  paymentStatus: z.enum(["unpaid", "paid"]),
  paymentAccountId: optionalUuid,
  paymentReference: z.string().trim().max(120).optional(),
  employeeId: optionalUuid,
  vendorId: optionalUuid,
  locationId: optionalUuid,
  description: z.string().trim().optional(),
  attachmentObjectKey: z.string().trim().optional(),
  attachmentFileName: z.string().trim().optional(),
  attachmentMimeType: z.string().trim().optional(),
  attachmentSizeBytes: z.coerce.number().int().nonnegative().optional(),
  attachmentSha256Hash: z.string().trim().optional(),
});

const payExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  paymentAccountId: z.string().uuid(),
  amount: z.string().trim().min(1),
  reference: z.string().trim().max(120).optional(),
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

function categoryPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: formValue(formData, "code"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    isActive: checkboxValue(formData, "isActive"),
    returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses/categories",
  };
}

function expensePayload(formData: FormData) {
  return {
    categoryId: formValue(formData, "categoryId"),
    expenseDate: formValue(formData, "expenseDate"),
    amount: formValue(formData, "amount"),
    paymentStatus: formValue(formData, "paymentStatus"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    paymentReference: formValue(formData, "paymentReference"),
    employeeId: formValue(formData, "employeeId"),
    vendorId: formValue(formData, "vendorId"),
    locationId: formValue(formData, "locationId"),
    description: formValue(formData, "description"),
    attachmentObjectKey: formValue(formData, "attachmentObjectKey"),
    attachmentFileName: formValue(formData, "attachmentFileName"),
    attachmentMimeType: formValue(formData, "attachmentMimeType"),
    attachmentSizeBytes: formValue(formData, "attachmentSizeBytes") || undefined,
    attachmentSha256Hash: formValue(formData, "attachmentSha256Hash"),
  };
}

function sha256Fallback(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function getOutboundPaymentAccount(accountId: string, companyId: string, currencyCode: string) {
  const [account] = await db
    .select({
      id: paymentAccounts.id,
      currencyCode: paymentAccounts.currencyCode,
      methodId: paymentMethods.id,
      requiresReference: paymentMethods.requiresReference,
      allowOutbound: paymentMethods.allowOutbound,
    })
    .from(paymentAccounts)
    .innerJoin(paymentMethods, eq(paymentAccounts.paymentMethodId, paymentMethods.id))
    .where(
      and(
        eq(paymentAccounts.id, accountId),
        eq(paymentAccounts.companyId, companyId),
        eq(paymentAccounts.isActive, true),
        eq(paymentMethods.isActive, true),
        isNull(paymentAccounts.deletedAt),
        isNull(paymentMethods.deletedAt),
      ),
    )
    .limit(1);

  if (!account || !account.allowOutbound || account.currencyCode !== currencyCode) {
    throw new Error("Select an active outbound payment account with matching currency.");
  }

  return account;
}

async function updateExpensePaymentStatus(expenseId: string) {
  const [summary] = await db.execute<{ amountMinor: number; paidMinor: number }>(sql`
    select
      e.amount_minor as "amountMinor",
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidMinor"
    from expenses e
    left join payment_allocations pa on pa.expense_id = e.id
    left join payments p on p.id = pa.payment_id
    where e.id = ${expenseId}
      and e.deleted_at is null
    group by e.id
    limit 1
  `);

  const paymentStatus = (summary?.paidMinor ?? 0) >= (summary?.amountMinor ?? 0) ? "paid" : "unpaid";

  await db
    .update(expenses)
    .set({ paymentStatus, updatedAt: sql`now()` })
    .where(eq(expenses.id, expenseId));
}

async function createPostedExpensePayment({
  companyId,
  userId,
  expenseId,
  partnerId,
  paymentAccountId,
  amountMinor,
  currencyCode,
  reference,
  notes,
}: {
  companyId: string;
  userId: string;
  expenseId: string;
  partnerId: string | null;
  paymentAccountId: string;
  amountMinor: number;
  currencyCode: string;
  reference?: string | null;
  notes?: string | null;
}) {
  const account = await getOutboundPaymentAccount(paymentAccountId, companyId, currencyCode);

  if (account.requiresReference && !reference) {
    throw new Error("This payment method requires a reference.");
  }

  const [payment] = await db
    .insert(payments)
    .values({
      companyId,
      partnerId,
      paymentNo: paymentNo(),
      paymentType: "outbound",
      status: "posted",
      paymentMethodId: account.methodId,
      paymentAccountId: account.id,
      amountMinor,
      currencyCode,
      reference: reference || null,
      notes: notes || "Expense payment.",
      postedAt: new Date(),
      postedBy: userId,
    })
    .returning({ id: payments.id, paymentNo: payments.paymentNo });

  await db.insert(paymentAllocations).values({
    paymentId: payment.id,
    expenseId,
    amountMinor,
    notes: "Expense payment allocation.",
  });

  return payment;
}

export async function createExpenseCategory(formData: FormData) {
  await requirePermission("company.manage");
  const parsed = expenseCategorySchema.safeParse(categoryPayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/categories", "error", parsed.error.issues[0]?.message ?? "Invalid expense category.");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(expenseCategories).values({
      companyId: company.id,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive,
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create expense category."));
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category created");
}

export async function updateExpenseCategory(formData: FormData) {
  await requirePermission("company.manage");
  const parsed = expenseCategorySchema.safeParse(categoryPayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/operations/expenses/categories", "error", "Expense category ID, code, and name are required.");
  }

  try {
    await db
      .update(expenseCategories)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive,
        updatedAt: sql`now()`,
      })
      .where(eq(expenseCategories.id, parsed.data.id));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update expense category."));
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category updated");
}

export async function softDeleteExpenseCategory(formData: FormData) {
  await requirePermission("company.manage");
  const parsed = idSchema.safeParse({ id: formValue(formData, "id"), returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses/categories" });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/categories", "error", "Expense category ID is missing.");
  }

  await db
    .update(expenseCategories)
    .set({ isActive: false, deletedAt: sql`now()`, deleteReason: "Deleted from expense categories.", updatedAt: sql`now()` })
    .where(eq(expenseCategories.id, parsed.data.id));

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category deleted");
}

export async function restoreExpenseCategory(formData: FormData) {
  await requirePermission("company.manage");
  const parsed = idSchema.safeParse({ id: formValue(formData, "id"), returnPath: formValue(formData, "returnPath") || "/admin/operations/expenses/categories?show=deleted" });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/categories?show=deleted", "error", "Expense category ID is missing.");
  }

  await db
    .update(expenseCategories)
    .set({ isActive: true, deletedAt: null, deletedBy: null, deleteReason: null, updatedAt: sql`now()` })
    .where(eq(expenseCategories.id, parsed.data.id));

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense category restored");
}

export async function createExpense(formData: FormData) {
  const user = await requirePermission("company.manage");
  const parsed = expenseSchema.safeParse(expensePayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses/new", "error", parsed.error.issues[0]?.message ?? "Invalid expense.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithMessage("/admin/operations/expenses/new", "error", "Expense amount must be greater than zero.");
  }

  if (parsed.data.paymentStatus === "paid" && !parsed.data.paymentAccountId) {
    redirectWithMessage("/admin/operations/expenses/new", "error", "Paid expense requires a payment account.");
  }

  const company = await getDefaultCompany();
  let createdExpenseId: string | undefined;

  try {
    const outboundPaymentAccount =
      parsed.data.paymentStatus === "paid" && parsed.data.paymentAccountId
        ? await getOutboundPaymentAccount(parsed.data.paymentAccountId, company.id, company.baseCurrencyCode)
        : null;

    if (outboundPaymentAccount?.requiresReference && !parsed.data.paymentReference) {
      throw new Error("This payment method requires a reference.");
    }

    await db.transaction(async (tx) => {
      const [category] = await tx
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(and(eq(expenseCategories.id, parsed.data.categoryId), eq(expenseCategories.companyId, company.id), eq(expenseCategories.isActive, true), isNull(expenseCategories.deletedAt)))
        .limit(1);

      if (!category) {
        throw new Error("Select an active expense category.");
      }

      const [expense] = await tx
        .insert(expenses)
        .values({
          companyId: company.id,
          categoryId: parsed.data.categoryId,
          employeeId: parsed.data.employeeId,
          vendorId: parsed.data.vendorId,
          locationId: parsed.data.locationId,
          expenseNo: expenseNo(),
          status: "posted",
          paymentStatus: parsed.data.paymentStatus,
          expenseDate: parsed.data.expenseDate,
          amountMinor,
          currencyCode: company.baseCurrencyCode,
          description: parsed.data.description || null,
        })
        .returning({ id: expenses.id, expenseNo: expenses.expenseNo });
      createdExpenseId = expense.id;

      if (parsed.data.attachmentObjectKey && parsed.data.attachmentFileName) {
        await tx.insert(attachments).values({
          companyId: company.id,
          entityType: "expense",
          entityId: expense.id,
          objectKey: parsed.data.attachmentObjectKey,
          fileName: parsed.data.attachmentFileName,
          mimeType: parsed.data.attachmentMimeType || "application/octet-stream",
          sizeBytes: parsed.data.attachmentSizeBytes ?? 0,
          sha256Hash: (parsed.data.attachmentSha256Hash || sha256Fallback(parsed.data.attachmentObjectKey)).slice(0, 64),
          uploadedBy: user.id,
        });
      }

      if (outboundPaymentAccount) {
        const [payment] = await tx
          .insert(payments)
          .values({
            companyId: company.id,
            partnerId: parsed.data.vendorId,
            paymentNo: paymentNo(),
            paymentType: "outbound",
            status: "posted",
            paymentMethodId: outboundPaymentAccount.methodId,
            paymentAccountId: outboundPaymentAccount.id,
            amountMinor,
            currencyCode: company.baseCurrencyCode,
            reference: parsed.data.paymentReference || null,
            notes: "Payment created from paid expense.",
            postedAt: new Date(),
            postedBy: user.id,
          })
          .returning({ id: payments.id, paymentNo: payments.paymentNo });

        await tx.insert(paymentAllocations).values({
          paymentId: payment.id,
          expenseId: expense.id,
          amountMinor,
          notes: "Expense payment allocation.",
        });
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "expense.create",
        entityType: "expense",
        entityId: expense.id,
        severity: "info",
        metadata: { expenseNo: expense.expenseNo, paymentStatus: parsed.data.paymentStatus },
      });
    });
  } catch (error) {
    redirectWithMessage("/admin/operations/expenses/new", "error", error instanceof Error ? error.message : "Could not create expense.");
  }

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(`/admin/operations/expenses/${createdExpenseId}`, "notice", "Expense created");
}

export async function registerExpensePayment(formData: FormData) {
  const user = await requirePermission("company.manage");
  const parsed = payExpenseSchema.safeParse({
    expenseId: formValue(formData, "expenseId"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    amount: formValue(formData, "amount"),
    reference: formValue(formData, "reference"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithMessage("/admin/operations/expenses", "error", parsed.error.issues[0]?.message ?? "Invalid payment.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithMessage(`/admin/operations/expenses/${parsed.data.expenseId}`, "error", "Payment amount must be greater than zero.");
  }

  const company = await getDefaultCompany();

  try {
    const [expense] = await db.execute<{ id: string; vendorId: string | null; amountMinor: number; residualAmountMinor: number; currencyCode: string; status: string }>(sql`
      select
        e.id as "id",
        e.vendor_id as "vendorId",
        e.amount_minor as "amountMinor",
        greatest(e.amount_minor - coalesce(sum(pa.amount_minor) filter (
          where p.status = 'posted'
            and p.deleted_at is null
            and pa.deleted_at is null
        ), 0), 0)::bigint as "residualAmountMinor",
        e.currency_code as "currencyCode",
        e.status::text as "status"
      from expenses e
      left join payment_allocations pa on pa.expense_id = e.id
      left join payments p on p.id = pa.payment_id
      where e.id = ${parsed.data.expenseId}
        and e.company_id = ${company.id}
        and e.deleted_at is null
      group by e.id
      limit 1
    `);

    if (!expense || expense.status === "cancelled") {
      throw new Error("Expense does not exist or is cancelled.");
    }

    if (amountMinor > expense.residualAmountMinor) {
      throw new Error("Payment amount cannot exceed the expense residual.");
    }

    await createPostedExpensePayment({
      companyId: company.id,
      userId: user.id,
      expenseId: expense.id,
      partnerId: expense.vendorId,
      paymentAccountId: parsed.data.paymentAccountId,
      amountMinor,
      currencyCode: expense.currencyCode,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || "Expense payment.",
    });
    await updateExpensePaymentStatus(expense.id);
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

  await db
    .update(expenses)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: user.id,
      updatedAt: sql`now()`,
    })
    .where(and(eq(expenses.id, parsed.data.id), isNull(expenses.deletedAt)));

  revalidatePath("/admin/operations/expenses");
  redirectWithMessage(parsed.data.returnPath, "notice", "Expense cancelled");
}
