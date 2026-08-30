"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { minorToDisplay } from "@/lib/catalog-utils";
import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany, majorToMinor, uniqueViolationMessage } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  customerInvoiceLines,
  customerInvoiceLineTaxes,
  customerInvoices,
  deliveries,
  deliveryLines,
  paymentAccounts,
  paymentAllocations,
  paymentMethods,
  payments,
  partners,
  locations,
  productLots,
  productSerials,
  products,
  salesOrderLines,
  salesOrderLineTaxes,
  salesOrders,
  serialOwnershipHistory,
  stockBalances,
  stockMovementLines,
  stockMovements,
  stockReservations,
  taxes,
  warrantyRegistrations,
} from "@/server/db/schema";
import { getOrCreatePartnerStockLocation } from "@/server/inventory/partner-locations";
import { getCustomerInvoicePaymentSummary } from "@/server/payments/payments";

const salesOrderHeaderSchema = z.object({
  salesOrderId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  sourceLocationId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  customerReference: z.string().trim().max(80).optional(),
  validUntil: z.string().trim().optional(),
  expectedDeliveryDate: z.string().trim().optional(),
  reserveOnConfirm: z.boolean(),
  notes: z.string().trim().optional(),
});

const salesOrderLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.string().trim().default("0"),
  discount: z.string().trim().default("0"),
  taxIds: z.array(z.string().uuid()).default([]),
});

const confirmSalesOrderSchema = z.object({
  salesOrderId: z.string().uuid(),
  returnPath: z.string().trim().startsWith("/admin/sales").optional(),
});

const createDeliverySchema = z.object({
  salesOrderId: z.string().uuid(),
});

const postDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
});

const cancelDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
});

const createInvoiceSchema = z.object({
  salesOrderId: z.string().uuid().optional(),
  deliveryId: z.string().uuid().optional(),
});

const invoiceStatusSchema = z.object({
  customerInvoiceId: z.string().uuid(),
});

