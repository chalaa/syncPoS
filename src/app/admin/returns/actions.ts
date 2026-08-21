"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany, majorToMinor } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  customerRefundPlaceholders,
  customerReturnLines,
  customerReturns,
  goodsReceipts,
  productLots,
  productSerials,
  products,
  salesOrders,
  serialOwnershipHistory,
  stockBalances,
  stockMovementLines,
  stockMovements,
  supplierReturnLines,
  supplierReturns,
  vendorRefundPlaceholders,
  vendorBills,
} from "@/server/db/schema";

const returnConditionSchema = z.enum(["available", "returned", "damaged", "scrapped"]);
const customerReturnSchema = z.object({
  salesOrderId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  refundAmount: z.string().trim().default("0"),
  notes: z.string().trim().optional(),
});
const supplierReturnSchema = z.object({
  goodsReceiptId: z.string().uuid(),
  sourceLocationId: z.string().uuid(),
  refundAmount: z.string().trim().default("0"),
  notes: z.string().trim().optional(),
});
const statusSchema = z.object({
  id: z.string().uuid(),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}

function documentNo(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseLines(formData: FormData) {
  const productIds = formValues(formData, "productId");
  const quantities = formValues(formData, "quantity");
  const conditions = formValues(formData, "condition");
  const refundAmounts = formValues(formData, "lineRefundAmount");
  const serialNumbers = formValues(formData, "serialNo");
  const lotNumbers = formValues(formData, "lotNo");
  const notes = formValues(formData, "lineNotes");

  return productIds
    .map((productId, index) => ({
      productId,
      quantity: Number(quantities[index] ?? 0),
      condition: returnConditionSchema.parse(conditions[index] || "returned"),
      refundAmountMinor: majorToMinor(refundAmounts[index] ?? "0"),
      serialNo: serialNumbers[index]?.trim() || null,
      lotNo: lotNumbers[index]?.trim() || null,
      notes: notes[index]?.trim() || null,
    }))
    .filter((line) => line.productId || line.quantity > 0);
}

async function addBalance(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], params: {
  companyId: string;
  locationId: string;
  productId: string;
  productSerialId: string | null;
  productLotId: string | null;
  quantity: number;
  unitCostMinor: number;
  currencyCode: string;
}) {
  const serialFilter = params.productSerialId ? eq(stockBalances.productSerialId, params.productSerialId) : isNull(stockBalances.productSerialId);
  const lotFilter = params.productLotId ? eq(stockBalances.productLotId, params.productLotId) : isNull(stockBalances.productLotId);
  const [balance] = await tx
    .select({
      id: stockBalances.id,
      quantityOnHand: stockBalances.quantityOnHand,
      quantityReserved: stockBalances.quantityReserved,
      averageCostMinor: stockBalances.averageCostMinor,
    })
    .from(stockBalances)
    .where(and(eq(stockBalances.companyId, params.companyId), eq(stockBalances.locationId, params.locationId), eq(stockBalances.productId, params.productId), serialFilter, lotFilter, isNull(stockBalances.deletedAt)))
    .limit(1);

  if (balance) {
    const nextOnHand = Number(balance.quantityOnHand) + params.quantity;
    await tx
      .update(stockBalances)
      .set({
        quantityOnHand: String(nextOnHand),
        quantityAvailable: String(nextOnHand - Number(balance.quantityReserved)),
        averageCostMinor: params.unitCostMinor || balance.averageCostMinor,
        lastMovementAt: new Date(),
        updatedAt: sql`now()`,
      })
      .where(eq(stockBalances.id, balance.id));
    return;
  }

  await tx.insert(stockBalances).values({
    companyId: params.companyId,
    locationId: params.locationId,
    productId: params.productId,
    productSerialId: params.productSerialId,
    productLotId: params.productLotId,
    quantityOnHand: String(params.quantity),
    quantityReserved: "0",
    quantityAvailable: String(params.quantity),
    averageCostMinor: params.unitCostMinor,
    currencyCode: params.currencyCode,
    lastMovementAt: new Date(),
  });
}

async function removeBalance(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], params: {
  companyId: string;
  locationId: string;
  productId: string;
  productSerialId: string | null;
  productLotId: string | null;
  quantity: number;
}) {
  const serialFilter = params.productSerialId ? eq(stockBalances.productSerialId, params.productSerialId) : isNull(stockBalances.productSerialId);
  const lotFilter = params.productLotId ? eq(stockBalances.productLotId, params.productLotId) : isNull(stockBalances.productLotId);
  const [balance] = await tx
    .select({
      id: stockBalances.id,
      quantityOnHand: stockBalances.quantityOnHand,
      quantityReserved: stockBalances.quantityReserved,
      quantityAvailable: stockBalances.quantityAvailable,
      averageCostMinor: stockBalances.averageCostMinor,
    })
    .from(stockBalances)
    .where(and(eq(stockBalances.companyId, params.companyId), eq(stockBalances.locationId, params.locationId), eq(stockBalances.productId, params.productId), serialFilter, lotFilter, isNull(stockBalances.deletedAt)))
    .limit(1);

  if (!balance || Number(balance.quantityAvailable) < params.quantity || Number(balance.quantityOnHand) < params.quantity) {
    throw new Error("Insufficient stock for supplier return.");
  }

  const nextOnHand = Number(balance.quantityOnHand) - params.quantity;
  await tx
    .update(stockBalances)
    .set({
      quantityOnHand: String(nextOnHand),
      quantityAvailable: String(nextOnHand - Number(balance.quantityReserved)),
      lastMovementAt: new Date(),
      updatedAt: sql`now()`,
    })
    .where(eq(stockBalances.id, balance.id));

  return balance;
}

