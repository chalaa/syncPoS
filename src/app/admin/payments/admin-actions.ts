"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  customerInvoices,
  directVendorSales,
  paymentAccounts,
  paymentAllocations,
  paymentLines,
  payments,
  vendorBills,
} from "@/server/db/schema";
import { PERMISSIONS } from "@/server/iam/permissions";
import { paymentLinesTotal, replacePaymentLines, resolvePaymentLines } from "@/server/payments/payment-lines";

const paymentIdSchema = z.string().uuid();

type PaymentTarget =
  | "salesOrder"
  | "customerInvoice"
  | "customerDirectVendorSale"
  | "purchaseOrder"
  | "vendorBill"
  | "vendorDirectVendorSale";

const targetColumns: Record<PaymentTarget, string> = {
  salesOrder: "sales_order_id",
  customerInvoice: "customer_invoice_id",
  customerDirectVendorSale: "customer_direct_vendor_sale_id",
  purchaseOrder: "purchase_order_id",
  vendorBill: "vendor_bill_id",
  vendorDirectVendorSale: "vendor_direct_vendor_sale_id",
};

const targetTables: Record<PaymentTarget, string> = {
  salesOrder: "sales_orders",
  customerInvoice: "customer_invoices",
  customerDirectVendorSale: "direct_vendor_sales",
  purchaseOrder: "purchase_orders",
  vendorBill: "vendor_bills",
  vendorDirectVendorSale: "direct_vendor_sales",
};

function paymentPath(paymentType: "inbound" | "outbound", paymentId: string) {
  return paymentType === "inbound"
    ? `/admin/sales/payments/${paymentId}`
    : `/admin/purchasing/payments/${paymentId}`;
}

