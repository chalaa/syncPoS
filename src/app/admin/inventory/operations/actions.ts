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
  locations,
  owners,
  productLots,
  productSerials,
  products,
  stockBalances,
  stockMovementLines,
  stockMovements,
} from "@/server/db/schema";
import { getOrCreateSystemStockLocation } from "@/server/inventory/system-locations";

const operationTypes = ["transfer", "adjustment", "scrap", "customer_return", "supplier_return"] as const;

const createOperationSchema = z.object({
  movementType: z.enum(operationTypes),
  ownerId: z.string().uuid("Owner is required"),
  fromLocationId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  toLocationId: z.string().uuid().or(z.literal("")).transform((value) => value || null),
  sourceNo: z.string().trim().max(80).optional(),
  notes: z.string().trim().optional(),
});

const statusSchema = z.object({
  movementId: z.string().uuid(),
});

const adjustmentSchema = z.object({
  ownerId: z.string().uuid("Owner is required"),
  locationId: z.string().uuid(),
  sourceNo: z.string().trim().max(80).optional(),
  notes: z.string().trim().optional(),
});

const scrapSchema = z.object({
  ownerId: z.string().uuid("Owner is required"),
  locationId: z.string().uuid(),
  sourceNo: z.string().trim().max(80).optional(),
  notes: z.string().trim().optional(),
});

const internalTransferSchema = z.object({
  ownerId: z.string().uuid("Owner is required"),
  fromLocationId: z.string().uuid("Source location is required"),
  toLocationId: z.string().uuid("Destination location is required"),
  sourceNo: z.string().trim().max(80).optional(),
  notes: z.string().trim().optional(),
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
    .filter((line) => line.productId || line.quantity !== 0);
}

function parseCountLines(formData: FormData) {
  const productIds = formValues(formData, "productId");
  const countedQuantities = formValues(formData, "countedQuantity");
  const serialNumbers = formValues(formData, "serialNo");
  const lotNumbers = formValues(formData, "lotNo");
  const notes = formValues(formData, "lineNotes");

  return productIds
    .map((productId, index) => ({
      productId,
      countedQuantity: Number(countedQuantities[index] ?? 0),
      serialNo: serialNumbers[index]?.trim() || null,
      lotNo: lotNumbers[index]?.trim() || null,
      notes: notes[index]?.trim() || null,
    }))
    .filter((line) => line.productId || line.countedQuantity !== 0 || line.serialNo || line.lotNo);
}

function parseScrapLines(formData: FormData) {
  const productIds = formValues(formData, "productId");
  const quantities = formValues(formData, "quantity");
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
    .filter((line) => line.productId || line.quantity > 0 || line.serialNo || line.lotNo);
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

async function validateSelectableLocation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  companyId: string,
  locationId: string,
) {
  const [location] = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.id, locationId),
        eq(locations.companyId, companyId),
        eq(locations.isActive, true),
        isNull(locations.deletedAt),
        sql`${locations.locationType} in ('warehouse', 'display_shop', 'transit')`,
      ),
    )
    .limit(1);

  if (!location) {
    throw new Error("Stock location is invalid.");
  }
}

