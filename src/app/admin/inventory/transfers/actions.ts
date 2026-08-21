"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  productLots,
  productSerials,
  products,
  stockBalances,
  stockMovementLines,
  stockMovements,
  transferLines,
  transfers,
} from "@/server/db/schema";

const createTransferSchema = z.object({
  fromLocationId: z.string().uuid(),
  transitLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  notes: z.string().trim().optional(),
});

const idSchema = z.object({
  transferId: z.string().uuid(),
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
  const quantities = formValues(formData, "quantityRequested");
  const serialNumbers = formValues(formData, "serialNo");
  const lotNumbers = formValues(formData, "lotNo");
  const notes = formValues(formData, "lineNotes");

  return productIds
    .map((productId, index) => ({
      productId,
      quantity: Number(quantities[index] ?? 0),
      serialNo: serialNumbers[index]?.trim() || null,
      lotNo: lotNumbers[index]?.trim() || null,
      notes: notes[index]?.trim() || null,
    }))
    .filter((line) => line.productId || line.quantity > 0);
}

function parseReceiptLines(formData: FormData) {
  const lineIds = formValues(formData, "transferLineId");
  const quantities = formValues(formData, "quantityReceivedNow");
  const discrepancies = formValues(formData, "discrepancy");
  const allowedDiscrepancies = ["none", "shortage", "overage", "damaged"] as const;

  return lineIds
    .map((lineId, index) => {
      const discrepancy = discrepancies[index];

      return {
        lineId,
        quantity: Number(quantities[index] ?? 0),
        discrepancy: allowedDiscrepancies.includes(discrepancy as (typeof allowedDiscrepancies)[number])
          ? (discrepancy as (typeof allowedDiscrepancies)[number])
          : "none",
      };
    })
    .filter((line) => line.lineId);
}

async function getBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    companyId: string;
    locationId: string;
    productId: string;
    productSerialId: string | null;
    productLotId: string | null;
  },
) {
  const serialFilter = params.productSerialId ? eq(stockBalances.productSerialId, params.productSerialId) : isNull(stockBalances.productSerialId);
  const lotFilter = params.productLotId ? eq(stockBalances.productLotId, params.productLotId) : isNull(stockBalances.productLotId);

  const [balance] = await tx
    .select({
      id: stockBalances.id,
      quantityOnHand: stockBalances.quantityOnHand,
      quantityReserved: stockBalances.quantityReserved,
      quantityAvailable: stockBalances.quantityAvailable,
      averageCostMinor: stockBalances.averageCostMinor,
      currencyCode: stockBalances.currencyCode,
    })
    .from(stockBalances)
    .where(and(eq(stockBalances.companyId, params.companyId), eq(stockBalances.locationId, params.locationId), eq(stockBalances.productId, params.productId), serialFilter, lotFilter, isNull(stockBalances.deletedAt)))
    .limit(1);

  return balance;
}