export async function createCustomerReturn(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = customerReturnSchema.safeParse({
    salesOrderId: formValue(formData, "salesOrderId"),
    destinationLocationId: formValue(formData, "destinationLocationId"),
    refundAmount: formValue(formData, "refundAmount"),
    notes: formValue(formData, "notes"),
  });
  const lines = parseLines(formData).filter((line) => line.quantity > 0);

  if (!parsed.success) {
    redirectWithError("/admin/sales/returns/new", parsed.error.issues[0]?.message ?? "Invalid customer return.");
  }

  if (lines.length === 0) {
    redirectWithError("/admin/sales/returns/new", "At least one return line is required.");
  }

  const company = await getDefaultCompany();
  const returnNo = documentNo("CR");
  const refundAmountMinor = majorToMinor(parsed.data.refundAmount);
  let returnId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: salesOrders.id,
          orderNo: salesOrders.orderNo,
          customerId: salesOrders.customerId,
          currencyCode: salesOrders.currencyCode,
        })
        .from(salesOrders)
        .where(and(eq(salesOrders.id, parsed.data.salesOrderId), eq(salesOrders.companyId, company.id), isNull(salesOrders.deletedAt)))
        .limit(1);

      if (!order) {
        throw new Error("Original sales order is required.");
      }

      const paid = await tx.execute<{ amountMinor: number }>(sql`
        select coalesce(sum(pa.amount_minor) filter (
          where p.status = 'posted' and p.deleted_at is null and pa.deleted_at is null
        ), 0)::bigint as "amountMinor"
        from customer_invoices ci
        left join payment_allocations pa on pa.customer_invoice_id = ci.id
        left join payments p on p.id = pa.payment_id
        where ci.sales_order_id = ${order.id}
          and ci.deleted_at is null
      `);

      if (refundAmountMinor > (paid[0]?.amountMinor ?? 0)) {
        throw new Error("Refund cannot exceed the original paid amount.");
      }

      const productsById = new Map(
        (await tx
          .select({
            id: products.id,
            sku: products.sku,
            unitId: products.unitId,
            trackingMode: products.trackingMode,
            currencyCode: products.currencyCode,
          })
          .from(products)
          .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true))))
          .map((product) => [product.id, product]),
      );

      const [record] = await tx
        .insert(customerReturns)
        .values({
          companyId: company.id,
          salesOrderId: order.id,
          customerId: order.customerId,
          returnNo,
          status: "draft",
          refundAmountMinor,
          currencyCode: order.currencyCode,
          destinationLocationId: parsed.data.destinationLocationId,
          notes: parsed.data.notes || null,
        })
        .returning({ id: customerReturns.id });
      returnId = record.id;

      await tx.insert(customerReturnLines).values(
        lines.map((line, index) => {
          const product = productsById.get(line.productId);
          if (!product) {
            throw new Error("One or more products are invalid.");
          }

          if (product.trackingMode === "serial" && (!line.serialNo || line.quantity !== 1)) {
            throw new Error(`Serialized product ${product.sku} requires quantity 1 and serial number.`);
          }

          if (product.trackingMode === "lot" && !line.lotNo) {
            throw new Error(`Lot tracked product ${product.sku} requires lot number.`);
          }

          return {
            customerReturnId: record.id,
            lineNo: index + 1,
            productId: product.id,
            unitId: product.unitId,
            quantityReturned: String(line.quantity),
            condition: line.condition,
            refundAmountMinor: line.refundAmountMinor,
            currencyCode: order.currencyCode,
            serialNo: line.serialNo,
            lotNo: line.lotNo,
            notes: line.notes,
          };
        }),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer_return.create",
        entityType: "customer_return",
        entityId: record.id,
        severity: "info",
        metadata: { returnNo, orderNo: order.orderNo },
      });
    });
  } catch (error) {
    redirectWithError("/admin/sales/returns/new", error instanceof Error ? error.message : "Could not create customer return.");
  }

  revalidatePath("/admin/sales");
  redirect(`/admin/sales/returns/${returnId}?notice=${encodeURIComponent("Customer return created")}`);
}