async function validateOwner(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  companyId: string,
  ownerId: string,
) {
  const [owner] = await tx
    .select({ id: owners.id })
    .from(owners)
    .where(and(eq(owners.id, ownerId), eq(owners.companyId, companyId), isNull(owners.deletedAt)))
    .limit(1);

  if (!owner) {
    throw new Error("Owner is invalid or inactive.");
  }

  return owner;
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

async function resolveTrackedStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    productId: string;
    trackingMode: string;
    locationId: string;
    serialNo: string | null;
    lotNo: string | null;
    allowCreateInbound: boolean;
    unitCostMinor: number;
  },
) {
  let productSerialId: string | null = null;
  let productLotId: string | null = null;
  let serialCurrentLocationId: string | null = null;

  if (params.trackingMode === "serial") {
    if (!params.serialNo) {
      throw new Error("Serial tracked products require a serial number.");
    }

    const [serial] = await tx
      .select({
        id: productSerials.id,
        currentLocationId: productSerials.currentLocationId,
      })
      .from(productSerials)
      .where(and(eq(productSerials.productId, params.productId), eq(productSerials.serialNo, params.serialNo), isNull(productSerials.deletedAt)))
      .limit(1);

    if (!serial && !params.allowCreateInbound) {
      throw new Error(`Serial ${params.serialNo} does not exist.`);
    }

    if (!serial) {
      const [created] = await tx
        .insert(productSerials)
        .values({
          productId: params.productId,
          serialNo: params.serialNo,
          status: "available",
          currentLocationId: params.locationId,
          landedUnitCostMinor: params.unitCostMinor || null,
        })
        .returning({ id: productSerials.id });

      productSerialId = created.id;
    } else {
      productSerialId = serial.id;
      serialCurrentLocationId = serial.currentLocationId;
    }
  }

  if (params.trackingMode === "lot") {
    if (!params.lotNo) {
      throw new Error("Lot tracked products require a lot number.");
    }

    const [lot] = await tx
      .select({
        id: productLots.id,
      })
      .from(productLots)
      .where(and(eq(productLots.productId, params.productId), eq(productLots.lotNo, params.lotNo), isNull(productLots.deletedAt)))
      .limit(1);

    if (!lot && !params.allowCreateInbound) {
      throw new Error(`Lot ${params.lotNo} does not exist.`);
    }

    if (!lot) {
      const [created] = await tx
        .insert(productLots)
        .values({
          productId: params.productId,
          lotNo: params.lotNo,
          status: "available",
          currentLocationId: params.locationId,
          landedUnitCostMinor: params.unitCostMinor || null,
        })
        .returning({ id: productLots.id });

      productLotId = created.id;
    } else {
      productLotId = lot.id;
    }
  }

  return {
    productSerialId,
    productLotId,
    serialCurrentLocationId,
  };
}

async function getBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    companyId: string;
    ownerId: string;
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
        eq(stockBalances.ownerId, params.ownerId),
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

type PreparedStockOperationLine = {
  ownerId: string;
  product: {
    id: string;
    sku: string;
    unitId: string;
    trackingMode: string;
    currencyCode: string;
    standardCostMinor: number;
  };
  productSerialId: string | null;
  productLotId: string | null;
  quantity: number;
  unitCostMinor: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};

async function getOperationProductMap(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], companyId: string) {
  const productRows = await tx
    .select({
      id: products.id,
      sku: products.sku,
      unitId: products.unitId,
      trackingMode: products.trackingMode,
      currencyCode: products.currencyCode,
      standardCostMinor: products.standardCostMinor,
    })
    .from(products)
    .where(and(eq(products.companyId, companyId), isNull(products.deletedAt), eq(products.isActive, true)));

  return new Map(productRows.map((product) => [product.id, product]));
}

async function addToBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    companyId: string;
    ownerId: string;
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
    ownerId: params.ownerId,
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
    ownerId: string;
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

