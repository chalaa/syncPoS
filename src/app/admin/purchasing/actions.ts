"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getDefaultCompany, majorToMinor, uniqueViolationMessage } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { db } from "@/server/db/client";
import {
  auditLogs,
  goodsReceiptLines,
  goodsReceipts,
  landedCostAllocations,
  landedCosts,
  partners,
  productLots,
  productSerials,
  products,
  purchaseOrderLineTaxes,
  purchaseOrderLines,
  purchaseOrders,
  stockBalances,
  stockMovementLines,
  stockMovements,
  taxes,
  vendorBillLineTaxes,
  vendorBillLines,
  vendorBills,
} from "@/server/db/schema";
import { getOrCreatePartnerStockLocation } from "@/server/inventory/partner-locations";
import { getPurchaseOrderReceiptLines } from "@/server/purchasing/purchasing";

const purchaseOrderHeaderSchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  deliverToLocationId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  vendorReference: z.string().trim().max(80).optional(),
  paymentTerm: z.enum(["cash", "credit"]).default("credit"),
  expectedDate: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const purchaseOrderLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitCost: z.string().trim().default("0"),
  taxIds: z.array(z.string().uuid()).default([]),
});

const receiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  locationId: z.string().uuid(),
  supplierInvoiceNo: z.string().trim().optional(),
});

const receiptLineSchema = z.object({
  purchaseOrderLineId: z.string().uuid(),
  quantity: z.coerce.number().min(0),
  serialNo: z.string().trim().optional(),
  lotNo: z.string().trim().optional(),
});

const confirmSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  returnPath: z.string().trim().startsWith("/admin/purchasing").optional(),
});

const receiptDocumentSchema = z.object({
  receiptId: z.string().uuid(),
});

const purchaseOrderDocumentSchema = z.object({
  purchaseOrderId: z.string().uuid(),
});

const vendorBillStatusSchema = z.object({
  vendorBillId: z.string().uuid(),
});

const landedCostSchema = z.object({
  landedCostId: z.string().uuid().optional(),
  goodsReceiptId: z.string().uuid(),
  costType: z.enum(["freight", "customs", "insurance", "handling", "other"]),
  allocationMethod: z.enum(["quantity", "value", "manual"]),
  amount: z.string().trim(),
  vendorId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  notes: z.string().trim().optional(),
});

