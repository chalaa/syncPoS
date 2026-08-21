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
  productLots,
  productSerials,
  products,
  stockBalances,
  stockMovementLines,
  stockMovements,
} from "@/server/db/schema";

const operationTypes = ["transfer", "adjustment", "scrap", "customer_return", "supplier_return"] as const;

const createOperationSchema = z.object({
  movementType: z.enum(operationTypes),
  fromLocationId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  toLocationId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  sourceNo: z.string().trim().max(80).optional(),
  notes: z.string().trim().optional(),
});

const statusSchema = z.object({
  movementId: z.string().uuid(),
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
  const unitCosts = formValues(formData, "unitCost");
  const serialNumbers = formValues(formData, "serialNo");
  const lotNumbers = formValues(formData, "lotNo");
  const notes = formValues(formData, "lineNotes");

  return productIds
    .map((productId, index) => ({
      productId,
      quantity: Number(quantities[index] ?? 0),
      unitCostMinor: majorToMinor(unitCosts[index] ?? "0"),
      serialNo: serialNumbers[index]?.trim() || null,
      lotNo: lotNumbers[index]?.trim() || null,
      notes: notes[index]?.trim() || null,
    }))
    .filter((line) => line.productId || line.quantity !== 0);
}

function movementPrefix(type: (typeof operationTypes)[number]) {
  const prefixes: Record<(typeof operationTypes)[number], string> = {
    transfer: "INT",
    adjustment: "ADJ",
    scrap: "SCR",
    customer_return: "RTN-C",
    supplier_return: "RTN-S",
  };

  return prefixes[type];
}

function sourceType(type: (typeof operationTypes)[number]) {
  const sources: Record<(typeof operationTypes)[number], string> = {
    transfer: "internal_transfer",
    adjustment: "inventory_adjustment",
    scrap: "scrap",
    customer_return: "customer_return",
    supplier_return: "supplier_return",
  };

  return sources[type];
}

function validateHeader(type: (typeof operationTypes)[number], fromLocationId: string | null, toLocationId: string | null) {
  if ((type === "transfer" || type === "scrap" || type === "supplier_return") && !fromLocationId) {
    throw new Error("Source location is required.");
  }

  if ((type === "transfer" || type === "customer_return") && !toLocationId) {
    throw new Error("Destination location is required.");
  }

  if (type === "transfer" && fromLocationId === toLocationId) {
    throw new Error("Transfer source and destination must be different.");
  }
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
  const serialFilter = params.productSerialId
    ? eq(stockBalances.productSerialId, params.productSerialId)
    : isNull(stockBalances.productSerialId);
  const lotFilter = params.productLotId
    ? eq(stockBalances.productLotId, params.productLotId)
    : isNull(stockBalances.productLotId);

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
    .where(
      and(
        eq(stockBalances.companyId, params.companyId),
        eq(stockBalances.locationId, params.locationId),
        eq(stockBalances.productId, params.productId),
        serialFilter,
        lotFilter,
        isNull(stockBalances.deletedAt),
      ),
    )
    .limit(1);

  return balance;
}

async function addToBalance(
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
    const nextAvailable = nextOnHand - Number(balance.quantityReserved);

    await tx
      .update(stockBalances)
      .set({
        quantityOnHand: String(nextOnHand),
        quantityAvailable: String(nextAvailable),
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

async function removeFromBalance(
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

  if (!balance) {
    throw new Error("No stock balance exists for the selected product and location.");
  }

  if (Number(balance.quantityAvailable) < params.quantity || Number(balance.quantityOnHand) < params.quantity) {
    throw new Error("Insufficient available stock for this operation.");
  }

  const nextOnHand = Number(balance.quantityOnHand) - params.quantity;
  const nextAvailable = nextOnHand - Number(balance.quantityReserved);

  await tx
    .update(stockBalances)
    .set({
      quantityOnHand: String(nextOnHand),
      quantityAvailable: String(nextAvailable),
      lastMovementAt: new Date(),
      updatedAt: sql`now()`,
    })
    .where(eq(stockBalances.id, balance.id));

  return balance;
}

export async function createInventoryOperation(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = createOperationSchema.safeParse({
    movementType: formValue(formData, "movementType"),
    fromLocationId: formValue(formData, "fromLocationId"),
    toLocationId: formValue(formData, "toLocationId"),
    sourceNo: formValue(formData, "sourceNo"),
    notes: formValue(formData, "notes"),
  });
  const inputLines = parseLines(formData).filter((line) => line.quantity !== 0);

  if (!parsed.success) {
    redirectWithError("/admin/inventory/operations/new", parsed.error.issues[0]?.message ?? "Invalid operation.");
  }

  if (inputLines.length === 0) {
    redirectWithError("/admin/inventory/operations/new", "At least one operation line is required.");
  }

  const company = await getDefaultCompany();
  const movementNo = documentNo(movementPrefix(parsed.data.movementType));
  let movementId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      validateHeader(parsed.data.movementType, parsed.data.fromLocationId, parsed.data.toLocationId);

      if (parsed.data.movementType === "adjustment") {
        if (inputLines.some((line) => line.quantity < 0) && !parsed.data.fromLocationId) {
          throw new Error("Source location is required for negative adjustments.");
        }

        if (inputLines.some((line) => line.quantity > 0) && !parsed.data.toLocationId) {
          throw new Error("Destination location is required for positive adjustments.");
        }
      }

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

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          movementNo,
          movementType: parsed.data.movementType,
          status: "draft",
          fromLocationId: parsed.data.fromLocationId,
          toLocationId: parsed.data.toLocationId,
          sourceType: sourceType(parsed.data.movementType),
          sourceNo: parsed.data.sourceNo || movementNo,
          notes: parsed.data.notes || null,
        })
        .returning({ id: stockMovements.id });
      movementId = movement.id;

      await tx.insert(stockMovementLines).values(
        inputLines.map((line, index) => {
          const product = productById.get(line.productId);

          if (!product) {
            throw new Error("One or more products are invalid.");
          }

          if (product.trackingMode === "serial" && (!line.serialNo || Math.abs(line.quantity) !== 1)) {
            throw new Error(`Serialized product ${product.sku} requires quantity 1 and a serial number.`);
          }

          if (product.trackingMode === "lot" && !line.lotNo) {
            throw new Error(`Lot tracked product ${product.sku} requires a lot number.`);
          }

          return {
            stockMovementId: movement.id,
            lineNo: index + 1,
            productId: product.id,
            unitId: product.unitId,
            fromLocationId:
              parsed.data.movementType === "transfer" || parsed.data.movementType === "scrap" || parsed.data.movementType === "supplier_return"
                ? parsed.data.fromLocationId
                : parsed.data.movementType === "adjustment" && line.quantity < 0
                  ? parsed.data.fromLocationId
                  : null,
            toLocationId:
              parsed.data.movementType === "transfer" || parsed.data.movementType === "customer_return"
                ? parsed.data.toLocationId
                : parsed.data.movementType === "adjustment" && line.quantity > 0
                  ? parsed.data.toLocationId
                  : null,
            quantity: String(Math.abs(line.quantity)),
            unitCostMinor: line.unitCostMinor,
            totalCostMinor: Math.round(Math.abs(line.quantity) * line.unitCostMinor),
            currencyCode: product.currencyCode,
            notes: line.notes,
            metadata: {
              requestedSerialNo: line.serialNo,
              requestedLotNo: line.lotNo,
              adjustmentDirection: parsed.data.movementType === "adjustment" ? (line.quantity < 0 ? "decrease" : "increase") : null,
            },
          };
        }),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "inventory_operation.create",
        entityType: "stock_movement",
        entityId: movement.id,
        severity: "info",
        metadata: { movementNo, movementType: parsed.data.movementType },
      });
    });
  } catch (error) {
    redirectWithError("/admin/inventory/operations/new", error instanceof Error ? error.message : "Could not create operation.");
  }

  revalidatePath("/admin/inventory/operations");
  redirect(`/admin/inventory/operations/${movementId}?notice=${encodeURIComponent("Inventory operation created")}`);
}

