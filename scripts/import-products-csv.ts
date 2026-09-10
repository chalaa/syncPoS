import "dotenv/config";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  auditLogs,
  brands,
  companies,
  locations,
  owners,
  productCategories,
  products,
  stockBalances,
  stockMovementLines,
  stockMovements,
  unitsOfMeasure,
  users,
} from "@/server/db/schema";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the import script.");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidFromSeed(value: string) {
  const hash = sha256(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [[]];
  let inQuotes = false;
  let row = 0;
  let col = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        rows[row][col] += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      col++;
      rows[row][col] = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      row++;
      col = 0;
      rows[row] = [""];
    } else {
      if (!rows[row][col]) rows[row][col] = "";
      rows[row][col] += char;
    }
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

interface CsvProductRow {
  rowNumber: number;
  productName: string;
  category: string;
  brand: string;
  model: string;
  country: string;
  specifications: Record<string, string | null>;
  unit: string;
  stockQty: number;
  salesUnitPriceMinor: number;
  description: string;
  owner: string;
}

function generateStandardName(params: {
  brandName?: string;
  model?: string;
  categoryName?: string;
  specifications: Record<string, string | null>;
  productName: string;
}): string {
  const specVals = Object.values(params.specifications)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  const parts = [
    params.brandName,
    params.model?.trim(),
    params.categoryName,
    ...specVals,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : params.productName;
}

async function main() {
  const csvPath = resolve("/home/cassiopeia/Downloads/products_for_import.csv");
  console.log(`Reading CSV from ${csvPath}...`);
  const rawCsv = readFileSync(csvPath, "utf-8");

  const parsed = parseCSV(rawCsv);
  if (parsed.length < 2) {
    throw new Error("CSV file must contain at least a header row and one data row.");
  }

  const headers = parsed[0].map((h) => h.trim());
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => headerMap.set(h, i));

  const requiredHeaders = ["product_name", "category", "brand", "unit", "stock_qty", "owner"];
  for (const req of requiredHeaders) {
    if (!headerMap.has(req)) {
      throw new Error(`Missing required CSV column: ${req}`);
    }
  }

  const csvRows: CsvProductRow[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const r = parsed[i];
    const getVal = (col: string) => (r[headerMap.get(col) ?? -1] ?? "").trim();

    let specs: Record<string, string | null> = {};
    const specsRaw = getVal("specifications");
    if (specsRaw) {
      try {
        specs = JSON.parse(specsRaw);
      } catch (err) {
        console.warn(`Row ${i + 1}: Failed to parse specifications JSON: ${specsRaw}`);
      }
    }

    const priceRaw = getVal("sales_unit_price");
    const priceNum = priceRaw ? Number(priceRaw) : 0;
    const salesUnitPriceMinor = !isNaN(priceNum) && priceNum >= 0 ? Math.round(priceNum * 100) : 0;

    const qtyRaw = getVal("stock_qty");
    const qtyNum = Number(qtyRaw);

    csvRows.push({
      rowNumber: i + 1,
      productName: getVal("product_name"),
      category: getVal("category"),
      brand: getVal("brand"),
      model: getVal("model"),
      country: getVal("country"),
      specifications: specs,
      unit: getVal("unit"),
      stockQty: isNaN(qtyNum) ? 0 : qtyNum,
      salesUnitPriceMinor,
      description: getVal("description"),
      owner: getVal("owner"),
    });
  }

  console.log(`Parsed ${csvRows.length} product records from CSV.`);
  const totalStockQty = csvRows.reduce((sum, r) => sum + r.stockQty, 0);
  console.log(`Total stock quantity across all records: ${totalStockQty}`);

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch Company
      const [company] = await tx
        .select({ id: companies.id, baseCurrencyCode: companies.baseCurrencyCode })
        .from(companies)
        .where(isNull(companies.deletedAt))
        .limit(1);

      if (!company) {
        throw new Error("No active company found in database.");
      }
      console.log(`Active company: ${company.id} (${company.baseCurrencyCode})`);

      // 2. Fetch Admin User
      const [adminUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, "admin"))
        .limit(1);

      if (!adminUser) {
        throw new Error("Admin user not found.");
      }

      // 3. Fetch or map Unit of Measure (Pcs)
      const existingUnits = await tx
        .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
        .from(unitsOfMeasure)
        .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt)));

      const pcsUnit = existingUnits.find(
        (u) => u.code.toUpperCase() === "UOM-0001" || u.name.toLowerCase() === "pcs",
      );

      if (!pcsUnit) {
        throw new Error("Unit of measure 'Pcs' not found in database.");
      }
      console.log(`Using Unit of Measure: ${pcsUnit.name} (${pcsUnit.id})`);

      // 4. Fetch Owner (Mesud)
      const existingOwners = await tx
        .select({ id: owners.id, name: owners.name })
        .from(owners)
        .where(and(eq(owners.companyId, company.id), isNull(owners.deletedAt)));

      const mesudOwner = existingOwners.find((o) => o.name.toLowerCase() === "mesud");
      if (!mesudOwner) {
        throw new Error("Owner 'Mesud' not found in database.");
      }
      console.log(`Using Owner: ${mesudOwner.name} (${mesudOwner.id})`);

      // 5. Fetch Target Location (SHOP-001: Mesud Display Shop)
      const existingLocations = await tx
        .select({ id: locations.id, code: locations.code, name: locations.name })
        .from(locations)
        .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt)));

      const targetLocation =
        existingLocations.find((l) => l.code === "SHOP-001") ??
        existingLocations.find((l) => l.code === "WH-001") ??
        existingLocations[0];

      if (!targetLocation) {
        throw new Error("No valid storage location found in database.");
      }
      console.log(`Using Location: ${targetLocation.name} (${targetLocation.code}, ${targetLocation.id})`);

      // 6. Ensure Categories Exist
      const existingCategories = await tx
        .select({ id: productCategories.id, code: productCategories.code, name: productCategories.name })
        .from(productCategories)
        .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt)));

      const categoryMap = new Map<string, { id: string; code: string; name: string }>();
      for (const cat of existingCategories) {
        categoryMap.set(cat.name.toLowerCase().trim(), cat);
        categoryMap.set(cat.code.toLowerCase().trim(), cat);
      }

      let maxCatNum = 0;
      for (const cat of existingCategories) {
        const num = parseInt(cat.code.replace(/\D/g, "") || "0", 10);
        if (!isNaN(num) && num > maxCatNum) maxCatNum = num;
      }

      const uniqueCsvCategories = Array.from(new Set(csvRows.map((r) => r.category.trim()).filter(Boolean)));
      for (const catName of uniqueCsvCategories) {
        if (!categoryMap.has(catName.toLowerCase())) {
          maxCatNum++;
          const newCode = `CAT-${String(maxCatNum).padStart(4, "0")}`;
          const newId = uuidFromSeed(`import:category:${catName.toLowerCase()}`);
          console.log(`Creating missing category: "${catName}" with code ${newCode}`);
          await tx
            .insert(productCategories)
            .values({
              id: newId,
              companyId: company.id,
              code: newCode,
              name: catName,
              isActive: true,
            })
            .onConflictDoUpdate({
              target: productCategories.id,
              set: { name: catName, isActive: true },
            });
          const catRecord = { id: newId, code: newCode, name: catName };
          categoryMap.set(catName.toLowerCase(), catRecord);
        }
      }

      // 7. Ensure Brands Exist
      const existingBrands = await tx
        .select({ id: brands.id, code: brands.code, name: brands.name })
        .from(brands)
        .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt)));

      const brandMap = new Map<string, { id: string; code: string; name: string }>();
      for (const b of existingBrands) {
        brandMap.set(b.name.toLowerCase().trim(), b);
        brandMap.set(b.code.toLowerCase().trim(), b);
      }

      let maxBrandNum = 0;
      for (const b of existingBrands) {
        const num = parseInt(b.code.replace(/\D/g, "") || "0", 10);
        if (!isNaN(num) && num > maxBrandNum) maxBrandNum = num;
      }

      const uniqueCsvBrands = Array.from(new Set(csvRows.map((r) => r.brand.trim()).filter(Boolean)));
      for (const brandName of uniqueCsvBrands) {
        if (!brandMap.has(brandName.toLowerCase())) {
          maxBrandNum++;
          const newCode = `BRD-${String(maxBrandNum).padStart(4, "0")}`;
          const newId = uuidFromSeed(`import:brand:${brandName.toLowerCase()}`);
          console.log(`Creating missing brand: "${brandName}" with code ${newCode}`);
          await tx
            .insert(brands)
            .values({
              id: newId,
              companyId: company.id,
              code: newCode,
              name: brandName,
              isActive: true,
            })
            .onConflictDoUpdate({
              target: brands.id,
              set: { name: brandName, isActive: true },
            });
          const brandRecord = { id: newId, code: newCode, name: brandName };
          brandMap.set(brandName.toLowerCase(), brandRecord);
        }
      }

      // 8. Determine Next Product SKU
      const existingProducts = await tx
        .select({ sku: products.sku })
        .from(products)
        .where(eq(products.companyId, company.id));

      let maxSkuNum = 0;
      for (const p of existingProducts) {
        const num = parseInt(p.sku.replace(/\D/g, "") || "0", 10);
        if (!isNaN(num) && num > maxSkuNum) maxSkuNum = num;
      }
      console.log(`Current highest SKU number: ${maxSkuNum}. Starting new items from ${maxSkuNum + 1}`);

      // 9. Prepare and Insert 74 Products
      interface InsertedProductInfo {
        id: string;
        sku: string;
        name: string;
        stockQty: number;
        lineNo: number;
      }

      const insertedProducts: InsertedProductInfo[] = [];

      for (let idx = 0; idx < csvRows.length; idx++) {
        const row = csvRows[idx];
        const currentSkuNum = maxSkuNum + 1 + idx;
        const sku = `ITEM-${String(currentSkuNum).padStart(5, "0")}`;
        const productId = uuidFromSeed(`import:product:row-${row.rowNumber}:${sku}`);

        const cat = categoryMap.get(row.category.toLowerCase().trim());
        const brand = brandMap.get(row.brand.toLowerCase().trim());

        const standardName = generateStandardName({
          brandName: brand?.name,
          model: row.model,
          categoryName: cat?.name,
          specifications: row.specifications,
          productName: row.productName,
        });

        await tx
          .insert(products)
          .values({
            id: productId,
            companyId: company.id,
            sku,
            name: row.productName,
            standardName,
            categoryId: cat?.id ?? null,
            brandId: brand?.id ?? null,
            model: row.model || null,
            country: row.country || null,
            description: row.description || null,
            specifications: row.specifications,
            unitId: pcsUnit.id,
            trackingMode: "none",
            standardCostMinor: 0,
            listPriceMinor: row.salesUnitPriceMinor,
            currencyCode: company.baseCurrencyCode,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: products.id,
            set: {
              name: row.productName,
              standardName,
              categoryId: cat?.id ?? null,
              brandId: brand?.id ?? null,
              model: row.model || null,
              country: row.country || null,
              description: row.description || null,
              specifications: row.specifications,
              unitId: pcsUnit.id,
              listPriceMinor: row.salesUnitPriceMinor,
              updatedAt: sql`now()`,
            },
          });

        insertedProducts.push({
          id: productId,
          sku,
          name: row.productName,
          stockQty: row.stockQty,
          lineNo: idx + 1,
        });
      }

      console.log(`Successfully inserted ${insertedProducts.length} products.`);

      // 10. Record Opening Stock Movement
      const movementId = uuidFromSeed("import:stock-movement:products-for-import-csv");
      const movementNo = "OS-20260910-MESUD-IMPORT";

      await tx
        .insert(stockMovements)
        .values({
          id: movementId,
          companyId: company.id,
          ownerId: mesudOwner.id,
          movementNo,
          movementType: "opening_balance",
          status: "posted",
          movementDate: new Date(),
          toLocationId: targetLocation.id,
          postedAt: new Date(),
          postedBy: adminUser.id,
          sourceType: "opening_stock_import",
          sourceNo: movementNo,
          notes: `Opening stock import of 74 products (277 units) for owner ${mesudOwner.name} at ${targetLocation.name}`,
          metadata: {
            sourceFile: "products_for_import.csv",
            productCount: insertedProducts.length,
            totalStockQuantity: totalStockQty,
          },
        })
        .onConflictDoUpdate({
          target: stockMovements.id,
          set: {
            status: "posted",
            postedAt: new Date(),
            updatedAt: sql`now()`,
          },
        });

      console.log(`Created opening stock movement: ${movementNo} (${movementId})`);

      // 11. Insert Stock Movement Lines
      for (const item of insertedProducts) {
        const lineId = uuidFromSeed(`import:stock-movement-line:${movementNo}:${item.sku}`);

        await tx
          .insert(stockMovementLines)
          .values({
            id: lineId,
            stockMovementId: movementId,
            ownerId: mesudOwner.id,
            lineNo: item.lineNo,
            productId: item.id,
            toLocationId: targetLocation.id,
            unitId: pcsUnit.id,
            quantity: String(item.stockQty),
            totalCostMinor: 0,
            currencyCode: company.baseCurrencyCode,
            notes: `Initial stock for ${item.name}`,
            metadata: {
              sku: item.sku,
            },
          })
          .onConflictDoUpdate({
            target: stockMovementLines.id,
            set: {
              quantity: String(item.stockQty),
              updatedAt: sql`now()`,
            },
          });

        // 12. Upsert Stock Balance
        const balanceId = uuidFromSeed(
          `import:stock-balance:${company.id}:${targetLocation.id}:${mesudOwner.id}:${item.id}`,
        );

        await tx
          .insert(stockBalances)
          .values({
            id: balanceId,
            companyId: company.id,
            ownerId: mesudOwner.id,
            locationId: targetLocation.id,
            productId: item.id,
            quantityOnHand: String(item.stockQty),
            quantityReserved: "0",
            quantityAvailable: String(item.stockQty),
            averageCostMinor: 0,
            currencyCode: company.baseCurrencyCode,
            lastMovementAt: new Date(),
          })
          .onConflictDoUpdate({
            target: stockBalances.id,
            set: {
              quantityOnHand: String(item.stockQty),
              quantityAvailable: String(item.stockQty),
              lastMovementAt: new Date(),
              updatedAt: sql`now()`,
            },
          });
      }

      console.log(`Recorded ${insertedProducts.length} stock movement lines and balance records.`);

      // 13. Audit Log
      const auditId = uuidFromSeed("import:audit:products-for-import-csv");
      await tx
        .insert(auditLogs)
        .values({
          id: auditId,
          companyId: company.id,
          actorUserId: adminUser.id,
          action: "inventory.opening_stock_import",
          entityType: "stock_movement",
          entityId: movementId,
          severity: "info",
          metadata: {
            movementNo,
            sourceFile: "products_for_import.csv",
            productCount: insertedProducts.length,
            totalStockQuantity: totalStockQty,
          },
        })
        .onConflictDoNothing();

      console.log("Audit log entry created.");
    });

    console.log("==================================================");
    console.log("DATA IMPORT COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("IMPORT FAILED:", err);
  process.exit(1);
});
