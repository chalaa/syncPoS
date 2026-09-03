import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDefaultCompany, minorToDisplay } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  locations,
  owners,
  productLots,
  productSerials,
  products,
  stockBalances,
  stockMovementLines,
  stockMovements,
} from "@/server/db/schema";
import { stockLocationTypeOptions, stockSelectableLocationTypeOptions } from "@/server/inventory/location-types";
import {
  stockStatusOptions,
  inventoryOperationViewOptions,
  type InventoryOperationDetail,
  type InventoryOperationDetailLine,
  type InventoryOperationFormOptions,
  type InventoryOperationListRow,
  type InventoryOperationView,
  type ProductStockCardRow,
  type SerialHistoryRow,
  type StockByLocationRow,
  type StockStatusOption,
} from "@/server/inventory/stock-types";

export { inventoryOperationViewOptions, stockStatusOptions };

export function displayMoneyMinor(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}

export function displayQuantity(value: string | number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return parsed.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

export function parseStockStatus(value?: string): StockStatusOption {
  return stockStatusOptions.includes(value as StockStatusOption)
    ? (value as StockStatusOption)
    : "all";
}

export function parseAsOfDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T23:59:59.999Z`);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseInventoryOperationView(value?: string): InventoryOperationView {
  return inventoryOperationViewOptions.includes(value as InventoryOperationView)
    ? (value as InventoryOperationView)
    : "all";
}

function stockStatusSql(status: StockStatusOption) {
  if (status === "in_stock") {
    return sql`cast(${stockBalances.quantityOnHand} as numeric) > 0`;
  }

  if (status === "reserved") {
    return sql`cast(${stockBalances.quantityReserved} as numeric) > 0`;
  }

  if (status === "out_of_stock") {
    return sql`cast(${stockBalances.quantityOnHand} as numeric) = 0`;
  }

  if (status === "negative") {
    return sql`cast(${stockBalances.quantityOnHand} as numeric) < 0`;
  }

  return undefined;
}

export async function getInventoryFilterOptions() {
  const company = await getDefaultCompany();
  const [locationRows, productRows] = await Promise.all([
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(
        and(
          eq(locations.companyId, company.id),
          inArray(locations.locationType, [...stockLocationTypeOptions]),
          isNull(locations.deletedAt),
          eq(locations.isActive, true),
        ),
      )
      .orderBy(asc(locations.name)),
    db
      .select({
        id: products.id,
        code: products.sku,
        name: products.name,
      })
      .from(products)
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)))
      .orderBy(asc(products.name)),
  ]);

  return {
    locations: locationRows,
    products: productRows,
  };
}

export async function getInventoryOperationFormOptions(): Promise<InventoryOperationFormOptions> {
  const company = await getDefaultCompany();
  const [ownerRows, locationRows, productRows] = await Promise.all([
    db
      .select({
        id: owners.id,
        name: owners.name,
      })
      .from(owners)
      .where(and(eq(owners.companyId, company.id), isNull(owners.deletedAt)))
      .orderBy(asc(owners.name)),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
      })
      .from(locations)
      .where(
        and(
          eq(locations.companyId, company.id),
          inArray(locations.locationType, [...stockSelectableLocationTypeOptions]),
          isNull(locations.deletedAt),
          eq(locations.isActive, true),
        ),
      )
      .orderBy(asc(locations.name)),
    db
      .select({
        id: products.id,
        code: products.sku,
        name: products.name,
        trackingMode: products.trackingMode,
      })
      .from(products)
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)))
      .orderBy(asc(products.name)),
  ]);

  return {
    company,
    owners: ownerRows,
    locations: locationRows,
    products: productRows,
  };
}

export async function getInventoryOperationList(params: {
  view?: InventoryOperationView;
  query?: string;
}): Promise<InventoryOperationListRow[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim() ?? "";
  const view = params.view ?? "all";
  const rows = await db.execute<InventoryOperationListRow>(sql`
    select
      sm.id as "id",
      sm.movement_no as "movementNo",
      sm.movement_type as "movementType",
      sm.status as "status",
      sm.movement_date as "movementDate",
      sm.source_type as "sourceType",
      sm.source_no as "sourceNo",
      fl.code as "fromLocationCode",
      tl.code as "toLocationCode",
      count(sml.id)::int as "lineCount",
      coalesce(sum(abs(cast(sml.quantity as numeric))), 0)::text as "totalQuantity",
      coalesce(sum(sml.total_cost_minor), 0)::bigint as "totalCostMinor",
      max(sml.currency_code) as "currencyCode"
    from stock_movements sm
    left join locations fl on fl.id = sm.from_location_id
    left join locations tl on tl.id = sm.to_location_id
    left join stock_movement_lines sml on sml.stock_movement_id = sm.id and sml.deleted_at is null
    where sm.company_id = ${company.id}
      and sm.deleted_at is null
      and (${query} = '' or sm.movement_no ilike ${`%${query}%`} or sm.source_no ilike ${`%${query}%`} or sm.notes ilike ${`%${query}%`})
      and (${view} = 'all'
        or (${view} = 'receipts' and sm.movement_type = 'purchase_receipt')
        or (${view} = 'deliveries' and sm.movement_type in ('sale_delivery', 'sale_issue'))
        or (${view} = 'transfers' and sm.movement_type = 'transfer')
        or (${view} = 'adjustments' and sm.movement_type in ('adjustment', 'stock_count', 'opening_balance'))
        or (${view} = 'scrap' and sm.movement_type = 'scrap')
        or (${view} = 'returns' and sm.movement_type in ('customer_return', 'supplier_return'))
      )
    group by sm.id, fl.code, tl.code
    order by sm.movement_date desc
  `);

  return rows;
}

export async function getInventoryAdjustmentFormOptions() {
  const options = await getInventoryOperationFormOptions();
  const balances = await getStockByLocation({});

  return {
    ...options,
    balances: balances.map((balance) => ({
      locationId: balance.locationId,
      ownerId: balance.ownerId,
      ownerName: balance.ownerName,
      productId: balance.productId,
      serialNo: balance.serialNo,
      lotNo: balance.lotNo,
      quantityOnHand: balance.quantityOnHand,
      quantityAvailable: balance.quantityAvailable,
      averageCostMinor: balance.averageCostMinor,
      currencyCode: balance.currencyCode,
    })),
  };
}

export async function getInventoryOperationDetail(id: string): Promise<InventoryOperationDetail | null> {
  const company = await getDefaultCompany();
  const fromLocations = alias(locations, "operation_from_locations");
  const toLocations = alias(locations, "operation_to_locations");
  const lineFromLocations = alias(locations, "line_from_locations");
  const lineToLocations = alias(locations, "line_to_locations");

  const [operation] = await db
    .select({
      id: stockMovements.id,
      movementNo: stockMovements.movementNo,
      movementType: stockMovements.movementType,
      status: stockMovements.status,
      movementDate: stockMovements.movementDate,
      sourceType: stockMovements.sourceType,
      sourceId: stockMovements.sourceId,
      sourceNo: stockMovements.sourceNo,
      fromLocationCode: fromLocations.code,
      toLocationCode: toLocations.code,
      postedAt: stockMovements.postedAt,
      notes: stockMovements.notes,
    })
    .from(stockMovements)
    .leftJoin(fromLocations, eq(stockMovements.fromLocationId, fromLocations.id))
    .leftJoin(toLocations, eq(stockMovements.toLocationId, toLocations.id))
    .where(and(eq(stockMovements.id, id), eq(stockMovements.companyId, company.id), isNull(stockMovements.deletedAt)))
    .limit(1);

  if (!operation) {
    return null;
  }

  const lines = await db
    .select({
      id: stockMovementLines.id,
      lineNo: stockMovementLines.lineNo,
      ownerId: stockMovementLines.ownerId,
      ownerName: owners.name,
      productId: products.id,
      sku: products.sku,
      productName: products.name,
      trackingMode: products.trackingMode,
      serialNo: productSerials.serialNo,
      lotNo: productLots.lotNo,
      fromLocationCode: lineFromLocations.code,
      toLocationCode: lineToLocations.code,
      quantity: stockMovementLines.quantity,
      totalCostMinor: stockMovementLines.totalCostMinor,
      currencyCode: stockMovementLines.currencyCode,
      notes: stockMovementLines.notes,
    })
    .from(stockMovementLines)
    .innerJoin(products, eq(stockMovementLines.productId, products.id))
    .leftJoin(owners, eq(stockMovementLines.ownerId, owners.id))
    .leftJoin(productSerials, eq(stockMovementLines.productSerialId, productSerials.id))
    .leftJoin(productLots, eq(stockMovementLines.productLotId, productLots.id))
    .leftJoin(lineFromLocations, eq(stockMovementLines.fromLocationId, lineFromLocations.id))
    .leftJoin(lineToLocations, eq(stockMovementLines.toLocationId, lineToLocations.id))
    .where(and(eq(stockMovementLines.stockMovementId, id), isNull(stockMovementLines.deletedAt)))
    .orderBy(asc(stockMovementLines.lineNo));
  const totals = lines.reduce(
    (sum, line) => ({
      quantity: sum.quantity + Math.abs(Number(line.quantity)),
      totalCostMinor: sum.totalCostMinor + line.totalCostMinor,
    }),
    { quantity: 0, totalCostMinor: 0 },
  );

  return {
    ...operation,
    lineCount: lines.length,
    totalQuantity: String(totals.quantity),
    totalCostMinor: totals.totalCostMinor,
    currencyCode: lines[0]?.currencyCode ?? null,
    lines: lines satisfies InventoryOperationDetailLine[],
  };
}

export async function getStockByLocation(params: {
  query?: string;
  locationId?: string;
  status?: StockStatusOption;
  asOfDate?: Date;
}): Promise<StockByLocationRow[]> {
  if (params.asOfDate) {
    return getStockByLocationAsOf({
      ...params,
      asOfDate: params.asOfDate,
    });
  }

  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const statusFilter = stockStatusSql(params.status ?? "all");
  const searchFilter = query
    ? or(
        ilike(products.sku, `%${query}%`),
        ilike(products.name, `%${query}%`),
        ilike(productSerials.serialNo, `%${query}%`),
        ilike(productLots.lotNo, `%${query}%`),
      )
    : undefined;
  const locationFilter = params.locationId ? eq(stockBalances.locationId, params.locationId) : undefined;
  const filters = [
    eq(stockBalances.companyId, company.id),
    isNull(stockBalances.deletedAt),
    locationFilter,
    statusFilter,
    searchFilter,
  ].filter(Boolean);

  return db
    .select({
      locationId: locations.id,
      stockBalanceId: stockBalances.id,
      locationCode: locations.code,
      locationName: locations.name,
      ownerId: owners.id,
      ownerName: owners.name,
      productId: products.id,
      sku: products.sku,
      productName: products.name,
      trackingMode: products.trackingMode,
      serialNo: productSerials.serialNo,
      lotNo: productLots.lotNo,
      quantityOnHand: stockBalances.quantityOnHand,
      quantityReserved: stockBalances.quantityReserved,
      quantityAvailable: stockBalances.quantityAvailable,
      averageCostMinor: stockBalances.averageCostMinor,
      currencyCode: stockBalances.currencyCode,
      lastMovementAt: stockBalances.lastMovementAt,
    })
    .from(stockBalances)
    .innerJoin(locations, eq(stockBalances.locationId, locations.id))
    .innerJoin(products, eq(stockBalances.productId, products.id))
    .leftJoin(owners, eq(stockBalances.ownerId, owners.id))
    .leftJoin(productSerials, eq(stockBalances.productSerialId, productSerials.id))
    .leftJoin(productLots, eq(stockBalances.productLotId, productLots.id))
    .where(and(...filters))
    .orderBy(asc(locations.name), asc(products.name), asc(productSerials.serialNo), asc(productLots.lotNo));
}

async function getStockByLocationAsOf(params: {
  query?: string;
  locationId?: string;
  status?: StockStatusOption;
  asOfDate: Date;
}): Promise<StockByLocationRow[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim() ?? "";
  const status = params.status ?? "all";
  const rows = await db.execute<StockByLocationRow>(sql`
    with ledger as (
      select
        sml.to_location_id as location_id,
        sml.owner_id,
        sml.product_id,
        sml.product_serial_id,
        sml.product_lot_id,
        cast(sml.quantity as numeric) as quantity,
        sml.total_cost_minor,
        sml.currency_code,
        sm.movement_date
      from stock_movement_lines sml
      inner join stock_movements sm on sm.id = sml.stock_movement_id
      where sm.company_id = ${company.id}
        and sm.status = 'posted'
        and sm.deleted_at is null
        and sml.deleted_at is null
        and sml.to_location_id is not null
        and sm.movement_date <= ${params.asOfDate}
      union all
      select
        sml.from_location_id as location_id,
        sml.owner_id,
        sml.product_id,
        sml.product_serial_id,
        sml.product_lot_id,
        cast(sml.quantity as numeric) * -1 as quantity,
        sml.total_cost_minor,
        sml.currency_code,
        sm.movement_date
      from stock_movement_lines sml
      inner join stock_movements sm on sm.id = sml.stock_movement_id
      where sm.company_id = ${company.id}
        and sm.status = 'posted'
        and sm.deleted_at is null
        and sml.deleted_at is null
        and sml.from_location_id is not null
        and sm.movement_date <= ${params.asOfDate}
    ),
    grouped as (
      select
        location_id,
        product_id,
        owner_id,
        product_serial_id,
        product_lot_id,
        sum(quantity) as quantity_on_hand,
        max(
          case
            when quantity = 0 then 0
            else abs(total_cost_minor / quantity)
          end
        )::bigint as average_cost_minor,
        max(currency_code) as currency_code,
        max(movement_date) as last_movement_at
      from ledger
      group by location_id, owner_id, product_id, product_serial_id, product_lot_id
    )
    select
      concat(grouped.location_id, '-', coalesce(grouped.owner_id::text, 'no-owner'), '-', grouped.product_id, '-', coalesce(grouped.product_serial_id::text, 'bulk'), '-', coalesce(grouped.product_lot_id::text, 'bulk')) as "stockBalanceId",
      l.id as "locationId",
      l.code as "locationCode",
      l.name as "locationName",
      o.id as "ownerId",
      o.name as "ownerName",
      p.id as "productId",
      p.sku as "sku",
      p.name as "productName",
      p.tracking_mode as "trackingMode",
      ps.serial_no as "serialNo",
      pl.lot_no as "lotNo",
      grouped.quantity_on_hand::text as "quantityOnHand",
      '0' as "quantityReserved",
      grouped.quantity_on_hand::text as "quantityAvailable",
      grouped.average_cost_minor::bigint as "averageCostMinor",
      grouped.currency_code as "currencyCode",
      grouped.last_movement_at as "lastMovementAt"
    from grouped
    inner join locations l on l.id = grouped.location_id
    inner join products p on p.id = grouped.product_id
    left join owners o on o.id = grouped.owner_id
    left join product_serials ps on ps.id = grouped.product_serial_id
    left join product_lots pl on pl.id = grouped.product_lot_id
    where (${params.locationId ?? ""} = '' or l.id = ${params.locationId ?? ""})
      and (${query} = '' or p.sku ilike ${`%${query}%`} or p.name ilike ${`%${query}%`} or ps.serial_no ilike ${`%${query}%`} or pl.lot_no ilike ${`%${query}%`})
      and (
        ${status} = 'all'
        or (${status} = 'in_stock' and grouped.quantity_on_hand > 0)
        or (${status} = 'out_of_stock' and grouped.quantity_on_hand = 0)
        or (${status} = 'negative' and grouped.quantity_on_hand < 0)
        or (${status} = 'reserved' and false)
      )
    order by l.name, p.name, ps.serial_no, pl.lot_no
  `);

  return rows;
}

export async function getProductStockCard(params: {
  productId?: string;
  query?: string;
  asOfDate?: Date;
}): Promise<ProductStockCardRow[]> {
  const company = await getDefaultCompany();
  const fromLocations = alias(locations, "from_locations");
  const toLocations = alias(locations, "to_locations");
  const query = params.query?.trim();
  const productFilter = params.productId ? eq(products.id, params.productId) : undefined;
  const dateFilter = params.asOfDate ? lte(stockMovements.movementDate, params.asOfDate) : undefined;
  const searchFilter = query
    ? or(
        ilike(products.sku, `%${query}%`),
        ilike(products.name, `%${query}%`),
        ilike(stockMovements.movementNo, `%${query}%`),
        ilike(stockMovements.sourceNo, `%${query}%`),
      )
    : undefined;
  const filters = [
    eq(products.companyId, company.id),
    eq(stockMovements.status, "posted"),
    isNull(stockMovements.deletedAt),
    isNull(stockMovementLines.deletedAt),
    productFilter,
    dateFilter,
    searchFilter,
  ].filter(Boolean);

  return db
    .select({
      movementLineId: stockMovementLines.id,
      movementId: stockMovements.id,
      movementNo: stockMovements.movementNo,
      movementType: stockMovements.movementType,
      movementDate: stockMovements.movementDate,
      sourceNo: stockMovements.sourceNo,
      ownerId: stockMovementLines.ownerId,
      ownerName: owners.name,
      fromLocationCode: fromLocations.code,
      toLocationCode: toLocations.code,
      serialNo: productSerials.serialNo,
      quantity: stockMovementLines.quantity,
      totalCostMinor: stockMovementLines.totalCostMinor,
      notes: stockMovementLines.notes,
    })
    .from(stockMovementLines)
    .innerJoin(stockMovements, eq(stockMovementLines.stockMovementId, stockMovements.id))
    .innerJoin(products, eq(stockMovementLines.productId, products.id))
    .leftJoin(owners, eq(stockMovementLines.ownerId, owners.id))
    .leftJoin(productSerials, eq(stockMovementLines.productSerialId, productSerials.id))
    .leftJoin(fromLocations, eq(stockMovementLines.fromLocationId, fromLocations.id))
    .leftJoin(toLocations, eq(stockMovementLines.toLocationId, toLocations.id))
    .where(and(...filters))
    .orderBy(desc(stockMovements.movementDate), desc(stockMovementLines.lineNo));
}

export async function getSerialHistory(params: {
  serialQuery?: string;
  asOfDate?: Date;
}): Promise<SerialHistoryRow[]> {
  const company = await getDefaultCompany();
  const fromLocations = alias(locations, "from_locations");
  const toLocations = alias(locations, "to_locations");
  const currentLocations = alias(locations, "current_locations");
  const query = params.serialQuery?.trim();
  const dateFilter = params.asOfDate ? lte(stockMovements.movementDate, params.asOfDate) : undefined;
  const searchFilter = query
    ? or(
        ilike(productSerials.serialNo, `%${query}%`),
        ilike(productSerials.engineNo, `%${query}%`),
        ilike(productSerials.chassisNo, `%${query}%`),
        ilike(products.sku, `%${query}%`),
      )
    : undefined;
  const filters = [
    eq(products.companyId, company.id),
    eq(stockMovements.status, "posted"),
    isNull(stockMovements.deletedAt),
    isNull(stockMovementLines.deletedAt),
    searchFilter,
    dateFilter,
  ].filter(Boolean);

  return db
    .select({
      movementLineId: stockMovementLines.id,
      movementId: stockMovements.id,
      movementNo: stockMovements.movementNo,
      movementType: stockMovements.movementType,
      movementDate: stockMovements.movementDate,
      sourceNo: stockMovements.sourceNo,
      ownerId: stockMovementLines.ownerId,
      ownerName: owners.name,
      fromLocationCode: fromLocations.code,
      toLocationCode: toLocations.code,
      serialNo: productSerials.serialNo,
      quantity: stockMovementLines.quantity,
      totalCostMinor: stockMovementLines.totalCostMinor,
      notes: stockMovementLines.notes,
      productName: products.name,
      sku: products.sku,
      currentLocationCode: currentLocations.code,
      serialStatus: productSerials.status,
    })
    .from(stockMovementLines)
    .innerJoin(stockMovements, eq(stockMovementLines.stockMovementId, stockMovements.id))
    .innerJoin(productSerials, eq(stockMovementLines.productSerialId, productSerials.id))
    .innerJoin(products, eq(productSerials.productId, products.id))
    .leftJoin(owners, eq(stockMovementLines.ownerId, owners.id))
    .leftJoin(fromLocations, eq(stockMovementLines.fromLocationId, fromLocations.id))
    .leftJoin(toLocations, eq(stockMovementLines.toLocationId, toLocations.id))
    .leftJoin(currentLocations, eq(productSerials.currentLocationId, currentLocations.id))
    .where(and(...filters))
    .orderBy(desc(stockMovements.movementDate), desc(stockMovementLines.lineNo));
}