export async function postInventoryOperation(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = statusSchema.safeParse({
    movementId: formValue(formData, "movementId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/inventory/operations", "Operation ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [movement] = await tx
        .select({
          id: stockMovements.id,
          movementNo: stockMovements.movementNo,
          movementType: stockMovements.movementType,
          status: stockMovements.status,
          fromLocationId: stockMovements.fromLocationId,
          toLocationId: stockMovements.toLocationId,
        })
        .from(stockMovements)
        .where(and(eq(stockMovements.id, parsed.data.movementId), eq(stockMovements.companyId, company.id), isNull(stockMovements.deletedAt)))
        .limit(1);

      if (!movement) {
        throw new Error("Inventory operation does not exist.");
      }

      if (movement.status !== "draft") {
        throw new Error("Only draft inventory operations can be posted.");
      }

      if (!operationTypes.includes(movement.movementType as (typeof operationTypes)[number])) {
        throw new Error("This operation is controlled by its source document.");
      }

      const movementType = movement.movementType as (typeof operationTypes)[number];
      validateHeader(movementType, movement.fromLocationId, movement.toLocationId);

      const lines = await tx
        .select({
          id: stockMovementLines.id,
          lineNo: stockMovementLines.lineNo,
          productId: stockMovementLines.productId,
          quantity: stockMovementLines.quantity,
          unitCostMinor: stockMovementLines.unitCostMinor,
          currencyCode: stockMovementLines.currencyCode,
          metadata: stockMovementLines.metadata,
          trackingMode: products.trackingMode,
          sku: products.sku,
        })
        .from(stockMovementLines)
        .innerJoin(products, eq(stockMovementLines.productId, products.id))
        .where(and(eq(stockMovementLines.stockMovementId, movement.id), isNull(stockMovementLines.deletedAt)))
        .orderBy(sql`${stockMovementLines.lineNo} asc`);

      if (lines.length === 0) {
        throw new Error("Operation has no lines.");
      }

      for (const line of lines) {
        const quantity = Math.abs(Number(line.quantity));
        const metadata = line.metadata as { requestedSerialNo?: string | null; requestedLotNo?: string | null; adjustmentDirection?: string | null };
        const serialNo = metadata.requestedSerialNo?.trim() || null;
        const lotNo = metadata.requestedLotNo?.trim() || null;
        let productSerialId: string | null = null;
        let productLotId: string | null = null;
        const outboundLocationId =
          movementType === "transfer" || movementType === "scrap" || movementType === "supplier_return"
            ? movement.fromLocationId
            : movementType === "adjustment" && metadata.adjustmentDirection === "decrease"
              ? movement.fromLocationId
              : null;
        const inboundLocationId =
          movementType === "transfer" || movementType === "customer_return"
            ? movement.toLocationId
            : movementType === "adjustment" && metadata.adjustmentDirection !== "decrease"
              ? movement.toLocationId
              : null;

        if (line.trackingMode === "serial" && (!serialNo || quantity !== 1)) {
          throw new Error(`Serialized product ${line.sku} requires quantity 1 and a serial number.`);
        }

        if (line.trackingMode === "lot" && !lotNo) {
          throw new Error(`Lot tracked product ${line.sku} requires a lot number.`);
        }

        if (serialNo) {
          const [serial] = await tx
            .select({
              id: productSerials.id,
              status: productSerials.status,
              currentLocationId: productSerials.currentLocationId,
            })
            .from(productSerials)
            .where(and(eq(productSerials.productId, line.productId), eq(productSerials.serialNo, serialNo), isNull(productSerials.deletedAt)))
            .limit(1);

          if (!serial) {
            throw new Error(`Serial ${serialNo} does not exist.`);
          }

          if (outboundLocationId && serial.currentLocationId !== outboundLocationId) {
            throw new Error(`Serial ${serialNo} is not in the source location.`);
          }

          productSerialId = serial.id;
        }

        if (lotNo) {
          const [lot] = await tx
            .select({ id: productLots.id })
            .from(productLots)
            .where(and(eq(productLots.productId, line.productId), eq(productLots.lotNo, lotNo), isNull(productLots.deletedAt)))
            .limit(1);

          if (!lot) {
            throw new Error(`Lot ${lotNo} does not exist.`);
          }

          productLotId = lot.id;
        }

        if (outboundLocationId) {
          const balance = await removeFromBalance(tx, {
            companyId: company.id,
            locationId: outboundLocationId,
            productId: line.productId,
            productSerialId,
            productLotId,
            quantity,
          });

          if (line.unitCostMinor === 0 && balance.averageCostMinor > 0) {
            await tx
              .update(stockMovementLines)
              .set({
                unitCostMinor: balance.averageCostMinor,
                totalCostMinor: Math.round(quantity * balance.averageCostMinor),
                updatedAt: sql`now()`,
              })
              .where(eq(stockMovementLines.id, line.id));
          }
        }

        if (inboundLocationId) {
          await addToBalance(tx, {
            companyId: company.id,
            locationId: inboundLocationId,
            productId: line.productId,
            productSerialId,
            productLotId,
            quantity,
            unitCostMinor: line.unitCostMinor,
            currencyCode: line.currencyCode,
          });
        }

        await tx
          .update(stockMovementLines)
          .set({
            productSerialId,
            productLotId,
            fromLocationId: outboundLocationId,
            toLocationId: inboundLocationId,
            updatedAt: sql`now()`,
          })
          .where(eq(stockMovementLines.id, line.id));

        if (productSerialId) {
          const nextStatus =
            movementType === "scrap"
              ? "scrapped"
              : movementType === "supplier_return"
                ? "returned"
                : movementType === "customer_return"
                  ? "returned"
                  : "available";
          const nextLocationId = movementType === "scrap" || movementType === "supplier_return" ? null : inboundLocationId ?? outboundLocationId;

          await tx
            .update(productSerials)
            .set({
              status: nextStatus,
              currentLocationId: nextLocationId,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, productSerialId));
        }

        if (productLotId) {
          const nextLotStatus =
            movementType === "scrap"
              ? "scrapped"
              : movementType === "supplier_return"
                ? "returned"
                : movementType === "customer_return"
                  ? "returned"
                  : "available";
          const nextLotLocationId = movementType === "scrap" || movementType === "supplier_return" ? null : inboundLocationId ?? outboundLocationId;

          await tx
            .update(productLots)
            .set({
              status: nextLotStatus,
              currentLocationId: nextLotLocationId,
              updatedAt: sql`now()`,
            })
            .where(eq(productLots.id, productLotId));
        }
      }

      await tx
        .update(stockMovements)
        .set({
          status: "posted",
          postedAt: new Date(),
          postedBy: user.id,
          updatedAt: sql`now()`,
        })
        .where(eq(stockMovements.id, movement.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "inventory_operation.post",
        entityType: "stock_movement",
        entityId: movement.id,
        severity: "info",
        metadata: { movementNo: movement.movementNo, movementType },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/inventory/operations/${parsed.data.movementId}`, error instanceof Error ? error.message : "Could not post operation.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/operations");
  revalidatePath(`/admin/inventory/operations/${parsed.data.movementId}`);
  redirect(`/admin/inventory/operations/${parsed.data.movementId}?notice=${encodeURIComponent("Inventory operation posted")}`);
}

export async function cancelInventoryOperation(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = statusSchema.safeParse({
    movementId: formValue(formData, "movementId"),
  });

  if (!parsed.success) {
    redirectWithError("/admin/inventory/operations", "Operation ID is required.");
  }

  try {
    const company = await getDefaultCompany();
    await db.transaction(async (tx) => {
      const [movement] = await tx
        .select({
          id: stockMovements.id,
          movementNo: stockMovements.movementNo,
          status: stockMovements.status,
          movementType: stockMovements.movementType,
        })
        .from(stockMovements)
        .where(and(eq(stockMovements.id, parsed.data.movementId), eq(stockMovements.companyId, company.id), isNull(stockMovements.deletedAt)))
        .limit(1);

      if (!movement) {
        throw new Error("Inventory operation does not exist.");
      }

      if (movement.status !== "draft") {
        throw new Error("Posted operations require an explicit reversal operation.");
      }

      await tx
        .update(stockMovements)
        .set({
          status: "void",
          updatedAt: sql`now()`,
        })
        .where(eq(stockMovements.id, movement.id));

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "inventory_operation.cancel",
        entityType: "stock_movement",
        entityId: movement.id,
        severity: "warning",
        metadata: { movementNo: movement.movementNo, movementType: movement.movementType },
      });
    });
  } catch (error) {
    redirectWithError(`/admin/inventory/operations/${parsed.data.movementId}`, error instanceof Error ? error.message : "Could not cancel operation.");
  }

  revalidatePath("/admin/inventory/operations");
  revalidatePath(`/admin/inventory/operations/${parsed.data.movementId}`);
  redirect(`/admin/inventory/operations/${parsed.data.movementId}?notice=${encodeURIComponent("Inventory operation cancelled")}`);
}
