"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDefaultCompany, majorToMinor } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import {
  auditLogs,
  paymentAccounts,
  paymentAllocations,
  paymentMethods,
  payments,
  vendorBills,
} from "@/server/db/schema";
import { getVendorBillPaymentSummary } from "@/server/payments/payments";

const registerSupplierPaymentSchema = z.object({
  vendorBillId: z.string().uuid(),
  paymentAccountId: z.string().uuid(),
  amount: z.string().trim(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().optional(),
});

const paymentStatusSchema = z.object({
  paymentId: z.string().uuid(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function paymentNo(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function updateVendorBillPaymentStatus(vendorBillId: string) {
  const summary = await getVendorBillPaymentSummary(vendorBillId);

  await db
    .update(vendorBills)
    .set({
      paymentStatus: summary.paymentStatus,
      updatedAt: sql`now()`,
    })
    .where(eq(vendorBills.id, vendorBillId));

  return summary;
}

export async function registerSupplierPayment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = registerSupplierPaymentSchema.safeParse({
    vendorBillId: formValue(formData, "vendorBillId"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    amount: formValue(formData, "amount"),
    reference: formValue(formData, "reference"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=supplier-bills", parsed.error.issues[0]?.message ?? "Invalid supplier payment.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`, "Payment amount must be greater than zero.");
  }

  const company = await getDefaultCompany();
  let paymentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [bill] = await tx
        .select({
          id: vendorBills.id,
          supplierId: vendorBills.supplierId,
          status: vendorBills.status,
          totalMinor: vendorBills.totalMinor,
          currencyCode: vendorBills.currencyCode,
          paymentStatus: vendorBills.paymentStatus,
        })
        .from(vendorBills)
        .where(and(eq(vendorBills.id, parsed.data.vendorBillId), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
        .limit(1);

      if (!bill) {
        throw new Error("Vendor bill does not exist.");
      }

      if (bill.status !== "posted") {
        throw new Error("Only posted vendor bills can be paid.");
      }

      if (bill.paymentStatus === "paid") {
        throw new Error("Vendor bill is already paid.");
      }

      const [account] = await tx
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
            eq(paymentAccounts.id, parsed.data.paymentAccountId),
            eq(paymentAccounts.companyId, company.id),
            eq(paymentAccounts.isActive, true),
            eq(paymentMethods.isActive, true),
            isNull(paymentAccounts.deletedAt),
            isNull(paymentMethods.deletedAt),
          ),
        )
        .limit(1);

      if (!account || !account.allowOutbound) {
        throw new Error("Select an active outbound payment account.");
      }

      if (account.currencyCode !== bill.currencyCode) {
        throw new Error("Payment account currency must match the vendor bill.");
      }

      if (account.requiresReference && !parsed.data.reference) {
        throw new Error("This payment method requires a reference.");
      }

      const [summary] = await tx.execute<{ residualAmountMinor: number }>(sql`
        select greatest(
          ${bill.totalMinor} - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted'
              and p.deleted_at is null
              and pa.deleted_at is null
          ), 0),
          0
        )::bigint as "residualAmountMinor"
        from vendor_bills vb
        left join payment_allocations pa on pa.vendor_bill_id = vb.id
        left join payments p on p.id = pa.payment_id
        where vb.id = ${bill.id}
        group by vb.id
      `);

      if (amountMinor > (summary?.residualAmountMinor ?? 0)) {
        throw new Error("Payment amount cannot exceed the vendor bill residual.");
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: company.id,
          partnerId: bill.supplierId,
          paymentNo: paymentNo("PAY-OUT"),
          paymentType: "outbound",
          status: "draft",
          paymentMethodId: account.methodId,
          paymentAccountId: account.id,
          amountMinor,
          currencyCode: bill.currencyCode,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
        })
        .returning({ id: payments.id, paymentNo: payments.paymentNo });
      paymentId = payment.id;

      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        vendorBillId: bill.id,
        amountMinor,
        notes: "Supplier payment allocation.",
      });

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "supplier_payment.register",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, vendorBillId: bill.id },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`, error instanceof Error ? error.message : "Could not register supplier payment.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`);
  redirect(`/admin/purchasing/payments/${paymentId}?notice=${encodeURIComponent("Supplier payment registered as draft")}`);
}

export async function postSupplierPayment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = paymentStatusSchema.safeParse({ paymentId: formValue(formData, "paymentId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing/payments", "Payment ID is required.");
  }

  let vendorBillId: string | undefined;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
          paymentNo: payments.paymentNo,
          status: payments.status,
          amountMinor: payments.amountMinor,
          paymentType: payments.paymentType,
        })
        .from(payments)
        .where(and(eq(payments.id, parsed.data.paymentId), eq(payments.companyId, company.id), isNull(payments.deletedAt)))
        .limit(1);

      if (!payment) {
        throw new Error("Payment does not exist.");
      }

      if (payment.status !== "draft") {
        return;
      }

      if (payment.paymentType !== "outbound") {
        throw new Error("Only outbound supplier payments can be posted here.");
      }

      const allocations = await tx
        .select({
          vendorBillId: paymentAllocations.vendorBillId,
          amountMinor: paymentAllocations.amountMinor,
        })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)));

      const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
      if (allocations.length !== 1 || !allocations[0]?.vendorBillId || allocationTotal !== payment.amountMinor) {
        throw new Error("Supplier payment allocation must match payment amount.");
      }

      vendorBillId = allocations[0].vendorBillId;

      const [bill] = await tx
        .select({
          id: vendorBills.id,
          status: vendorBills.status,
          totalMinor: vendorBills.totalMinor,
        })
        .from(vendorBills)
        .where(and(eq(vendorBills.id, vendorBillId), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
        .limit(1);

      if (!bill || bill.status !== "posted") {
        throw new Error("Vendor bill must be posted before payment posting.");
      }

      const [summary] = await tx.execute<{ residualAmountMinor: number }>(sql`
        select greatest(
          ${bill.totalMinor} - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted'
              and p.deleted_at is null
              and pa.deleted_at is null
          ), 0),
          0
        )::bigint as "residualAmountMinor"
        from vendor_bills vb
        left join payment_allocations pa on pa.vendor_bill_id = vb.id
        left join payments p on p.id = pa.payment_id
        where vb.id = ${bill.id}
        group by vb.id
      `);

      if (payment.amountMinor > (summary?.residualAmountMinor ?? 0)) {
        throw new Error("Payment amount cannot exceed the vendor bill residual.");
      }

      await tx
        .update(payments)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, payment.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "supplier_payment.post",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, vendorBillId },
      });
    });

    if (vendorBillId) {
      await updateVendorBillPaymentStatus(vendorBillId);
    }
  } catch (error) {
    redirectWithError(`/admin/purchasing/payments/${parsed.data.paymentId}`, error instanceof Error ? error.message : "Could not post supplier payment.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/payments/${parsed.data.paymentId}`);
  if (vendorBillId) {
    revalidatePath(`/admin/purchasing/vendor-bills/vendor_bill/${vendorBillId}`);
  }
  redirect(`/admin/purchasing/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Supplier payment posted")}`);
}

export async function cancelSupplierPayment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = paymentStatusSchema.safeParse({ paymentId: formValue(formData, "paymentId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing/payments", "Payment ID is required.");
  }

  let vendorBillId: string | undefined;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
          paymentNo: payments.paymentNo,
          status: payments.status,
        })
        .from(payments)
        .where(and(eq(payments.id, parsed.data.paymentId), eq(payments.companyId, company.id), isNull(payments.deletedAt)))
        .limit(1);

      if (!payment || payment.status === "cancelled") {
        return;
      }

      const [allocation] = await tx
        .select({ vendorBillId: paymentAllocations.vendorBillId })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)))
        .limit(1);
      vendorBillId = allocation?.vendorBillId ?? undefined;

      await tx
        .update(payments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: user.id,
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, payment.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "supplier_payment.cancel",
        entityType: "payment",
        entityId: payment.id,
        severity: "warning",
        metadata: { paymentNo: payment.paymentNo, vendorBillId },
      });
    });

    if (vendorBillId) {
      await updateVendorBillPaymentStatus(vendorBillId);
    }
  } catch (error) {
    redirectWithError(`/admin/purchasing/payments/${parsed.data.paymentId}`, error instanceof Error ? error.message : "Could not cancel supplier payment.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/payments/${parsed.data.paymentId}`);
  if (vendorBillId) {
    revalidatePath(`/admin/purchasing/vendor-bills/vendor_bill/${vendorBillId}`);
  }
  redirect(`/admin/purchasing/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Supplier payment cancelled")}`);
}
