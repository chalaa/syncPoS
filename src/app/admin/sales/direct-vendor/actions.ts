"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { majorToMinor } from "@/lib/catalog-utils";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany, uniqueViolationMessage } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  directVendorSaleLines,
  directVendorSales,
  partners,
  paymentAllocations,
  payments,
  products,
} from "@/server/db/schema";
import { PERMISSIONS } from "@/server/iam/permissions";
import { paymentLinesTotal, replacePaymentLines, resolvePaymentLines } from "@/server/payments/payment-lines";

const optionalUuid = z.string().uuid().or(z.literal("")).optional().transform((value) => value || null);

const directVendorSaleHeaderSchema = z.object({
  customerId: z.string().uuid(),
  vendorId: z.string().uuid(),
  ownerId: optionalUuid,
  saleDate: z.string().trim().min(1, "Sale date is required."),
  customerPaymentTerm: z.enum(["cash", "credit"]).default("cash"),
  vendorPaymentTerm: z.enum(["cash", "credit"]).default("cash"),
  notes: z.string().trim().optional(),
  intent: z.enum(["draft", "post"]).default("post"),
});

const directVendorSalePaymentSchema = z.object({
  directVendorSaleId: z.string().uuid(),
});

const directVendorSaleLineSchema = z.object({
  productId: z.string().uuid(),
  description: z.string().trim().max(500).optional(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  vendorUnitCost: z.string().trim().default("0"),
  customerUnitPrice: z.string().trim().default("0"),
  discount: z.string().trim().default("0"),
  taxAmount: z.string().trim().default("0"),
  notes: z.string().trim().optional(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function documentNo(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function currentYear() {
  return new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
  }).format(new Date());
}

async function nextDirectVendorSaleNo(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], companyId: string) {
  const year = currentYear();
  const pattern = `^DVS/([0-9]{5})/${year}$`;
  const filterPattern = `^DVS/[0-9]{5}/${year}$`;
  const [row] = await tx.execute<{ saleNo: string }>(sql`
    select (
      'DVS/'
      || lpad((coalesce(max((substring(sale_no from ${pattern}))::int), 0) + 1)::text, 5, '0')
      || '/'
      || ${year}
    ) as "saleNo"
    from direct_vendor_sales
    where company_id = ${companyId}
      and deleted_at is null
      and sale_no ~ ${filterPattern}
  `);

  return row?.saleNo ?? `DVS/00001/${year}`;
}

function parseDirectVendorSaleForm(formData: FormData, errorPath: string) {
  const parsedHeader = directVendorSaleHeaderSchema.safeParse({
    customerId: formValue(formData, "customerId"),
    vendorId: formValue(formData, "vendorId"),
    ownerId: formValue(formData, "ownerId"),
    saleDate: formValue(formData, "saleDate"),
    customerPaymentTerm: formValue(formData, "customerPaymentTerm") || "cash",
    vendorPaymentTerm: formValue(formData, "vendorPaymentTerm") || "cash",
    notes: formValue(formData, "notes"),
    intent: formValue(formData, "intent") || "post",
  });

  if (!parsedHeader.success) {
    redirectWithError(errorPath, parsedHeader.error.issues[0]?.message ?? "Invalid direct vendor sale header.");
  }

  const productIds = formValues(formData, "productId");
  const descriptions = formValues(formData, "description");
  const quantities = formValues(formData, "quantity");
  const vendorUnitCosts = formValues(formData, "vendorUnitCost");
  const customerUnitPrices = formValues(formData, "customerUnitPrice");
  const discounts = formValues(formData, "discount");
  const taxAmounts = formValues(formData, "taxAmount");
  const notes = formValues(formData, "lineNotes");

  const parsedLines = productIds
    .map((productId, index) => ({
      productId,
      description: descriptions[index] ?? "",
      quantity: quantities[index] ?? "",
      vendorUnitCost: vendorUnitCosts[index] ?? "0",
      customerUnitPrice: customerUnitPrices[index] ?? "0",
      discount: discounts[index] ?? "0",
      taxAmount: taxAmounts[index] ?? "0",
      notes: notes[index] ?? "",
    }))
    .filter((line) => line.productId || Number(line.quantity) > 0);

  if (parsedLines.length === 0) {
    redirectWithError(errorPath, "At least one direct vendor sale line is required.");
  }

  const lines = parsedLines.map((line) => {
    const parsedLine = directVendorSaleLineSchema.safeParse(line);

    if (!parsedLine.success) {
      redirectWithError(errorPath, parsedLine.error.issues[0]?.message ?? "Invalid direct vendor sale line.");
    }

    return parsedLine.data;
  });

  return { header: parsedHeader.data, lines };
}

function lineAmounts(line: z.infer<typeof directVendorSaleLineSchema>) {
  const quantity = line.quantity;
  const vendorUnitCostMinor = majorToMinor(line.vendorUnitCost);
  const customerUnitPriceMinor = majorToMinor(line.customerUnitPrice);
  const discountMinor = majorToMinor(line.discount);
  const taxAmountMinor = majorToMinor(line.taxAmount);

  if (vendorUnitCostMinor < 0 || customerUnitPriceMinor < 0 || discountMinor < 0 || taxAmountMinor < 0) {
    throw new Error("Amounts cannot be negative.");
  }

  const vendorLineTotalMinor = Math.round(vendorUnitCostMinor * quantity);
  const grossCustomerMinor = Math.round(customerUnitPriceMinor * quantity);

  if (discountMinor > grossCustomerMinor) {
    throw new Error("Discount cannot exceed the line sale amount.");
  }

  const subtotalMinor = grossCustomerMinor - discountMinor;
  const customerLineTotalMinor = subtotalMinor + taxAmountMinor;
  const lineMarginMinor = customerLineTotalMinor - vendorLineTotalMinor;

  return {
    quantity,
    vendorUnitCostMinor,
    customerUnitPriceMinor,
    discountMinor,
    taxAmountMinor,
    vendorLineTotalMinor,
    subtotalMinor,
    customerLineTotalMinor,
    lineMarginMinor,
  };
}

export async function createDirectVendorSale(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);
  const errorPath = "/admin/sales/direct-vendor/new";
  const { header, lines } = parseDirectVendorSaleForm(formData, errorPath);
  const company = await getDefaultCompany();
  let createdId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(and(eq(partners.id, header.customerId), eq(partners.companyId, company.id), eq(partners.isCustomer, true), isNull(partners.deletedAt)))
        .limit(1);

      if (!customer) {
        throw new Error("Customer does not exist.");
      }

      const [vendor] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(and(eq(partners.id, header.vendorId), eq(partners.companyId, company.id), eq(partners.isSupplier, true), isNull(partners.deletedAt)))
        .limit(1);

      if (!vendor) {
        throw new Error("Vendor does not exist.");
      }

      const productRows = await tx
        .select({ id: products.id, unitId: products.unitId })
        .from(products)
        .where(and(eq(products.companyId, company.id), isNull(products.deletedAt)));
      const unitByProductId = new Map(productRows.map((product) => [product.id, product.unitId]));

      let subtotalMinor = 0;
      let taxAmountMinor = 0;
      let customerTotalMinor = 0;
      let vendorCostTotalMinor = 0;
      let marginMinor = 0;
      const preparedLines = lines.map((line, index) => {
        const unitId = unitByProductId.get(line.productId);
        if (!unitId) {
          throw new Error(`Product on line ${index + 1} does not exist.`);
        }

        const amounts = lineAmounts(line);
        subtotalMinor += amounts.subtotalMinor;
        taxAmountMinor += amounts.taxAmountMinor;
        customerTotalMinor += amounts.customerLineTotalMinor;
        vendorCostTotalMinor += amounts.vendorLineTotalMinor;
        marginMinor += amounts.lineMarginMinor;

        return { line, unitId, amounts };
      });

      const saleNo = await nextDirectVendorSaleNo(tx, company.id);
      const isPosted = header.intent === "post";
      const [created] = await tx
        .insert(directVendorSales)
        .values({
          companyId: company.id,
          saleNo,
          customerId: header.customerId,
          vendorId: header.vendorId,
          ownerId: header.ownerId,
          saleDate: header.saleDate,
          status: isPosted ? "posted" : "draft",
          currencyCode: company.baseCurrencyCode,
          customerPaymentTerm: header.customerPaymentTerm,
          vendorPaymentTerm: header.vendorPaymentTerm,
          subtotalMinor,
          taxAmountMinor,
          customerTotalMinor,
          vendorCostTotalMinor,
          marginMinor,
          customerPaidMinor: 0,
          vendorPaidMinor: 0,
          notes: header.notes || null,
          createdBy: user.id,
          postedAt: isPosted ? new Date() : null,
          postedBy: isPosted ? user.id : null,
        })
        .returning({ id: directVendorSales.id, saleNo: directVendorSales.saleNo });

      createdId = created.id;

      await tx.insert(directVendorSaleLines).values(
        preparedLines.map(({ line, unitId, amounts }, index) => ({
          directVendorSaleId: created.id,
          lineNo: index + 1,
          productId: line.productId,
          description: line.description || null,
          unitId,
          quantity: String(amounts.quantity),
          vendorUnitCostMinor: amounts.vendorUnitCostMinor,
          customerUnitPriceMinor: amounts.customerUnitPriceMinor,
          discountMinor: amounts.discountMinor,
          taxAmountMinor: amounts.taxAmountMinor,
          vendorLineTotalMinor: amounts.vendorLineTotalMinor,
          customerLineTotalMinor: amounts.customerLineTotalMinor,
          lineMarginMinor: amounts.lineMarginMinor,
          currencyCode: company.baseCurrencyCode,
          notes: line.notes || null,
        })),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: isPosted ? "direct_vendor_sale.post" : "direct_vendor_sale.create",
        entityType: "direct_vendor_sale",
        entityId: created.id,
        severity: "info",
        metadata: { saleNo: created.saleNo, lineCount: preparedLines.length, customerTotalMinor, vendorCostTotalMinor },
      });
    });
  } catch (error) {
    redirectWithError(errorPath, uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not create direct vendor sale."));
  }

  revalidatePath("/admin/sales/direct-vendor");
  redirect(`/admin/sales/direct-vendor/${createdId}?notice=${encodeURIComponent(header.intent === "post" ? "Direct vendor sale posted." : "Direct vendor sale saved as draft.")}`);
}