const landedCostStatusSchema = z.object({
  landedCostId: z.string().uuid(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function parseTaxIds(value: string) {
  return value
    .split(",")
    .map((taxId) => taxId.trim())
    .filter(Boolean);
}

function parsePurchaseOrderForm(formData: FormData, errorPath: string) {
  const parsedHeader = purchaseOrderHeaderSchema.safeParse({
    purchaseOrderId: formValue(formData, "purchaseOrderId") || undefined,
    supplierId: formValue(formData, "supplierId"),
    deliverToLocationId: formValue(formData, "deliverToLocationId"),
    vendorReference: formValue(formData, "vendorReference"),
    paymentTerm: formValue(formData, "paymentTerm") || "credit",
    expectedDate: formValue(formData, "expectedDate"),
    notes: formValue(formData, "notes"),
  });
  const productIds = formValues(formData, "productId");
  const quantities = formValues(formData, "quantity");
  const unitCosts = formValues(formData, "unitCost");
  const taxIdValues = formValues(formData, "taxIds");
  const parsedLines = productIds
    .map((productId, index) => ({
      productId,
      quantity: quantities[index] ?? "",
      unitCost: unitCosts[index] || "0",
      taxIds: parseTaxIds(taxIdValues[index] ?? ""),
    }))
    .filter((line) => line.productId || line.quantity || line.unitCost || line.taxIds.length > 0)
    .map((line) => purchaseOrderLineSchema.safeParse(line));

  if (!parsedHeader.success) {
    redirectWithError(errorPath, parsedHeader.error.issues[0]?.message ?? "Invalid purchase order.");
  }

  if (parsedLines.length === 0) {
    redirectWithError(errorPath, "At least one order line is required.");
  }

  const invalidLine = parsedLines.find((line) => !line.success);
  if (invalidLine && !invalidLine.success) {
    redirectWithError(errorPath, invalidLine.error.issues[0]?.message ?? "Invalid order line.");
  }

  const lines = parsedLines.map((line) => {
    if (!line.success) {
      throw new Error("Invalid order line.");
    }

    return line.data;
  });

  return { header: parsedHeader.data, lines };
}

function parseReceiptLines(formData: FormData) {
  const lineIds = formValues(formData, "purchaseOrderLineId");
  const quantities = formValues(formData, "receiveQuantity");
  const serialNos = formValues(formData, "serialNo");
  const lotNos = formValues(formData, "lotNo");

  return lineIds
    .map((purchaseOrderLineId, index) =>
      receiptLineSchema.safeParse({
        purchaseOrderLineId,
        quantity: quantities[index] || "0",
        serialNo: serialNos[index] ?? "",
        lotNo: lotNos[index] ?? "",
      }),
    )
    .map((line) => {
      if (!line.success) {
        throw new Error(line.error.issues[0]?.message ?? "Invalid receipt line.");
      }

      return line.data;
    });
}

function movementNo(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function calculateTaxAmount(
  lineAmountMinor: number,
  quantity: number,
  tax: {
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
  taxRows: {
    id: string;
    computation: "percent" | "fixed";
    rate: string;
    amountMinor: number;
    priceIncluded: boolean;
  }[],
) {
  const lineTaxes = taxRows.map((tax) => ({
    taxId: tax.id,
    taxAmountMinor: calculateTaxAmount(lineAmountMinor, quantity, tax),
    priceIncluded: tax.priceIncluded,
  }));
  const includedTaxAmountMinor = lineTaxes
    .filter((tax) => tax.priceIncluded)
    .reduce((sum, tax) => sum + tax.taxAmountMinor, 0);
  const excludedTaxAmountMinor = lineTaxes
    .filter((tax) => !tax.priceIncluded)
    .reduce((sum, tax) => sum + tax.taxAmountMinor, 0);

  return {
    lineTaxes,
    taxAmountMinor: includedTaxAmountMinor + excludedTaxAmountMinor,
    subtotalMinor: Math.max(lineAmountMinor - includedTaxAmountMinor, 0),
    lineTotalMinor: lineAmountMinor + excludedTaxAmountMinor,
  };
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createPurchaseOrder(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const { header, lines } = parsePurchaseOrderForm(formData, "/admin/purchasing/new");
  const company = await getDefaultCompany();
  const orderNo = movementNo("PO");
  const reference = movementNo("REF");

  try {
    await db.transaction(async (tx) => {
      const uniqueProductIds = [...new Set(lines.map((line) => line.productId))];
      const uniqueTaxIds = [...new Set(lines.flatMap((line) => line.taxIds))];
      const productRows = await tx
        .select({
          id: products.id,
          unitId: products.unitId,
          currencyCode: products.currencyCode,
        })
        .from(products)
        .where(
          and(
            inArray(products.id, uniqueProductIds),
            eq(products.companyId, company.id),
            isNull(products.deletedAt),
            eq(products.isActive, true),
          ),
        );
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
                eq(taxes.companyId, company.id),
                isNull(taxes.deletedAt),
                eq(taxes.isActive, true),
                sql`${taxes.scope} in ('purchase', 'both')`,
              ),
            )
        : [];

      const [supplier] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(
          and(
            eq(partners.id, header.supplierId),
            eq(partners.companyId, company.id),
            eq(partners.isSupplier, true),
            isNull(partners.deletedAt),
          ),
        )
        .limit(1);

      if (!supplier) {
        throw new Error("Supplier is invalid.");
      }

      if (productRows.length !== uniqueProductIds.length) {
        throw new Error("One or more products are invalid.");
      }

      if (taxRows.length !== uniqueTaxIds.length) {
        throw new Error("One or more taxes are invalid.");
      }

      const productById = new Map(productRows.map((product) => [product.id, product]));
      const taxById = new Map(taxRows.map((tax) => [tax.id, tax]));
      const currencyCode = productRows[0]?.currencyCode ?? company.baseCurrencyCode;

      if (productRows.some((product) => product.currencyCode !== currencyCode)) {
        throw new Error("All purchase order lines must use the same currency.");
      }

      const preparedLines = lines.map((line, index) => {
        const product = productById.get(line.productId);

        if (!product) {
          throw new Error("Product is invalid.");
        }

        const unitCostMinor = majorToMinor(line.unitCost);
        const grossOrUntaxedMinor = Math.round(line.quantity * unitCostMinor);
        const selectedTaxes = line.taxIds.map((taxId) => taxById.get(taxId)).filter((tax): tax is NonNullable<typeof tax> => Boolean(tax));
        const { lineTaxes, taxAmountMinor, subtotalMinor, lineTotalMinor } = calculateLineTaxes(
          grossOrUntaxedMinor,
          line.quantity,
          selectedTaxes,
        );

        return {
          lineNo: index + 1,
          product,
          quantityOrdered: String(line.quantity),
          unitCostMinor,
          lineTaxes,
          taxAmountMinor,
          subtotalMinor,
          lineTotalMinor,
        };
      });
      const subtotalMinor = preparedLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
      const taxAmountMinor = preparedLines.reduce((sum, line) => sum + line.taxAmountMinor, 0);
      const totalMinor = preparedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          companyId: company.id,
          supplierId: supplier.id,
          orderNo,
          deliverToLocationId: header.deliverToLocationId,
          vendorReference: header.vendorReference || reference,
          paymentTerm: header.paymentTerm,
          status: "draft",
          expectedDate: header.expectedDate || null,
          currencyCode,
          subtotalMinor,
          taxAmountMinor,
          totalMinor,
          notes: header.notes || null,
          createdBy: user.id,
        })
        .returning({ id: purchaseOrders.id });

      const insertedLines = await tx
        .insert(purchaseOrderLines)
        .values(
          preparedLines.map((line) => ({
            purchaseOrderId: order.id,
            lineNo: line.lineNo,
            productId: line.product.id,
            unitId: line.product.unitId,
            quantityOrdered: line.quantityOrdered,
            unitCostMinor: line.unitCostMinor,
            taxAmountMinor: line.taxAmountMinor,
            lineTotalMinor: line.lineTotalMinor,
            currencyCode,
          })),
        )
        .returning({ id: purchaseOrderLines.id, lineNo: purchaseOrderLines.lineNo });

      const lineTaxes = preparedLines
        .flatMap((line) => {
          const insertedLine = insertedLines.find((record) => record.lineNo === line.lineNo);

          return insertedLine
            ? line.lineTaxes.map((lineTax) => ({
                purchaseOrderLineId: insertedLine.id,
                taxId: lineTax.taxId,
                taxAmountMinor: lineTax.taxAmountMinor,
              }))
            : [];
        })

      if (lineTaxes.length > 0) {
        await tx.insert(purchaseOrderLineTaxes).values(lineTaxes);
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "purchase_order.rfq_create",
        entityType: "purchase_order",
        entityId: order.id,
        severity: "info",
        metadata: { orderNo },
      });
    });
  } catch (error) {
    const message = uniqueViolationMessage(
      error,
      error instanceof Error ? error.message : "Could not create purchase order.",
    );
    redirectWithError("/admin/purchasing/new", message);
  }

  revalidatePath("/admin/purchasing");
  redirect("/admin/purchasing?notice=RFQ created");
}

export async function updatePurchaseOrder(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const purchaseOrderId = formValue(formData, "purchaseOrderId");
  const errorPath = purchaseOrderId ? `/admin/purchasing/${purchaseOrderId}` : "/admin/purchasing";
  const { header, lines } = parsePurchaseOrderForm(formData, errorPath);

  if (!header.purchaseOrderId) {
    redirectWithError("/admin/purchasing", "Purchase order ID is required.");
  }

  const orderId = header.purchaseOrderId;
  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [existingOrder] = await tx
        .select({
          id: purchaseOrders.id,
          orderNo: purchaseOrders.orderNo,
          status: purchaseOrders.status,
        })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.id, orderId),
            eq(purchaseOrders.companyId, company.id),
            isNull(purchaseOrders.deletedAt),
          ),
        )
        .limit(1);

      if (!existingOrder) {
        throw new Error("Purchase order does not exist.");
      }

      if (existingOrder.status !== "draft") {
        throw new Error("Only draft RFQs can be edited.");
      }

      const uniqueProductIds = [...new Set(lines.map((line) => line.productId))];
      const uniqueTaxIds = [...new Set(lines.flatMap((line) => line.taxIds))];
      const productRows = await tx
        .select({
          id: products.id,
          unitId: products.unitId,
          currencyCode: products.currencyCode,
        })
        .from(products)
        .where(
          and(
            inArray(products.id, uniqueProductIds),
            eq(products.companyId, company.id),
            isNull(products.deletedAt),
            eq(products.isActive, true),
          ),
        );
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
                eq(taxes.companyId, company.id),
                isNull(taxes.deletedAt),
                eq(taxes.isActive, true),
                sql`${taxes.scope} in ('purchase', 'both')`,
              ),
            )
        : [];

      const [supplier] = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(
          and(
            eq(partners.id, header.supplierId),
            eq(partners.companyId, company.id),
            eq(partners.isSupplier, true),
            isNull(partners.deletedAt),
          ),
        )
        .limit(1);

      if (!supplier) {
        throw new Error("Supplier is invalid.");
      }

      if (productRows.length !== uniqueProductIds.length) {
        throw new Error("One or more products are invalid.");
      }

      if (taxRows.length !== uniqueTaxIds.length) {
        throw new Error("One or more taxes are invalid.");
      }

      const productById = new Map(productRows.map((product) => [product.id, product]));
      const taxById = new Map(taxRows.map((tax) => [tax.id, tax]));
      const currencyCode = productRows[0]?.currencyCode ?? company.baseCurrencyCode;

      if (productRows.some((product) => product.currencyCode !== currencyCode)) {
        throw new Error("All purchase order lines must use the same currency.");
      }

      const preparedLines = lines.map((line, index) => {
        const product = productById.get(line.productId);

        if (!product) {
          throw new Error("Product is invalid.");
        }

        const unitCostMinor = majorToMinor(line.unitCost);
        const grossOrUntaxedMinor = Math.round(line.quantity * unitCostMinor);
        const selectedTaxes = line.taxIds.map((taxId) => taxById.get(taxId)).filter((tax): tax is NonNullable<typeof tax> => Boolean(tax));
        const { lineTaxes, taxAmountMinor, subtotalMinor, lineTotalMinor } = calculateLineTaxes(
          grossOrUntaxedMinor,
          line.quantity,
          selectedTaxes,
        );

        return {
          lineNo: index + 1,
          product,
          quantityOrdered: String(line.quantity),
          unitCostMinor,
          lineTaxes,
          taxAmountMinor,
          subtotalMinor,
          lineTotalMinor,
        };
      });
      const subtotalMinor = preparedLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
      const taxAmountMinor = preparedLines.reduce((sum, line) => sum + line.taxAmountMinor, 0);
      const totalMinor = preparedLines.reduce((sum, line) => sum + line.lineTotalMinor, 0);

      const existingLines = await tx
        .select({ id: purchaseOrderLines.id })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.purchaseOrderId, existingOrder.id));
      const existingLineIds = existingLines.map((line) => line.id);

      if (existingLineIds.length > 0) {
        await tx.delete(purchaseOrderLineTaxes).where(inArray(purchaseOrderLineTaxes.purchaseOrderLineId, existingLineIds));
        await tx.delete(purchaseOrderLines).where(inArray(purchaseOrderLines.id, existingLineIds));
      }

      await tx
        .update(purchaseOrders)
        .set({
          supplierId: supplier.id,
          deliverToLocationId: header.deliverToLocationId,
          paymentTerm: header.paymentTerm,
          expectedDate: header.expectedDate || null,
          currencyCode,
          subtotalMinor,
          taxAmountMinor,
          totalMinor,
          notes: header.notes || null,
          updatedAt: sql`now()`,
        })
        .where(eq(purchaseOrders.id, existingOrder.id));

      const insertedLines = await tx
        .insert(purchaseOrderLines)
        .values(
          preparedLines.map((line) => ({
            purchaseOrderId: existingOrder.id,
            lineNo: line.lineNo,
            productId: line.product.id,
            unitId: line.product.unitId,
            quantityOrdered: line.quantityOrdered,
            unitCostMinor: line.unitCostMinor,
            taxAmountMinor: line.taxAmountMinor,
            lineTotalMinor: line.lineTotalMinor,
            currencyCode,
          })),
        )
        .returning({ id: purchaseOrderLines.id, lineNo: purchaseOrderLines.lineNo });

      const lineTaxes = preparedLines
        .flatMap((line) => {
          const insertedLine = insertedLines.find((record) => record.lineNo === line.lineNo);

          return insertedLine
            ? line.lineTaxes.map((lineTax) => ({
                purchaseOrderLineId: insertedLine.id,
                taxId: lineTax.taxId,
                taxAmountMinor: lineTax.taxAmountMinor,
              }))
            : [];
        })

      if (lineTaxes.length > 0) {
        await tx.insert(purchaseOrderLineTaxes).values(lineTaxes);
      }

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "purchase_order.rfq_update",
        entityType: "purchase_order",
        entityId: existingOrder.id,
        severity: "info",
        metadata: { orderNo: existingOrder.orderNo },
      });
    });
  } catch (error) {
    const message = uniqueViolationMessage(
      error,
      error instanceof Error ? error.message : "Could not update purchase order.",
    );
    redirectWithError(errorPath, message);
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${orderId}`);
  redirect(`/admin/purchasing/${orderId}?notice=RFQ updated`);
}

export async function confirmPurchaseOrder(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = confirmSchema.safeParse({
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    returnPath: formValue(formData, "returnPath") || undefined,
  });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing", "Purchase order ID is required.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: purchaseOrders.id,
        orderNo: purchaseOrders.orderNo,
        supplierId: purchaseOrders.supplierId,
        deliverToLocationId: purchaseOrders.deliverToLocationId,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, parsed.data.purchaseOrderId),
          eq(purchaseOrders.companyId, company.id),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .limit(1);

    if (!order) {
      throw new Error("Purchase order does not exist.");
    }

    if (order.status !== "draft") {
      return;
    }

    if (!order.deliverToLocationId) {
      throw new Error("Select a receiving location before confirming the purchase order.");
    }

    await tx
      .update(purchaseOrders)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedBy: user.id,
        updatedAt: sql`now()`,
      })
      .where(eq(purchaseOrders.id, order.id));

    const [existingReceipt] = await tx
      .select({ id: goodsReceipts.id })
      .from(goodsReceipts)
      .where(and(eq(goodsReceipts.purchaseOrderId, order.id), isNull(goodsReceipts.deletedAt)))
      .limit(1);

    if (!existingReceipt) {
      const receiptNo = movementNo("GR");

      const [receipt] = await tx
        .insert(goodsReceipts)
        .values({
          companyId: company.id,
          purchaseOrderId: order.id,
          supplierId: order.supplierId,
          locationId: order.deliverToLocationId,
          receiptNo,
          status: "draft",
          notes: `Draft receipt generated from ${order.orderNo}.`,
        })
        .returning({ id: goodsReceipts.id });

      const expectedLines = await tx
        .select({
          id: purchaseOrderLines.id,
          lineNo: purchaseOrderLines.lineNo,
          productId: purchaseOrderLines.productId,
          unitId: purchaseOrderLines.unitId,
          quantityOrdered: purchaseOrderLines.quantityOrdered,
          quantityReceived: purchaseOrderLines.quantityReceived,
          unitCostMinor: purchaseOrderLines.unitCostMinor,
          currencyCode: purchaseOrderLines.currencyCode,
        })
        .from(purchaseOrderLines)
        .where(and(eq(purchaseOrderLines.purchaseOrderId, order.id), isNull(purchaseOrderLines.deletedAt)))
        .orderBy(purchaseOrderLines.lineNo);

      const receiptLines = expectedLines
        .map((line) => {
          const quantityRemaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
          return {
            goodsReceiptId: receipt.id,
            purchaseOrderLineId: line.id,
            lineNo: line.lineNo,
            productId: line.productId,
            unitId: line.unitId,
            quantityReceived: String(quantityRemaining),
            unitCostMinor: line.unitCostMinor,
            landedUnitCostMinor: line.unitCostMinor,
            lineTotalMinor: Math.round(quantityRemaining * line.unitCostMinor),
            currencyCode: line.currencyCode,
          };
        })
        .filter((line) => Number(line.quantityReceived) > 0);

      if (receiptLines.length > 0) {
        await tx.insert(goodsReceiptLines).values(receiptLines);
      }
    }

    await tx.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "purchase_order.confirm",
      entityType: "purchase_order",
      entityId: order.id,
      severity: "info",
      metadata: { orderNo: order.orderNo },
    });
    });
  } catch (error) {
    redirectWithError(
      parsed.data.returnPath ?? `/admin/purchasing/${parsed.data.purchaseOrderId}`,
      error instanceof Error ? error.message : "Could not confirm purchase order.",
    );
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${parsed.data.purchaseOrderId}`);
  redirect(`${parsed.data.returnPath ?? "/admin/purchasing"}?notice=Purchase order confirmed`);
}