export async function postCustomerReturn(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = statusSchema.safeParse({ id: formValue(formData, "id") });

  if (!parsed.success) {
    redirectWithError("/admin/sales?view=returns", "Return ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [record] = await tx
        .select({
          id: customerReturns.id,
          returnNo: customerReturns.returnNo,
          status: customerReturns.status,
          salesOrderId: customerReturns.salesOrderId,
          customerId: customerReturns.customerId,
          destinationLocationId: customerReturns.destinationLocationId,
          refundAmountMinor: customerReturns.refundAmountMinor,
          currencyCode: customerReturns.currencyCode,
        })
        .from(customerReturns)
        .where(and(eq(customerReturns.id, parsed.data.id), eq(customerReturns.companyId, company.id), isNull(customerReturns.deletedAt)))
        .limit(1);

      if (!record || record.status !== "draft") {
        throw new Error("Only draft customer returns can be posted.");
      }

      const lines = await tx
        .select({
          id: customerReturnLines.id,
          lineNo: customerReturnLines.lineNo,
          productId: customerReturnLines.productId,
          unitId: customerReturnLines.unitId,
          quantityReturned: customerReturnLines.quantityReturned,
          condition: customerReturnLines.condition,
          refundAmountMinor: customerReturnLines.refundAmountMinor,
          currencyCode: customerReturnLines.currencyCode,
          serialNo: customerReturnLines.serialNo,
          lotNo: customerReturnLines.lotNo,
          trackingMode: products.trackingMode,
          sku: products.sku,
        })
        .from(customerReturnLines)
        .innerJoin(products, eq(customerReturnLines.productId, products.id))
        .where(and(eq(customerReturnLines.customerReturnId, record.id), isNull(customerReturnLines.deletedAt)))
        .orderBy(sql`${customerReturnLines.lineNo} asc`);

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo: documentNo("CR-MOVE"),
          movementType: "customer_return",
          status: "posted",
          toLocationId: record.destinationLocationId,
          sourceType: "customer_return",
          sourceId: record.id,
          sourceNo: record.returnNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: `Customer return ${record.returnNo}`,
        })
        .returning({ id: stockMovements.id });

      for (const line of lines) {
        let productSerialId: string | null = null;
        let productLotId: string | null = null;
        const quantity = Number(line.quantityReturned);

        if (line.trackingMode === "serial" && line.serialNo) {
          const [serial] = await tx
            .select({ id: productSerials.id, status: productSerials.status })
            .from(productSerials)
            .where(and(eq(productSerials.productId, line.productId), eq(productSerials.serialNo, line.serialNo), isNull(productSerials.deletedAt)))
            .limit(1);

          if (!serial || serial.status !== "sold") {
            throw new Error(`Returned serial ${line.serialNo} must reference a sold serial.`);
          }

          const [saleLine] = await tx.execute<{ id: string }>(sql`
            select dl.id
            from delivery_lines dl
            inner join deliveries d on d.id = dl.delivery_id
            where d.sales_order_id = ${record.salesOrderId}
              and dl.product_serial_id = ${serial.id}
              and d.status = 'posted'
              and d.deleted_at is null
              and dl.deleted_at is null
            limit 1
          `);

          if (!saleLine) {
            throw new Error(`Serial ${line.serialNo} was not sold on the referenced sales order.`);
          }

          productSerialId = serial.id;
        }

        if (line.trackingMode === "lot" && line.lotNo) {
          const [lot] = await tx
            .select({ id: productLots.id })
            .from(productLots)
            .where(and(eq(productLots.productId, line.productId), eq(productLots.lotNo, line.lotNo), isNull(productLots.deletedAt)))
            .limit(1);
          productLotId = lot?.id ?? null;
        }

        await tx.insert(stockMovementLines).values({
          stockMovementId: movement.id,
          lineNo: line.lineNo,
          productId: line.productId,
          productSerialId,
          productLotId,
          toLocationId: record.destinationLocationId,
          unitId: line.unitId,
          quantity: String(quantity),
          unitCostMinor: 0,
          totalCostMinor: 0,
          currencyCode: line.currencyCode,
          notes: `Returned condition: ${line.condition}`,
        });

        await addBalance(tx, {
          companyId: company.id,
          locationId: record.destinationLocationId,
          productId: line.productId,
          productSerialId,
          productLotId,
          quantity,
          unitCostMinor: 0,
          currencyCode: line.currencyCode,
        });

        if (productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: line.condition,
              currentLocationId: record.destinationLocationId,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, productSerialId));

          await tx.insert(serialOwnershipHistory).values({
            companyId: company.id,
            productSerialId,
            partnerId: record.customerId,
            ownershipType: "customer_return",
            sourceType: "customer_return",
            sourceId: record.id,
            sourceNo: record.returnNo,
            notes: `Returned as ${line.condition}`,
          });
        }
      }

      if (record.refundAmountMinor > 0) {
        await tx.insert(customerRefundPlaceholders).values({
          companyId: company.id,
          customerReturnId: record.id,
          customerId: record.customerId,
          refundNo: documentNo("CN"),
          status: "pending",
          amountMinor: record.refundAmountMinor,
          currencyCode: record.currencyCode,
          notes: `Credit note placeholder for ${record.returnNo}`,
        });
      }

      await tx
        .update(customerReturns)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          stockMovementId: movement.id,
          updatedAt: sql`now()`,
        })
        .where(eq(customerReturns.id, record.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "customer_return.post",
        entityType: "customer_return",
        entityId: record.id,
        severity: "info",
        metadata: { returnNo: record.returnNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/sales/returns/${parsed.data.id}`, error instanceof Error ? error.message : "Could not post customer return.");
  }

  revalidatePath("/admin/sales");
  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/sales/returns/${parsed.data.id}`);
  redirect(`/admin/sales/returns/${parsed.data.id}?notice=${encodeURIComponent("Customer return posted")}`);
}

export async function createSupplierReturn(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = supplierReturnSchema.safeParse({
    goodsReceiptId: formValue(formData, "goodsReceiptId"),
    sourceLocationId: formValue(formData, "sourceLocationId"),
    refundAmount: formValue(formData, "refundAmount"),
    notes: formValue(formData, "notes"),
  });
  const lines = parseLines(formData).filter((line) => line.quantity > 0);

  if (!parsed.success) {
    redirectWithError("/admin/purchasing/returns/new", parsed.error.issues[0]?.message ?? "Invalid supplier return.");
  }

  if (lines.length === 0) {
    redirectWithError("/admin/purchasing/returns/new", "At least one return line is required.");
  }

  const company = await getDefaultCompany();
  const returnNo = documentNo("SR");
  let returnId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const [receipt] = await tx
        .select({
          id: goodsReceipts.id,
          receiptNo: goodsReceipts.receiptNo,
          purchaseOrderId: goodsReceipts.purchaseOrderId,
          supplierId: goodsReceipts.supplierId,
        })
        .from(goodsReceipts)
        .where(and(eq(goodsReceipts.id, parsed.data.goodsReceiptId), eq(goodsReceipts.companyId, company.id), eq(goodsReceipts.status, "posted"), isNull(goodsReceipts.deletedAt)))
        .limit(1);

      if (!receipt) {
        throw new Error("Posted purchase receipt is required.");
      }

      const [bill] = await tx
        .select({ id: vendorBills.id, currencyCode: vendorBills.currencyCode })
        .from(vendorBills)
        .where(and(eq(vendorBills.goodsReceiptId, receipt.id), eq(vendorBills.companyId, company.id), isNull(vendorBills.deletedAt)))
        .limit(1);

      const productsById = new Map(
        (await tx
          .select({
            id: products.id,
            sku: products.sku,
            unitId: products.unitId,
            trackingMode: products.trackingMode,
            currencyCode: products.currencyCode,
          })
          .from(products)
          .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true))))
          .map((product) => [product.id, product]),
      );
      const currencyCode = bill?.currencyCode ?? productsById.get(lines[0]?.productId ?? "")?.currencyCode ?? company.baseCurrencyCode;

      const [record] = await tx
        .insert(supplierReturns)
        .values({
          companyId: company.id,
          purchaseOrderId: receipt.purchaseOrderId,
          goodsReceiptId: receipt.id,
          vendorBillId: bill?.id ?? null,
          supplierId: receipt.supplierId,
          returnNo,
          status: "draft",
          refundAmountMinor: majorToMinor(parsed.data.refundAmount),
          currencyCode,
          sourceLocationId: parsed.data.sourceLocationId,
          notes: parsed.data.notes || null,
        })
        .returning({ id: supplierReturns.id });
      returnId = record.id;

      await tx.insert(supplierReturnLines).values(
        lines.map((line, index) => {
          const product = productsById.get(line.productId);
          if (!product) {
            throw new Error("One or more products are invalid.");
          }

          return {
            supplierReturnId: record.id,
            lineNo: index + 1,
            productId: product.id,
            unitId: product.unitId,
            quantityReturned: String(line.quantity),
            condition: line.condition,
            refundAmountMinor: line.refundAmountMinor,
            currencyCode,
            serialNo: line.serialNo,
            lotNo: line.lotNo,
            notes: line.notes,
          };
        }),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "supplier_return.create",
        entityType: "supplier_return",
        entityId: record.id,
        severity: "info",
        metadata: { returnNo, receiptNo: receipt.receiptNo },
      });
    });
  } catch (error) {
    redirectWithError("/admin/purchasing/returns/new", error instanceof Error ? error.message : "Could not create supplier return.");
  }

  revalidatePath("/admin/purchasing");
  redirect(`/admin/purchasing/returns/${returnId}?notice=${encodeURIComponent("Supplier return created")}`);
}