export async function createInventoryAdjustment(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = adjustmentSchema.safeParse({
    ownerId: formValue(formData, "ownerId"),
    locationId: formValue(formData, "locationId"),
    sourceNo: formValue(formData, "sourceNo"),
    notes: formValue(formData, "notes"),
  });
  const inputLines = parseCountLines(formData);

  if (!parsed.success) {
    redirectWithError("/admin/inventory/operations/adjustments/new", parsed.error.issues[0]?.message ?? "Invalid adjustment.");
  }

  if (inputLines.length === 0) {
    redirectWithError("/admin/inventory/operations/adjustments/new", "At least one counted line is required.");
  }

  const company = await getDefaultCompany();
  const adjustmentLocation = await getOrCreateSystemStockLocation(company.id, "adjustment");
  const movementNo = documentNo("ADJ");
  let movementId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const owner = await validateOwner(tx, company.id, parsed.data.ownerId);
      await validateSelectableLocation(tx, company.id, parsed.data.locationId);

      const productById = await getOperationProductMap(tx, company.id);
      const preparedLines: PreparedStockOperationLine[] = [];

      for (const line of inputLines) {
        const product = productById.get(line.productId);

        if (!product) {
          throw new Error("One or more products are invalid.");
        }

        if (!Number.isFinite(line.countedQuantity) || line.countedQuantity < 0) {
          throw new Error(`Counted quantity for ${product.sku} must be zero or greater.`);
        }

        if (product.trackingMode === "serial" && ![0, 1].includes(line.countedQuantity)) {
          throw new Error(`Serialized product ${product.sku} counted quantity must be 0 or 1.`);
        }

        const tracked = await resolveTrackedStock(tx, {
          productId: product.id,
          trackingMode: product.trackingMode,
          locationId: parsed.data.locationId,
          serialNo: line.serialNo,
          lotNo: line.lotNo,
          allowCreateInbound: true,
          unitCostMinor: product.standardCostMinor,
        });
        const balance = await getBalance(tx, {
          companyId: company.id,
          ownerId: owner.id,
          locationId: parsed.data.locationId,
          productId: product.id,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
        });
        const previousQuantity = Number(balance?.quantityOnHand ?? 0);
        const difference = line.countedQuantity - previousQuantity;

        if (difference === 0) {
          continue;
        }

        if (product.trackingMode === "serial" && Math.abs(difference) !== 1) {
          throw new Error(`Serialized product ${product.sku} adjustment difference must be 1 or -1.`);
        }

        if (
          product.trackingMode === "serial" &&
          difference > 0 &&
          tracked.serialCurrentLocationId &&
          tracked.serialCurrentLocationId !== parsed.data.locationId
        ) {
          throw new Error(`Serial ${line.serialNo} already belongs to another location.`);
        }

        const quantity = Math.abs(difference);
        const unitCostMinor = balance?.averageCostMinor || product.standardCostMinor;
        const fromLocationId = difference > 0 ? adjustmentLocation.id : parsed.data.locationId;
        const toLocationId = difference > 0 ? parsed.data.locationId : adjustmentLocation.id;

        if (difference > 0) {
          await addToBalance(tx, {
            companyId: company.id,
            ownerId: owner.id,
            locationId: parsed.data.locationId,
            productId: product.id,
            productSerialId: tracked.productSerialId,
            productLotId: tracked.productLotId,
            quantity,
            unitCostMinor,
            currencyCode: product.currencyCode,
          });
        } else {
          await removeFromBalance(tx, {
            companyId: company.id,
            ownerId: owner.id,
            locationId: parsed.data.locationId,
            productId: product.id,
            productSerialId: tracked.productSerialId,
            productLotId: tracked.productLotId,
            quantity,
          });
        }

        if (tracked.productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: difference > 0 ? "available" : "damaged",
              currentLocationId: difference > 0 ? parsed.data.locationId : adjustmentLocation.id,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, tracked.productSerialId));
        }

        if (tracked.productLotId) {
          await tx
            .update(productLots)
            .set({
              status: difference > 0 ? "available" : "damaged",
              currentLocationId: difference > 0 ? parsed.data.locationId : adjustmentLocation.id,
              updatedAt: sql`now()`,
            })
            .where(eq(productLots.id, tracked.productLotId));
        }

        preparedLines.push({
          ownerId: owner.id,
          product,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity,
          unitCostMinor,
          fromLocationId,
          toLocationId,
          notes: line.notes,
          metadata: {
            countedQuantity: line.countedQuantity,
            previousQuantity,
            difference,
          },
        });
      }

      if (preparedLines.length === 0) {
        throw new Error("No adjustment needed. Counted quantity matches current on hand.");
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          ownerId: owner.id,
          movementNo,
          movementType: "adjustment",
          status: "posted",
          fromLocationId: null,
          toLocationId: null,
          sourceType: "inventory_adjustment",
          sourceNo: parsed.data.sourceNo || movementNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: parsed.data.notes || null,
          metadata: {
            countedLocationId: parsed.data.locationId,
            adjustmentLocationId: adjustmentLocation.id,
          },
        })
        .returning({ id: stockMovements.id });
      movementId = movement.id;

      await tx.insert(stockMovementLines).values(
        preparedLines.map((line, index) => ({
          stockMovementId: movement.id,
          ownerId: line.ownerId,
          lineNo: index + 1,
          productId: line.product.id,
          productSerialId: line.productSerialId,
          productLotId: line.productLotId,
          unitId: line.product.unitId,
          fromLocationId: line.fromLocationId,
          toLocationId: line.toLocationId,
          quantity: String(line.quantity),
          totalCostMinor: Math.round(line.quantity * line.unitCostMinor),
          currencyCode: line.product.currencyCode,
          notes: line.notes,
          metadata: line.metadata,
        })),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "inventory_adjustment.post",
        entityType: "stock_movement",
        entityId: movement.id,
        severity: "info",
        metadata: { movementNo, lineCount: preparedLines.length },
      });
    });
  } catch (error) {
    redirectWithError("/admin/inventory/operations/adjustments/new", error instanceof Error ? error.message : "Could not post adjustment.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/operations");
  redirect(`/admin/inventory/operations/${movementId}?notice=${encodeURIComponent("Inventory adjustment posted")}`);
}