const registerCustomerPaymentSchema = z.object({
  customerInvoiceId: z.string().uuid(),
  paymentAccountId: z.string().uuid(),
  amount: z.string().trim(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().optional(),
});

const updateCustomerPaymentSchema = registerCustomerPaymentSchema.omit({ customerInvoiceId: true }).extend({
  paymentId: z.string().uuid(),
});

const paymentStatusSchema = z.object({
  paymentId: z.string().uuid(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function documentNo(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addYears(value: Date, years: number) {
  const copy = new Date(value);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

function formatMoneyForError(valueMinor: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(valueMinor)}`;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseTaxIds(value: string) {
  return value
    .split(",")
    .map((taxId) => taxId.trim())
    .filter(Boolean);
}

function parseDeliveryLines(formData: FormData) {
  const deliveryLineIds = formValues(formData, "deliveryLineId");
  const salesOrderLineIds = formValues(formData, "salesOrderLineId");
  const quantities = formValues(formData, "quantityDelivered");
  const serialNumbers = formValues(formData, "serialNo");
  const lotNumbers = formValues(formData, "lotNo");

  const rowCount = Math.max(deliveryLineIds.length, salesOrderLineIds.length, quantities.length);

  return Array.from({ length: rowCount })
    .map((_, index) => ({
      deliveryLineId: deliveryLineIds[index] || null,
      salesOrderLineId: salesOrderLineIds[index] || null,
      quantity: Number(quantities[index] ?? 0),
      serialNo: serialNumbers[index]?.trim() || null,
      lotNo: lotNumbers[index]?.trim() || null,
    }))
    .filter((line) => line.deliveryLineId || line.salesOrderLineId);
}

function parseCreateDeliveryLines(formData: FormData) {
  const salesOrderLineIds = formValues(formData, "salesOrderLineId");
  const quantities = formValues(formData, "deliveryQuantity");
  const serialNumbers = formValues(formData, "serialNo");
  const lotNumbers = formValues(formData, "lotNo");

  return salesOrderLineIds
    .map((salesOrderLineId, index) => ({
      salesOrderLineId,
      quantity: Number(quantities[index] ?? 0),
      serialNo: serialNumbers[index]?.trim() || null,
      lotNo: lotNumbers[index]?.trim() || null,
    }))
    .filter((line) => line.salesOrderLineId && line.quantity > 0);
}

function parseSalesOrderForm(formData: FormData, errorPath: string) {
  const parsedHeader = salesOrderHeaderSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId") || undefined,
    customerId: formValue(formData, "customerId"),
    sourceLocationId: formValue(formData, "sourceLocationId"),
    customerReference: formValue(formData, "customerReference"),
    validUntil: formValue(formData, "validUntil"),
    expectedDeliveryDate: formValue(formData, "expectedDeliveryDate"),
    reserveOnConfirm: checkboxValue(formData, "reserveOnConfirm"),
    notes: formValue(formData, "notes"),
  });
  const productIds = formValues(formData, "productId");
  const quantities = formValues(formData, "quantity");
  const unitPrices = formValues(formData, "unitPrice");
  const discounts = formValues(formData, "discount");
  const taxIdValues = formValues(formData, "taxIds");
  const parsedLines = productIds
    .map((productId, index) => ({
      productId,
      quantity: quantities[index] ?? "",
      unitPrice: unitPrices[index] ?? "0",
      discount: discounts[index] ?? "0",
      taxIds: parseTaxIds(taxIdValues[index] ?? ""),
    }))
    .filter((line) => line.productId || Number(line.quantity) > 0);

  if (!parsedHeader.success) {
    redirectWithError(errorPath, parsedHeader.error.issues[0]?.message ?? "Invalid sales order header.");
  }

  if (parsedLines.length === 0) {
    redirectWithError(errorPath, "At least one order line is required.");
  }

  const lines = parsedLines.map((line) => {
    const parsedLine = salesOrderLineSchema.safeParse(line);

    if (!parsedLine.success) {
      redirectWithError(errorPath, parsedLine.error.issues[0]?.message ?? "Invalid sales order line.");
    }

    return parsedLine.data;
  });

  return { header: parsedHeader.data, lines };
}

function calculateLineTax(lineAmountMinor: number, quantity: number, tax: {
  id: string;
  computation: "percent" | "fixed";
  rate: string;
  amountMinor: number;
  priceIncluded: boolean;
}) {
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

function calculateLineTaxes(lineAmountMinor: number, quantity: number, selectedTaxes: {
  id: string;
  computation: "percent" | "fixed";
  rate: string;
  amountMinor: number;
  priceIncluded: boolean;
}[]) {
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

async function prepareSalesLines(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  companyId: string,
  lines: z.infer<typeof salesOrderLineSchema>[],
) {
  const uniqueProductIds = [...new Set(lines.map((line) => line.productId))];
  const uniqueTaxIds = [...new Set(lines.flatMap((line) => line.taxIds))];
  const productRows = await tx
    .select({
      id: products.id,
      unitId: products.unitId,
      currencyCode: products.currencyCode,
    })
    .from(products)
    .where(and(inArray(products.id, uniqueProductIds), eq(products.companyId, companyId), isNull(products.deletedAt), eq(products.isActive, true)));
  const taxRows = uniqueTaxIds.length
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
            inArray(taxes.id, uniqueTaxIds),
            eq(taxes.companyId, companyId),
            isNull(taxes.deletedAt),
            eq(taxes.isActive, true),
            sql`${taxes.scope} in ('sale', 'both')`,
          ),
        )
    : [];

  if (productRows.length !== uniqueProductIds.length) {
    throw new Error("One or more products are invalid.");
  }

  if (taxRows.length !== uniqueTaxIds.length) {
    throw new Error("One or more taxes are invalid.");
  }

  const productById = new Map(productRows.map((product) => [product.id, product]));
  const taxById = new Map(taxRows.map((tax) => [tax.id, tax]));
  const currencyCode = productRows[0]?.currencyCode;

  if (!currencyCode) {
    throw new Error("At least one product is required.");
  }

  if (productRows.some((product) => product.currencyCode !== currencyCode)) {
    throw new Error("All sales order lines must use the same currency.");
  }

  const preparedLines = lines.map((line, index) => {
    const product = productById.get(line.productId);

    if (!product) {
      throw new Error("Product is invalid.");
    }

    const unitPriceMinor = majorToMinor(line.unitPrice);
    const discountMinor = majorToMinor(line.discount);
    const effectiveUnitPriceMinor = Math.max(unitPriceMinor - discountMinor, 0);
    const lineAmountMinor = Math.round(line.quantity * effectiveUnitPriceMinor);
    const selectedTaxes = line.taxIds.map((taxId) => taxById.get(taxId)).filter((tax): tax is NonNullable<typeof tax> => Boolean(tax));
    const { lineTaxes, taxAmountMinor, subtotalMinor, lineTotalMinor } = calculateLineTaxes(
      lineAmountMinor,
      line.quantity,
      selectedTaxes,
    );

    return {
      lineNo: index + 1,
      product,
      quantityOrdered: String(line.quantity),
      unitPriceMinor,
      discountMinor,
      lineTaxes,
      taxAmountMinor,
      subtotalMinor,
      lineTotalMinor,
    };
  });

  return {
    currencyCode,
    preparedLines,
    subtotalMinor: preparedLines.reduce((sum, line) => sum + line.subtotalMinor, 0),
    taxAmountMinor: preparedLines.reduce((sum, line) => sum + line.taxAmountMinor, 0),
    totalMinor: preparedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
  };
}

export async function createSalesOrder(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const { header, lines } = parseSalesOrderForm(formData, "/admin/sales/new");
  const company = await getDefaultCompany();
  const orderNo = documentNo("SO");
  let createdOrderId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [customer] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(and(eq(partners.id, header.customerId), eq(partners.companyId, company.id), eq(partners.isCustomer, true), isNull(partners.deletedAt)))
        .limit(1);

      if (!customer) {
        throw new Error("Customer is invalid.");
      }

      const prepared = await prepareSalesLines(tx, company.id, lines);
      const [order] = await tx
        .insert(salesOrders)
        .values({
          companyId: company.id,
          customerId: customer.id,
          sourceLocationId: header.sourceLocationId,
          orderNo,
          customerReference: header.customerReference || null,
          status: "quotation",
          validUntil: header.validUntil || null,
          expectedDeliveryDate: header.expectedDeliveryDate || null,
          currencyCode: prepared.currencyCode,
          subtotalMinor: prepared.subtotalMinor,
          taxAmountMinor: prepared.taxAmountMinor,
          totalMinor: prepared.totalMinor,
          reserveOnConfirm: header.reserveOnConfirm,
          notes: header.notes || null,
          createdBy: user.id,
        })
        .returning({ id: salesOrders.id });
      createdOrderId = order.id;

      const insertedLines = await tx
        .insert(salesOrderLines)
        .values(
          prepared.preparedLines.map((line) => ({
            salesOrderId: order.id,
            lineNo: line.lineNo,
            productId: line.product.id,
            unitId: line.product.unitId,
            quantityOrdered: line.quantityOrdered,
            unitPriceMinor: line.unitPriceMinor,
            discountMinor: line.discountMinor,
            taxAmountMinor: line.taxAmountMinor,
            lineTotalMinor: line.lineTotalMinor,
            currencyCode: prepared.currencyCode,
          })),
        )
        .returning({ id: salesOrderLines.id, lineNo: salesOrderLines.lineNo });

      const lineTaxes = prepared.preparedLines.flatMap((line) => {
        const insertedLine = insertedLines.find((record) => record.lineNo === line.lineNo);

        return insertedLine
          ? line.lineTaxes.map((lineTax) => ({
              salesOrderLineId: insertedLine.id,
              taxId: lineTax.taxId,
              taxAmountMinor: lineTax.taxAmountMinor,
            }))
          : [];
      });

      if (lineTaxes.length > 0) {
        await tx.insert(salesOrderLineTaxes).values(lineTaxes);
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "sales_order.quotation_create",
        entityType: "sales_order",
        entityId: order.id,
        severity: "info",
        metadata: { orderNo },
      });
    });
  } catch (error) {
    redirectWithError("/admin/sales/new", uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not create quotation."));
  }

  revalidatePath("/admin/sales");
  redirect(`/admin/sales/${createdOrderId}?notice=${encodeURIComponent("Quotation created")}`);
}

export async function updateSalesOrder(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const salesOrderId = formValue(formData, "salesOrderId");
  const errorPath = salesOrderId ? `/admin/sales/${salesOrderId}` : "/admin/sales";
  const { header, lines } = parseSalesOrderForm(formData, errorPath);

  if (!header.salesOrderId) {
    redirectWithError("/admin/sales", "Sales order ID is required.");
  }

  const orderId = header.salesOrderId;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [existingOrder] = await tx
        .select({
          id: salesOrders.id,
          orderNo: salesOrders.orderNo,
          status: salesOrders.status,
        })
        .from(salesOrders)
        .where(and(eq(salesOrders.id, orderId), eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt)))
        .limit(1);

      if (!existingOrder) {
        throw new Error("Sales order does not exist.");
      }

      if (existingOrder.status !== "quotation") {
        throw new Error("Only draft quotations can be edited.");
      }

      const [customer] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(and(eq(partners.id, header.customerId), eq(partners.companyId, company.id), eq(partners.isCustomer, true), isNull(partners.deletedAt)))
        .limit(1);

      if (!customer) {
        throw new Error("Customer is invalid.");
      }

      const prepared = await prepareSalesLines(tx, company.id, lines);
      const existingLines = await tx
        .select({ id: salesOrderLines.id })
        .from(salesOrderLines)
        .where(eq(salesOrderLines.salesOrderId, existingOrder.id));
      const existingLineIds = existingLines.map((line) => line.id);

      if (existingLineIds.length > 0) {
        await tx.delete(salesOrderLineTaxes).where(inArray(salesOrderLineTaxes.salesOrderLineId, existingLineIds));
        await tx.delete(salesOrderLines).where(inArray(salesOrderLines.id, existingLineIds));
      }

      await tx
        .update(salesOrders)
        .set({
          customerId: customer.id,
          sourceLocationId: header.sourceLocationId,
          customerReference: header.customerReference || null,
          validUntil: header.validUntil || null,
          expectedDeliveryDate: header.expectedDeliveryDate || null,
          currencyCode: prepared.currencyCode,
          subtotalMinor: prepared.subtotalMinor,
          taxAmountMinor: prepared.taxAmountMinor,
          totalMinor: prepared.totalMinor,
          reserveOnConfirm: header.reserveOnConfirm,
          notes: header.notes || null,
          updatedAt: sql`now()`,
        })
        .where(eq(salesOrders.id, existingOrder.id));

      const insertedLines = await tx
        .insert(salesOrderLines)
        .values(
          prepared.preparedLines.map((line) => ({
            salesOrderId: existingOrder.id,
            lineNo: line.lineNo,
            productId: line.product.id,
            unitId: line.product.unitId,
            quantityOrdered: line.quantityOrdered,
            unitPriceMinor: line.unitPriceMinor,
            discountMinor: line.discountMinor,
            taxAmountMinor: line.taxAmountMinor,
            lineTotalMinor: line.lineTotalMinor,
            currencyCode: prepared.currencyCode,
          })),
        )
        .returning({ id: salesOrderLines.id, lineNo: salesOrderLines.lineNo });

      const lineTaxes = prepared.preparedLines.flatMap((line) => {
        const insertedLine = insertedLines.find((record) => record.lineNo === line.lineNo);

        return insertedLine
          ? line.lineTaxes.map((lineTax) => ({
              salesOrderLineId: insertedLine.id,
              taxId: lineTax.taxId,
              taxAmountMinor: lineTax.taxAmountMinor,
            }))
          : [];
      });

      if (lineTaxes.length > 0) {
        await tx.insert(salesOrderLineTaxes).values(lineTaxes);
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "sales_order.quotation_update",
        entityType: "sales_order",
        entityId: existingOrder.id,
        severity: "info",
        metadata: { orderNo: existingOrder.orderNo },
      });
    });
  } catch (error) {
    redirectWithError(errorPath, uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not update quotation."));
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${orderId}`);
  redirect(`/admin/sales/${orderId}?notice=${encodeURIComponent("Quotation updated")}`);
}

export async function confirmSalesOrder(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = confirmSalesOrderSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId"),
    returnPath: formValue(formData, "returnPath") || undefined,
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales", "Sales order ID is required.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: salesOrders.id,
          orderNo: salesOrders.orderNo,
          status: salesOrders.status,
          customerId: salesOrders.customerId,
          sourceLocationId: salesOrders.sourceLocationId,
          totalMinor: salesOrders.totalMinor,
          reserveOnConfirm: salesOrders.reserveOnConfirm,
        })
        .from(salesOrders)
        .where(and(eq(salesOrders.id, parsed.data.salesOrderId), eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt)))
        .limit(1);

      if (!order) {
        throw new Error("Sales order does not exist.");
      }

      if (order.status !== "quotation") {
        return;
      }

      const lines = await tx
        .select({
          id: salesOrderLines.id,
          productId: salesOrderLines.productId,
          productName: products.name,
          sku: products.sku,
          quantityOrdered: salesOrderLines.quantityOrdered,
        })
        .from(salesOrderLines)
        .innerJoin(products, eq(salesOrderLines.productId, products.id))
        .where(and(eq(salesOrderLines.salesOrderId, order.id), isNull(salesOrderLines.deletedAt)));

      if (lines.length === 0) {
        throw new Error("Sales order has no lines.");
      }

      const [creditSummary] = await tx.execute<{
        customerName: string;
        creditLimitMinor: number;
        receivableResidualMinor: number;
      }>(sql`
        select
          p.display_name as "customerName",
          p.credit_limit_minor as "creditLimitMinor",
          coalesce((
            select sum(greatest(open_invoices.total_minor - open_invoices.paid_minor, 0))
            from (
              select
                ci.id,
                ci.total_minor,
                coalesce((
                  select sum(pa.amount_minor)
                  from payment_allocations pa
                  inner join payments pay on pay.id = pa.payment_id
                  where pa.customer_invoice_id = ci.id
                    and pa.deleted_at is null
                    and pay.deleted_at is null
                    and pay.status = 'posted'
                ), 0) as paid_minor
              from customer_invoices ci
              where ci.company_id = ${company.id}
                and ci.customer_id = ${order.customerId}
                and ci.deleted_at is null
                and ci.status <> 'cancelled'
            ) open_invoices
          ), 0)::bigint as "receivableResidualMinor"
        from partners p
        where p.id = ${order.customerId}
          and p.company_id = ${company.id}
          and p.deleted_at is null
        limit 1
      `);

      if (!creditSummary) {
        throw new Error("Customer does not exist.");
      }

      const creditLimitMinor = Number(creditSummary.creditLimitMinor);
      const receivableResidualMinor = Number(creditSummary.receivableResidualMinor);
      const orderTotalMinor = Number(order.totalMinor);

      if (creditLimitMinor > 0) {
        const creditUsedAfterOrder = receivableResidualMinor + orderTotalMinor;

        if (creditUsedAfterOrder > creditLimitMinor) {
          const overLimitMinor = creditUsedAfterOrder - creditLimitMinor;

          throw new Error(
            `${creditSummary.customerName} is over the credit limit. Limit ${formatMoneyForError(
              creditLimitMinor,
              company.baseCurrencyCode,
            )}, current unpaid ${formatMoneyForError(
              receivableResidualMinor,
              company.baseCurrencyCode,
            )}, this order ${formatMoneyForError(orderTotalMinor, company.baseCurrencyCode)}, over by ${formatMoneyForError(
              overLimitMinor,
              company.baseCurrencyCode,
            )}.`,
          );
        }
      }

      if (order.reserveOnConfirm) {
        if (!order.sourceLocationId) {
          throw new Error("A source location is required to reserve stock.");
        }

        const [sourceLocation] = await tx
          .select({
            code: locations.code,
            name: locations.name,
          })
          .from(locations)
          .where(eq(locations.id, order.sourceLocationId))
          .limit(1);
        const sourceLocationName = sourceLocation
          ? `${sourceLocation.code} / ${sourceLocation.name}`
          : "the selected source location";

        for (const line of lines) {
          const balances = await tx
            .select({
              id: stockBalances.id,
              productSerialId: stockBalances.productSerialId,
              productLotId: stockBalances.productLotId,
              quantityAvailable: stockBalances.quantityAvailable,
            })
            .from(stockBalances)
            .where(
              and(
                eq(stockBalances.companyId, company.id),
                eq(stockBalances.locationId, order.sourceLocationId),
                eq(stockBalances.productId, line.productId),
                sql`cast(${stockBalances.quantityAvailable} as numeric) > 0`,
                isNull(stockBalances.deletedAt),
              ),
            )
            .orderBy(
              asc(stockBalances.productSerialId),
              asc(stockBalances.productLotId),
              asc(stockBalances.createdAt),
            );
          const quantity = Number(line.quantityOrdered);
          const available = balances.reduce((sum, balance) => sum + Number(balance.quantityAvailable), 0);

          if (available < quantity) {
            throw new Error(
              `Insufficient stock available for ${line.sku} / ${line.productName} in ${sourceLocationName}. Required ${quantity}, available ${available}.`,
            );
          }

          let remainingToReserve = quantity;

          for (const balance of balances) {
            if (remainingToReserve <= 0) {
              break;
            }

            const reserveQuantity = Math.min(Number(balance.quantityAvailable), remainingToReserve);
            const reservationNo = documentNo("RSV");

            await tx.insert(stockReservations).values({
              companyId: company.id,
              reservationNo,
              locationId: order.sourceLocationId,
              productId: line.productId,
              productSerialId: balance.productSerialId,
              productLotId: balance.productLotId,
              partnerId: order.customerId,
              sourceType: "sales_order_line",
              sourceId: line.id,
              sourceNo: order.orderNo,
              quantity: String(reserveQuantity),
              status: "active",
            });

            await tx
              .update(stockBalances)
              .set({
                quantityReserved: sql`${stockBalances.quantityReserved} + ${String(reserveQuantity)}`,
                quantityAvailable: sql`${stockBalances.quantityAvailable} - ${String(reserveQuantity)}`,
                updatedAt: sql`now()`,
              })
              .where(eq(stockBalances.id, balance.id));

            remainingToReserve -= reserveQuantity;
          }

          await tx
            .update(salesOrderLines)
            .set({
              quantityReserved: line.quantityOrdered,
              updatedAt: sql`now()`,
            })
            .where(eq(salesOrderLines.id, line.id));
        }
      }

      await tx
        .update(salesOrders)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedBy: user.id,
          updatedAt: sql`now()`,
        })
        .where(eq(salesOrders.id, order.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "sales_order.confirm",
        entityType: "sales_order",
        entityId: order.id,
        severity: "info",
        metadata: { orderNo: order.orderNo, reserveOnConfirm: order.reserveOnConfirm },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/${parsed.data.salesOrderId}`, error instanceof Error ? error.message : "Could not confirm quotation.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${parsed.data.salesOrderId}`);
  redirect(`${parsed.data.returnPath ?? `/admin/sales/${parsed.data.salesOrderId}`}?notice=${encodeURIComponent("Quotation confirmed")}`);
}