export async function postSupplierReturn(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = statusSchema.safeParse({ id: formValue(formData, "id") });

  if (!parsed.success) {
    redirectWithError("/admin/purchasing?view=returns", "Return ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [record] = await tx
        .select({
          id: supplierReturns.id,
          returnNo: supplierReturns.returnNo,
          status: supplierReturns.status,
          supplierId: supplierReturns.supplierId,
          sourceLocationId: supplierReturns.sourceLocationId,
          refundAmountMinor: supplierReturns.refundAmountMinor,
          currencyCode: supplierReturns.currencyCode,
        })
        .from(supplierReturns)
        .where(and(eq(supplierReturns.id, parsed.data.id), eq(supplierReturns.companyId, company.id), isNull(supplierReturns.deletedAt)))
        .limit(1);

      if (!record || record.status !== "draft") {
        throw new Error("Only draft supplier returns can be posted.");
      }

      const lines = await tx
        .select({
          id: supplierReturnLines.id,
          lineNo: supplierReturnLines.lineNo,
          productId: supplierReturnLines.productId,
          unitId: supplierReturnLines.unitId,
          quantityReturned: supplierReturnLines.quantityReturned,
          currencyCode: supplierReturnLines.currencyCode,
          serialNo: supplierReturnLines.serialNo,
          lotNo: supplierReturnLines.lotNo,
          trackingMode: products.trackingMode,
        })
        .from(supplierReturnLines)
        .innerJoin(products, eq(supplierReturnLines.productId, products.id))
        .where(and(eq(supplierReturnLines.supplierReturnId, record.id), isNull(supplierReturnLines.deletedAt)))
        .orderBy(sql`${supplierReturnLines.lineNo} asc`);

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo: documentNo("SR-MOVE"),
          movementType: "supplier_return",
          status: "posted",
          fromLocationId: record.sourceLocationId,
          sourceType: "supplier_return",
          sourceId: record.id,
          sourceNo: record.returnNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: `Supplier return ${record.returnNo}`,
        })
        .returning({ id: stockMovements.id });

      for (const line of lines) {
        let productSerialId: string | null = null;
        let productLotId: string | null = null;
        const quantity = Number(line.quantityReturned);

        if (line.trackingMode === "serial" && line.serialNo) {
          const [serial] = await tx
            .select({ id: productSerials.id, currentLocationId: productSerials.currentLocationId })
            .from(productSerials)
            .where(and(eq(productSerials.productId, line.productId), eq(productSerials.serialNo, line.serialNo), isNull(productSerials.deletedAt)))
            .limit(1);

          if (!serial || serial.currentLocationId !== record.sourceLocationId) {
            throw new Error(`Serial ${line.serialNo} is not in the supplier return source location.`);
          }

          productSerialId = serial.id;
        }

        if (line.trackingMode === "lot" && line.lotNo) {
          const [lot] = await tx
            .select({ id: productLots.id })
            .from(productLots)
            .where(and(eq(productLots.productId, line.productId), eq(productLots.lotNo, line.lotNo), isNull(productLots.deletedAt)))
            .limit(1);
          productLotId = lot?.id ?? null;
        }

        const balance = await removeBalance(tx, {
          companyId: company.id,
          locationId: record.sourceLocationId,
          productId: line.productId,
          productSerialId,
          productLotId,
          quantity,
        });

        await tx.insert(stockMovementLines).values({
          stockMovementId: movement.id,
          lineNo: line.lineNo,
          productId: line.productId,
          productSerialId,
          productLotId,
          fromLocationId: record.sourceLocationId,
          unitId: line.unitId,
          quantity: String(quantity),
          unitCostMinor: balance.averageCostMinor,
          totalCostMinor: Math.round(quantity * balance.averageCostMinor),
          currencyCode: line.currencyCode,
          notes: "Returned to supplier",
        });

        if (productSerialId) {
          await tx
            .update(productSerials)
            .set({ status: "returned", currentLocationId: null, updatedAt: sql`now()` })
            .where(eq(productSerials.id, productSerialId));

          await tx.insert(serialOwnershipHistory).values({
            companyId: company.id,
            productSerialId,
            partnerId: record.supplierId,
            ownershipType: "supplier_return",
            sourceType: "supplier_return",
            sourceId: record.id,
            sourceNo: record.returnNo,
          });
        }
      }

      if (record.refundAmountMinor > 0) {
        await tx.insert(vendorRefundPlaceholders).values({
          companyId: company.id,
          supplierReturnId: record.id,
          supplierId: record.supplierId,
          refundNo: documentNo("VR"),
          status: "pending",
          amountMinor: record.refundAmountMinor,
          currencyCode: record.currencyCode,
          notes: `Vendor refund placeholder for ${record.returnNo}`,
        });
      }

      await tx
        .update(supplierReturns)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          stockMovementId: movement.id,
          updatedAt: sql`now()`,
        })
        .where(eq(supplierReturns.id, record.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "supplier_return.post",
        entityType: "supplier_return",
        entityId: record.id,
        severity: "info",
        metadata: { returnNo: record.returnNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/purchasing/returns/${parsed.data.id}`, error instanceof Error ? error.message : "Could not post supplier return.");
  }

  revalidatePath("/admin/purchasing");
  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/purchasing/returns/${parsed.data.id}`);
  redirect(`/admin/purchasing/returns/${parsed.data.id}?notice=${encodeURIComponent("Supplier return posted")}`);
}