export async function updatePostedPaymentAsAdministrator(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.OWNER.ALL);
  const paymentId = paymentIdSchema.safeParse(formData.get("paymentId"));
  if (!paymentId.success) {
    redirect("/admin?error=Invalid%20payment");
  }

  const company = await getDefaultCompany();
  let returnPath = "/admin";
  let linkedPath: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
          paymentNo: payments.paymentNo,
          paymentType: payments.paymentType,
          status: payments.status,
          amountMinor: payments.amountMinor,
          paymentAccountId: payments.paymentAccountId,
          currencyCode: payments.currencyCode,
          reference: payments.reference,
        })
        .from(payments)
        .where(and(eq(payments.id, paymentId.data), eq(payments.companyId, company.id), isNull(payments.deletedAt)))
        .limit(1)
        .for("update");

      if (!payment) {
        throw new Error("Payment does not exist.");
      }
      returnPath = paymentPath(payment.paymentType, payment.id);
      if (payment.status !== "posted") {
        throw new Error("Only posted payments can use administrator editing.");
      }

      const allocations = await tx
        .select({
          id: paymentAllocations.id,
          salesOrderId: paymentAllocations.salesOrderId,
          customerInvoiceId: paymentAllocations.customerInvoiceId,
          customerDirectVendorSaleId: paymentAllocations.customerDirectVendorSaleId,
          purchaseOrderId: paymentAllocations.purchaseOrderId,
          vendorBillId: paymentAllocations.vendorBillId,
          vendorDirectVendorSaleId: paymentAllocations.vendorDirectVendorSaleId,
        })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)));
      if (allocations.length !== 1) {
        throw new Error("Administrator editing requires exactly one payment allocation.");
      }
      const allocation = allocations[0];
      const targetEntry = (Object.keys(targetColumns) as PaymentTarget[])
        .map((targetType) => ({ targetType, targetId: allocation[`${targetType}Id`] }))
        .find((entry) => Boolean(entry.targetId));
      if (!targetEntry?.targetId) {
        throw new Error("This payment allocation cannot be edited here.");
      }
      const { targetType, targetId } = targetEntry;
      if ((payment.paymentType === "inbound") !== (["salesOrder", "customerInvoice", "customerDirectVendorSale"] as PaymentTarget[]).includes(targetType)) {
        throw new Error("Payment direction does not match its allocation.");
      }

      await tx.execute(sql`
        select id from ${sql.raw(targetTables[targetType])}
        where id = ${targetId} and company_id = ${company.id} and deleted_at is null
        for update
      `);

      const [target] = await tx.execute<{
        totalMinor: number;
        currencyCode: string;
        status: string;
      }>(sql`
        select
          coalesce(so.total_minor, ci.total_minor, cdvs.customer_total_minor, po.total_minor, vb.total_minor, vdvs.vendor_cost_total_minor)::bigint as "totalMinor",
          coalesce(so.currency_code, ci.currency_code, cdvs.currency_code, po.currency_code, vb.currency_code, vdvs.currency_code) as "currencyCode",
          coalesce(so.status::text, ci.status::text, cdvs.status::text, po.status::text, vb.status::text, vdvs.status::text) as status
        from payment_allocations pa
        left join sales_orders so on so.id = pa.sales_order_id and so.company_id = ${company.id} and so.deleted_at is null
        left join customer_invoices ci on ci.id = pa.customer_invoice_id and ci.company_id = ${company.id} and ci.deleted_at is null
        left join direct_vendor_sales cdvs on cdvs.id = pa.customer_direct_vendor_sale_id and cdvs.company_id = ${company.id} and cdvs.deleted_at is null
        left join purchase_orders po on po.id = pa.purchase_order_id and po.company_id = ${company.id} and po.deleted_at is null
        left join vendor_bills vb on vb.id = pa.vendor_bill_id and vb.company_id = ${company.id} and vb.deleted_at is null
        left join direct_vendor_sales vdvs on vdvs.id = pa.vendor_direct_vendor_sale_id and vdvs.company_id = ${company.id} and vdvs.deleted_at is null
        where pa.id = ${allocation.id}
      `);
      if (!target?.currencyCode || target.status === "cancelled" || target.status === "draft" || target.status === "quotation") {
        throw new Error("The linked document is not active and posted.");
      }
      if (payment.currencyCode !== target.currencyCode) {
        throw new Error("Payment currency differs from its linked document.");
      }

      const paymentLineRows = await resolvePaymentLines(tx, {
        formData,
        companyId: company.id,
        currencyCode: target.currencyCode,
        direction: payment.paymentType,
      });
      const amountMinor = paymentLinesTotal(paymentLineRows);
      const firstLine = paymentLineRows[0];
      const accountIds = [...new Set([payment.paymentAccountId, ...paymentLineRows.map((line) => line.paymentAccountId)])];
      const newAccountRows = await tx.select({ id: paymentAccounts.id, verifyEtEnabled: paymentAccounts.verifyEtEnabled })
        .from(paymentAccounts)
        .where(inArray(paymentAccounts.id, accountIds));
      const oldVerifiedLines = await tx.select({ id: paymentLines.id })
        .from(paymentLines)
        .innerJoin(paymentAccounts, eq(paymentLines.paymentAccountId, paymentAccounts.id))
        .where(and(eq(paymentLines.paymentId, payment.id), eq(paymentAccounts.verifyEtEnabled, true), isNull(paymentLines.deletedAt)));
      const [verification] = await tx.execute<{ hasVerification: boolean }>(sql`
          select exists(
            select 1 from payment_line_verifications verification
            inner join payment_lines line on line.id = verification.payment_line_id
            where line.payment_id = ${payment.id} and verification.verified = true
          ) as "hasVerification"
        `);
      if (verification?.hasVerification || oldVerifiedLines.length > 0 || newAccountRows.some((account) => account.verifyEtEnabled)) {
        throw new Error("Verified bank payment lines cannot be changed after posting.");
      }

      const [otherPayments] = await tx.execute<{ paidMinor: number }>(sql`
        select coalesce(sum(pa.amount_minor), 0)::bigint as "paidMinor"
        from payment_allocations pa
        inner join payments p on p.id = pa.payment_id
        where ${sql.raw(`pa.${targetColumns[targetType]}`)} = ${targetId}
          and p.id <> ${payment.id}
          and pa.deleted_at is null and p.deleted_at is null and p.status = 'posted'
      `);
      const otherPaidMinor = Number(otherPayments?.paidMinor ?? 0);
      if (amountMinor + otherPaidMinor > Number(target.totalMinor)) {
        throw new Error("Payment amount cannot exceed the remaining document balance.");
      }

      await tx.update(payments).set({
        paymentMethodId: firstLine.paymentMethodId,
        paymentAccountId: firstLine.paymentAccountId,
        amountMinor,
        reference: firstLine.reference,
        notes: firstLine.note,
        updatedAt: sql`now()`,
      }).where(eq(payments.id, payment.id));
      await replacePaymentLines(tx, {
        companyId: company.id,
        paymentId: payment.id,
        lines: paymentLineRows,
      });
      await tx.update(paymentAllocations).set({ amountMinor, updatedAt: sql`now()` }).where(eq(paymentAllocations.id, allocation.id));

      const paidMinor = otherPaidMinor + amountMinor;
      const paymentStatus = paidMinor >= Number(target.totalMinor) ? "paid" : paidMinor > 0 ? "partial" : "not_paid";
      if (targetType === "customerInvoice") {
        await tx.update(customerInvoices).set({ paymentStatus, updatedAt: sql`now()` }).where(eq(customerInvoices.id, targetId));
        linkedPath = `/admin/sales/invoices/${targetId}`;
      } else if (targetType === "vendorBill") {
        await tx.update(vendorBills).set({ paymentStatus, updatedAt: sql`now()` }).where(eq(vendorBills.id, targetId));
        linkedPath = `/admin/purchasing/vendor-bills/vendor_bill/${targetId}`;
      } else if (targetType === "customerDirectVendorSale") {
        await tx.update(directVendorSales).set({
          customerPaidMinor: paidMinor,
          customerPaymentMethodId: firstLine.paymentMethodId,
          customerPaymentAccountId: firstLine.paymentAccountId,
          customerPaymentReference: firstLine.reference,
          updatedAt: sql`now()`,
        }).where(eq(directVendorSales.id, targetId));
        linkedPath = `/admin/sales/direct-vendor/${targetId}`;
      } else if (targetType === "vendorDirectVendorSale") {
        await tx.update(directVendorSales).set({
          vendorPaidMinor: paidMinor,
          vendorPaymentMethodId: firstLine.paymentMethodId,
          vendorPaymentAccountId: firstLine.paymentAccountId,
          vendorPaymentReference: firstLine.reference,
          updatedAt: sql`now()`,
        }).where(eq(directVendorSales.id, targetId));
        linkedPath = `/admin/sales/direct-vendor/${targetId}`;
      } else {
        linkedPath = targetType === "salesOrder" ? `/admin/sales/${targetId}` : `/admin/purchasing/${targetId}`;
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "payment.administrator_update",
        entityType: "payment",
        entityId: payment.id,
        severity: "warning",
        metadata: {
          paymentNo: payment.paymentNo,
          targetType,
          targetId,
          previousAmountMinor: payment.amountMinor,
          amountMinor,
          previousPaymentAccountId: payment.paymentAccountId,
          previousReference: payment.reference,
        },
      });
    });
  } catch (error) {
    redirect(`${returnPath}?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not update payment.")}`);
  }

  revalidatePath(paymentPath("inbound", paymentId.data));
  revalidatePath(paymentPath("outbound", paymentId.data));
  revalidatePath("/admin/sales");
  revalidatePath("/admin/purchasing");
  if (linkedPath) revalidatePath(linkedPath);
  redirect(`${returnPath}?notice=${encodeURIComponent("Payment updated by administrator.")}`);
}