export async function createDeliveryFromSalesOrder(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = createDeliverySchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales", "Sales order ID is required.");
  }

  const company = await getDefaultCompany();
  const deliveryNo = documentNo("DO");
  const inputLines = parseCreateDeliveryLines(formData);
  let createdDeliveryId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: salesOrders.id,
          orderNo: salesOrders.orderNo,
          status: salesOrders.status,
          customerId: salesOrders.customerId,
          sourceLocationId: salesOrders.sourceLocationId,
          currencyCode: salesOrders.currencyCode,
        })
        .from(salesOrders)
        .where(and(eq(salesOrders.id, parsed.data.salesOrderId), eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt)))
        .limit(1);

      if (!order) {
        throw new Error("Sales order does not exist.");
      }

      if (!["confirmed", "partially_delivered", "invoiced"].includes(order.status)) {
        throw new Error("Only confirmed, partially delivered, or invoiced sales orders can create deliveries.");
      }

      if (!order.sourceLocationId) {
        throw new Error("Sales order needs a source location before delivery.");
      }

      const lines = await tx
        .select({
          id: salesOrderLines.id,
          lineNo: salesOrderLines.lineNo,
          productId: salesOrderLines.productId,
          unitId: salesOrderLines.unitId,
          quantityOrdered: salesOrderLines.quantityOrdered,
          quantityDelivered: salesOrderLines.quantityDelivered,
          currencyCode: salesOrderLines.currencyCode,
        })
        .from(salesOrderLines)
        .where(and(eq(salesOrderLines.salesOrderId, order.id), isNull(salesOrderLines.deletedAt)))
        .orderBy(sql`${salesOrderLines.lineNo} asc`);
      const remainingLines = lines
        .map((line) => ({
          ...line,
          remainingQuantity: Number(line.quantityOrdered) - Number(line.quantityDelivered),
        }))
        .filter((line) => line.remainingQuantity > 0);

      if (remainingLines.length === 0) {
        throw new Error("This sales order has no remaining quantity to deliver.");
      }

      const remainingByLineId = new Map(remainingLines.map((line) => [line.id, line]));
      const selectedLines = inputLines.length > 0
        ? inputLines.map((input) => {
            const line = remainingByLineId.get(input.salesOrderLineId);

            if (!line) {
              throw new Error("One or more delivery lines are invalid.");
            }

            if (input.quantity > line.remainingQuantity) {
              throw new Error("Delivery quantity cannot exceed the remaining order quantity.");
            }

            return { ...line, selectedQuantity: input.quantity, serialNo: input.serialNo, lotNo: input.lotNo };
          })
        : remainingLines.map((line) => ({
            ...line,
            selectedQuantity: line.remainingQuantity,
            serialNo: null,
            lotNo: null,
          }));

      if (selectedLines.length === 0) {
        throw new Error("At least one delivery quantity is required.");
      }

      const [delivery] = await tx
        .insert(deliveries)
        .values({
          companyId: company.id,
          salesOrderId: order.id,
          customerId: order.customerId,
          sourceLocationId: order.sourceLocationId,
          deliveryNo,
          status: "draft",
          notes: `Delivery for ${order.orderNo}`,
        })
        .returning({ id: deliveries.id });
      createdDeliveryId = delivery.id;

      await tx.insert(deliveryLines).values(
        selectedLines.map((line, index) => ({
          deliveryId: delivery.id,
          salesOrderLineId: line.id,
          lineNo: index + 1,
          productId: line.productId,
          unitId: line.unitId,
          quantityDelivered: String(line.selectedQuantity),
          currencyCode: line.currencyCode,
          serialNo: line.serialNo,
          lotNo: line.lotNo,
        })),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "delivery.create",
        entityType: "delivery",
        entityId: delivery.id,
        severity: "info",
        metadata: { deliveryNo, orderNo: order.orderNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/${parsed.data.salesOrderId}`, error instanceof Error ? error.message : "Could not create delivery.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${parsed.data.salesOrderId}`);
  redirect(`/admin/sales/deliveries/${createdDeliveryId}?notice=${encodeURIComponent("Delivery created")}`);
}

