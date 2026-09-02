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
  purchaseOrders,
  vendorBills,
} from "@/server/db/schema";
import { getPurchaseOrderPaymentSummary, getVendorBillPaymentSummary } from "@/server/payments/payments";

const optionalUuid = z.string().uuid().or(z.literal("")).optional().transform((value) => value || undefined);

const supplierPaymentFormSchema = z.object({
  vendorBillId: optionalUuid,
  purchaseOrderId: optionalUuid,
  paymentAccountId: z.string().uuid(),
  amount: z.string().trim(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().optional(),
});

const registerSupplierPaymentSchema = supplierPaymentFormSchema.refine((data) => Boolean(data.vendorBillId) !== Boolean(data.purchaseOrderId), {
  message: "Select either a vendor bill or purchase order for payment.",
});

const updateSupplierPaymentSchema = supplierPaymentFormSchema.omit({ vendorBillId: true, purchaseOrderId: true }).extend({
  paymentId: z.string().uuid(),
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
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    amount: formValue(formData, "amount"),
    reference: formValue(formData, "reference"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=payments", parsed.error.issues[0]?.message ?? "Invalid supplier payment.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError(
      parsed.data.purchaseOrderId ? `/admin/purchasing/${parsed.data.purchaseOrderId}` : `/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`,
      "Payment amount must be greater than zero.",
    );
  }

  const company = await getDefaultCompany();
  let paymentId: string | undefined;
  const returnPath = parsed.data.purchaseOrderId ? `/admin/purchasing/${parsed.data.purchaseOrderId}` : `/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`;

  try {
    await db.transaction(async (tx) => {
      const target = parsed.data.purchaseOrderId
        ? await (async () => {
            const [order] = await tx
              .select({
                id: purchaseOrders.id,
                supplierId: purchaseOrders.supplierId,
                status: purchaseOrders.status,
                totalMinor: purchaseOrders.totalMinor,
                currencyCode: purchaseOrders.currencyCode,
                orderNo: purchaseOrders.orderNo,
              })
              .from(purchaseOrders)
              .where(and(eq(purchaseOrders.id, parsed.data.purchaseOrderId!), eq(purchaseOrders.companyId, company.id), isNull(purchaseOrders.deletedAt)))
              .limit(1);

            if (!order) {
              throw new Error("Purchase order does not exist.");
            }

            if (order.status === "draft" || order.status === "cancelled") {
              throw new Error("Only confirmed purchase orders can be paid.");
            }

            const summary = await getPurchaseOrderPaymentSummary(order.id);
            if (summary.paymentStatus === "paid") {
              throw new Error("Purchase order is already paid.");
            }

            return {
              id: order.id,
              no: order.orderNo,
              supplierId: order.supplierId,
              totalMinor: order.totalMinor,
              currencyCode: order.currencyCode,
              residualAmountMinor: summary.residualAmountMinor,
              purchaseOrderId: order.id,
              vendorBillId: null as string | null,
            };
          })()
        : null;

      const [bill] = target
        ? []
        : await tx
            .select({
              id: vendorBills.id,
              supplierId: vendorBills.supplierId,
              status: vendorBills.status,
              totalMinor: vendorBills.totalMinor,
              currencyCode: vendorBills.currencyCode,
              paymentStatus: vendorBills.paymentStatus,
            })
            .from(vendorBills)
            .where(and(eq(vendorBills.id, parsed.data.vendorBillId!), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
            .limit(1);

      if (!target && !bill) {
        throw new Error("Vendor bill does not exist.");
      }

      if (!target && bill.status !== "posted") {
        throw new Error("Only posted vendor bills can be paid.");
      }

      if (!target && bill.paymentStatus === "paid") {
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

      const currencyCode = target?.currencyCode ?? bill.currencyCode;
      const supplierId = target?.supplierId ?? bill.supplierId;
      const residualAmountMinor = target?.residualAmountMinor;

      if (account.currencyCode !== currencyCode) {
        throw new Error("Payment account currency must match the purchase currency.");
      }

      if (account.requiresReference && !parsed.data.reference) {
        throw new Error("This payment method requires a reference.");
      }

      const [summary] = target ? [{ residualAmountMinor }] : await tx.execute<{ residualAmountMinor: number }>(sql`
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
        throw new Error("Payment amount cannot exceed the unpaid purchase balance.");
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: company.id,
          partnerId: supplierId,
          paymentNo: paymentNo("PAY-OUT"),
          paymentType: "outbound",
          status: "draft",
          paymentMethodId: account.methodId,
          paymentAccountId: account.id,
          amountMinor,
          currencyCode,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
        })
        .returning({ id: payments.id, paymentNo: payments.paymentNo });
      paymentId = payment.id;

      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        vendorBillId: target ? null : bill.id,
        purchaseOrderId: target?.purchaseOrderId ?? null,
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
        metadata: { paymentNo: payment.paymentNo, vendorBillId: target ? null : bill.id, purchaseOrderId: target?.purchaseOrderId ?? null },
      });
    });
  } catch (error) {
    redirectWithError(returnPath, error instanceof Error ? error.message : "Could not register supplier payment.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(returnPath);
  redirect(`/admin/purchasing/payments/${paymentId}?notice=${encodeURIComponent("Supplier payment registered as draft")}`);
}

export async function postSupplierPayment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = paymentStatusSchema.safeParse({ paymentId: formValue(formData, "paymentId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing/payments", "Payment ID is required.");
  }

  let vendorBillId: string | undefined;
  let purchaseOrderId: string | undefined;
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
          purchaseOrderId: paymentAllocations.purchaseOrderId,
          amountMinor: paymentAllocations.amountMinor,
        })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)));

      const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
      const allocation = allocations[0];
      if (allocations.length !== 1 || (!allocation?.vendorBillId && !allocation?.purchaseOrderId) || allocationTotal !== payment.amountMinor) {
        throw new Error("Supplier payment allocation must match payment amount.");
      }

      vendorBillId = allocation.vendorBillId ?? undefined;
      purchaseOrderId = allocation.purchaseOrderId ?? undefined;

      if (purchaseOrderId) {
        const [order] = await tx
          .select({
            id: purchaseOrders.id,
            status: purchaseOrders.status,
            totalMinor: purchaseOrders.totalMinor,
          })
          .from(purchaseOrders)
          .where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.companyId, company.id), isNull(purchaseOrders.deletedAt)))
          .limit(1);

        if (!order || order.status === "draft" || order.status === "cancelled") {
          throw new Error("Purchase order must be confirmed before payment posting.");
        }

        const [summary] = await tx.execute<{ residualAmountMinor: number }>(sql`
          select greatest(
            ${order.totalMinor} - coalesce(sum(pa.amount_minor) filter (
              where p.status = 'posted'
                and p.deleted_at is null
                and pa.deleted_at is null
            ), 0),
            0
          )::bigint as "residualAmountMinor"
          from purchase_orders po
          left join payment_allocations pa on pa.purchase_order_id = po.id
          left join payments p on p.id = pa.payment_id
          where po.id = ${order.id}
          group by po.id
        `);

        if (payment.amountMinor > (summary?.residualAmountMinor ?? 0)) {
          throw new Error("Payment amount cannot exceed the unpaid purchase balance.");
        }
      }

      const [bill] = vendorBillId ? await tx
        .select({
          id: vendorBills.id,
          status: vendorBills.status,
          totalMinor: vendorBills.totalMinor,
        })
        .from(vendorBills)
        .where(and(eq(vendorBills.id, vendorBillId), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
        .limit(1) : [];

      if (vendorBillId && (!bill || bill.status !== "posted")) {
        throw new Error("Vendor bill must be posted before payment posting.");
      }

      if (vendorBillId && bill) {
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
        metadata: { paymentNo: payment.paymentNo, vendorBillId, purchaseOrderId },
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
  if (purchaseOrderId) {
    revalidatePath(`/admin/purchasing/${purchaseOrderId}`);
  }
  redirect(`/admin/purchasing/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Supplier payment posted")}`);
}

export async function updateSupplierPayment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = updateSupplierPaymentSchema.safeParse({
    paymentId: formValue(formData, "paymentId"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    amount: formValue(formData, "amount"),
    reference: formValue(formData, "reference"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=payments", parsed.error.issues[0]?.message ?? "Invalid supplier payment.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError(`/admin/purchasing/payments/${parsed.data.paymentId}`, "Payment amount must be greater than zero.");
  }

  const company = await getDefaultCompany();
  let vendorBillId: string | undefined;
  let purchaseOrderId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
          paymentNo: payments.paymentNo,
          status: payments.status,
          paymentType: payments.paymentType,
        })
        .from(payments)
        .where(and(eq(payments.id, parsed.data.paymentId), eq(payments.companyId, company.id), isNull(payments.deletedAt)))
        .limit(1);

      if (!payment) {
        throw new Error("Payment does not exist.");
      }

      if (payment.status !== "draft") {
        throw new Error("Only draft payments can be edited.");
      }

      if (payment.paymentType !== "outbound") {
        throw new Error("Only outbound supplier payments can be edited here.");
      }

      const [allocation] = await tx
        .select({
          id: paymentAllocations.id,
          vendorBillId: paymentAllocations.vendorBillId,
          purchaseOrderId: paymentAllocations.purchaseOrderId,
        })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)))
        .limit(1);

      if (!allocation?.vendorBillId && !allocation?.purchaseOrderId) {
        throw new Error("Supplier payment allocation is missing.");
      }
      vendorBillId = allocation.vendorBillId ?? undefined;
      purchaseOrderId = allocation.purchaseOrderId ?? undefined;

      const [bill] = vendorBillId ? await tx
        .select({
          id: vendorBills.id,
          status: vendorBills.status,
          totalMinor: vendorBills.totalMinor,
          currencyCode: vendorBills.currencyCode,
        })
        .from(vendorBills)
        .where(and(eq(vendorBills.id, vendorBillId), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
        .limit(1) : [];

      const [order] = purchaseOrderId ? await tx
        .select({
          id: purchaseOrders.id,
          status: purchaseOrders.status,
          totalMinor: purchaseOrders.totalMinor,
          currencyCode: purchaseOrders.currencyCode,
        })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.companyId, company.id), isNull(purchaseOrders.deletedAt)))
        .limit(1) : [];

      if (vendorBillId && (!bill || bill.status !== "posted")) {
        throw new Error("Vendor bill must be posted before editing payment.");
      }

      if (purchaseOrderId && (!order || order.status === "draft" || order.status === "cancelled")) {
        throw new Error("Purchase order must be confirmed before editing payment.");
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

      const currencyCode = order?.currencyCode ?? bill?.currencyCode;

      if (account.currencyCode !== currencyCode) {
        throw new Error("Payment account currency must match the purchase currency.");
      }

      if (account.requiresReference && !parsed.data.reference) {
        throw new Error("This payment method requires a reference.");
      }

      const [summary] = purchaseOrderId && order ? await tx.execute<{ residualAmountMinor: number }>(sql`
        select greatest(
          ${order.totalMinor} - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted'
              and p.deleted_at is null
              and pa.deleted_at is null
          ), 0),
          0
        )::bigint as "residualAmountMinor"
        from purchase_orders po
        left join payment_allocations pa on pa.purchase_order_id = po.id
        left join payments p on p.id = pa.payment_id
        where po.id = ${order.id}
        group by po.id
      `) : await tx.execute<{ residualAmountMinor: number }>(sql`
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
        throw new Error("Payment amount cannot exceed the unpaid purchase balance.");
      }

      await tx
        .update(payments)
        .set({
          paymentMethodId: account.methodId,
          paymentAccountId: account.id,
          amountMinor,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
          updatedAt: sql`now()`,
        })
        .where(eq(payments.id, payment.id));

      await tx
        .update(paymentAllocations)
        .set({
          amountMinor,
          updatedAt: sql`now()`,
        })
        .where(eq(paymentAllocations.id, allocation.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "supplier_payment.update",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, vendorBillId, purchaseOrderId },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/payments/${parsed.data.paymentId}`, error instanceof Error ? error.message : "Could not update supplier payment.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/payments/${parsed.data.paymentId}`);
  if (vendorBillId) {
    revalidatePath(`/admin/purchasing/vendor-bills/vendor_bill/${vendorBillId}`);
  }
  if (purchaseOrderId) {
    revalidatePath(`/admin/purchasing/${purchaseOrderId}`);
  }
  redirect(`/admin/purchasing/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Supplier payment updated")}`);
}

export async function cancelSupplierPayment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = paymentStatusSchema.safeParse({ paymentId: formValue(formData, "paymentId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing/payments", "Payment ID is required.");
  }

  let vendorBillId: string | undefined;
  let purchaseOrderId: string | undefined;
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
        .select({
          vendorBillId: paymentAllocations.vendorBillId,
          purchaseOrderId: paymentAllocations.purchaseOrderId,
        })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)))
        .limit(1);
      vendorBillId = allocation?.vendorBillId ?? undefined;
      purchaseOrderId = allocation?.purchaseOrderId ?? undefined;

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
        metadata: { paymentNo: payment.paymentNo, vendorBillId, purchaseOrderId },
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
  if (purchaseOrderId) {
    revalidatePath(`/admin/purchasing/${purchaseOrderId}`);
  }
  redirect(`/admin/purchasing/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Supplier payment cancelled")}`);
}
