import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/server/db/client";
import {
  brands,
  companies,
  goodsReceiptLines,
  goodsReceipts,
  locations,
  productLots,
  productCategories,
  productSerials,
  products,
  priceListItems,
  priceLists,
  purchaseOrderLines,
  purchaseOrders,
  stockBalances,
  stockMovementLines,
  stockMovements,
  taxes,
  unitsOfMeasure,
} from "@/server/db/schema";
import type {
  CatalogReferenceKind,
  CatalogReferenceRecord,
  ProductDetail,
  ProductDetailMovementRow,
  ProductDetailStockRow,
  ProductDetailTrackingRow,
  ProductPriceListRow,
  ProductTrackingListRow,
  TaxRecord,
} from "@/server/catalog/types";
export {
  productTypeOptions,
  taxComputationOptions,
  taxScopeOptions,
  trackingModeOptions,
} from "@/server/catalog/types";

export async function getDefaultCompany() {
  const [company] = await db
    .select({
      id: companies.id,
      code: companies.code,
      baseCurrencyCode: companies.baseCurrencyCode,
    })
    .from(companies)
    .where(and(eq(companies.code, "SYNC"), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new Error("Default company is missing. Run pnpm db:seed first.");
  }

  return company;
}

export async function getCatalogFormOptions() {
  const company = await getDefaultCompany();

  const [categoryRows, brandRows, unitRows] = await Promise.all([
    db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
      })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt)))
      .orderBy(asc(productCategories.name)),
    db
      .select({
        id: brands.id,
        code: brands.code,
        name: brands.name,
      })
      .from(brands)
      .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt)))
      .orderBy(asc(brands.name)),
    db
      .select({
        id: unitsOfMeasure.id,
        code: unitsOfMeasure.code,
        name: unitsOfMeasure.name,
      })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt)))
      .orderBy(asc(unitsOfMeasure.code)),
  ]);

  return {
    company,
    categories: categoryRows,
    brands: brandRows,
    units: unitRows,
  };
}

export async function getProductList(params: { query?: string; showDeleted?: boolean }) {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(products.deletedAt) : isNull(products.deletedAt);
  const searchFilter = query
    ? or(
        ilike(products.sku, `%${query}%`),
        ilike(products.barcode, `%${query}%`),
        ilike(products.name, `%${query}%`),
        ilike(products.model, `%${query}%`),
      )
    : undefined;

  const filters = [eq(products.companyId, company.id), deletedFilter, searchFilter].filter(Boolean);

  return db
    .select({
      id: products.id,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      model: products.model,
      productType: products.productType,
      trackingMode: products.trackingMode,
      standardCostMinor: products.standardCostMinor,
      listPriceMinor: products.listPriceMinor,
      currencyCode: products.currencyCode,
      isActive: products.isActive,
      deletedAt: products.deletedAt,
      categoryName: productCategories.name,
      brandName: brands.name,
      unitCode: unitsOfMeasure.code,
    })
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(unitsOfMeasure, eq(products.unitId, unitsOfMeasure.id))
    .where(and(...filters))
    .orderBy(desc(products.createdAt));
}

export async function getCatalogReferenceList(params: {
  kind: CatalogReferenceKind;
  query?: string;
  showDeleted?: boolean;
}): Promise<CatalogReferenceRecord[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();

  if (params.kind === "category") {
    const filters = [
      eq(productCategories.companyId, company.id),
      params.showDeleted ? isNotNull(productCategories.deletedAt) : isNull(productCategories.deletedAt),
      query
        ? or(
            ilike(productCategories.code, `%${query}%`),
            ilike(productCategories.name, `%${query}%`),
            ilike(productCategories.description, `%${query}%`),
          )
        : undefined,
    ].filter(Boolean);

    return db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        description: productCategories.description,
        isActive: productCategories.isActive,
        deletedAt: productCategories.deletedAt,
      })
      .from(productCategories)
      .where(and(...filters))
      .orderBy(asc(productCategories.name));
  }

  if (params.kind === "brand") {
    const filters = [
      eq(brands.companyId, company.id),
      params.showDeleted ? isNotNull(brands.deletedAt) : isNull(brands.deletedAt),
      query
        ? or(
            ilike(brands.code, `%${query}%`),
            ilike(brands.name, `%${query}%`),
            ilike(brands.description, `%${query}%`),
          )
        : undefined,
    ].filter(Boolean);

    return db
      .select({
        id: brands.id,
        code: brands.code,
        name: brands.name,
        description: brands.description,
        isActive: brands.isActive,
        deletedAt: brands.deletedAt,
      })
      .from(brands)
      .where(and(...filters))
      .orderBy(asc(brands.name));
  }

  const filters = [
    eq(unitsOfMeasure.companyId, company.id),
    params.showDeleted ? isNotNull(unitsOfMeasure.deletedAt) : isNull(unitsOfMeasure.deletedAt),
    query
      ? or(
          ilike(unitsOfMeasure.code, `%${query}%`),
          ilike(unitsOfMeasure.name, `%${query}%`),
        )
      : undefined,
  ].filter(Boolean);

  return db
    .select({
      id: unitsOfMeasure.id,
      code: unitsOfMeasure.code,
      name: unitsOfMeasure.name,
      precision: unitsOfMeasure.precision,
      isActive: unitsOfMeasure.isActive,
      deletedAt: unitsOfMeasure.deletedAt,
    })
    .from(unitsOfMeasure)
    .where(and(...filters))
    .orderBy(asc(unitsOfMeasure.code));
}