export async function postDelivery(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = postDeliverySchema.safeParse({
    deliveryId: formValue(formData, "deliveryId"),
  });
  const inputLines = parseDeliveryLines(formData).filter((line) => line.quantity > 0);

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=deliveries", "Delivery ID is required.");
  }

  if (inputLines.length === 0) {
    redirectWithError(`/admin/sales/deliveries/${parsed.data.deliveryId}`, "At least one delivery quantity is required.");
  }

  const company = await getDefaultCompany();
  const customerLocation = await getOrCreatePartnerStockLocation(company.id, "customer");
  const movementNo = documentNo("SD");
  let salesOrderId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [delivery] = await tx
        .select({
          id: deliveries.id,
          deliveryNo: deliveries.deliveryNo,
          status: deliveries.status,
          salesOrderId: deliveries.salesOrderId,
          customerId: deliveries.customerId,
          sourceLocationId: deliveries.sourceLocationId,
        })
        .from(deliveries)
        .where(and(eq(deliveries.id, parsed.data.deliveryId), eq(deliveries.companyId, company.id), isNull(deliveries.deletedAt)))
        .limit(1);

      if (!delivery) {
        throw new Error("Delivery does not exist.");
      }

      salesOrderId = delivery.salesOrderId;

      if (delivery.status !== "draft") {
        throw new Error("Only draft deliveries can be posted.");
      }

      const submittedRows = inputLines.filter((line) => line.salesOrderLineId && line.quantity > 0);
      if (submittedRows.length > 0) {
        const submittedSalesOrderLineIds = [...new Set(submittedRows.map((line) => line.salesOrderLineId).filter((id): id is string => Boolean(id)))];
        const salesLines = await tx
          .select({
            id: salesOrderLines.id,
            lineNo: salesOrderLines.lineNo,
            productId: salesOrderLines.productId,
            unitId: salesOrderLines.unitId,
            quantityOrdered: salesOrderLines.quantityOrdered,
            quantityDelivered: salesOrderLines.quantityDelivered,
            currencyCode: salesOrderLines.currencyCode,
            trackingMode: products.trackingMode,
            sku: products.sku,
          })
          .from(salesOrderLines)
          .innerJoin(products, eq(salesOrderLines.productId, products.id))
          .where(
            and(
              inArray(salesOrderLines.id, submittedSalesOrderLineIds),
              eq(salesOrderLines.salesOrderId, delivery.salesOrderId),
              isNull(salesOrderLines.deletedAt),
            ),
          );

        if (salesLines.length !== submittedSalesOrderLineIds.length) {
          throw new Error("One or more delivery lines are invalid.");
        }

        const salesLineById = new Map(salesLines.map((line) => [line.id, line]));
        const quantityBySalesLineId = new Map<string, number>();
        for (const row of submittedRows) {
          if (!row.salesOrderLineId) {
            continue;
          }

          const salesLine = salesLineById.get(row.salesOrderLineId);
          if (!salesLine) {
            throw new Error("One or more delivery lines are invalid.");
          }

          if (salesLine.trackingMode === "serial" && (row.quantity !== 1 || !row.serialNo)) {
            throw new Error(`Serialized product ${salesLine.sku} requires quantity 1 and a serial selection.`);
          }

          if (salesLine.trackingMode === "lot" && !row.lotNo) {
            throw new Error(`Lot tracked product ${salesLine.sku} requires a lot selection.`);
          }

          quantityBySalesLineId.set(
            row.salesOrderLineId,
            (quantityBySalesLineId.get(row.salesOrderLineId) ?? 0) + row.quantity,
          );
        }

        for (const [salesOrderLineId, quantity] of quantityBySalesLineId) {
          const salesLine = salesLineById.get(salesOrderLineId);
          const remaining = Number(salesLine?.quantityOrdered ?? 0) - Number(salesLine?.quantityDelivered ?? 0);

          if (quantity > remaining) {
            throw new Error(`Delivery quantity for ${salesLine?.sku ?? "line"} is greater than the remaining sales order quantity.`);
          }
        }

        await tx
          .update(deliveryLines)
          .set({ deletedAt: new Date(), updatedAt: sql`now()` })
          .where(and(eq(deliveryLines.deliveryId, delivery.id), isNull(deliveryLines.deletedAt)));

        await tx.insert(deliveryLines).values(
          submittedRows.map((row, index) => {
            const salesLine = salesLineById.get(row.salesOrderLineId ?? "");

            if (!salesLine) {
              throw new Error("One or more delivery lines are invalid.");
            }

            return {
              deliveryId: delivery.id,
              salesOrderLineId: salesLine.id,
              lineNo: index + 1,
              productId: salesLine.productId,
              unitId: salesLine.unitId,
              quantityDelivered: String(row.quantity),
              currencyCode: salesLine.currencyCode,
              serialNo: row.serialNo,
              lotNo: row.lotNo,
            };
          }),
        );
      }

      const lines = await tx
        .select({
          id: deliveryLines.id,
          lineNo: deliveryLines.lineNo,
          salesOrderLineId: deliveryLines.salesOrderLineId,
          productId: deliveryLines.productId,
          unitId: deliveryLines.unitId,
          quantityDelivered: deliveryLines.quantityDelivered,
          currencyCode: deliveryLines.currencyCode,
          quantityOrdered: salesOrderLines.quantityOrdered,
          salesQuantityDelivered: salesOrderLines.quantityDelivered,
          salesQuantityReserved: salesOrderLines.quantityReserved,
          trackingMode: products.trackingMode,
          sku: products.sku,
          serialNo: deliveryLines.serialNo,
          lotNo: deliveryLines.lotNo,
        })
        .from(deliveryLines)
        .innerJoin(products, eq(deliveryLines.productId, products.id))
        .leftJoin(salesOrderLines, eq(deliveryLines.salesOrderLineId, salesOrderLines.id))
        .where(and(eq(deliveryLines.deliveryId, delivery.id), isNull(deliveryLines.deletedAt)))
        .orderBy(sql`${deliveryLines.lineNo} asc`);
      const selectedLines = lines.filter((line) => Number(line.quantityDelivered) > 0);

      if (selectedLines.length === 0) {
        throw new Error("At least one delivery quantity is required.");
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo,
          movementType: "sale_delivery",
          status: "posted",
          fromLocationId: delivery.sourceLocationId,
          toLocationId: customerLocation.id,
          sourceType: "delivery",
          sourceId: delivery.id,
          sourceNo: delivery.deliveryNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: `Sales delivery ${delivery.deliveryNo}`,
        })
        .returning({ id: stockMovements.id });

      for (const line of selectedLines) {
        const deliverQuantity = Number(line.quantityDelivered);
        const remaining = Number(line.quantityOrdered ?? 0) - Number(line.salesQuantityDelivered ?? 0);

        if (deliverQuantity <= 0) {
          continue;
        }

        if (deliverQuantity > remaining) {
          throw new Error(`Delivery quantity for ${line.sku} is greater than the remaining sales order quantity.`);
        }

        if (line.trackingMode === "serial" && (!line.serialNo || deliverQuantity !== 1)) {
          throw new Error(`Serialized product ${line.sku} requires quantity 1 and a serial number.`);
        }

        if (line.trackingMode === "lot" && !line.lotNo) {
          throw new Error(`Lot tracked product ${line.sku} requires a lot number.`);
        }

        let productSerialId: string | null = null;
        let productLotId: string | null = null;

        if (line.trackingMode === "serial" && line.serialNo) {
          const [serial] = await tx
            .select({
              id: productSerials.id,
              status: productSerials.status,
              currentLocationId: productSerials.currentLocationId,
              landedUnitCostMinor: productSerials.landedUnitCostMinor,
            })
            .from(productSerials)
            .where(and(eq(productSerials.productId, line.productId), eq(productSerials.serialNo, line.serialNo), isNull(productSerials.deletedAt)))
            .limit(1);

          if (!serial || serial.currentLocationId !== delivery.sourceLocationId || !["available", "reserved"].includes(serial.status)) {
            throw new Error(`Serial ${line.serialNo} is not available in the delivery location.`);
          }

          const [postedSerialDelivery] = await tx.execute<{ id: string }>(sql`
            select dl.id
            from delivery_lines dl
            inner join deliveries d on d.id = dl.delivery_id
            where dl.product_serial_id = ${serial.id}
              and dl.deleted_at is null
              and d.deleted_at is null
              and d.status = 'posted'
            limit 1
          `);

          if (postedSerialDelivery) {
            throw new Error(`Serial ${line.serialNo} has already been delivered.`);
          }

          productSerialId = serial.id;
        }

        if (line.trackingMode === "lot" && line.lotNo) {
          const [lot] = await tx
            .select({
              id: productLots.id,
              status: productLots.status,
              currentLocationId: productLots.currentLocationId,
              landedUnitCostMinor: productLots.landedUnitCostMinor,
            })
            .from(productLots)
            .where(and(eq(productLots.productId, line.productId), eq(productLots.lotNo, line.lotNo), isNull(productLots.deletedAt)))
            .limit(1);

          if (!lot) {
            throw new Error(`Lot ${line.lotNo} does not exist.`);
          }

          if (lot.currentLocationId !== delivery.sourceLocationId || !["available", "reserved"].includes(lot.status)) {
            throw new Error(`Lot ${line.lotNo} is not available in the delivery location.`);
          }

          productLotId = lot.id;
        }

        const serialFilter = productSerialId
          ? eq(stockBalances.productSerialId, productSerialId)
          : isNull(stockBalances.productSerialId);
        const lotFilter = productLotId
          ? eq(stockBalances.productLotId, productLotId)
          : isNull(stockBalances.productLotId);
        const [balance] = await tx
          .select({
            id: stockBalances.id,
            quantityOnHand: stockBalances.quantityOnHand,
            quantityReserved: stockBalances.quantityReserved,
            quantityAvailable: stockBalances.quantityAvailable,
            averageCostMinor: stockBalances.averageCostMinor,
          })
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, delivery.sourceLocationId),
              eq(stockBalances.productId, line.productId),
              serialFilter,
              lotFilter,
              isNull(stockBalances.deletedAt),
            ),
          )
          .limit(1);

        if (!balance) {
          throw new Error(`No stock balance exists for ${line.sku} in the delivery location.`);
        }

        const trackedBalanceSelected = Boolean(productSerialId || productLotId);
        const reservedQuantity = Math.min(Number(line.salesQuantityReserved ?? 0), deliverQuantity);
        const reservedFromSelectedBalance = Math.min(Number(balance.quantityReserved), reservedQuantity);
        const reservedFromOrderBalance = trackedBalanceSelected ? reservedQuantity - reservedFromSelectedBalance : 0;
        const availableForThisDelivery = Number(balance.quantityAvailable) + reservedFromSelectedBalance;

        if (Number(balance.quantityOnHand) < deliverQuantity || availableForThisDelivery < deliverQuantity) {
          throw new Error(`Insufficient stock available for ${line.sku}.`);
        }

        const nextOnHand = Number(balance.quantityOnHand) - deliverQuantity;
        const nextReserved = Math.max(Number(balance.quantityReserved) - reservedFromSelectedBalance, 0);
        const nextAvailable = nextOnHand - nextReserved;
        const totalCostMinor = Math.round(deliverQuantity * balance.averageCostMinor);

        if (nextOnHand < 0 || nextReserved < 0 || nextAvailable < 0) {
          throw new Error(`Delivery would create negative stock for ${line.sku}.`);
        }

        await tx.insert(stockMovementLines).values({
          stockMovementId: movement.id,
          lineNo: line.lineNo,
          productId: line.productId,
          productSerialId,
          productLotId,
          fromLocationId: delivery.sourceLocationId,
          toLocationId: customerLocation.id,
          unitId: line.unitId,
          quantity: String(deliverQuantity),
          unitCostMinor: balance.averageCostMinor,
          totalCostMinor,
          currencyCode: line.currencyCode,
          notes: `Delivered on ${delivery.deliveryNo}`,
        });

        await tx
          .update(stockBalances)
          .set({
            quantityOnHand: String(nextOnHand),
            quantityReserved: String(nextReserved),
            quantityAvailable: String(nextAvailable),
            lastMovementAt: new Date(),
            updatedAt: sql`now()`,
          })
          .where(eq(stockBalances.id, balance.id));

        if (reservedFromOrderBalance > 0) {
          const [reservationBalance] = await tx
            .select({
              id: stockBalances.id,
              quantityOnHand: stockBalances.quantityOnHand,
              quantityReserved: stockBalances.quantityReserved,
            })
            .from(stockBalances)
            .where(
              and(
                eq(stockBalances.companyId, company.id),
                eq(stockBalances.locationId, delivery.sourceLocationId),
                eq(stockBalances.productId, line.productId),
                isNull(stockBalances.productSerialId),
                isNull(stockBalances.productLotId),
                isNull(stockBalances.deletedAt),
              ),
            )
            .limit(1);

          if (reservationBalance) {
            const nextReservationBalanceReserved = Math.max(Number(reservationBalance.quantityReserved) - reservedFromOrderBalance, 0);
            await tx
              .update(stockBalances)
              .set({
                quantityReserved: String(nextReservationBalanceReserved),
                quantityAvailable: String(Number(reservationBalance.quantityOnHand) - nextReservationBalanceReserved),
                updatedAt: sql`now()`,
              })
              .where(eq(stockBalances.id, reservationBalance.id));
          }
        }

        if (productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: "sold",
              currentLocationId: null,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, productSerialId));

          await tx.insert(serialOwnershipHistory).values({
            companyId: company.id,
            productSerialId,
            partnerId: delivery.customerId,
            ownershipType: "sale",
            sourceType: "delivery",
            sourceId: delivery.id,
            sourceNo: delivery.deliveryNo,
            notes: "Serial sold through delivery.",
          });

          const [existingWarranty] = await tx
            .select({ id: warrantyRegistrations.id })
            .from(warrantyRegistrations)
            .where(and(eq(warrantyRegistrations.productSerialId, productSerialId), eq(warrantyRegistrations.status, "active"), isNull(warrantyRegistrations.deletedAt)))
            .limit(1);

          if (!existingWarranty) {
            const startDate = new Date();
            await tx.insert(warrantyRegistrations).values({
              companyId: company.id,
              productSerialId,
              customerId: delivery.customerId,
              salesOrderId: delivery.salesOrderId,
              deliveryId: delivery.id,
              warrantyNo: documentNo("WRT"),
              status: "active",
              startDate: dateOnly(startDate),
              endDate: dateOnly(addYears(startDate, 1)),
              notes: "Automatic warranty from serial sale.",
            });

            await tx.insert(serialOwnershipHistory).values({
              companyId: company.id,
              productSerialId,
              partnerId: delivery.customerId,
              ownershipType: "warranty_registration",
              sourceType: "warranty_registration",
              sourceId: delivery.id,
              sourceNo: delivery.deliveryNo,
              notes: "Warranty registered from delivery.",
            });
          }
        }

        const nextLineReserved = Math.max(Number(line.salesQuantityReserved ?? 0) - reservedQuantity, 0);
        await tx
          .update(deliveryLines)
          .set({
            productSerialId,
            productLotId,
            quantityDelivered: String(deliverQuantity),
            unitCostMinor: balance.averageCostMinor,
            totalCostMinor,
            serialNo: line.serialNo ?? null,
            lotNo: line.lotNo ?? null,
            updatedAt: sql`now()`,
          })
          .where(eq(deliveryLines.id, line.id));

        if (line.salesOrderLineId) {
          await tx
            .update(salesOrderLines)
            .set({
              quantityDelivered: sql`${salesOrderLines.quantityDelivered} + ${String(deliverQuantity)}`,
              quantityReserved: String(nextLineReserved),
              updatedAt: sql`now()`,
            })
            .where(eq(salesOrderLines.id, line.salesOrderLineId));

          if (reservedQuantity > 0) {
            await tx
              .update(stockReservations)
              .set({
                quantity: String(nextLineReserved),
                status: nextLineReserved <= 0 ? "fulfilled" : "active",
                fulfilledAt: nextLineReserved <= 0 ? new Date() : null,
                updatedAt: sql`now()`,
              })
              .where(
                and(
                  eq(stockReservations.sourceType, "sales_order_line"),
                  eq(stockReservations.sourceId, line.salesOrderLineId),
                  eq(stockReservations.status, "active"),
                  isNull(stockReservations.deletedAt),
                ),
              );
          }
        }
      }

      const [remainingAfterDelivery] = await tx.execute<{ count: number }>(sql`
        select count(*)::int as "count"
        from sales_order_lines
        where sales_order_id = ${delivery.salesOrderId}
          and deleted_at is null
          and quantity_delivered < quantity_ordered
      `);

      await tx
        .update(deliveries)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          stockMovementId: movement.id,
          updatedAt: sql`now()`,
        })
        .where(eq(deliveries.id, delivery.id));

      await tx
        .update(salesOrders)
        .set({
          status: remainingAfterDelivery?.count === 0 ? "delivered" : "partially_delivered",
          updatedAt: sql`now()`,
        })
        .where(eq(salesOrders.id, delivery.salesOrderId));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "delivery.post",
        entityType: "delivery",
        entityId: delivery.id,
        severity: "info",
        metadata: { deliveryNo: delivery.deliveryNo, movementNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/deliveries/${parsed.data.deliveryId}`, error instanceof Error ? error.message : "Could not post delivery.");
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/inventory");
  if (salesOrderId) {
    revalidatePath(`/admin/sales/${salesOrderId}`);
  }
  revalidatePath(`/admin/sales/deliveries/${parsed.data.deliveryId}`);
  redirect(`/admin/sales/deliveries/${parsed.data.deliveryId}?notice=${encodeURIComponent("Delivery posted")}`);
}

export async function cancelDelivery(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = cancelDeliverySchema.safeParse({
    deliveryId: formValue(formData, "deliveryId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=deliveries", "Delivery ID is required.");
  }

  let salesOrderId: string | undefined;

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [delivery] = await tx
        .select({
          id: deliveries.id,
          deliveryNo: deliveries.deliveryNo,
          status: deliveries.status,
          salesOrderId: deliveries.salesOrderId,
        })
        .from(deliveries)
        .where(and(eq(deliveries.id, parsed.data.deliveryId), eq(deliveries.companyId, company.id), isNull(deliveries.deletedAt)))
        .limit(1);

      if (!delivery) {
        throw new Error("Delivery does not exist.");
      }

      salesOrderId = delivery.salesOrderId;

      if (delivery.status !== "draft") {
        throw new Error("Only draft deliveries can be cancelled.");
      }

      await tx
        .update(deliveries)
        .set({
          status: "cancelled",
          updatedAt: sql`now()`,
        })
        .where(eq(deliveries.id, delivery.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "delivery.cancel",
        entityType: "delivery",
        entityId: delivery.id,
        severity: "info",
        metadata: { deliveryNo: delivery.deliveryNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/deliveries/${parsed.data.deliveryId}`, error instanceof Error ? error.message : "Could not cancel delivery.");
  }

  revalidatePath("/admin/sales");
  if (salesOrderId) {
    revalidatePath(`/admin/sales/${salesOrderId}`);
  }
  revalidatePath(`/admin/sales/deliveries/${parsed.data.deliveryId}`);
  redirect(`/admin/sales/deliveries/${parsed.data.deliveryId}?notice=${encodeURIComponent("Delivery cancelled")}`);
}