export async function createScrapOperation(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = scrapSchema.safeParse({
    ownerId: formValue(formData, "ownerId"),
    locationId: formValue(formData, "locationId"),
    sourceNo: formValue(formData, "sourceNo"),
    notes: formValue(formData, "notes"),
  });
  const inputLines = parseScrapLines(formData);

  if (!parsed.success) {
    redirectWithError("/admin/inventory/operations/scrap/new", parsed.error.issues[0]?.message ?? "Invalid scrap operation.");
  }

  if (inputLines.length === 0) {
    redirectWithError("/admin/inventory/operations/scrap/new", "At least one scrap line is required.");
  }

  const company = await getDefaultCompany();
  const scrapLocation = await getOrCreateSystemStockLocation(company.id, "scrap");
  const movementNo = documentNo("SCR");
  let movementId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const owner = await validateOwner(tx, company.id, parsed.data.ownerId);
      await validateSelectableLocation(tx, company.id, parsed.data.locationId);

      const productById = await getOperationProductMap(tx, company.id);
      const preparedLines: PreparedStockOperationLine[] = [];

      for (const line of inputLines) {
        const product = productById.get(line.productId);

        if (!product) {
          throw new Error("One or more products are invalid.");
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          throw new Error(`Scrap quantity for ${product.sku} must be greater than zero.`);
        }

        if (product.trackingMode === "serial" && line.quantity !== 1) {
          throw new Error(`Serialized product ${product.sku} scrap quantity must be 1.`);
        }

        const tracked = await resolveTrackedStock(tx, {
          productId: product.id,
          trackingMode: product.trackingMode,
          locationId: parsed.data.locationId,
          serialNo: line.serialNo,
          lotNo: line.lotNo,
          allowCreateInbound: false,
          unitCostMinor: product.standardCostMinor,
        });
        const balance = await removeFromBalance(tx, {
          companyId: company.id,
          ownerId: owner.id,
          locationId: parsed.data.locationId,
          productId: product.id,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity: line.quantity,
        });
        const unitCostMinor = balance.averageCostMinor || product.standardCostMinor;

        await addToBalance(tx, {
          companyId: company.id,
          ownerId: owner.id,
          locationId: scrapLocation.id,
          productId: product.id,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity: line.quantity,
          unitCostMinor,
          currencyCode: product.currencyCode,
        });

        if (tracked.productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: "scrapped",
              currentLocationId: scrapLocation.id,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, tracked.productSerialId));
        }

        if (tracked.productLotId) {
          await tx
            .update(productLots)
            .set({
              status: "scrapped",
              currentLocationId: scrapLocation.id,
              updatedAt: sql`now()`,
            })
            .where(eq(productLots.id, tracked.productLotId));
        }

        preparedLines.push({
          ownerId: owner.id,
          product,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity: line.quantity,
          unitCostMinor,
          fromLocationId: parsed.data.locationId,
          toLocationId: scrapLocation.id,
          notes: line.notes,
          metadata: {},
        });
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          ownerId: owner.id,
          movementNo,
          movementType: "scrap",
          status: "posted",
          fromLocationId: parsed.data.locationId,
          toLocationId: scrapLocation.id,
          sourceType: "scrap",
          sourceNo: parsed.data.sourceNo || movementNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: parsed.data.notes || null,
        })
        .returning({ id: stockMovements.id });
      movementId = movement.id;

      await tx.insert(stockMovementLines).values(
        preparedLines.map((line, index) => ({
          stockMovementId: movement.id,
          ownerId: line.ownerId,
          lineNo: index + 1,
          productId: line.product.id,
          productSerialId: line.productSerialId,
          productLotId: line.productLotId,
          unitId: line.product.unitId,
          fromLocationId: line.fromLocationId,
          toLocationId: line.toLocationId,
          quantity: String(line.quantity),
          totalCostMinor: Math.round(line.quantity * line.unitCostMinor),
          currencyCode: line.product.currencyCode,
          notes: line.notes,
          metadata: line.metadata,
        })),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "scrap_operation.post",
        entityType: "stock_movement",
        entityId: movement.id,
        severity: "info",
        metadata: { movementNo, lineCount: preparedLines.length },
      });
    });
  } catch (error) {
    redirectWithError("/admin/inventory/operations/scrap/new", error instanceof Error ? error.message : "Could not post scrap operation.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/operations");
  redirect(`/admin/inventory/operations/${movementId}?notice=${encodeURIComponent("Scrap operation posted")}`);
}