export async function postDirectVendorSale(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);
  const saleId = formValue(formData, "directVendorSaleId");

  if (!z.string().uuid().safeParse(saleId).success) {
    redirectWithError("/admin/sales/direct-vendor", "Invalid direct vendor sale.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({
          id: directVendorSales.id,
          saleNo: directVendorSales.saleNo,
          status: directVendorSales.status,
          customerTotalMinor: directVendorSales.customerTotalMinor,
          vendorCostTotalMinor: directVendorSales.vendorCostTotalMinor,
        })
        .from(directVendorSales)
        .where(and(eq(directVendorSales.id, saleId), eq(directVendorSales.companyId, company.id), isNull(directVendorSales.deletedAt)))
        .limit(1);

      if (!sale) {
        throw new Error("Direct vendor sale does not exist.");
      }
      if (sale.status !== "draft") {
        throw new Error("Only draft direct vendor sales can be posted.");
      }
      await tx
        .update(directVendorSales)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          customerPaidMinor: 0,
          vendorPaidMinor: 0,
          updatedAt: new Date(),
        })
        .where(eq(directVendorSales.id, sale.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "direct_vendor_sale.post",
        entityType: "direct_vendor_sale",
        entityId: sale.id,
        severity: "info",
        metadata: { saleNo: sale.saleNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/direct-vendor/${saleId}`, error instanceof Error ? error.message : "Could not post direct vendor sale.");
  }

  revalidatePath("/admin/sales/direct-vendor");
  revalidatePath(`/admin/sales/direct-vendor/${saleId}`);
  redirect(`/admin/sales/direct-vendor/${saleId}?notice=${encodeURIComponent("Direct vendor sale posted.")}`);
}

async function directVendorSaleCustomerResidual(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], saleId: string, customerTotalMinor: number) {
  const [summary] = await tx.execute<{ paidMinor: number; residualAmountMinor: number }>(sql`
    select
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidMinor",
      greatest(
        ${customerTotalMinor} - coalesce(sum(pa.amount_minor) filter (
          where p.status = 'posted'
            and p.deleted_at is null
            and pa.deleted_at is null
        ), 0),
        0
      )::bigint as "residualAmountMinor"
    from direct_vendor_sales dvs
    left join payment_allocations pa on pa.customer_direct_vendor_sale_id = dvs.id
    left join payments p on p.id = pa.payment_id
    where dvs.id = ${saleId}
    group by dvs.id
  `);

  return {
    paidMinor: Number(summary?.paidMinor ?? 0),
    residualAmountMinor: Number(summary?.residualAmountMinor ?? customerTotalMinor),
  };
}

async function directVendorSaleVendorResidual(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], saleId: string, vendorCostTotalMinor: number) {
  const [summary] = await tx.execute<{ paidMinor: number; residualAmountMinor: number }>(sql`
    select
      coalesce(sum(pa.amount_minor) filter (
        where p.status = 'posted'
          and p.deleted_at is null
          and pa.deleted_at is null
      ), 0)::bigint as "paidMinor",
      greatest(
        ${vendorCostTotalMinor} - coalesce(sum(pa.amount_minor) filter (
          where p.status = 'posted'
            and p.deleted_at is null
            and pa.deleted_at is null
        ), 0),
        0
      )::bigint as "residualAmountMinor"
    from direct_vendor_sales dvs
    left join payment_allocations pa on pa.vendor_direct_vendor_sale_id = dvs.id
    left join payments p on p.id = pa.payment_id
    where dvs.id = ${saleId}
    group by dvs.id
  `);

  return {
    paidMinor: Number(summary?.paidMinor ?? 0),
    residualAmountMinor: Number(summary?.residualAmountMinor ?? vendorCostTotalMinor),
  };
}

export async function registerDirectVendorCustomerPayment(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);
  const parsed = directVendorSalePaymentSchema.safeParse({
    directVendorSaleId: formValue(formData, "directVendorSaleId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales/direct-vendor", "Invalid direct vendor sale.");
  }

  const saleId = parsed.data.directVendorSaleId;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({
          id: directVendorSales.id,
          saleNo: directVendorSales.saleNo,
          customerId: directVendorSales.customerId,
          status: directVendorSales.status,
          customerTotalMinor: directVendorSales.customerTotalMinor,
          currencyCode: directVendorSales.currencyCode,
        })
        .from(directVendorSales)
        .where(and(eq(directVendorSales.id, saleId), eq(directVendorSales.companyId, company.id), isNull(directVendorSales.deletedAt)))
        .limit(1);

      if (!sale) {
        throw new Error("Direct vendor sale does not exist.");
      }
      if (sale.status !== "posted") {
        throw new Error("Only posted direct vendor sales can receive customer payments.");
      }

      const summary = await directVendorSaleCustomerResidual(tx, sale.id, sale.customerTotalMinor);
      if (summary.residualAmountMinor <= 0) {
        throw new Error("Customer side is already paid.");
      }

      const paymentLineRows = await resolvePaymentLines(tx, {
        formData,
        companyId: company.id,
        currencyCode: sale.currencyCode,
        direction: "inbound",
      });
      const amountMinor = paymentLinesTotal(paymentLineRows);
      if (amountMinor > summary.residualAmountMinor) {
        throw new Error("Payment amount cannot exceed the unpaid customer balance.");
      }
      const firstLine = paymentLineRows[0];

      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: company.id,
          partnerId: sale.customerId,
          paymentNo: documentNo("PAY-IN"),
          paymentType: "inbound",
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          paymentMethodId: firstLine.paymentMethodId,
          paymentAccountId: firstLine.paymentAccountId,
          amountMinor,
          currencyCode: sale.currencyCode,
          reference: firstLine.reference,
          notes: firstLine.note,
        })
        .returning({ id: payments.id, paymentNo: payments.paymentNo });

      await replacePaymentLines(tx, {
        companyId: company.id,
        paymentId: payment.id,
        lines: paymentLineRows,
      });

      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        customerDirectVendorSaleId: sale.id,
        amountMinor,
        notes: "Direct vendor sale customer payment allocation.",
      });

      const nextPaidMinor = summary.paidMinor + amountMinor;
      await tx
        .update(directVendorSales)
        .set({
          customerPaidMinor: nextPaidMinor,
          customerPaymentMethodId: firstLine.paymentMethodId,
          customerPaymentAccountId: firstLine.paymentAccountId,
          customerPaymentReference: firstLine.reference,
          updatedAt: new Date(),
        })
        .where(eq(directVendorSales.id, sale.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "direct_vendor_sale.customer_payment.post",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, directVendorSaleId: sale.id, saleNo: sale.saleNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/direct-vendor/${saleId}`, error instanceof Error ? error.message : "Could not register customer payment.");
  }

  revalidatePath("/admin/sales/direct-vendor");
  revalidatePath(`/admin/sales/direct-vendor/${saleId}`);
  redirect(`/admin/sales/direct-vendor/${saleId}?notice=${encodeURIComponent("Customer payment posted successfully.")}`);
}

