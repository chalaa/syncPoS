import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  locations,
  products,
  transferLines,
  transfers,
} from "@/server/db/schema";
import type {
  TransferDetail,
  TransferDetailLine,
  TransferFormOptions,
  TransferListRow,
} from "@/server/transfers/types";

export async function getTransferFormOptions(): Promise<TransferFormOptions> {
  const company = await getDefaultCompany();
  const [locationRows, transitRows, productRows] = await Promise.all([
    db
      .select({ id: locations.id, code: locations.code, name: locations.name })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt), eq(locations.isActive, true), sql`${locations.locationType} in ('warehouse', 'display_shop')`))
      .orderBy(asc(locations.name)),
    db
      .select({ id: locations.id, code: locations.code, name: locations.name })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNull(locations.deletedAt), eq(locations.isActive, true), eq(locations.locationType, "transit")))
      .orderBy(asc(locations.name)),
    db
      .select({ id: products.id, code: products.sku, name: products.name, trackingMode: products.trackingMode })
      .from(products)
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt), eq(products.isActive, true)))
      .orderBy(asc(products.name)),
  ]);

  return {
    locations: locationRows,
    transitLocations: transitRows,
    products: productRows,
  };
}

export async function getTransferList(): Promise<TransferListRow[]> {
  const company = await getDefaultCompany();
  const fromLocations = alias(locations, "transfer_from_locations");
  const transitLocations = alias(locations, "transfer_transit_locations");
  const toLocations = alias(locations, "transfer_to_locations");

  return db
    .select({
      id: transfers.id,
      transferNo: transfers.transferNo,
      status: transfers.status,
      transferDate: sql<string>`${transfers.transferDate}::text`,
      fromLocationCode: fromLocations.code,
      transitLocationCode: transitLocations.code,
      toLocationCode: toLocations.code,
      lineCount: sql<number>`count(${transferLines.id})::int`,
      quantityRequested: sql<string>`coalesce(sum(${transferLines.quantityRequested}), 0)::text`,
      quantityDispatched: sql<string>`coalesce(sum(${transferLines.quantityDispatched}), 0)::text`,
      quantityReceived: sql<string>`coalesce(sum(${transferLines.quantityReceived}), 0)::text`,
    })
    .from(transfers)
    .innerJoin(fromLocations, eq(transfers.fromLocationId, fromLocations.id))
    .innerJoin(transitLocations, eq(transfers.transitLocationId, transitLocations.id))
    .innerJoin(toLocations, eq(transfers.toLocationId, toLocations.id))
    .leftJoin(transferLines, and(eq(transferLines.transferId, transfers.id), isNull(transferLines.deletedAt)))
    .where(and(eq(transfers.companyId, company.id), isNull(transfers.deletedAt)))
    .groupBy(transfers.id, fromLocations.id, transitLocations.id, toLocations.id)
    .orderBy(sql`${transfers.transferDate} desc`, sql`${transfers.transferNo} desc`);
}

export async function getTransferDetail(id: string): Promise<TransferDetail | null> {
  const company = await getDefaultCompany();
  const fromLocations = alias(locations, "transfer_detail_from_locations");
  const transitLocations = alias(locations, "transfer_detail_transit_locations");
  const toLocations = alias(locations, "transfer_detail_to_locations");

  const [transfer] = await db
    .select({
      id: transfers.id,
      transferNo: transfers.transferNo,
      status: transfers.status,
      transferDate: sql<string>`${transfers.transferDate}::text`,
      fromLocationId: transfers.fromLocationId,
      transitLocationId: transfers.transitLocationId,
      toLocationId: transfers.toLocationId,
      fromLocationCode: fromLocations.code,
      transitLocationCode: transitLocations.code,
      toLocationCode: toLocations.code,
      approvedAt: sql<string | null>`${transfers.approvedAt}::text`,
      dispatchedAt: sql<string | null>`${transfers.dispatchedAt}::text`,
      receivedAt: sql<string | null>`${transfers.receivedAt}::text`,
      dispatchMovementId: transfers.dispatchMovementId,
      receiptMovementId: transfers.receiptMovementId,
      notes: transfers.notes,
      lineCount: sql<number>`count(${transferLines.id})::int`,
      quantityRequested: sql<string>`coalesce(sum(${transferLines.quantityRequested}), 0)::text`,
      quantityDispatched: sql<string>`coalesce(sum(${transferLines.quantityDispatched}), 0)::text`,
      quantityReceived: sql<string>`coalesce(sum(${transferLines.quantityReceived}), 0)::text`,
    })
    .from(transfers)
    .innerJoin(fromLocations, eq(transfers.fromLocationId, fromLocations.id))
    .innerJoin(transitLocations, eq(transfers.transitLocationId, transitLocations.id))
    .innerJoin(toLocations, eq(transfers.toLocationId, toLocations.id))
    .leftJoin(transferLines, and(eq(transferLines.transferId, transfers.id), isNull(transferLines.deletedAt)))
    .where(and(eq(transfers.id, id), eq(transfers.companyId, company.id), isNull(transfers.deletedAt)))
    .groupBy(transfers.id, fromLocations.id, transitLocations.id, toLocations.id)
    .limit(1);

  if (!transfer) {
    return null;
  }

  const lines = await db
    .select({
      id: transferLines.id,
      lineNo: transferLines.lineNo,
      productName: products.name,
      sku: products.sku,
      trackingMode: products.trackingMode,
      quantityRequested: transferLines.quantityRequested,
      quantityDispatched: transferLines.quantityDispatched,
      quantityReceived: transferLines.quantityReceived,
      discrepancy: transferLines.discrepancy,
      unitCostMinor: transferLines.unitCostMinor,
      currencyCode: transferLines.currencyCode,
      serialNo: transferLines.serialNo,
      lotNo: transferLines.lotNo,
    })
    .from(transferLines)
    .innerJoin(products, eq(transferLines.productId, products.id))
    .where(and(eq(transferLines.transferId, id), isNull(transferLines.deletedAt)))
    .orderBy(asc(transferLines.lineNo));

  return {
    ...transfer,
    lines: lines satisfies TransferDetailLine[],
  };
}