export async function createInternalTransferOperation(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = internalTransferSchema.safeParse({
    ownerId: formValue(formData, "ownerId"),
    fromLocationId: formValue(formData, "fromLocationId"),
    toLocationId: formValue(formData, "toLocationId"),
    sourceNo: formValue(formData, "sourceNo"),
    notes: formValue(formData, "notes"),
  });
  const inputLines = parseScrapLines(formData);

  if (!parsed.success) {
    redirectWithError("/admin/inventory/operations/internal-transfers/new", parsed.error.issues[0]?.message ?? "Invalid internal transfer.");
  }

  if (parsed.data.fromLocationId === parsed.data.toLocationId) {
    redirectWithError("/admin/inventory/operations/internal-transfers/new", "Source and destination locations must be different.");
  }

  if (inputLines.length === 0) {
    redirectWithError("/admin/inventory/operations/internal-transfers/new", "At least one transfer line is required.");
  }

  const company = await getDefaultCompany();
  const movementNo = documentNo("INT");
  let movementId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const owner = await validateOwner(tx, company.id, parsed.data.ownerId);
      await validateSelectableLocation(tx, company.id, parsed.data.fromLocationId);
      await validateSelectableLocation(tx, company.id, parsed.data.toLocationId);

      const productById = await getOperationProductMap(tx, company.id);
      const preparedLines: PreparedStockOperationLine[] = [];

      for (const line of inputLines) {
        const product = productById.get(line.productId);

        if (!product) {
          throw new Error("One or more products are invalid.");
        }

        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          throw new Error(`Transfer quantity for ${product.sku} must be greater than zero.`);
        }

        if (product.trackingMode === "serial" && line.quantity !== 1) {
          throw new Error(`Serialized product ${product.sku} transfer quantity must be 1.`);
        }

        const tracked = await resolveTrackedStock(tx, {
          productId: product.id,
          trackingMode: product.trackingMode,
          locationId: parsed.data.fromLocationId,
          serialNo: line.serialNo,
          lotNo: line.lotNo,
          allowCreateInbound: false,
          unitCostMinor: product.standardCostMinor,
        });

        if (
          product.trackingMode === "serial" &&
          tracked.serialCurrentLocationId &&
          tracked.serialCurrentLocationId !== parsed.data.fromLocationId
        ) {
          throw new Error(`Serial ${line.serialNo} is not in the source location.`);
        }

        const sourceBalance = await removeFromBalance(tx, {
          companyId: company.id,
          ownerId: owner.id,
          locationId: parsed.data.fromLocationId,
          productId: product.id,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity: line.quantity,
        });
        const unitCostMinor = sourceBalance.averageCostMinor || product.standardCostMinor;

        await addToBalance(tx, {
          companyId: company.id,
          ownerId: owner.id,
          locationId: parsed.data.toLocationId,
          productId: product.id,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity: line.quantity,
          unitCostMinor,
          currencyCode: product.currencyCode,
        });

        if (tracked.productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: "available",
              currentLocationId: parsed.data.toLocationId,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, tracked.productSerialId));
        }

        if (tracked.productLotId) {
          await tx
            .update(productLots)
            .set({
              status: "available",
              currentLocationId: parsed.data.toLocationId,
              updatedAt: sql`now()`,
            })
            .where(eq(productLots.id, tracked.productLotId));
        }

        preparedLines.push({
          ownerId: owner.id,
          product,
          productSerialId: tracked.productSerialId,
          productLotId: tracked.productLotId,
          quantity: line.quantity,
          unitCostMinor,
          fromLocationId: parsed.data.fromLocationId,
          toLocationId: parsed.data.toLocationId,
          notes: line.notes,
          metadata: {},
        });
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          ownerId: owner.id,
          movementNo,
          movementType: "transfer",
          status: "posted",
          fromLocationId: parsed.data.fromLocationId,
          toLocationId: parsed.data.toLocationId,
          sourceType: "internal_transfer",
          sourceNo: parsed.data.sourceNo || movementNo,
          postedAt: new Date(),
          postedBy: user.id,
          notes: parsed.data.notes || null,
        })
        .returning({ id: stockMovements.id });
      movementId = movement.id;

      await tx.insert(stockMovementLines).values(
        preparedLines.map((line, index) => ({
          stockMovementId: movement.id,
          ownerId: line.ownerId,
          lineNo: index + 1,
          productId: line.product.id,
          productSerialId: line.productSerialId,
          productLotId: line.productLotId,
          unitId: line.product.unitId,
          fromLocationId: line.fromLocationId,
          toLocationId: line.toLocationId,
          quantity: String(line.quantity),
          totalCostMinor: Math.round(line.quantity * line.unitCostMinor),
          currencyCode: line.product.currencyCode,
          notes: line.notes,
          metadata: line.metadata,
        })),
      );

      await tx.insert(auditLogs).values({
        companyId: company.id,
        actorUserId: user.id,
        action: "internal_transfer.post",
        entityType: "stock_movement",
        entityId: movement.id,
        severity: "info",
        metadata: { movementNo, lineCount: preparedLines.length },
      });
    });
  } catch (error) {
    redirectWithError("/admin/inventory/operations/internal-transfers/new", error instanceof Error ? error.message : "Could not post internal transfer.");
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/inventory/operations");
  redirect(`/admin/inventory/operations/${movementId}?notice=${encodeURIComponent("Internal transfer posted")}`);
}