async function addBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    companyId: string;
    locationId: string;
    productId: string;
    productSerialId: string | null;
    productLotId: string | null;
    quantity: number;
    unitCostMinor: number;
    currencyCode: string;
  },
) {
  const balance = await getBalance(tx, params);

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

async function removeBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    companyId: string;
    locationId: string;
    productId: string;
    productSerialId: string | null;
    productLotId: string | null;
    quantity: number;
  },
) {
  const balance = await getBalance(tx, params);

  if (!balance || Number(balance.quantityAvailable) < params.quantity || Number(balance.quantityOnHand) < params.quantity) {
    throw new Error("Insufficient available stock for transfer.");
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

export async function createTransfer(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = createTransferSchema.safeParse({
    fromLocationId: formValue(formData, "fromLocationId"),
    transitLocationId: formValue(formData, "transitLocationId"),
    toLocationId: formValue(formData, "toLocationId"),
    notes: formValue(formData, "notes"),
  });
  const inputLines = parseLines(formData).filter((line) => line.quantity > 0);

  if (!parsed.success) {
    redirectWithError("/admin/inventory/transfers/new", parsed.error.issues[0]?.message ?? "Invalid transfer.");
  }

  if (parsed.data.fromLocationId === parsed.data.toLocationId || parsed.data.fromLocationId === parsed.data.transitLocationId || parsed.data.toLocationId === parsed.data.transitLocationId) {
    redirectWithError("/admin/inventory/transfers/new", "Source, transit, and destination locations must be different.");
  }

  if (inputLines.length === 0) {
    redirectWithError("/admin/inventory/transfers/new", "At least one transfer line is required.");
  }

  const company = await getDefaultCompany();
  const transferNo = documentNo("TR");
  let transferId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const productRows = await tx
        .select({
          id: products.id,
          sku: products.sku,
          unitId: products.unitId,
          trackingMode: products.trackingMode,
          currencyCode: products.currencyCode,
        })
        .from(products)
        .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)));
      const productById = new Map(productRows.map((product) => [product.id, product]));

      const [transfer] = await tx
        .insert(transfers)
        .values({
          companyId: company.id,
          transferNo,
          status: "draft",
          fromLocationId: parsed.data.fromLocationId,
          transitLocationId: parsed.data.transitLocationId,
          toLocationId: parsed.data.toLocationId,
          notes: parsed.data.notes || null,
        })
        .returning({ id: transfers.id });
      transferId = transfer.id;

      await tx.insert(transferLines).values(
        inputLines.map((line, index) => {
          const product = productById.get(line.productId);

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
            transferId: transfer.id,
            lineNo: index + 1,
            productId: product.id,
            unitId: product.unitId,
            quantityRequested: String(line.quantity),
            currencyCode: product.currencyCode,
            serialNo: line.serialNo,
            lotNo: line.lotNo,
            notes: line.notes,
          };
        }),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "transfer.create",
        entityType: "transfer",
        entityId: transfer.id,
        severity: "info",
        metadata: { transferNo },
      });
    });
  } catch (error) {
    redirectWithError("/admin/inventory/transfers/new", error instanceof Error ? error.message : "Could not create transfer.");
  }

  revalidatePath("/admin/inventory/transfers");
  redirect(`/admin/inventory/transfers/${transferId}?notice=${encodeURIComponent("Transfer created")}`);
}