export async function registerDirectVendorVendorPayment(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);
  const parsed = directVendorSalePaymentSchema.safeParse({
    directVendorSaleId: formValue(formData, "directVendorSaleId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales/direct-vendor", "Invalid direct vendor sale.");
  }

  const saleId = parsed.data.directVendorSaleId;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({
          id: directVendorSales.id,
          saleNo: directVendorSales.saleNo,
          vendorId: directVendorSales.vendorId,
          status: directVendorSales.status,
          vendorCostTotalMinor: directVendorSales.vendorCostTotalMinor,
          currencyCode: directVendorSales.currencyCode,
        })
        .from(directVendorSales)
        .where(and(eq(directVendorSales.id, saleId), eq(directVendorSales.companyId, company.id), isNull(directVendorSales.deletedAt)))
        .limit(1);

      if (!sale) {
        throw new Error("Direct vendor sale does not exist.");
      }
      if (sale.status !== "posted") {
        throw new Error("Only posted direct vendor sales can register vendor payments.");
      }

      const summary = await directVendorSaleVendorResidual(tx, sale.id, sale.vendorCostTotalMinor);
      if (summary.residualAmountMinor <= 0) {
        throw new Error("Vendor side is already paid.");
      }

      const paymentLineRows = await resolvePaymentLines(tx, {
        formData,
        companyId: company.id,
        currencyCode: sale.currencyCode,
        direction: "outbound",
      });
      const amountMinor = paymentLinesTotal(paymentLineRows);
      if (amountMinor > summary.residualAmountMinor) {
        throw new Error("Payment amount cannot exceed the unpaid vendor balance.");
      }
      const firstLine = paymentLineRows[0];

      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: company.id,
          partnerId: sale.vendorId,
          paymentNo: documentNo("PAY-OUT"),
          paymentType: "outbound",
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          paymentMethodId: firstLine.paymentMethodId,
          paymentAccountId: firstLine.paymentAccountId,
          amountMinor,
          currencyCode: sale.currencyCode,
          reference: firstLine.reference,
          notes: firstLine.note,
        })
        .returning({ id: payments.id, paymentNo: payments.paymentNo });

      await replacePaymentLines(tx, {
        companyId: company.id,
        paymentId: payment.id,
        lines: paymentLineRows,
      });

      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        vendorDirectVendorSaleId: sale.id,
        amountMinor,
        notes: "Direct vendor sale vendor payment allocation.",
      });

      const nextPaidMinor = summary.paidMinor + amountMinor;
      await tx
        .update(directVendorSales)
        .set({
          vendorPaidMinor: nextPaidMinor,
          vendorPaymentMethodId: firstLine.paymentMethodId,
          vendorPaymentAccountId: firstLine.paymentAccountId,
          vendorPaymentReference: firstLine.reference,
          updatedAt: new Date(),
        })
        .where(eq(directVendorSales.id, sale.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "direct_vendor_sale.vendor_payment.post",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, directVendorSaleId: sale.id, saleNo: sale.saleNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/direct-vendor/${saleId}`, error instanceof Error ? error.message : "Could not register vendor payment.");
  }

  revalidatePath("/admin/sales/direct-vendor");
  revalidatePath(`/admin/sales/direct-vendor/${saleId}`);
  redirect(`/admin/sales/direct-vendor/${saleId}?notice=${encodeURIComponent("Vendor payment posted successfully.")}`);
}

export async function cancelDirectVendorSale(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);
  const saleId = formValue(formData, "directVendorSaleId");

  if (!z.string().uuid().safeParse(saleId).success) {
    redirectWithError("/admin/sales/direct-vendor", "Invalid direct vendor sale.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({ id: directVendorSales.id, saleNo: directVendorSales.saleNo, status: directVendorSales.status })
        .from(directVendorSales)
        .where(and(eq(directVendorSales.id, saleId), eq(directVendorSales.companyId, company.id), isNull(directVendorSales.deletedAt)))
        .limit(1);

      if (!sale) {
        throw new Error("Direct vendor sale does not exist.");
      }
      if (sale.status !== "draft") {
        throw new Error("Only draft direct vendor sales can be cancelled.");
      }

      await tx
        .update(directVendorSales)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: user.id, updatedAt: new Date() })
        .where(eq(directVendorSales.id, sale.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "direct_vendor_sale.cancel",
        entityType: "direct_vendor_sale",
        entityId: sale.id,
        severity: "warning",
        metadata: { saleNo: sale.saleNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/direct-vendor/${saleId}`, error instanceof Error ? error.message : "Could not cancel direct vendor sale.");
  }

  revalidatePath("/admin/sales/direct-vendor");
  revalidatePath(`/admin/sales/direct-vendor/${saleId}`);
  redirect(`/admin/sales/direct-vendor/${saleId}?notice=${encodeURIComponent("Direct vendor sale cancelled.")}`);
}
