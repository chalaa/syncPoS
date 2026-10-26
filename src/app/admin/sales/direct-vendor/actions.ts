"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { majorToMinor } from "@/lib/catalog-utils";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany, uniqueViolationMessage } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  directVendorSaleLines,
  directVendorSales,
  partnerContacts,
  partners,
  paymentAllocations,
  payments,
  products,
  taxes,
} from "@/server/db/schema";
import { generateCompanyCode } from "@/server/db/code-generator";
import { PERMISSIONS } from "@/server/iam/permissions";
import { paymentLinesTotal, replacePaymentLines, resolvePaymentLines } from "@/server/payments/payment-lines";

const optionalUuid = z.string().uuid().or(z.literal("")).optional().transform((value) => value || null);

const directVendorSaleHeaderSchema = z.object({
  customerId: z.string().uuid(),
  vendorId: z.string().uuid(),
  ownerId: optionalUuid,
  saleDate: z.string().trim().min(1, "Sale date is required."),
  customerPaymentTerm: z.enum(["cash", "credit"]).default("cash"),
  vendorPaymentTerm: z.enum(["cash", "credit"]).default("credit"),
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
  vendorUnitCost: z.string().trim().refine((val) => majorToMinor(val) > 0, "Vendor cost/purchase price is mandatory and must be greater than zero."),
  customerUnitPrice: z.string().trim().refine((val) => majorToMinor(val) > 0, "Sale price is mandatory and must be greater than zero."),
  taxIds: z.array(z.string().uuid()).default([]),
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
  const deliverProduct = formValue(formData, "deliverProduct") !== "false";
  let intent = formValue(formData, "intent") || "post";
  if (!deliverProduct && intent === "post") {
    intent = "draft";
  }

  const parsedHeader = directVendorSaleHeaderSchema.safeParse({
    customerId: formValue(formData, "customerId"),
    vendorId: formValue(formData, "vendorId"),
    ownerId: formValue(formData, "ownerId"),
    saleDate: formValue(formData, "saleDate"),
    customerPaymentTerm: formValue(formData, "customerPaymentTerm") || "cash",
    vendorPaymentTerm: formValue(formData, "vendorPaymentTerm") || "credit",
    notes: formValue(formData, "notes"),
    intent,
  });

  if (!parsedHeader.success) {
    redirectWithError(errorPath, parsedHeader.error.issues[0]?.message ?? "Invalid direct vendor sale header.");
  }

  const productIds = formValues(formData, "productId");
  const descriptions = formValues(formData, "description");
  const quantities = formValues(formData, "quantity");
  const vendorUnitCosts = formValues(formData, "vendorUnitCost");
  const customerUnitPrices = formValues(formData, "customerUnitPrice");
  const taxIdValues = formValues(formData, "taxIds");
  const notes = formValues(formData, "lineNotes");

  const parsedLines = productIds
    .map((productId, index) => ({
      productId,
      description: descriptions[index] ?? "",
      quantity: quantities[index] ?? "",
      vendorUnitCost: vendorUnitCosts[index] ?? "0",
      customerUnitPrice: customerUnitPrices[index] ?? "0",
      taxIds: parseTaxIds(taxIdValues[index] ?? ""),
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

function parseTaxIds(value: string) {
  return value
    .split(",")
    .map((taxId) => taxId.trim())
    .filter(Boolean);
}

function calculateLineTax(
  lineAmountMinor: number,
  quantity: number,
  tax: {
    id: string;
    computation: "percent" | "fixed";
    rate: string;
    amountMinor: number;
    priceIncluded: boolean;
  },
) {
  if (tax.computation === "fixed") {
    const amount = Math.round(tax.amountMinor * quantity);
    return tax.priceIncluded ? Math.min(amount, lineAmountMinor) : amount;
  }

  const rate = Number(tax.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  if (tax.priceIncluded) {
    return Math.round(lineAmountMinor - lineAmountMinor / (1 + rate / 100));
  }

  return Math.round(lineAmountMinor * (rate / 100));
}

function calculateLineTaxes(
  lineAmountMinor: number,
  quantity: number,
  selectedTaxes: {
    id: string;
    computation: "percent" | "fixed";
    rate: string;
    amountMinor: number;
    priceIncluded: boolean;
  }[],
) {
  const lineTaxes = selectedTaxes.map((tax) => ({
    taxId: tax.id,
    taxAmountMinor: calculateLineTax(lineAmountMinor, quantity, tax),
    priceIncluded: tax.priceIncluded,
  }));
  const includedTaxAmount = lineTaxes
    .filter((tax) => tax.priceIncluded)
    .reduce((sum, tax) => sum + tax.taxAmountMinor, 0);
  const excludedTaxAmount = lineTaxes
    .filter((tax) => !tax.priceIncluded)
    .reduce((sum, tax) => sum + tax.taxAmountMinor, 0);
  const taxAmountMinor = includedTaxAmount + excludedTaxAmount;
  const subtotalMinor = Math.max(lineAmountMinor - includedTaxAmount, 0);
  const lineTotalMinor = lineAmountMinor + excludedTaxAmount;

  return { lineTaxes, taxAmountMinor, subtotalMinor, lineTotalMinor };
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

      const uniqueTaxIds = [...new Set(lines.flatMap((line) => line.taxIds))];
      const taxRows =
        uniqueTaxIds.length > 0
          ? await tx
              .select({
                id: taxes.id,
                computation: taxes.computation,
                rate: taxes.rate,
                amountMinor: taxes.amountMinor,
                priceIncluded: taxes.priceIncluded,
              })
              .from(taxes)
              .where(
                and(
                  eq(taxes.companyId, company.id),
                  isNull(taxes.deletedAt),
                  eq(taxes.isActive, true),
                  sql`${taxes.scope} in ('sale', 'both')`,
                  inArray(taxes.id, uniqueTaxIds),
                ),
              )
          : [];
      const taxById = new Map(taxRows.map((tax) => [tax.id, tax]));

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

        const quantity = line.quantity;
        const vendorUnitCostMinor = majorToMinor(line.vendorUnitCost);
        const customerUnitPriceMinor = majorToMinor(line.customerUnitPrice);

        if (vendorUnitCostMinor <= 0) {
          throw new Error("Vendor/purchase unit cost is mandatory and must be greater than zero.");
        }

        if (customerUnitPriceMinor <= 0) {
          throw new Error("Customer/sale unit price is mandatory and must be greater than zero.");
        }

        const vendorLineTotalMinor = Math.round(vendorUnitCostMinor * quantity);
        const grossCustomerMinor = Math.round(customerUnitPriceMinor * quantity);

        const selectedTaxes = line.taxIds
          .map((id) => taxById.get(id))
          .filter((tax): tax is NonNullable<typeof tax> => Boolean(tax));

        const taxCalc = calculateLineTaxes(grossCustomerMinor, quantity, selectedTaxes);
        const lineTaxAmountMinor = taxCalc.taxAmountMinor;
        const lineSubtotalMinor = taxCalc.subtotalMinor;
        const customerLineTotalMinor = taxCalc.lineTotalMinor;
        const lineMarginMinor = customerLineTotalMinor - vendorLineTotalMinor;

        subtotalMinor += lineSubtotalMinor;
        taxAmountMinor += lineTaxAmountMinor;
        customerTotalMinor += customerLineTotalMinor;
        vendorCostTotalMinor += vendorLineTotalMinor;
        marginMinor += lineMarginMinor;

        return {
          line,
          unitId,
          amounts: {
            quantity,
            vendorUnitCostMinor,
            customerUnitPriceMinor,
            discountMinor: 0,
            taxAmountMinor: lineTaxAmountMinor,
            vendorLineTotalMinor,
            subtotalMinor: lineSubtotalMinor,
            customerLineTotalMinor,
            lineMarginMinor,
          },
        };
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

const partnerCreateSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  legalName: z.string().trim().max(200).optional(),
  tin: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Email is invalid").max(160).or(z.literal("")).optional(),
});

export async function createCustomerFromDirectVendor(input: unknown) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);

  const parsed = partnerCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid customer.");
  }

  const company = await getDefaultCompany();

  try {
    const customer = await db.transaction(async (tx) => {
      const code = await generateCompanyCode(tx, {
        companyId: company.id,
        table: "partners",
        prefix: "CUST",
      });

      const [created] = await tx
        .insert(partners)
        .values({
          companyId: company.id,
          code,
          displayName: parsed.data.displayName,
          legalName: parsed.data.legalName || parsed.data.displayName,
          tin: parsed.data.tin || null,
          isCustomer: true,
          isSupplier: false,
          creditLimitMinor: 0,
          currencyCode: company.baseCurrencyCode,
          status: "active",
        })
        .returning({
          id: partners.id,
          code: partners.code,
          name: partners.displayName,
        });

      if (!created) {
        throw new Error("Could not create customer.");
      }

      if (parsed.data.phone || parsed.data.email) {
        await tx.insert(partnerContacts).values({
          partnerId: created.id,
          fullName: parsed.data.displayName,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          isPrimary: true,
        });
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer.quick_create_from_direct_vendor",
        entityType: "partner",
        entityId: created.id,
        severity: "info",
        metadata: { code: created.code, displayName: created.name },
      });

      return created;
    });

    revalidatePath("/admin/sales/direct-vendor");
    revalidatePath("/admin/partners");

    return customer;
  } catch (error) {
    throw new Error(uniqueViolationMessage(error, "Could not create customer."));
  }
}

export async function createVendorFromDirectVendor(input: unknown) {
  const user = await requirePermission(PERMISSIONS.SALES.CREATE);

  const parsed = partnerCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid vendor.");
  }

  const company = await getDefaultCompany();

  try {
    const vendor = await db.transaction(async (tx) => {
      const code = await generateCompanyCode(tx, {
        companyId: company.id,
        table: "partners",
        prefix: "SUP",
      });

      const [created] = await tx
        .insert(partners)
        .values({
          companyId: company.id,
          code,
          displayName: parsed.data.displayName,
          legalName: parsed.data.legalName || parsed.data.displayName,
          tin: parsed.data.tin || null,
          isCustomer: false,
          isSupplier: true,
          creditLimitMinor: 0,
          currencyCode: company.baseCurrencyCode,
          status: "active",
        })
        .returning({
          id: partners.id,
          code: partners.code,
          name: partners.displayName,
        });

      if (!created) {
        throw new Error("Could not create vendor.");
      }

      if (parsed.data.phone || parsed.data.email) {
        await tx.insert(partnerContacts).values({
          partnerId: created.id,
          fullName: parsed.data.displayName,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          isPrimary: true,
        });
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "vendor.quick_create_from_direct_vendor",
        entityType: "partner",
        entityId: created.id,
        severity: "info",
        metadata: { code: created.code, displayName: created.name },
      });

      return created;
    });

    revalidatePath("/admin/sales/direct-vendor");
    revalidatePath("/admin/partners");

    return vendor;
  } catch (error) {
    throw new Error(uniqueViolationMessage(error, "Could not create vendor."));
  }
}
