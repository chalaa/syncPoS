import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDefaultCompany, majorToMinor } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  auditLogs,
  locations,
  productSerials,
  products,
  stockBalances,
  stockMovementLines,
  stockMovements,
} from "@/server/db/schema";
import type {
  OpeningStockCommitPayload,
  OpeningStockImportRow,
} from "@/server/inventory/types";

const templateHeaders = ["sku", "location_code", "quantity", "unit_cost", "serial_no", "notes"];

export const openingStockTemplateCsv = `${templateHeaders.join(",")}
SKU-001,WH-001,10,1250.50,,Opening stock for bulk item
SKU-002,SHOP-001,1,85000,SERIAL-001,Opening stock for serialized item
`;

type ParsedCsvRow = {
  rowNumber: number;
  sku: string;
  locationCode: string;
  quantity: string;
  unitCost: string;
  serialNo: string;
  notes: string;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): ParsedCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    return {
      rowNumber: index + 2,
      sku: values[headerIndex.sku] ?? "",
      locationCode: values[headerIndex.location_code] ?? "",
      quantity: values[headerIndex.quantity] ?? "",
      unitCost: values[headerIndex.unit_cost] ?? "",
      serialNo: values[headerIndex.serial_no] ?? "",
      notes: values[headerIndex.notes] ?? "",
    };
  });
}

function positiveNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function importToken(rows: OpeningStockImportRow[]) {
  return createHash("sha256")
    .update(JSON.stringify(rows.map((row) => [row.sku, row.locationCode, row.quantity, row.unitCost, row.serialNo])))
    .digest("hex");
}

export async function previewOpeningStockCsv(text: string) {
  const company = await getDefaultCompany();
  const parsedRows = parseCsv(text);

  if (parsedRows.length === 0) {
    return {
      rows: [],
      importToken: undefined,
    };
  }

  const [productRows, locationRows] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        trackingMode: products.trackingMode,
        unitId: products.unitId,
        currencyCode: products.currencyCode,
      })
      .from(products)
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true))),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt), eq(locations.isActive, true))),
  ]);

  const productBySku = new Map(productRows.map((product) => [product.sku.toUpperCase(), product]));
  const locationByCode = new Map(locationRows.map((location) => [location.code.toUpperCase(), location]));
  const serialsSeen = new Set<string>();

  const rows = parsedRows.map((row): OpeningStockImportRow => {
    const sku = row.sku.trim().toUpperCase();
    const locationCode = row.locationCode.trim().toUpperCase();
    const serialNo = row.serialNo.trim();
    const quantity = positiveNumber(row.quantity);
    const unitCost = nonNegativeNumber(row.unitCost);
    const product = productBySku.get(sku);
    const location = locationByCode.get(locationCode);
    const errors: string[] = [];

    if (!sku) {
      errors.push("SKU is required.");
    } else if (!product) {
      errors.push("SKU does not match an active product.");
    }

    if (!locationCode) {
      errors.push("Location code is required.");
    } else if (!location) {
      errors.push("Location code does not match an active location.");
    }

    if (!quantity) {
      errors.push("Quantity must be greater than 0.");
    }

    if (unitCost === undefined) {
      errors.push("Unit cost must be 0 or greater.");
    }

    if (product?.trackingMode === "serial") {
      if (!serialNo) {
        errors.push("Serial number is required for serialized products.");
      }

      if (quantity && quantity !== 1) {
        errors.push("Serialized opening stock rows must have quantity 1.");
      }
    }

    if (product && product.trackingMode !== "serial" && serialNo) {
      errors.push("Serial number is only allowed for serialized products.");
    }

    if (serialNo) {
      const serialKey = `${sku}:${serialNo.toUpperCase()}`;

      if (serialsSeen.has(serialKey)) {
        errors.push("Duplicate serial number in import file.");
      }

      serialsSeen.add(serialKey);
    }

    return {
      rowNumber: row.rowNumber,
      sku,
      productName: product?.name ?? "",
      trackingMode: product?.trackingMode ?? "none",
      locationCode,
      locationName: location?.name ?? "",
      quantity: quantity ? String(quantity) : row.quantity.trim(),
      unitCost: unitCost === undefined ? row.unitCost.trim() : String(unitCost),
      unitCostMinor: unitCost === undefined ? 0 : majorToMinor(String(unitCost)),
      totalCostMinor: quantity && unitCost !== undefined ? Math.round(quantity * majorToMinor(String(unitCost))) : 0,
      serialNo,
      notes: row.notes.trim(),
      errors,
    };
  });

  return {
    rows,
    importToken: importToken(rows),
  };
}