async function updateCustomerInvoicePaymentStatus(customerInvoiceId: string) {
  const summary = await getCustomerInvoicePaymentSummary(customerInvoiceId);

  await db
    .update(customerInvoices)
    .set({
      paymentStatus: summary.paymentStatus,
      updatedAt: sql`now()`,
    })
    .where(eq(customerInvoices.id, customerInvoiceId));

  return summary;
}

export async function createCustomerInvoiceFromSalesOrder(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = createInvoiceSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId") || undefined,
  });

  if (!parsed.success || !parsed.data.salesOrderId) {
    redirectWithError("/admin/sales", "Sales order ID is required.");
  }

  const salesOrderId = parsed.data.salesOrderId;
  const company = await getDefaultCompany();
  const invoiceNo = documentNo("INV");
  let invoiceId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: salesOrders.id,
          orderNo: salesOrders.orderNo,
          customerId: salesOrders.customerId,
          customerReference: salesOrders.customerReference,
          status: salesOrders.status,
          currencyCode: salesOrders.currencyCode,
        })
        .from(salesOrders)
        .where(and(eq(salesOrders.id, salesOrderId), eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt)))
        .limit(1);

      if (!order) {
        throw new Error("Sales order does not exist.");
      }

      if (!["confirmed", "partially_delivered", "delivered"].includes(order.status)) {
        throw new Error("Only confirmed or delivered sales orders can be invoiced.");
      }

      const lines = await tx.execute<{
        id: string;
        lineNo: number;
        productId: string;
        productName: string;
        sku: string;
        quantityOrdered: string;
        quantityInvoiced: string;
        unitPriceMinor: number;
        discountMinor: number;
        taxAmountMinor: number;
        lineTotalMinor: number;
        currencyCode: string;
      }>(sql`
        select
          sol.id as "id",
          sol.line_no as "lineNo",
          sol.product_id as "productId",
          pr.name as "productName",
          pr.sku as "sku",
          sol.quantity_ordered::text as "quantityOrdered",
          sol.quantity_invoiced::text as "quantityInvoiced",
          sol.unit_price_minor as "unitPriceMinor",
          sol.discount_minor as "discountMinor",
          sol.tax_amount_minor as "taxAmountMinor",
          sol.line_total_minor as "lineTotalMinor",
          sol.currency_code as "currencyCode"
        from sales_order_lines sol
        inner join products pr on pr.id = sol.product_id
        where sol.sales_order_id = ${order.id}
          and sol.deleted_at is null
        order by sol.line_no
      `);
      const invoiceLines = lines
        .map((line) => {
          const quantityOrdered = Number(line.quantityOrdered);
          const quantityInvoiced = Number(line.quantityInvoiced);
          const quantity = quantityOrdered - quantityInvoiced;
          const ratio = quantityOrdered > 0 ? quantity / quantityOrdered : 0;

          return {
            ...line,
            quantity,
            taxAmountMinor: Math.round(line.taxAmountMinor * ratio),
            lineTotalMinor: Math.round(line.lineTotalMinor * ratio),
          };
        })
        .filter((line) => line.quantity > 0);

      if (invoiceLines.length === 0) {
        throw new Error("This sales order has no remaining quantity to invoice.");
      }

      const untaxedAmountMinor = invoiceLines.reduce((sum, line) => {
        const unitSubtotalMinor = Math.max(line.unitPriceMinor - line.discountMinor, 0);
        return sum + Math.round(line.quantity * unitSubtotalMinor);
      }, 0);
      const taxAmountMinor = invoiceLines.reduce((sum, line) => sum + line.taxAmountMinor, 0);
      const totalMinor = invoiceLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

      const [invoice] = await tx
        .insert(customerInvoices)
        .values({
          companyId: company.id,
          salesOrderId: order.id,
          customerId: order.customerId,
          invoiceNo,
          customerReference: order.customerReference,
          status: "draft",
          paymentStatus: "not_paid",
          currencyCode: order.currencyCode,
          untaxedAmountMinor,
          taxAmountMinor,
          totalMinor,
          notes: `Invoice for ${order.orderNo}`,
        })
        .returning({ id: customerInvoices.id });
      invoiceId = invoice.id;

      await tx
        .insert(customerInvoiceLines)
        .values(
          invoiceLines.map((line, index) => ({
            customerInvoiceId: invoice.id,
            salesOrderLineId: line.id,
            lineNo: index + 1,
            productId: line.productId,
            description: `${line.sku} - ${line.productName}`,
            quantity: String(line.quantity),
            unitPriceMinor: line.unitPriceMinor,
            discountMinor: line.discountMinor,
            taxAmountMinor: line.taxAmountMinor,
            lineTotalMinor: line.lineTotalMinor,
            currencyCode: line.currencyCode,
          })),
        );

      const lineTaxes = await tx.execute<{
        invoiceLineId: string;
        taxId: string;
        taxAmountMinor: number;
      }>(sql`
        select
          cil.id as "invoiceLineId",
          solt.tax_id as "taxId",
          round(solt.tax_amount_minor * (cil.quantity / nullif(sol.quantity_ordered, 0)))::bigint as "taxAmountMinor"
        from customer_invoice_lines cil
        inner join sales_order_lines sol on sol.id = cil.sales_order_line_id
        inner join sales_order_line_taxes solt on solt.sales_order_line_id = sol.id
        where cil.customer_invoice_id = ${invoice.id}
      `);

      if (lineTaxes.length > 0) {
        await tx.insert(customerInvoiceLineTaxes).values(
          lineTaxes.map((lineTax) => ({
            customerInvoiceLineId: lineTax.invoiceLineId,
            taxId: lineTax.taxId,
            taxAmountMinor: lineTax.taxAmountMinor,
          })),
        );
      }

      for (const line of invoiceLines) {
        await tx
          .update(salesOrderLines)
          .set({
            quantityInvoiced: sql`${salesOrderLines.quantityInvoiced} + ${String(line.quantity)}`,
            updatedAt: sql`now()`,
          })
          .where(eq(salesOrderLines.id, line.id));
      }

      const [remainingAfterInvoice] = await tx.execute<{ count: number }>(sql`
        select count(*)::int as "count"
        from sales_order_lines
        where sales_order_id = ${order.id}
          and deleted_at is null
          and quantity_invoiced < quantity_ordered
      `);

      if (remainingAfterInvoice?.count === 0) {
        await tx
          .update(salesOrders)
          .set({ status: "invoiced", updatedAt: sql`now()` })
          .where(eq(salesOrders.id, order.id));
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer_invoice.create",
        entityType: "customer_invoice",
        entityId: invoice.id,
        severity: "info",
        metadata: { invoiceNo, orderNo: order.orderNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/${salesOrderId}`, error instanceof Error ? error.message : "Could not create invoice.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/${salesOrderId}`);
  redirect(`/admin/sales/invoices/${invoiceId}?notice=${encodeURIComponent("Customer invoice created")}`);
}