export async function getTaxList(params: {
  query?: string;
  showDeleted?: boolean;
}): Promise<TaxRecord[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(taxes.deletedAt) : isNull(taxes.deletedAt);
  const searchFilter = query
    ? or(
        ilike(taxes.code, `%${query}%`),
        ilike(taxes.name, `%${query}%`),
        ilike(taxes.description, `%${query}%`),
      )
    : undefined;
  const filters = [eq(taxes.companyId, company.id), deletedFilter, searchFilter].filter(Boolean);

  return db
    .select({
      id: taxes.id,
      code: taxes.code,
      name: taxes.name,
      scope: taxes.scope,
      computation: taxes.computation,
      rate: taxes.rate,
      amountMinor: taxes.amountMinor,
      priceIncluded: taxes.priceIncluded,
      description: taxes.description,
      isActive: taxes.isActive,
      deletedAt: taxes.deletedAt,
    })
    .from(taxes)
    .where(and(...filters))
    .orderBy(asc(taxes.name));
}

export async function getProductById(id: string) {
  const [product] = await db
    .select({
      id: products.id,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      categoryId: products.categoryId,
      brandId: products.brandId,
      model: products.model,
      description: products.description,
      unitId: products.unitId,
      productType: products.productType,
      trackingMode: products.trackingMode,
      standardCostMinor: products.standardCostMinor,
      listPriceMinor: products.listPriceMinor,
      currencyCode: products.currencyCode,
      isActive: products.isActive,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return product;
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const company = await getDefaultCompany();
  const fromLocations = alias(locations, "from_locations");
  const toLocations = alias(locations, "to_locations");
  const currentSerialLocations = alias(locations, "current_serial_locations");
  const currentLotLocations = alias(locations, "current_lot_locations");

  const [product] = await db
    .select({
      id: products.id,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      brandId: products.brandId,
      brandName: brands.name,
      model: products.model,
      description: products.description,
      unitId: products.unitId,
      unitCode: unitsOfMeasure.code,
      unitName: unitsOfMeasure.name,
      productType: products.productType,
      trackingMode: products.trackingMode,
      standardCostMinor: products.standardCostMinor,
      listPriceMinor: products.listPriceMinor,
      currencyCode: products.currencyCode,
      isActive: products.isActive,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(unitsOfMeasure, eq(products.unitId, unitsOfMeasure.id))
    .where(and(eq(products.id, id), eq(products.companyId, company.id), isNull(products.deletedAt)))
    .limit(1);

  if (!product) {
    return null;
  }

  const [
    stockRows,
    serialRows,
    lotRows,
    movementRows,
    incomingRows,
    receiptRows,
    movementCountRows,
  ] = await Promise.all([
    db
      .select({
        stockBalanceId: stockBalances.id,
        locationCode: locations.code,
        locationName: locations.name,
        serialNo: productSerials.serialNo,
        lotNo: productLots.lotNo,
        quantityOnHand: stockBalances.quantityOnHand,
        quantityReserved: stockBalances.quantityReserved,
        quantityAvailable: stockBalances.quantityAvailable,
        averageCostMinor: stockBalances.averageCostMinor,
        currencyCode: stockBalances.currencyCode,
      })
      .from(stockBalances)
      .innerJoin(locations, eq(stockBalances.locationId, locations.id))
      .leftJoin(productSerials, eq(stockBalances.productSerialId, productSerials.id))
      .leftJoin(productLots, eq(stockBalances.productLotId, productLots.id))
      .where(and(eq(stockBalances.companyId, company.id), eq(stockBalances.productId, id), isNull(stockBalances.deletedAt)))
      .orderBy(asc(locations.name), asc(productSerials.serialNo), asc(productLots.lotNo)),
    db
      .select({
        id: productSerials.id,
        referenceNo: productSerials.serialNo,
        status: productSerials.status,
        currentLocationCode: currentSerialLocations.code,
        landedUnitCostMinor: productSerials.landedUnitCostMinor,
        quantityOnHand: sql<string>`coalesce(sum(${stockBalances.quantityOnHand}), 0)::text`,
      })
      .from(productSerials)
      .leftJoin(currentSerialLocations, eq(productSerials.currentLocationId, currentSerialLocations.id))
      .leftJoin(stockBalances, and(eq(stockBalances.productSerialId, productSerials.id), isNull(stockBalances.deletedAt)))
      .where(and(eq(productSerials.productId, id), isNull(productSerials.deletedAt)))
      .groupBy(productSerials.id, currentSerialLocations.code)
      .orderBy(asc(productSerials.serialNo)),
    db
      .select({
        id: productLots.id,
        referenceNo: productLots.lotNo,
        status: productLots.status,
        currentLocationCode: currentLotLocations.code,
        landedUnitCostMinor: productLots.landedUnitCostMinor,
        quantityOnHand: sql<string>`coalesce(sum(${stockBalances.quantityOnHand}), 0)::text`,
      })
      .from(productLots)
      .leftJoin(currentLotLocations, eq(productLots.currentLocationId, currentLotLocations.id))
      .leftJoin(stockBalances, and(eq(stockBalances.productLotId, productLots.id), isNull(stockBalances.deletedAt)))
      .where(and(eq(productLots.productId, id), isNull(productLots.deletedAt)))
      .groupBy(productLots.id, currentLotLocations.code)
      .orderBy(asc(productLots.lotNo)),
    db
      .select({
        movementId: stockMovements.id,
        movementNo: stockMovements.movementNo,
        movementType: stockMovements.movementType,
        movementDate: stockMovements.movementDate,
        sourceNo: stockMovements.sourceNo,
        fromLocationCode: fromLocations.code,
        toLocationCode: toLocations.code,
        serialNo: productSerials.serialNo,
        lotNo: productLots.lotNo,
        quantity: stockMovementLines.quantity,
        unitCostMinor: stockMovementLines.unitCostMinor,
        totalCostMinor: stockMovementLines.totalCostMinor,
        currencyCode: stockMovementLines.currencyCode,
      })
      .from(stockMovementLines)
      .innerJoin(stockMovements, eq(stockMovementLines.stockMovementId, stockMovements.id))
      .leftJoin(fromLocations, eq(stockMovementLines.fromLocationId, fromLocations.id))
      .leftJoin(toLocations, eq(stockMovementLines.toLocationId, toLocations.id))
      .leftJoin(productSerials, eq(stockMovementLines.productSerialId, productSerials.id))
      .leftJoin(productLots, eq(stockMovementLines.productLotId, productLots.id))
      .where(
        and(
          eq(stockMovements.companyId, company.id),
          eq(stockMovementLines.productId, id),
          eq(stockMovements.status, "posted"),
          isNull(stockMovements.deletedAt),
          isNull(stockMovementLines.deletedAt),
        ),
      )
      .orderBy(desc(stockMovements.movementDate), desc(stockMovementLines.lineNo))
      .limit(20),
    db
      .select({
        incomingQuantity: sql<string>`
          coalesce(sum(cast(${purchaseOrderLines.quantityOrdered} as numeric) - cast(${purchaseOrderLines.quantityReceived} as numeric)), 0)::text
        `,
      })
      .from(purchaseOrderLines)
      .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
      .where(
        and(
          eq(purchaseOrders.companyId, company.id),
          eq(purchaseOrderLines.productId, id),
          sql`${purchaseOrders.status} in ('confirmed', 'partially_received')`,
          isNull(purchaseOrders.deletedAt),
          isNull(purchaseOrderLines.deletedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(distinct ${goodsReceipts.id})::int` })
      .from(goodsReceiptLines)
      .innerJoin(goodsReceipts, eq(goodsReceiptLines.goodsReceiptId, goodsReceipts.id))
      .where(and(eq(goodsReceipts.companyId, company.id), eq(goodsReceiptLines.productId, id), isNull(goodsReceipts.deletedAt), isNull(goodsReceiptLines.deletedAt))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovementLines)
      .innerJoin(stockMovements, eq(stockMovementLines.stockMovementId, stockMovements.id))
      .where(
        and(
          eq(stockMovements.companyId, company.id),
          eq(stockMovementLines.productId, id),
          eq(stockMovements.status, "posted"),
          isNull(stockMovements.deletedAt),
          isNull(stockMovementLines.deletedAt),
        ),
      ),
  ]);

  const totals = stockRows.reduce(
    (sum, row) => ({
      quantityOnHand: sum.quantityOnHand + Number(row.quantityOnHand),
      quantityReserved: sum.quantityReserved + Number(row.quantityReserved),
      quantityAvailable: sum.quantityAvailable + Number(row.quantityAvailable),
    }),
    { quantityOnHand: 0, quantityReserved: 0, quantityAvailable: 0 },
  );
  const trackingRows: ProductDetailTrackingRow[] = [
    ...serialRows.map((row) => ({ ...row, kind: "serial" as const })),
    ...lotRows.map((row) => ({ ...row, kind: "lot" as const })),
  ];

  return {
    ...product,
    quantityOnHand: String(totals.quantityOnHand),
    quantityReserved: String(totals.quantityReserved),
    quantityAvailable: String(totals.quantityAvailable),
    incomingQuantity: incomingRows[0]?.incomingQuantity ?? "0",
    receiptCount: receiptRows[0]?.count ?? 0,
    movementCount: movementCountRows[0]?.count ?? 0,
    stockRows: stockRows satisfies ProductDetailStockRow[],
    trackingRows,
    movementRows: movementRows satisfies ProductDetailMovementRow[],
  };
}

export async function getProductPriceListRows(): Promise<ProductPriceListRow[]> {
  const company = await getDefaultCompany();

  return db
    .select({
      id: priceLists.id,
      code: priceLists.code,
      name: priceLists.name,
      priceListType: priceLists.priceListType,
      currencyCode: priceLists.currencyCode,
      locationCode: locations.code,
      itemCount: sql<number>`count(${priceListItems.id})::int`,
      isActive: priceLists.isActive,
      validFrom: sql<string | null>`${priceLists.validFrom}::text`,
      validTo: sql<string | null>`${priceLists.validTo}::text`,
    })
    .from(priceLists)
    .leftJoin(locations, eq(priceLists.locationId, locations.id))
    .leftJoin(priceListItems, and(eq(priceListItems.priceListId, priceLists.id), isNull(priceListItems.deletedAt)))
    .where(and(eq(priceLists.companyId, company.id), isNull(priceLists.deletedAt)))
    .groupBy(priceLists.id, locations.code)
    .orderBy(asc(priceLists.name));
}

export async function getProductTrackingRows(): Promise<ProductTrackingListRow[]> {
  const company = await getDefaultCompany();
  const currentSerialLocations = alias(locations, "tracking_serial_locations");
  const currentLotLocations = alias(locations, "tracking_lot_locations");
  const serialRows = await db
    .select({
      id: productSerials.id,
      referenceNo: productSerials.serialNo,
      productId: products.id,
      sku: products.sku,
      productName: products.name,
      status: productSerials.status,
      currentLocationCode: currentSerialLocations.code,
      landedUnitCostMinor: productSerials.landedUnitCostMinor,
      quantityOnHand: sql<string>`coalesce(sum(${stockBalances.quantityOnHand}), 0)::text`,
    })
    .from(productSerials)
    .innerJoin(products, eq(productSerials.productId, products.id))
    .leftJoin(currentSerialLocations, eq(productSerials.currentLocationId, currentSerialLocations.id))
    .leftJoin(stockBalances, and(eq(stockBalances.productSerialId, productSerials.id), isNull(stockBalances.deletedAt)))
    .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), isNull(productSerials.deletedAt)))
    .groupBy(productSerials.id, products.id, currentSerialLocations.code)
    .orderBy(asc(productSerials.serialNo));
  const lotRows = await db
    .select({
      id: productLots.id,
      referenceNo: productLots.lotNo,
      productId: products.id,
      sku: products.sku,
      productName: products.name,
      status: productLots.status,
      currentLocationCode: currentLotLocations.code,
      landedUnitCostMinor: productLots.landedUnitCostMinor,
      quantityOnHand: sql<string>`coalesce(sum(${stockBalances.quantityOnHand}), 0)::text`,
    })
    .from(productLots)
    .innerJoin(products, eq(productLots.productId, products.id))
    .leftJoin(currentLotLocations, eq(productLots.currentLocationId, currentLotLocations.id))
    .leftJoin(stockBalances, and(eq(stockBalances.productLotId, productLots.id), isNull(stockBalances.deletedAt)))
    .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), isNull(productLots.deletedAt)))
    .groupBy(productLots.id, products.id, currentLotLocations.code)
    .orderBy(asc(productLots.lotNo));

  return [
    ...serialRows.map((row) => ({ ...row, kind: "serial" as const })),
    ...lotRows.map((row) => ({ ...row, kind: "lot" as const })),
  ];
}

export function minorToDisplay(value: number) {
  return (value / 100).toFixed(2);
}

export function majorToMinor(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function formatProductType(value: string) {
  return value.replace(/_/g, " ");
}

export function uniqueViolationMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return "A record with the same unique code, SKU, barcode, or name already exists.";
  }

  return fallback;
}