export async function commitOpeningStockImport(payload: OpeningStockCommitPayload, actorUserId: string) {
  const company = await getDefaultCompany();
  const expectedToken = importToken(payload.rows);

  if (expectedToken !== payload.importToken) {
    throw new Error("Import preview is stale. Please validate the file again.");
  }

  if (payload.rows.length === 0 || payload.rows.some((row) => row.errors.length > 0)) {
    throw new Error("Only a valid preview can be imported.");
  }

  const movementNo = `OS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;

  return db.transaction(async (tx) => {
    const [firstLocation] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.companyId, company.id),
          eq(locations.code, payload.rows[0].locationCode),
          isNull(locations.deletedAt),
        ),
      )
      .limit(1);

    if (!firstLocation) {
      throw new Error("First import row location no longer exists.");
    }

    const [movement] = await tx
      .insert(stockMovements)
      .values({
        companyId: company.id,
        movementNo,
        movementType: "opening_balance",
        status: "posted",
        toLocationId: firstLocation.id,
        postedAt: new Date(),
        postedBy: actorUserId,
        sourceType: "opening_stock_import",
        sourceNo: movementNo,
        notes: "Opening stock import",
        metadata: {
          importToken: payload.importToken,
          rowCount: payload.rows.length,
        },
      })
      .returning({ id: stockMovements.id });

    for (const [index, row] of payload.rows.entries()) {
      const [product] = await tx
        .select({
          id: products.id,
          sku: products.sku,
          trackingMode: products.trackingMode,
          unitId: products.unitId,
          currencyCode: products.currencyCode,
        })
        .from(products)
        .where(and(eq(products.companyId, company.id), eq(products.sku, row.sku), isNull(products.deletedAt)))
        .limit(1);

      const [location] = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(and(eq(locations.companyId, company.id), eq(locations.code, row.locationCode), isNull(locations.deletedAt)))
        .limit(1);

      if (!product || !location) {
        throw new Error(`Row ${row.rowNumber} no longer matches product or location data.`);
      }

      let productSerialId: string | null = null;

      if (product.trackingMode === "serial") {
        const [existingSerial] = await tx
          .select({
            id: productSerials.id,
            productId: productSerials.productId,
          })
          .from(productSerials)
          .where(eq(productSerials.serialNo, row.serialNo))
          .limit(1);

        if (existingSerial && existingSerial.productId !== product.id) {
          throw new Error(`Row ${row.rowNumber} serial number belongs to another product.`);
        }

        if (existingSerial) {
          productSerialId = existingSerial.id;
          await tx
            .update(productSerials)
            .set({
              status: "available",
              currentLocationId: location.id,
              landedUnitCostMinor: row.unitCostMinor,
              updatedAt: sql`now()`,
            })
            .where(eq(productSerials.id, existingSerial.id));
        } else {
          const [createdSerial] = await tx
            .insert(productSerials)
            .values({
              productId: product.id,
              serialNo: row.serialNo,
              status: "available",
              currentLocationId: location.id,
              landedUnitCostMinor: row.unitCostMinor,
            })
            .returning({ id: productSerials.id });

          productSerialId = createdSerial.id;
        }
      }

      await tx.insert(stockMovementLines).values({
        stockMovementId: movement.id,
        lineNo: index + 1,
        productId: product.id,
        productSerialId,
        toLocationId: location.id,
        unitId: product.unitId,
        quantity: row.quantity,
        unitCostMinor: row.unitCostMinor,
        totalCostMinor: row.totalCostMinor,
        currencyCode: product.currencyCode,
        notes: row.notes || null,
        metadata: {
          importRowNumber: row.rowNumber,
        },
      });

      const serialFilter = productSerialId
        ? eq(stockBalances.productSerialId, productSerialId)
        : isNull(stockBalances.productSerialId);
      const [existingBalance] = await tx
        .select({
          id: stockBalances.id,
          quantityOnHand: stockBalances.quantityOnHand,
          quantityReserved: stockBalances.quantityReserved,
        })
        .from(stockBalances)
        .where(
          and(
            eq(stockBalances.companyId, company.id),
            eq(stockBalances.locationId, location.id),
            eq(stockBalances.productId, product.id),
            serialFilter,
            isNull(stockBalances.deletedAt),
          ),
        )
        .limit(1);
      const currentOnHand = existingBalance ? Number(existingBalance.quantityOnHand) : 0;
      const currentReserved = existingBalance ? Number(existingBalance.quantityReserved) : 0;
      const nextOnHand = currentOnHand + Number(row.quantity);
      const nextAvailable = nextOnHand - currentReserved;

      if (existingBalance) {
        await tx
          .update(stockBalances)
          .set({
            quantityOnHand: String(nextOnHand),
            quantityAvailable: String(nextAvailable),
            averageCostMinor: row.unitCostMinor,
            lastMovementAt: new Date(),
            updatedAt: sql`now()`,
          })
          .where(eq(stockBalances.id, existingBalance.id));
      } else {
        await tx.insert(stockBalances).values({
          companyId: company.id,
          locationId: location.id,
          productId: product.id,
          productSerialId,
          quantityOnHand: row.quantity,
          quantityReserved: "0",
          quantityAvailable: row.quantity,
          averageCostMinor: row.unitCostMinor,
          currencyCode: product.currencyCode,
          lastMovementAt: new Date(),
        });
      }
    }

    await tx.insert(auditLogs).values({
      companyId: company.id,
      actorUserId,
      action: "inventory.opening_stock_import",
      entityType: "stock_movement",
      entityId: movement.id,
      severity: "info",
      metadata: {
        movementNo,
        importToken: payload.importToken,
        rowCount: payload.rows.length,
      },
    });

    return { movementNo };
  });
}