export async function createCustomerInvoiceFromDelivery(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = createInvoiceSchema.safeParse({
    deliveryId: formValue(formData, "deliveryId") || undefined,
  });

  if (!parsed.success || !parsed.data.deliveryId) {
    redirectWithError("/admin/sales?view=deliveries", "Delivery ID is required.");
  }

  const deliveryId = parsed.data.deliveryId;
  const company = await getDefaultCompany();
  const invoiceNo = documentNo("INV");
  let invoiceId: string | undefined;
  let salesOrderId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [delivery] = await tx
        .select({
          id: deliveries.id,
          deliveryNo: deliveries.deliveryNo,
          status: deliveries.status,
          salesOrderId: deliveries.salesOrderId,
          customerId: deliveries.customerId,
        })
        .from(deliveries)
        .where(and(eq(deliveries.id, deliveryId), eq(deliveries.companyId, company.id), isNull(deliveries.deletedAt)))
        .limit(1);

      if (!delivery) {
        throw new Error("Delivery does not exist.");
      }

      salesOrderId = delivery.salesOrderId;

      if (delivery.status !== "posted") {
        throw new Error("Only posted deliveries can be invoiced.");
      }

      const lines = await tx.execute<{
        deliveryLineId: string;
        salesOrderLineId: string;
        lineNo: number;
        productId: string;
        productName: string;
        sku: string;
        quantityDelivered: string;
        quantityOrdered: string;
        quantityInvoiced: string;
        unitPriceMinor: number;
        discountMinor: number;
        taxAmountMinor: number;
        lineTotalMinor: number;
        currencyCode: string;
        orderNo: string;
        customerReference: string | null;
        orderCurrencyCode: string;
      }>(sql`
        select
          dl.id as "deliveryLineId",
          sol.id as "salesOrderLineId",
          dl.line_no as "lineNo",
          dl.product_id as "productId",
          pr.name as "productName",
          pr.sku as "sku",
          dl.quantity_delivered::text as "quantityDelivered",
          sol.quantity_ordered::text as "quantityOrdered",
          sol.quantity_invoiced::text as "quantityInvoiced",
          sol.unit_price_minor as "unitPriceMinor",
          sol.discount_minor as "discountMinor",
          sol.tax_amount_minor as "taxAmountMinor",
          sol.line_total_minor as "lineTotalMinor",
          sol.currency_code as "currencyCode",
          so.order_no as "orderNo",
          so.customer_reference as "customerReference",
          so.currency_code as "orderCurrencyCode"
        from delivery_lines dl
        inner join sales_order_lines sol on sol.id = dl.sales_order_line_id
        inner join sales_orders so on so.id = sol.sales_order_id
        inner join products pr on pr.id = dl.product_id
        where dl.delivery_id = ${delivery.id}
          and dl.deleted_at is null
        order by dl.line_no
      `);

      const invoiceLines = lines
        .map((line) => {
          const remainingToInvoice = Number(line.quantityOrdered) - Number(line.quantityInvoiced);
          const quantity = Math.min(Number(line.quantityDelivered), remainingToInvoice);
          const ratio = Number(line.quantityOrdered) > 0 ? quantity / Number(line.quantityOrdered) : 0;

          return {
            ...line,
            quantity,
            taxAmountMinor: Math.round(line.taxAmountMinor * ratio),
            lineTotalMinor: Math.round(line.lineTotalMinor * ratio),
          };
        })
        .filter((line) => line.quantity > 0);

      if (invoiceLines.length === 0) {
        throw new Error("This delivery has no invoiceable lines.");
      }

      const orderInfo = invoiceLines[0];
      const untaxedAmountMinor = invoiceLines.reduce((sum, line) => {
        const unitSubtotalMinor = Math.max(line.unitPriceMinor - line.discountMinor, 0);
        return sum + Math.round(line.quantity * unitSubtotalMinor);
      }, 0);
      const taxAmountMinor = invoiceLines.reduce((sum, line) => sum + line.taxAmountMinor, 0);
      const totalMinor = invoiceLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

      const [invoice] = await tx
        .insert(customerInvoices)
        .values({
          companyId: company.id,
          salesOrderId: delivery.salesOrderId,
          deliveryId: delivery.id,
          customerId: delivery.customerId,
          invoiceNo,
          customerReference: orderInfo?.customerReference ?? null,
          status: "draft",
          paymentStatus: "not_paid",
          currencyCode: orderInfo?.orderCurrencyCode ?? company.baseCurrencyCode,
          untaxedAmountMinor,
          taxAmountMinor,
          totalMinor,
          notes: `Invoice for ${delivery.deliveryNo}`,
        })
        .returning({ id: customerInvoices.id });
      invoiceId = invoice.id;

      await tx.insert(customerInvoiceLines).values(
        invoiceLines.map((line, index) => ({
          customerInvoiceId: invoice.id,
          salesOrderLineId: line.salesOrderLineId,
          deliveryLineId: line.deliveryLineId,
          lineNo: index + 1,
          productId: line.productId,
          description: `${line.sku} - ${line.productName}`,
          quantity: String(line.quantity),
          unitPriceMinor: line.unitPriceMinor,
          discountMinor: line.discountMinor,
          taxAmountMinor: line.taxAmountMinor,
          lineTotalMinor: line.lineTotalMinor,
          currencyCode: line.currencyCode,
        })),
      );

      const lineTaxes = await tx.execute<{
        invoiceLineId: string;
        taxId: string;
        taxAmountMinor: number;
      }>(sql`
        select
          cil.id as "invoiceLineId",
          solt.tax_id as "taxId",
          round(solt.tax_amount_minor * (cil.quantity / nullif(sol.quantity_ordered, 0)))::bigint as "taxAmountMinor"
        from customer_invoice_lines cil
        inner join sales_order_lines sol on sol.id = cil.sales_order_line_id
        inner join sales_order_line_taxes solt on solt.sales_order_line_id = sol.id
        where cil.customer_invoice_id = ${invoice.id}
      `);

      if (lineTaxes.length > 0) {
        await tx.insert(customerInvoiceLineTaxes).values(
          lineTaxes.map((lineTax) => ({
            customerInvoiceLineId: lineTax.invoiceLineId,
            taxId: lineTax.taxId,
            taxAmountMinor: lineTax.taxAmountMinor,
          })),
        );
      }

      for (const line of invoiceLines) {
        await tx
          .update(salesOrderLines)
          .set({
            quantityInvoiced: sql`${salesOrderLines.quantityInvoiced} + ${String(line.quantity)}`,
            updatedAt: sql`now()`,
          })
          .where(eq(salesOrderLines.id, line.salesOrderLineId));
      }

      const [remainingAfterInvoice] = await tx.execute<{ count: number }>(sql`
        select count(*)::int as "count"
        from sales_order_lines
        where sales_order_id = ${delivery.salesOrderId}
          and deleted_at is null
          and quantity_invoiced < quantity_ordered
      `);

      if (remainingAfterInvoice?.count === 0) {
        await tx
          .update(salesOrders)
          .set({ status: "invoiced", updatedAt: sql`now()` })
          .where(eq(salesOrders.id, delivery.salesOrderId));
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer_invoice.create_from_delivery",
        entityType: "customer_invoice",
        entityId: invoice.id,
        severity: "info",
        metadata: { invoiceNo, deliveryNo: delivery.deliveryNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/deliveries/${deliveryId}`, error instanceof Error ? error.message : "Could not create invoice.");
  }

  revalidatePath("/admin/sales");
  if (salesOrderId) {
    revalidatePath(`/admin/sales/${salesOrderId}`);
  }
  revalidatePath(`/admin/sales/deliveries/${deliveryId}`);
  redirect(`/admin/sales/invoices/${invoiceId}?notice=${encodeURIComponent("Customer invoice created")}`);
}

export async function postCustomerInvoice(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = invoiceStatusSchema.safeParse({
    customerInvoiceId: formValue(formData, "customerInvoiceId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=invoices", "Customer invoice ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: customerInvoices.id,
          invoiceNo: customerInvoices.invoiceNo,
          status: customerInvoices.status,
        })
        .from(customerInvoices)
        .where(and(eq(customerInvoices.id, parsed.data.customerInvoiceId), eq(customerInvoices.companyId, company.id), isNull(customerInvoices.deletedAt)))
        .limit(1);

      if (!invoice) {
        throw new Error("Customer invoice does not exist.");
      }

      if (invoice.status !== "draft") {
        return;
      }

      await tx
        .update(customerInvoices)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          updatedAt: sql`now()`,
        })
        .where(eq(customerInvoices.id, invoice.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer_invoice.post",
        entityType: "customer_invoice",
        entityId: invoice.id,
        severity: "info",
        metadata: { invoiceNo: invoice.invoiceNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/invoices/${parsed.data.customerInvoiceId}`, error instanceof Error ? error.message : "Could not post customer invoice.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/invoices/${parsed.data.customerInvoiceId}`);
  redirect(`/admin/sales/invoices/${parsed.data.customerInvoiceId}?notice=${encodeURIComponent("Customer invoice posted")}`);
}

export async function registerCustomerPayment(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = registerCustomerPaymentSchema.safeParse({
    customerInvoiceId: formValue(formData, "customerInvoiceId"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    amount: formValue(formData, "amount"),
    reference: formValue(formData, "reference"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=invoices", parsed.error.issues[0]?.message ?? "Invalid customer payment.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError(`/admin/sales/invoices/${parsed.data.customerInvoiceId}`, "Payment amount must be greater than zero.");
  }

  const company = await getDefaultCompany();
  let paymentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: customerInvoices.id,
          invoiceNo: customerInvoices.invoiceNo,
          customerId: customerInvoices.customerId,
          status: customerInvoices.status,
          totalMinor: customerInvoices.totalMinor,
          currencyCode: customerInvoices.currencyCode,
          paymentStatus: customerInvoices.paymentStatus,
        })
        .from(customerInvoices)
        .where(and(eq(customerInvoices.id, parsed.data.customerInvoiceId), eq(customerInvoices.companyId, company.id), isNull(customerInvoices.deletedAt)))
        .limit(1);

      if (!invoice) {
        throw new Error("Customer invoice does not exist.");
      }

      if (invoice.status !== "posted") {
        throw new Error("Only posted customer invoices can be paid.");
      }

      if (invoice.paymentStatus === "paid") {
        throw new Error("Customer invoice is already paid.");
      }

      const [account] = await tx
        .select({
          id: paymentAccounts.id,
          currencyCode: paymentAccounts.currencyCode,
          methodId: paymentMethods.id,
          requiresReference: paymentMethods.requiresReference,
          allowInbound: paymentMethods.allowInbound,
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

      if (!account || !account.allowInbound) {
        throw new Error("Select an active inbound payment account.");
      }

      if (account.currencyCode !== invoice.currencyCode) {
        throw new Error("Payment account currency must match the customer invoice.");
      }

      if (account.requiresReference && !parsed.data.reference) {
        throw new Error("This payment method requires a reference.");
      }

      const [summary] = await tx.execute<{ residualAmountMinor: number }>(sql`
        select greatest(
          ${invoice.totalMinor} - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted'
              and p.deleted_at is null
              and pa.deleted_at is null
          ), 0),
          0
        )::bigint as "residualAmountMinor"
        from customer_invoices ci
        left join payment_allocations pa on pa.customer_invoice_id = ci.id
        left join payments p on p.id = pa.payment_id
        where ci.id = ${invoice.id}
        group by ci.id
      `);

      if (amountMinor > (summary?.residualAmountMinor ?? 0)) {
        throw new Error("Payment amount cannot exceed the customer invoice residual.");
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: company.id,
          partnerId: invoice.customerId,
          paymentNo: documentNo("PAY-IN"),
          paymentType: "inbound",
          status: "draft",
          paymentMethodId: account.methodId,
          paymentAccountId: account.id,
          amountMinor,
          currencyCode: invoice.currencyCode,
          reference: parsed.data.reference || null,
          notes: parsed.data.notes || null,
        })
        .returning({ id: payments.id, paymentNo: payments.paymentNo });
      paymentId = payment.id;

      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        customerInvoiceId: invoice.id,
        amountMinor,
        notes: "Customer payment allocation.",
      });

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer_payment.register",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, customerInvoiceId: invoice.id },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/invoices/${parsed.data.customerInvoiceId}`, error instanceof Error ? error.message : "Could not register customer payment.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/invoices/${parsed.data.customerInvoiceId}`);
  redirect(`/admin/sales/payments/${paymentId}?notice=${encodeURIComponent("Customer payment registered as draft")}`);
}

export async function postCustomerPayment(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = paymentStatusSchema.safeParse({ paymentId: formValue(formData, "paymentId") });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=payments", "Payment ID is required.");
  }

  let customerInvoiceId: string | undefined;
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

      if (payment.paymentType !== "inbound") {
        throw new Error("Only inbound customer payments can be posted here.");
      }

      const allocations = await tx
        .select({
          customerInvoiceId: paymentAllocations.customerInvoiceId,
          amountMinor: paymentAllocations.amountMinor,
        })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)));

      const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0);
      if (allocations.length !== 1 || !allocations[0]?.customerInvoiceId || allocationTotal !== payment.amountMinor) {
        throw new Error("Customer payment allocation must match payment amount.");
      }

      customerInvoiceId = allocations[0].customerInvoiceId;

      const [invoice] = await tx
        .select({
          id: customerInvoices.id,
          status: customerInvoices.status,
          totalMinor: customerInvoices.totalMinor,
        })
        .from(customerInvoices)
        .where(and(eq(customerInvoices.id, customerInvoiceId), eq(customerInvoices.companyId, company.id), isNull(customerInvoices.deletedAt)))
        .limit(1);

      if (!invoice || invoice.status !== "posted") {
        throw new Error("Customer invoice must be posted before payment posting.");
      }

      const [summary] = await tx.execute<{ residualAmountMinor: number }>(sql`
        select greatest(
          ${invoice.totalMinor} - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted'
              and p.deleted_at is null
              and pa.deleted_at is null
          ), 0),
          0
        )::bigint as "residualAmountMinor"
        from customer_invoices ci
        left join payment_allocations pa on pa.customer_invoice_id = ci.id
        left join payments p on p.id = pa.payment_id
        where ci.id = ${invoice.id}
        group by ci.id
      `);

      if (payment.amountMinor > (summary?.residualAmountMinor ?? 0)) {
        throw new Error("Payment amount cannot exceed the customer invoice residual.");
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
        action: "customer_payment.post",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, customerInvoiceId },
      });
    });

    if (customerInvoiceId) {
      await updateCustomerInvoicePaymentStatus(customerInvoiceId);
    }
  } catch (error) {
    redirectWithError(`/admin/sales/payments/${parsed.data.paymentId}`, error instanceof Error ? error.message : "Could not post customer payment.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/payments/${parsed.data.paymentId}`);
  if (customerInvoiceId) {
    revalidatePath(`/admin/sales/invoices/${customerInvoiceId}`);
  }
  redirect(`/admin/sales/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Customer payment posted")}`);
}