export async function approveTransfer(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = idSchema.safeParse({ transferId: formValue(formData, "transferId") });

  if (!parsed.success) {
    redirectWithError("/admin/inventory/transfers", "Transfer ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [transfer] = await tx
        .select({ id: transfers.id, transferNo: transfers.transferNo, status: transfers.status })
        .from(transfers)
        .where(and(eq(transfers.id, parsed.data.transferId), eq(transfers.companyId, company.id), isNull(transfers.deletedAt)))
        .limit(1);

      if (!transfer || transfer.status !== "draft") {
        throw new Error("Only draft transfers can be approved.");
      }

      await tx.update(transfers).set({ status: "approved", approvedAt: new Date(), approvedBy: user.id, updatedAt: sql`now()` }).where(eq(transfers.id, transfer.id));
      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "transfer.approve",
        entityType: "transfer",
        entityId: transfer.id,
        severity: "info",
        metadata: { transferNo: transfer.transferNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/inventory/transfers/${parsed.data.transferId}`, error instanceof Error ? error.message : "Could not approve transfer.");
  }

  revalidatePath("/admin/inventory/transfers");
  revalidatePath(`/admin/inventory/transfers/${parsed.data.transferId}`);
  redirect(`/admin/inventory/transfers/${parsed.data.transferId}?notice=${encodeURIComponent("Transfer approved")}`);
}

export async function dispatchTransfer(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = idSchema.safeParse({ transferId: formValue(formData, "transferId") });

  if (!parsed.success) {
    redirectWithError("/admin/inventory/transfers", "Transfer ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [transfer] = await tx
        .select({
          id: transfers.id,
          transferNo: transfers.transferNo,
          status: transfers.status,
          fromLocationId: transfers.fromLocationId,
          transitLocationId: transfers.transitLocationId,
        })
        .from(transfers)
        .where(and(eq(transfers.id, parsed.data.transferId), eq(transfers.companyId, company.id), isNull(transfers.deletedAt)))
        .limit(1);

      if (!transfer || transfer.status !== "approved") {
        throw new Error("Transfer must be approved before dispatch.");
      }

      const lines = await tx
        .select({
          id: transferLines.id,
          lineNo: transferLines.lineNo,
          productId: transferLines.productId,
          unitId: transferLines.unitId,
          quantityRequested: transferLines.quantityRequested,
          currencyCode: transferLines.currencyCode,
          serialNo: transferLines.serialNo,
          lotNo: transferLines.lotNo,
          trackingMode: products.trackingMode,
        })
        .from(transferLines)
        .innerJoin(products, eq(transferLines.productId, products.id))
        .where(and(eq(transferLines.transferId, transfer.id), isNull(transferLines.deletedAt)))
        .orderBy(sql`${transferLines.lineNo} asc`);

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo: documentNo("TR-DIS"),
          movementType: "transfer",
          status: "posted",
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.transitLocationId,
          sourceType: "transfer_dispatch",
          sourceId: transfer.id,
          sourceNo: transfer.transferNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: `Transfer dispatch ${transfer.transferNo}`,
        })
        .returning({ id: stockMovements.id });

      for (const line of lines) {
        const quantity = Number(line.quantityRequested);
        let productSerialId: string | null = null;
        let productLotId: string | null = null;

        if (line.trackingMode === "serial" && line.serialNo) {
          const [serial] = await tx
            .select({ id: productSerials.id, currentLocationId: productSerials.currentLocationId })
            .from(productSerials)
            .where(and(eq(productSerials.productId, line.productId), eq(productSerials.serialNo, line.serialNo), isNull(productSerials.deletedAt)))
            .limit(1);

          if (!serial || serial.currentLocationId !== transfer.fromLocationId) {
            throw new Error(`Serial ${line.serialNo} is not available in the source location.`);
          }

          productSerialId = serial.id;
        }

        if (line.trackingMode === "lot" && line.lotNo) {
          const [lot] = await tx
            .select({ id: productLots.id })
            .from(productLots)
            .where(and(eq(productLots.productId, line.productId), eq(productLots.lotNo, line.lotNo), isNull(productLots.deletedAt)))
            .limit(1);

          if (!lot) {
            throw new Error(`Lot ${line.lotNo} was not found for transfer line ${line.lineNo}.`);
          }

          productLotId = lot.id;
        }

        const balance = await removeBalance(tx, {
          companyId: company.id,
          locationId: transfer.fromLocationId,
          productId: line.productId,
          productSerialId,
          productLotId,
          quantity,
        });

        await addBalance(tx, {
          companyId: company.id,
          locationId: transfer.transitLocationId,
          productId: line.productId,
          productSerialId,
          productLotId,
          quantity,
          unitCostMinor: balance.averageCostMinor,
          currencyCode: line.currencyCode,
        });

        await tx.insert(stockMovementLines).values({
          stockMovementId: movement.id,
          lineNo: line.lineNo,
          productId: line.productId,
          productSerialId,
          productLotId,
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.transitLocationId,
          unitId: line.unitId,
          quantity: String(quantity),
          unitCostMinor: balance.averageCostMinor,
          totalCostMinor: Math.round(quantity * balance.averageCostMinor),
          currencyCode: line.currencyCode,
          notes: "Dispatched to transit",
        });

        await tx
          .update(transferLines)
          .set({
            productSerialId,
            productLotId,
            quantityDispatched: String(quantity),
            unitCostMinor: balance.averageCostMinor,
            updatedAt: sql`now()`,
          })
          .where(eq(transferLines.id, line.id));

        if (productSerialId) {
          await tx.update(productSerials).set({ status: "in_transit", currentLocationId: transfer.transitLocationId, updatedAt: sql`now()` }).where(eq(productSerials.id, productSerialId));
        }
      }

      await tx
        .update(transfers)
        .set({ status: "dispatched", dispatchedAt: new Date(), dispatchedBy: user.id, dispatchMovementId: movement.id, updatedAt: sql`now()` })
        .where(eq(transfers.id, transfer.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "transfer.dispatch",
        entityType: "transfer",
        entityId: transfer.id,
        severity: "info",
        metadata: { transferNo: transfer.transferNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/inventory/transfers/${parsed.data.transferId}`, error instanceof Error ? error.message : "Could not dispatch transfer.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/transfers");
  revalidatePath(`/admin/inventory/transfers/${parsed.data.transferId}`);
  redirect(`/admin/inventory/transfers/${parsed.data.transferId}?notice=${encodeURIComponent("Transfer dispatched")}`);
}

export async function receiveTransfer(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = idSchema.safeParse({ transferId: formValue(formData, "transferId") });
  const receiptLines = parseReceiptLines(formData).filter((line) => line.quantity > 0);

  if (!parsed.success) {
    redirectWithError("/admin/inventory/transfers", "Transfer ID is required.");
  }

  if (receiptLines.length === 0) {
    redirectWithError(`/admin/inventory/transfers/${parsed.data.transferId}`, "At least one received quantity is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [transfer] = await tx
        .select({
          id: transfers.id,
          transferNo: transfers.transferNo,
          status: transfers.status,
          transitLocationId: transfers.transitLocationId,
          toLocationId: transfers.toLocationId,
        })
        .from(transfers)
        .where(and(eq(transfers.id, parsed.data.transferId), eq(transfers.companyId, company.id), isNull(transfers.deletedAt)))
        .limit(1);

      if (!transfer || (transfer.status !== "dispatched" && transfer.status !== "partially_received")) {
        throw new Error("Only dispatched transfers can be received.");
      }

      const lines = await tx
        .select({
          id: transferLines.id,
          lineNo: transferLines.lineNo,
          productId: transferLines.productId,
          productSerialId: transferLines.productSerialId,
          productLotId: transferLines.productLotId,
          unitId: transferLines.unitId,
          quantityDispatched: transferLines.quantityDispatched,
          quantityReceived: transferLines.quantityReceived,
          unitCostMinor: transferLines.unitCostMinor,
          currencyCode: transferLines.currencyCode,
          serialNo: transferLines.serialNo,
        })
        .from(transferLines)
        .where(and(eq(transferLines.transferId, transfer.id), isNull(transferLines.deletedAt)))
        .orderBy(sql`${transferLines.lineNo} asc`);
      const lineById = new Map(lines.map((line) => [line.id, line]));
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo: documentNo("TR-REC"),
          movementType: "transfer",
          status: "posted",
          fromLocationId: transfer.transitLocationId,
          toLocationId: transfer.toLocationId,
          sourceType: "transfer_receipt",
          sourceId: transfer.id,
          sourceNo: transfer.transferNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: `Transfer receipt ${transfer.transferNo}`,
        })
        .returning({ id: stockMovements.id });

      for (const input of receiptLines) {
        const line = lineById.get(input.lineId);

        if (!line) {
          throw new Error("One or more transfer lines are invalid.");
        }

        const remaining = Number(line.quantityDispatched) - Number(line.quantityReceived);
        if (input.quantity > remaining) {
          throw new Error("Received quantity cannot exceed the remaining in-transit quantity.");
        }

        const balance = await removeBalance(tx, {
          companyId: company.id,
          locationId: transfer.transitLocationId,
          productId: line.productId,
          productSerialId: line.productSerialId,
          productLotId: line.productLotId,
          quantity: input.quantity,
        });

        await addBalance(tx, {
          companyId: company.id,
          locationId: transfer.toLocationId,
          productId: line.productId,
          productSerialId: line.productSerialId,
          productLotId: line.productLotId,
          quantity: input.quantity,
          unitCostMinor: balance.averageCostMinor,
          currencyCode: line.currencyCode,
        });

        await tx.insert(stockMovementLines).values({
          stockMovementId: movement.id,
          lineNo: line.lineNo,
          productId: line.productId,
          productSerialId: line.productSerialId,
          productLotId: line.productLotId,
          fromLocationId: transfer.transitLocationId,
          toLocationId: transfer.toLocationId,
          unitId: line.unitId,
          quantity: String(input.quantity),
          unitCostMinor: balance.averageCostMinor,
          totalCostMinor: Math.round(input.quantity * balance.averageCostMinor),
          currencyCode: line.currencyCode,
          notes: input.discrepancy === "none" ? "Received from transit" : `Received with ${input.discrepancy}`,
        });

        const nextReceived = Number(line.quantityReceived) + input.quantity;
        await tx
          .update(transferLines)
          .set({
            quantityReceived: String(nextReceived),
            discrepancy: input.discrepancy,
            updatedAt: sql`now()`,
          })
          .where(eq(transferLines.id, line.id));

        if (line.productSerialId) {
          await tx.update(productSerials).set({ status: "available", currentLocationId: transfer.toLocationId, updatedAt: sql`now()` }).where(eq(productSerials.id, line.productSerialId));
        }
      }

      const updatedLines = await tx
        .select({
          quantityDispatched: transferLines.quantityDispatched,
          quantityReceived: transferLines.quantityReceived,
        })
        .from(transferLines)
        .where(and(eq(transferLines.transferId, transfer.id), isNull(transferLines.deletedAt)));
      const allReceived = updatedLines.every((line) => Number(line.quantityReceived) >= Number(line.quantityDispatched));

      await tx
        .update(transfers)
        .set({
          status: allReceived ? "received" : "partially_received",
          receivedAt: allReceived ? new Date() : null,
          receivedBy: allReceived ? user.id : null,
          receiptMovementId: movement.id,
          updatedAt: sql`now()`,
        })
        .where(eq(transfers.id, transfer.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "transfer.receive",
        entityType: "transfer",
        entityId: transfer.id,
        severity: "info",
        metadata: { transferNo: transfer.transferNo, allReceived },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/inventory/transfers/${parsed.data.transferId}`, error instanceof Error ? error.message : "Could not receive transfer.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/transfers");
  revalidatePath(`/admin/inventory/transfers/${parsed.data.transferId}`);
  redirect(`/admin/inventory/transfers/${parsed.data.transferId}?notice=${encodeURIComponent("Transfer receipt posted")}`);
}

export async function cancelTransfer(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = idSchema.safeParse({ transferId: formValue(formData, "transferId") });

  if (!parsed.success) {
    redirectWithError("/admin/inventory/transfers", "Transfer ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [transfer] = await tx
        .select({ id: transfers.id, transferNo: transfers.transferNo, status: transfers.status })
        .from(transfers)
        .where(and(eq(transfers.id, parsed.data.transferId), eq(transfers.companyId, company.id), isNull(transfers.deletedAt)))
        .limit(1);

      if (!transfer || (transfer.status !== "draft" && transfer.status !== "approved")) {
        throw new Error("Only draft or approved transfers can be cancelled.");
      }

      await tx.update(transfers).set({ status: "cancelled", updatedAt: sql`now()` }).where(eq(transfers.id, transfer.id));
      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "transfer.cancel",
        entityType: "transfer",
        entityId: transfer.id,
        severity: "warning",
        metadata: { transferNo: transfer.transferNo },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/inventory/transfers/${parsed.data.transferId}`, error instanceof Error ? error.message : "Could not cancel transfer.");
  }

  revalidatePath("/admin/inventory/transfers");
  revalidatePath(`/admin/inventory/transfers/${parsed.data.transferId}`);
  redirect(`/admin/inventory/transfers/${parsed.data.transferId}?notice=${encodeURIComponent("Transfer cancelled")}`);
}