export async function postGoodsReceipt(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = receiptSchema.safeParse({
    purchaseOrderId: formValue(formData, "purchaseOrderId"),
    locationId: formValue(formData, "locationId"),
    supplierInvoiceNo: formValue(formData, "supplierInvoiceNo"),
  });
  const receiptInputLines = parseReceiptLines(formData).filter((line) => line.quantity > 0);

  if (!parsed.success) {
    redirectWithError("/admin/purchasing", "Purchase order and receiving location are required.");
  }

  if (receiptInputLines.length === 0) {
    redirectWithError(`/admin/purchasing/${formValue(formData, "purchaseOrderId")}`, "At least one receipt line quantity is required.");
  }

  const company = await getDefaultCompany();
  const supplierLocation = await getOrCreatePartnerStockLocation(company.id, "supplier");
  let receiptNo = movementNo("GR");
  const stockMoveNo = movementNo("PR");
  let postedReceiptId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: purchaseOrders.id,
          supplierId: purchaseOrders.supplierId,
          orderNo: purchaseOrders.orderNo,
          status: purchaseOrders.status,
          currencyCode: purchaseOrders.currencyCode,
        })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, parsed.data.purchaseOrderId), eq(purchaseOrders.companyId, company.id), isNull(purchaseOrders.deletedAt)))
        .limit(1);

      if (!order) {
        throw new Error("Purchase order does not exist.");
      }

      if (order.status !== "confirmed" && order.status !== "partially_received") {
        throw new Error("Confirm the RFQ before receiving products.");
      }

      const lines = await getPurchaseOrderReceiptLines(order.id);
      const receiptInputsByLineId = new Map<string, typeof receiptInputLines>();
      for (const line of receiptInputLines) {
        receiptInputsByLineId.set(line.purchaseOrderLineId, [
          ...(receiptInputsByLineId.get(line.purchaseOrderLineId) ?? []),
          line,
        ]);
      }

      if (lines.length === 0) {
        throw new Error("Purchase order has no lines to receive.");
      }

      const selectedLines = lines.filter((line) => receiptInputsByLineId.has(line.id));

      if (selectedLines.length !== receiptInputsByLineId.size) {
        throw new Error("One or more receipt lines are invalid.");
      }

      for (const line of selectedLines) {
        const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
        const inputs = receiptInputsByLineId.get(line.id) ?? [];
        const totalQuantity = inputs.reduce((sum, input) => sum + input.quantity, 0);

        if (totalQuantity > remaining) {
          throw new Error(`Receipt quantity for ${line.sku} is greater than the remaining quantity.`);
        }

        for (const inputLine of inputs) {
          if (line.trackingMode === "serial" && (!inputLine.serialNo || inputLine.quantity !== 1)) {
            throw new Error(`Serialized product ${line.sku} requires quantity 1 and a serial number.`);
          }

          if (line.trackingMode === "lot" && !inputLine.lotNo) {
            throw new Error(`Lot tracked product ${line.sku} requires a lot number.`);
          }
        }
      }

      const [draftReceipt] = await tx
        .select({ id: goodsReceipts.id, receiptNo: goodsReceipts.receiptNo })
        .from(goodsReceipts)
        .where(and(eq(goodsReceipts.purchaseOrderId, order.id), eq(goodsReceipts.status, "draft"), isNull(goodsReceipts.deletedAt)))
        .limit(1);

      if (draftReceipt) {
        receiptNo = draftReceipt.receiptNo;
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo: stockMoveNo,
          movementType: "purchase_receipt",
          status: "posted",
          fromLocationId: supplierLocation.id,
          toLocationId: parsed.data.locationId,
          sourceType: "goods_receipt",
          sourceNo: receiptNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: `Goods receipt ${receiptNo}`,
        })
        .returning({ id: stockMovements.id });

      const [receipt] = draftReceipt
        ? await tx
            .update(goodsReceipts)
            .set({
              locationId: parsed.data.locationId,
              status: "posted",
              postedAt: new Date(),
              postedBy: user.id,
              stockMovementId: movement.id,
              supplierInvoiceNo: parsed.data.supplierInvoiceNo || null,
              updatedAt: sql`now()`,
            })
            .where(eq(goodsReceipts.id, draftReceipt.id))
            .returning({ id: goodsReceipts.id })
        : await tx
            .insert(goodsReceipts)
            .values({
              companyId: company.id,
              purchaseOrderId: order.id,
              supplierId: order.supplierId,
              locationId: parsed.data.locationId,
              receiptNo,
              status: "posted",
              postedAt: new Date(),
              postedBy: user.id,
              stockMovementId: movement.id,
              supplierInvoiceNo: parsed.data.supplierInvoiceNo || null,
            })
            .returning({ id: goodsReceipts.id });
      postedReceiptId = receipt.id;

      if (draftReceipt) {
        await tx.delete(goodsReceiptLines).where(eq(goodsReceiptLines.goodsReceiptId, draftReceipt.id));
      }

      let receiptLineNo = 1;
      for (const line of selectedLines) {
        const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
        const inputLines = receiptInputsByLineId.get(line.id) ?? [];
        const totalReceivedForLine = inputLines.reduce((sum, inputLine) => sum + inputLine.quantity, 0);

        if (remaining <= 0 || totalReceivedForLine <= 0) {
          continue;
        }

        for (const inputLine of inputLines) {
          const receiveQuantity = inputLine.quantity;
          if (receiveQuantity <= 0) {
            continue;
          }

        let productSerialId: string | null = null;
        let productLotId: string | null = null;

        if (line.trackingMode === "serial" && inputLine?.serialNo) {
          const [createdSerial] = await tx
            .insert(productSerials)
            .values({
              productId: line.productId,
              serialNo: inputLine.serialNo,
              status: "available",
              currentLocationId: parsed.data.locationId,
              landedUnitCostMinor: line.unitCostMinor,
            })
            .returning({ id: productSerials.id });

          productSerialId = createdSerial.id;
        }

        if (line.trackingMode === "lot" && inputLine?.lotNo) {
          const [existingLot] = await tx
            .select({ id: productLots.id })
            .from(productLots)
            .where(and(eq(productLots.productId, line.productId), eq(productLots.lotNo, inputLine.lotNo), isNull(productLots.deletedAt)))
            .limit(1);

          if (existingLot) {
            productLotId = existingLot.id;
            await tx
              .update(productLots)
              .set({
                status: "available",
                currentLocationId: parsed.data.locationId,
                landedUnitCostMinor: line.unitCostMinor,
                updatedAt: sql`now()`,
              })
              .where(eq(productLots.id, existingLot.id));
          } else {
            const [createdLot] = await tx
              .insert(productLots)
              .values({
                productId: line.productId,
                lotNo: inputLine.lotNo,
                status: "available",
                currentLocationId: parsed.data.locationId,
                landedUnitCostMinor: line.unitCostMinor,
              })
              .returning({ id: productLots.id });

            productLotId = createdLot.id;
          }
        }

        const lineTotalMinor = Math.round(receiveQuantity * line.unitCostMinor);

        await tx.insert(goodsReceiptLines).values({
          goodsReceiptId: receipt.id,
          purchaseOrderLineId: line.id,
          lineNo: receiptLineNo,
          productId: line.productId,
          productSerialId,
          productLotId,
          unitId: line.unitId,
          quantityReceived: String(receiveQuantity),
          unitCostMinor: line.unitCostMinor,
          landedUnitCostMinor: line.unitCostMinor,
          lineTotalMinor,
          currencyCode: line.currencyCode,
          serialNo: inputLine?.serialNo || null,
          lotNo: inputLine?.lotNo || null,
        });

        await tx.insert(stockMovementLines).values({
          stockMovementId: movement.id,
          lineNo: receiptLineNo,
          productId: line.productId,
          productSerialId,
          productLotId,
          fromLocationId: supplierLocation.id,
          toLocationId: parsed.data.locationId,
          unitId: line.unitId,
          quantity: String(receiveQuantity),
          unitCostMinor: line.unitCostMinor,
          totalCostMinor: lineTotalMinor,
          currencyCode: line.currencyCode,
          notes: `Received from ${order.orderNo}`,
        });
        receiptLineNo += 1;

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
          })
          .from(stockBalances)
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, parsed.data.locationId),
              eq(stockBalances.productId, line.productId),
              serialFilter,
              lotFilter,
              isNull(stockBalances.deletedAt),
            ),
          )
          .limit(1);

        if (balance) {
          const nextOnHand = Number(balance.quantityOnHand) + receiveQuantity;
          const nextAvailable = nextOnHand - Number(balance.quantityReserved);
          await tx
            .update(stockBalances)
            .set({
              quantityOnHand: String(nextOnHand),
              quantityAvailable: String(nextAvailable),
              averageCostMinor: line.unitCostMinor,
              lastMovementAt: new Date(),
              updatedAt: sql`now()`,
            })
            .where(eq(stockBalances.id, balance.id));
        } else {
          await tx.insert(stockBalances).values({
            companyId: company.id,
            locationId: parsed.data.locationId,
            productId: line.productId,
            productSerialId,
            productLotId,
            quantityOnHand: String(receiveQuantity),
            quantityReserved: "0",
            quantityAvailable: String(receiveQuantity),
            averageCostMinor: line.unitCostMinor,
            currencyCode: line.currencyCode,
            lastMovementAt: new Date(),
          });
        }

        }

        await tx
          .update(purchaseOrderLines)
          .set({
            quantityReceived: String(Number(line.quantityReceived) + totalReceivedForLine),
            updatedAt: sql`now()`,
          })
          .where(eq(purchaseOrderLines.id, line.id));
      }

      const allReceived = lines.every((line) => {
        const inputLines = receiptInputsByLineId.get(line.id) ?? [];
        const receivedNow = inputLines.reduce((sum, inputLine) => sum + inputLine.quantity, 0);

        return Number(line.quantityReceived) + receivedNow >= Number(line.quantityOrdered);
      });

      await tx
        .update(purchaseOrders)
        .set({
          status: allReceived ? "received" : "partially_received",
          updatedAt: sql`now()`,
        })
        .where(eq(purchaseOrders.id, order.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "goods_receipt.post",
        entityType: "goods_receipt",
        entityId: receipt.id,
        severity: "info",
        metadata: { receiptNo, orderNo: order.orderNo, stockMoveNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/${parsed.success ? parsed.data.purchaseOrderId : ""}`, error instanceof Error ? error.message : "Could not post receipt.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${parsed.data.purchaseOrderId}`);
  revalidatePath("/admin/inventory");
  redirect(`/admin/purchasing/receipts/${postedReceiptId}?notice=${encodeURIComponent(`Receipt ${receiptNo} posted`)}`);
}

async function createVendorBill(
  source: "receipt" | "purchase_order",
  sourceId: string,
  userId: string,
) {
  const company = await getDefaultCompany();
  let createdBillId: string | undefined;

  await db.transaction(async (tx) => {
    const receiptFilter = source === "receipt" ? eq(goodsReceipts.id, sourceId) : undefined;
    const orderFilter = source === "purchase_order" ? eq(purchaseOrders.id, sourceId) : undefined;

    const [document] = await tx
      .select({
        purchaseOrderId: purchaseOrders.id,
        orderNo: purchaseOrders.orderNo,
        supplierId: purchaseOrders.supplierId,
        supplierInvoiceNo: goodsReceipts.supplierInvoiceNo,
        goodsReceiptId: goodsReceipts.id,
        status: purchaseOrders.status,
        currencyCode: purchaseOrders.currencyCode,
      })
      .from(purchaseOrders)
      .leftJoin(goodsReceipts, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
      .where(
        and(
          eq(purchaseOrders.companyId, company.id),
          isNull(purchaseOrders.deletedAt),
          source === "receipt" ? receiptFilter : orderFilter,
          source === "receipt" ? isNull(goodsReceipts.deletedAt) : undefined,
        ),
      )
      .limit(1);

    if (!document) {
      throw new Error(source === "receipt" ? "Receipt does not exist." : "Purchase order does not exist.");
    }

    if (source === "purchase_order" && document.status === "draft") {
      throw new Error("Confirm the purchase order before creating a vendor bill.");
    }

    const [existingBill] = await tx
      .select({ id: vendorBills.id })
      .from(vendorBills)
      .where(
        and(
          eq(vendorBills.companyId, company.id),
          source === "receipt"
            ? eq(vendorBills.goodsReceiptId, sourceId)
            : and(eq(vendorBills.purchaseOrderId, sourceId), isNull(vendorBills.goodsReceiptId)),
          isNull(vendorBills.deletedAt),
        ),
      )
      .limit(1);

    if (existingBill) {
      createdBillId = existingBill.id;
      return;
    }

    const sourceLines =
      source === "receipt"
        ? await tx
            .select({
              lineNo: goodsReceiptLines.lineNo,
              purchaseOrderLineId: goodsReceiptLines.purchaseOrderLineId,
              goodsReceiptLineId: goodsReceiptLines.id,
              productId: goodsReceiptLines.productId,
              productName: products.name,
              unitId: goodsReceiptLines.unitId,
              quantity: goodsReceiptLines.quantityReceived,
              unitCostMinor: goodsReceiptLines.unitCostMinor,
              currencyCode: goodsReceiptLines.currencyCode,
            })
            .from(goodsReceiptLines)
            .innerJoin(products, eq(goodsReceiptLines.productId, products.id))
            .where(and(eq(goodsReceiptLines.goodsReceiptId, sourceId), isNull(goodsReceiptLines.deletedAt)))
            .orderBy(sql`${goodsReceiptLines.lineNo}`)
        : await tx
            .select({
              lineNo: purchaseOrderLines.lineNo,
              purchaseOrderLineId: purchaseOrderLines.id,
              goodsReceiptLineId: sql<string | null>`null`,
              productId: purchaseOrderLines.productId,
              productName: products.name,
              unitId: purchaseOrderLines.unitId,
              quantity: purchaseOrderLines.quantityOrdered,
              unitCostMinor: purchaseOrderLines.unitCostMinor,
              currencyCode: purchaseOrderLines.currencyCode,
            })
            .from(purchaseOrderLines)
            .innerJoin(products, eq(purchaseOrderLines.productId, products.id))
            .where(and(eq(purchaseOrderLines.purchaseOrderId, sourceId), isNull(purchaseOrderLines.deletedAt)))
            .orderBy(sql`${purchaseOrderLines.lineNo}`);

    if (sourceLines.length === 0) {
      throw new Error("There are no billable lines.");
    }

    const purchaseOrderLineIds = sourceLines
      .map((line) => line.purchaseOrderLineId)
      .filter((lineId): lineId is string => Boolean(lineId));
    const sourceLineTaxRows = purchaseOrderLineIds.length
      ? await tx
          .select({
            purchaseOrderLineId: purchaseOrderLineTaxes.purchaseOrderLineId,
            taxId: taxes.id,
            computation: taxes.computation,
            rate: taxes.rate,
            amountMinor: taxes.amountMinor,
            priceIncluded: taxes.priceIncluded,
          })
          .from(purchaseOrderLineTaxes)
          .innerJoin(taxes, eq(purchaseOrderLineTaxes.taxId, taxes.id))
          .where(inArray(purchaseOrderLineTaxes.purchaseOrderLineId, purchaseOrderLineIds))
      : [];
    const taxesByPurchaseLineId = new Map<string, typeof sourceLineTaxRows>();
    for (const taxRow of sourceLineTaxRows) {
      const current = taxesByPurchaseLineId.get(taxRow.purchaseOrderLineId) ?? [];
      current.push(taxRow);
      taxesByPurchaseLineId.set(taxRow.purchaseOrderLineId, current);
    }

    const preparedLines = sourceLines.map((line) => {
      const quantity = Number(line.quantity);
      const grossOrUntaxedMinor = Math.round(quantity * line.unitCostMinor);
      const selectedTaxes = line.purchaseOrderLineId
        ? (taxesByPurchaseLineId.get(line.purchaseOrderLineId) ?? []).map((tax) => ({
            id: tax.taxId,
            computation: tax.computation,
            rate: tax.rate,
            amountMinor: tax.amountMinor,
            priceIncluded: tax.priceIncluded,
          }))
        : [];
      const { lineTaxes, taxAmountMinor, subtotalMinor, lineTotalMinor } = calculateLineTaxes(
        grossOrUntaxedMinor,
        quantity,
        selectedTaxes,
      );

      return {
        ...line,
        quantity: String(quantity),
        lineTaxes,
        subtotalMinor,
        taxAmountMinor,
        totalMinor: lineTotalMinor,
      };
    });
    const untaxedAmountMinor = preparedLines.reduce((sum, line) => sum + line.subtotalMinor, 0);
    const taxAmountMinor = preparedLines.reduce((sum, line) => sum + line.taxAmountMinor, 0);
    const totalMinor = preparedLines.reduce((sum, line) => sum + line.totalMinor, 0);
    const billNo =
      source === "receipt" && document.supplierInvoiceNo
        ? document.supplierInvoiceNo
        : movementNo(source === "receipt" ? "VB-GR" : "VB-PO");

    const [bill] = await tx
      .insert(vendorBills)
      .values({
        companyId: company.id,
        supplierId: document.supplierId,
        purchaseOrderId: document.purchaseOrderId,
        goodsReceiptId: source === "receipt" ? sourceId : null,
        billNo,
        vendorReference: source === "receipt" ? document.supplierInvoiceNo || null : null,
        status: "draft",
        paymentStatus: "not_paid",
        untaxedAmountMinor,
        taxAmountMinor,
        totalMinor,
        currencyCode: document.currencyCode,
        notes: source === "receipt" ? "Created from goods receipt." : "Created from purchase order.",
      })
      .returning({ id: vendorBills.id });
    createdBillId = bill.id;

    const insertedLines = await tx
      .insert(vendorBillLines)
      .values(
        preparedLines.map((line) => ({
          vendorBillId: bill.id,
          purchaseOrderLineId: line.purchaseOrderLineId,
          goodsReceiptLineId: line.goodsReceiptLineId,
          lineNo: line.lineNo,
          productId: line.productId,
          description: line.productName,
          unitId: line.unitId,
          quantity: line.quantity,
          unitPriceMinor: line.unitCostMinor,
          subtotalMinor: line.subtotalMinor,
          taxAmountMinor: line.taxAmountMinor,
          totalMinor: line.totalMinor,
          currencyCode: line.currencyCode,
        })),
      )
      .returning({ id: vendorBillLines.id, lineNo: vendorBillLines.lineNo });

    const billLineTaxes = preparedLines
      .flatMap((line) => {
        const insertedLine = insertedLines.find((record) => record.lineNo === line.lineNo);

        return insertedLine
          ? line.lineTaxes.map((lineTax) => ({
              vendorBillLineId: insertedLine.id,
              taxId: lineTax.taxId,
              taxAmountMinor: lineTax.taxAmountMinor,
            }))
          : [];
      })

    if (billLineTaxes.length > 0) {
      await tx.insert(vendorBillLineTaxes).values(billLineTaxes);
    }

    await tx.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: userId,
      action: "vendor_bill.create",
      entityType: "vendor_bill",
      entityId: bill.id,
      severity: "info",
      metadata: { source, orderNo: document.orderNo, billNo },
    });
  });

  if (!createdBillId) {
    throw new Error("Could not create vendor bill.");
  }

  return createdBillId;
}