export async function updateCustomerPayment(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = updateCustomerPaymentSchema.safeParse({
    paymentId: formValue(formData, "paymentId"),
    paymentAccountId: formValue(formData, "paymentAccountId"),
    amount: formValue(formData, "amount"),
    reference: formValue(formData, "reference"),
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=payments", parsed.error.issues[0]?.message ?? "Invalid customer payment.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError(`/admin/sales/payments/${parsed.data.paymentId}`, "Payment amount must be greater than zero.");
  }

  const company = await getDefaultCompany();
  let customerInvoiceId: string | undefined;

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

      if (payment.paymentType !== "inbound") {
        throw new Error("Only inbound customer payments can be edited here.");
      }

      const [allocation] = await tx
        .select({ id: paymentAllocations.id, customerInvoiceId: paymentAllocations.customerInvoiceId })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)))
        .limit(1);

      if (!allocation?.customerInvoiceId) {
        throw new Error("Customer payment allocation is missing.");
      }
      customerInvoiceId = allocation.customerInvoiceId;

      const [invoice] = await tx
        .select({
          id: customerInvoices.id,
          status: customerInvoices.status,
          totalMinor: customerInvoices.totalMinor,
          currencyCode: customerInvoices.currencyCode,
        })
        .from(customerInvoices)
        .where(and(eq(customerInvoices.id, allocation.customerInvoiceId), eq(customerInvoices.companyId, company.id), isNull(customerInvoices.deletedAt)))
        .limit(1);

      if (!invoice || invoice.status !== "posted") {
        throw new Error("Customer invoice must be posted before editing payment.");
      }

      const [account] = await tx
        .select({
          id: paymentAccounts.id,
          currencyCode: paymentAccounts.currencyCode,
          methodId: paymentMethods.id,
          requiresReference: paymentMethods.requiresReference,
          allowInbound: paymentMethods.allowInbound,
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

      if (!account || !account.allowInbound) {
        throw new Error("Select an active inbound payment account.");
      }

      if (account.currencyCode !== invoice.currencyCode) {
        throw new Error("Payment account currency must match the customer invoice.");
      }

      if (account.requiresReference && !parsed.data.reference) {
        throw new Error("This payment method requires a reference.");
      }

      const [summary] = await tx.execute<{ residualAmountMinor: number }>(sql`
        select greatest(
          ${invoice.totalMinor} - coalesce(sum(pa.amount_minor) filter (
            where p.status = 'posted'
              and p.deleted_at is null
              and pa.deleted_at is null
          ), 0),
          0
        )::bigint as "residualAmountMinor"
        from customer_invoices ci
        left join payment_allocations pa on pa.customer_invoice_id = ci.id
        left join payments p on p.id = pa.payment_id
        where ci.id = ${invoice.id}
        group by ci.id
      `);

      if (amountMinor > (summary?.residualAmountMinor ?? 0)) {
        throw new Error("Payment amount cannot exceed the customer invoice residual.");
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
        action: "customer_payment.update",
        entityType: "payment",
        entityId: payment.id,
        severity: "info",
        metadata: { paymentNo: payment.paymentNo, customerInvoiceId },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/payments/${parsed.data.paymentId}`, error instanceof Error ? error.message : "Could not update customer payment.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/payments/${parsed.data.paymentId}`);
  if (customerInvoiceId) {
    revalidatePath(`/admin/sales/invoices/${customerInvoiceId}`);
  }
  redirect(`/admin/sales/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Customer payment updated")}`);
}

export async function cancelCustomerPayment(formData: FormData) {
  const user = await requirePermission("sales:orders:create");
  const parsed = paymentStatusSchema.safeParse({ paymentId: formValue(formData, "paymentId") });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=payments", "Payment ID is required.");
  }

  let customerInvoiceId: string | undefined;
  const company = await getDefaultCompany();

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

      if (!payment || payment.status === "cancelled") {
        return;
      }

      if (payment.paymentType !== "inbound") {
        throw new Error("Only inbound customer payments can be cancelled here.");
      }

      const [allocation] = await tx
        .select({ customerInvoiceId: paymentAllocations.customerInvoiceId })
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.paymentId, payment.id), isNull(paymentAllocations.deletedAt)))
        .limit(1);
      customerInvoiceId = allocation?.customerInvoiceId ?? undefined;

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
        action: "customer_payment.cancel",
        entityType: "payment",
        entityId: payment.id,
        severity: "warning",
        metadata: { paymentNo: payment.paymentNo, customerInvoiceId },
      });
    });

    if (customerInvoiceId) {
      await updateCustomerInvoicePaymentStatus(customerInvoiceId);
    }
  } catch (error) {
    redirectWithError(`/admin/sales/payments/${parsed.data.paymentId}`, error instanceof Error ? error.message : "Could not cancel customer payment.");
  }

  revalidatePath("/admin/sales");
  revalidatePath(`/admin/sales/payments/${parsed.data.paymentId}`);
  if (customerInvoiceId) {
    revalidatePath(`/admin/sales/invoices/${customerInvoiceId}`);
  }
  redirect(`/admin/sales/payments/${parsed.data.paymentId}?notice=${encodeURIComponent("Customer payment cancelled")}`);
}