export async function createInventoryOperation(formData: FormData) {
  const user = await requirePermission("inventory.receive");
  const parsed = createOperationSchema.safeParse({
    movementType: formValue(formData, "movementType"),
    ownerId: formValue(formData, "ownerId"),
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
      const owner = await validateOwner(tx, company.id, parsed.data.ownerId);
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
          standardCostMinor: products.standardCostMinor,
        })
        .from(products)
        .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)));
      const productById = new Map(productRows.map((product) => [product.id, product]));

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          companyId: company.id,
          ownerId: owner.id,
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
          const unitCostMinor = product.standardCostMinor;

          return {
            stockMovementId: movement.id,
            ownerId: owner.id,
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
            totalCostMinor: Math.round(Math.abs(line.quantity) * unitCostMinor),
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
          ownerId: stockMovements.ownerId,
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
          ownerId: stockMovementLines.ownerId,
          productId: stockMovementLines.productId,
          quantity: stockMovementLines.quantity,
          totalCostMinor: stockMovementLines.totalCostMinor,
          currencyCode: stockMovementLines.currencyCode,
          metadata: stockMovementLines.metadata,
          trackingMode: products.trackingMode,
          sku: products.sku,
          standardCostMinor: products.standardCostMinor,
        })
        .from(stockMovementLines)
        .innerJoin(products, eq(stockMovementLines.productId, products.id))
        .where(and(eq(stockMovementLines.stockMovementId, movement.id), isNull(stockMovementLines.deletedAt)))
        .orderBy(sql`${stockMovementLines.lineNo} asc`);

      if (lines.length === 0) {
        throw new Error("Operation has no lines.");
      }

      for (const line of lines) {
        const lineOwnerId = line.ownerId ?? movement.ownerId;

        if (!lineOwnerId) {
          throw new Error(`Owner is required on operation line ${line.lineNo}.`);
        }

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

        let operationUnitCostMinor =
          quantity > 0 && line.totalCostMinor > 0
            ? Math.round(line.totalCostMinor / quantity)
            : line.standardCostMinor;

        if (outboundLocationId) {
          const balance = await removeFromBalance(tx, {
            companyId: company.id,
            ownerId: lineOwnerId,
            locationId: outboundLocationId,
            productId: line.productId,
            productSerialId,
            productLotId,
            quantity,
          });

          if (balance.averageCostMinor > 0) {
            operationUnitCostMinor = balance.averageCostMinor;
            await tx
              .update(stockMovementLines)
              .set({
                totalCostMinor: Math.round(quantity * balance.averageCostMinor),
                updatedAt: sql`now()`,
              })
              .where(eq(stockMovementLines.id, line.id));
          }
        }

        if (inboundLocationId) {
          await addToBalance(tx, {
            companyId: company.id,
            ownerId: lineOwnerId,
            locationId: inboundLocationId,
            productId: line.productId,
            productSerialId,
            productLotId,
            quantity,
            unitCostMinor: operationUnitCostMinor,
            currencyCode: line.currencyCode,
          });
        }

        await tx
          .update(stockMovementLines)
          .set({
            productSerialId,
            productLotId,
            ownerId: lineOwnerId,
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