export async function createVendorBillFromReceipt(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = receiptDocumentSchema.safeParse({ receiptId: formValue(formData, "receiptId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=receipts", "Receipt ID is required.");
  }

  let billId: string;
  try {
    billId = await createVendorBill("receipt", parsed.data.receiptId, user.id);
  } catch (error) {
    redirectWithError(`/admin/purchasing/receipts/${parsed.data.receiptId}`, error instanceof Error ? error.message : "Could not create vendor bill.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/receipts/${parsed.data.receiptId}`);
  redirect(`/admin/purchasing/vendor-bills/vendor_bill/${billId}?notice=${encodeURIComponent("Vendor bill is ready for review")}`);
}

export async function createVendorBillFromPurchaseOrder(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = purchaseOrderDocumentSchema.safeParse({ purchaseOrderId: formValue(formData, "purchaseOrderId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing", "Purchase order ID is required.");
  }

  let billId: string;
  try {
    billId = await createVendorBill("purchase_order", parsed.data.purchaseOrderId, user.id);
  } catch (error) {
    redirectWithError(`/admin/purchasing/${parsed.data.purchaseOrderId}`, error instanceof Error ? error.message : "Could not create vendor bill.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/${parsed.data.purchaseOrderId}`);
  redirect(`/admin/purchasing/vendor-bills/vendor_bill/${billId}?notice=${encodeURIComponent("Vendor bill is ready for review")}`);
}

export async function postVendorBill(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = vendorBillStatusSchema.safeParse({ vendorBillId: formValue(formData, "vendorBillId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=supplier-bills", "Vendor bill ID is required.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [bill] = await tx
        .select({
          id: vendorBills.id,
          status: vendorBills.status,
          totalMinor: vendorBills.totalMinor,
          purchaseOrderId: vendorBills.purchaseOrderId,
        })
        .from(vendorBills)
        .where(and(eq(vendorBills.id, parsed.data.vendorBillId), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
        .limit(1);

      if (!bill) {
        throw new Error("Vendor bill does not exist.");
      }

      if (bill.status !== "draft") {
        return;
      }

      if (bill.totalMinor <= 0) {
        throw new Error("Vendor bill total must be greater than zero before posting.");
      }

      await tx
        .update(vendorBills)
        .set({
          status: "posted",
          paymentStatus: "not_paid",
          postedAt: new Date(),
          postedBy: user.id,
          updatedAt: sql`now()`,
        })
        .where(eq(vendorBills.id, bill.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "vendor_bill.post",
        entityType: "vendor_bill",
        entityId: bill.id,
        severity: "info",
        metadata: { purchaseOrderId: bill.purchaseOrderId },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`, error instanceof Error ? error.message : "Could not post vendor bill.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`);
  redirect(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}?notice=${encodeURIComponent("Vendor bill posted and ready for payment")}`);
}

export async function cancelVendorBill(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = vendorBillStatusSchema.safeParse({ vendorBillId: formValue(formData, "vendorBillId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=supplier-bills", "Vendor bill ID is required.");
  }

  const company = await getDefaultCompany();

  await db.transaction(async (tx) => {
    const [bill] = await tx
      .select({ id: vendorBills.id, status: vendorBills.status })
      .from(vendorBills)
      .where(and(eq(vendorBills.id, parsed.data.vendorBillId), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
      .limit(1);

    if (!bill || bill.status === "cancelled") {
      return;
    }

    await tx
      .update(vendorBills)
      .set({
        status: "cancelled",
        paymentStatus: "not_paid",
        postedAt: null,
        postedBy: null,
        updatedAt: sql`now()`,
      })
      .where(eq(vendorBills.id, bill.id));

    await tx.insert(auditLogs).values({
      companyId: company.id,
      actorUserId: user.id,
      action: "vendor_bill.cancel",
      entityType: "vendor_bill",
      entityId: bill.id,
      severity: "warning",
      metadata: {},
    });
  });

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}`);
  redirect(`/admin/purchasing/vendor-bills/vendor_bill/${parsed.data.vendorBillId}?notice=${encodeURIComponent("Vendor bill cancelled")}`);
}

function allocateLandedCost(
  amountMinor: number,
  lines: { id: string; quantityReceived: string; lineTotalMinor: number }[],
  method: "quantity" | "value",
) {
  const basisValues = lines.map((line) => {
    if (method === "quantity") {
      return Number(line.quantityReceived);
    }

    return line.lineTotalMinor;
  });
  const totalBasis = basisValues.reduce((sum, value) => sum + value, 0);

  if (totalBasis <= 0) {
    throw new Error("Receipt lines do not have a valid allocation basis.");
  }

  let allocatedTotal = 0;
  const allocations = lines.map((line, index) => {
    const isLast = index === lines.length - 1;
    const allocatedAmountMinor = isLast
      ? amountMinor - allocatedTotal
      : Math.floor((amountMinor * basisValues[index]) / totalBasis);
    allocatedTotal += allocatedAmountMinor;

    return {
      goodsReceiptLineId: line.id,
      allocatedAmountMinor,
      allocationBasis: basisValues[index].toFixed(6),
    };
  });

  return allocations;
}

function parseManualLandedCostAllocations(formData: FormData) {
  const lineIds = formValues(formData, "manualGoodsReceiptLineId");
  const amounts = formValues(formData, "manualAllocationAmount");

  return lineIds.map((lineId, index) => ({
    goodsReceiptLineId: lineId,
    allocatedAmountMinor: majorToMinor(amounts[index] ?? "0"),
  }));
}

function allocateManualLandedCost(
  amountMinor: number,
  lines: { id: string }[],
  manualAllocations: { goodsReceiptLineId: string; allocatedAmountMinor: number }[],
) {
  if (manualAllocations.length === 0) {
    throw new Error("Manual allocation requires receipt line amounts.");
  }

  const validLineIds = new Set(lines.map((line) => line.id));
  const allocations = manualAllocations.map((allocation) => {
    if (!validLineIds.has(allocation.goodsReceiptLineId)) {
      throw new Error("Manual allocation contains a line outside the selected receipt.");
    }

    if (allocation.allocatedAmountMinor < 0) {
      throw new Error("Manual allocation amounts cannot be negative.");
    }

    return {
      goodsReceiptLineId: allocation.goodsReceiptLineId,
      allocatedAmountMinor: allocation.allocatedAmountMinor,
      allocationBasis: allocation.allocatedAmountMinor.toFixed(6),
    };
  });
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.allocatedAmountMinor, 0);

  if (allocatedTotal !== amountMinor) {
    throw new Error("Manual allocation total must equal landed cost amount.");
  }

  if (allocatedTotal <= 0) {
    throw new Error("Manual allocation must allocate a positive amount.");
  }

  return allocations;
}

export async function createLandedCost(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = landedCostSchema.safeParse({
    goodsReceiptId: formValue(formData, "goodsReceiptId"),
    costType: formValue(formData, "costType"),
    allocationMethod: formValue(formData, "allocationMethod"),
    amount: formValue(formData, "amount"),
    vendorId: formValue(formData, "vendorId"),
    notes: formValue(formData, "notes"),
  });
  const manualAllocations = parseManualLandedCostAllocations(formData);

  if (!parsed.success) {
    redirectWithError("/admin/purchasing/landed-costs/new", parsed.error.issues[0]?.message ?? "Invalid landed cost.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError("/admin/purchasing/landed-costs/new", "Landed cost amount must be greater than zero.");
  }

  const company = await getDefaultCompany();
  const costNo = movementNo("LC");
  let landedCostId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [receipt] = await tx
        .select({
          id: goodsReceipts.id,
          purchaseOrderId: goodsReceipts.purchaseOrderId,
          status: goodsReceipts.status,
          currencyCode: purchaseOrders.currencyCode,
        })
        .from(goodsReceipts)
        .innerJoin(purchaseOrders, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
        .where(and(eq(goodsReceipts.id, parsed.data.goodsReceiptId), eq(goodsReceipts.companyId, company.id), isNull(goodsReceipts.deletedAt)))
        .limit(1);

      if (!receipt || receipt.status !== "posted") {
        throw new Error("Select a posted goods receipt.");
      }

      const receiptLines = await tx
        .select({
          id: goodsReceiptLines.id,
          quantityReceived: goodsReceiptLines.quantityReceived,
          lineTotalMinor: goodsReceiptLines.lineTotalMinor,
        })
        .from(goodsReceiptLines)
        .where(and(eq(goodsReceiptLines.goodsReceiptId, receipt.id), isNull(goodsReceiptLines.deletedAt)));

      if (receiptLines.length === 0) {
        throw new Error("Receipt has no lines to allocate.");
      }

      const allocations =
        parsed.data.allocationMethod === "manual"
          ? allocateManualLandedCost(amountMinor, receiptLines, manualAllocations)
          : allocateLandedCost(amountMinor, receiptLines, parsed.data.allocationMethod);
      const [cost] = await tx
        .insert(landedCosts)
        .values({
          companyId: company.id,
          purchaseOrderId: receipt.purchaseOrderId,
          goodsReceiptId: receipt.id,
          costNo,
          costType: parsed.data.costType,
          status: "allocated",
          allocationMethod: parsed.data.allocationMethod,
          amountMinor,
          currencyCode: receipt.currencyCode,
          vendorId: parsed.data.vendorId,
          notes: parsed.data.notes || null,
        })
        .returning({ id: landedCosts.id });
      landedCostId = cost.id;

      await tx
        .insert(landedCostAllocations)
        .values(allocations.map((allocation) => ({ landedCostId: cost.id, ...allocation })));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "landed_cost.allocate",
        entityType: "landed_cost",
        entityId: cost.id,
        severity: "info",
        metadata: { costNo, goodsReceiptId: receipt.id },
      });
    });
  } catch (error) {
    redirectWithError("/admin/purchasing/landed-costs/new", error instanceof Error ? error.message : "Could not create landed cost.");
  }

  revalidatePath("/admin/purchasing");
  redirect(`/admin/purchasing/landed-costs/${landedCostId}?notice=${encodeURIComponent("Landed cost allocated")}`);
}

export async function updateLandedCost(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = landedCostSchema.safeParse({
    landedCostId: formValue(formData, "landedCostId") || undefined,
    goodsReceiptId: formValue(formData, "goodsReceiptId"),
    costType: formValue(formData, "costType"),
    allocationMethod: formValue(formData, "allocationMethod"),
    amount: formValue(formData, "amount"),
    vendorId: formValue(formData, "vendorId"),
    notes: formValue(formData, "notes"),
  });
  const manualAllocations = parseManualLandedCostAllocations(formData);

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=landed-costs", parsed.error.issues[0]?.message ?? "Invalid landed cost.");
  }

  const landedCostId = parsed.data.landedCostId;
  if (!landedCostId) {
    redirectWithError("/admin/purchasing?view=landed-costs", "Landed cost ID is required.");
  }

  const amountMinor = majorToMinor(parsed.data.amount);
  if (amountMinor <= 0) {
    redirectWithError(`/admin/purchasing/landed-costs/${landedCostId}/edit`, "Landed cost amount must be greater than zero.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [existingCost] = await tx
        .select({
          id: landedCosts.id,
          status: landedCosts.status,
          costNo: landedCosts.costNo,
        })
        .from(landedCosts)
        .where(and(eq(landedCosts.id, landedCostId), eq(landedCosts.companyId, company.id), isNull(landedCosts.deletedAt)))
        .limit(1);

      if (!existingCost) {
        throw new Error("Landed cost does not exist.");
      }

      if (existingCost.status === "posted") {
        throw new Error("Posted landed costs cannot be edited.");
      }

      const [receipt] = await tx
        .select({
          id: goodsReceipts.id,
          purchaseOrderId: goodsReceipts.purchaseOrderId,
          status: goodsReceipts.status,
          currencyCode: purchaseOrders.currencyCode,
        })
        .from(goodsReceipts)
        .innerJoin(purchaseOrders, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
        .where(and(eq(goodsReceipts.id, parsed.data.goodsReceiptId), eq(goodsReceipts.companyId, company.id), isNull(goodsReceipts.deletedAt)))
        .limit(1);

      if (!receipt || receipt.status !== "posted") {
        throw new Error("Select a posted goods receipt.");
      }

      const receiptLines = await tx
        .select({
          id: goodsReceiptLines.id,
          quantityReceived: goodsReceiptLines.quantityReceived,
          lineTotalMinor: goodsReceiptLines.lineTotalMinor,
        })
        .from(goodsReceiptLines)
        .where(and(eq(goodsReceiptLines.goodsReceiptId, receipt.id), isNull(goodsReceiptLines.deletedAt)));

      if (receiptLines.length === 0) {
        throw new Error("Receipt has no lines to allocate.");
      }

      const allocations =
        parsed.data.allocationMethod === "manual"
          ? allocateManualLandedCost(amountMinor, receiptLines, manualAllocations)
          : allocateLandedCost(amountMinor, receiptLines, parsed.data.allocationMethod);

      await tx
        .update(landedCosts)
        .set({
          purchaseOrderId: receipt.purchaseOrderId,
          goodsReceiptId: receipt.id,
          costType: parsed.data.costType,
          status: "allocated",
          allocationMethod: parsed.data.allocationMethod,
          amountMinor,
          currencyCode: receipt.currencyCode,
          vendorId: parsed.data.vendorId,
          notes: parsed.data.notes || null,
          updatedAt: sql`now()`,
        })
        .where(eq(landedCosts.id, existingCost.id));

      await tx
        .update(landedCostAllocations)
        .set({ deletedAt: sql`now()`, deleteReason: "Reallocated landed cost.", updatedAt: sql`now()` })
        .where(and(eq(landedCostAllocations.landedCostId, existingCost.id), isNull(landedCostAllocations.deletedAt)));

      await tx
        .insert(landedCostAllocations)
        .values(allocations.map((allocation) => ({ landedCostId: existingCost.id, ...allocation })));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "landed_cost.update",
        entityType: "landed_cost",
        entityId: existingCost.id,
        severity: "info",
        metadata: { costNo: existingCost.costNo, goodsReceiptId: receipt.id },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/landed-costs/${landedCostId}/edit`, error instanceof Error ? error.message : "Could not update landed cost.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath(`/admin/purchasing/landed-costs/${landedCostId}`);
  redirect(`/admin/purchasing/landed-costs/${landedCostId}?notice=${encodeURIComponent("Landed cost updated")}`);
}

export async function postLandedCost(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = landedCostStatusSchema.safeParse({ landedCostId: formValue(formData, "landedCostId") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=landed-costs", "Landed cost ID is required.");
  }

  const company = await getDefaultCompany();

  try {
    await db.transaction(async (tx) => {
      const [cost] = await tx
        .select({ id: landedCosts.id, status: landedCosts.status, amountMinor: landedCosts.amountMinor })
        .from(landedCosts)
        .where(and(eq(landedCosts.id, parsed.data.landedCostId), eq(landedCosts.companyId, company.id), isNull(landedCosts.deletedAt)))
        .limit(1);

      if (!cost) {
        throw new Error("Landed cost does not exist.");
      }

      if (cost.status === "posted") {
        return;
      }

      if (cost.status !== "allocated") {
        throw new Error("Allocate the landed cost before posting.");
      }

      const allocationRows = await tx
        .select({
          allocationId: landedCostAllocations.id,
          allocatedAmountMinor: landedCostAllocations.allocatedAmountMinor,
          goodsReceiptLineId: goodsReceiptLines.id,
          goodsReceiptId: goodsReceiptLines.goodsReceiptId,
          productId: goodsReceiptLines.productId,
          productSerialId: goodsReceiptLines.productSerialId,
          productLotId: goodsReceiptLines.productLotId,
          locationId: goodsReceipts.locationId,
          quantityReceived: goodsReceiptLines.quantityReceived,
        })
        .from(landedCostAllocations)
        .innerJoin(goodsReceiptLines, eq(landedCostAllocations.goodsReceiptLineId, goodsReceiptLines.id))
        .innerJoin(goodsReceipts, eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id))
        .where(and(eq(landedCostAllocations.landedCostId, cost.id), isNull(landedCostAllocations.deletedAt), isNull(goodsReceiptLines.deletedAt)));

      if (allocationRows.length === 0) {
        throw new Error("Landed cost has no allocations.");
      }

      const allocatedTotal = allocationRows.reduce((sum, row) => sum + row.allocatedAmountMinor, 0);
      if (allocatedTotal !== cost.amountMinor) {
        throw new Error("Landed cost allocation total must equal the landed cost amount.");
      }

      for (const row of allocationRows) {
        const quantity = Number(row.quantityReceived);
        const landedAddPerUnitMinor = quantity > 0 ? Math.round(row.allocatedAmountMinor / quantity) : 0;

        await tx
          .update(goodsReceiptLines)
          .set({
            landedUnitCostMinor: sql`${goodsReceiptLines.landedUnitCostMinor} + ${landedAddPerUnitMinor}`,
            updatedAt: sql`now()`,
          })
          .where(eq(goodsReceiptLines.id, row.goodsReceiptLineId));

        if (row.productSerialId) {
          await tx
            .update(productSerials)
            .set({
              landedUnitCostMinor: sql`coalesce(${productSerials.landedUnitCostMinor}, 0) + ${landedAddPerUnitMinor}`,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, row.productSerialId));
        }

        if (row.productLotId) {
          await tx
            .update(productLots)
            .set({
              landedUnitCostMinor: sql`coalesce(${productLots.landedUnitCostMinor}, 0) + ${landedAddPerUnitMinor}`,
              updatedAt: sql`now()`,
            })
            .where(eq(productLots.id, row.productLotId));
        }

        await tx
          .update(stockBalances)
          .set({
            averageCostMinor: sql`${stockBalances.averageCostMinor} + ${landedAddPerUnitMinor}`,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(stockBalances.companyId, company.id),
              eq(stockBalances.locationId, row.locationId),
              eq(stockBalances.productId, row.productId),
              row.productSerialId ? eq(stockBalances.productSerialId, row.productSerialId) : isNull(stockBalances.productSerialId),
              row.productLotId ? eq(stockBalances.productLotId, row.productLotId) : isNull(stockBalances.productLotId),
              isNull(stockBalances.deletedAt),
            ),
          );
      }

      await tx
        .update(landedCosts)
        .set({
          status: "posted",
          updatedAt: sql`now()`,
        })
        .where(eq(landedCosts.id, cost.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "landed_cost.post",
        entityType: "landed_cost",
        entityId: cost.id,
        severity: "info",
        metadata: { allocationCount: allocationRows.length },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/landed-costs/${parsed.data.landedCostId}`, error instanceof Error ? error.message : "Could not post landed cost.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/purchasing/landed-costs/${parsed.data.landedCostId}`);
  redirect(`/admin/purchasing/landed-costs/${parsed.data.landedCostId}?notice=${encodeURIComponent("Landed cost posted to inventory value")}`);
}
