"use client";

import Dexie, { type EntityTable } from "dexie";

export type LocalProduct = {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  tracking: "none" | "lot" | "serial";
  price: number;
  updatedAt: string;
};

export type LocalStockBalance = {
  id: string;
  locationId: string;
  productId: string;
  serialAssetId?: string;
  status: "available" | "reserved" | "in_transit" | "damaged" | "quarantine";
  onHand: number;
  reserved: number;
  version: number;
};

export type LocalSyncEvent = {
  id: string;
  eventId: string;
  deviceId: string;
  locationId: string;
  deviceSequence: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  payloadHash: string;
  status: "pending" | "sending" | "acknowledged" | "conflicted" | "rejected";
  occurredAtLocal: string;
};

export const offlineDb = new Dexie("syncpos-offline") as Dexie & {
  products: EntityTable<LocalProduct, "id">;
  stockBalances: EntityTable<LocalStockBalance, "id">;
  syncEvents: EntityTable<LocalSyncEvent, "id">;
};

offlineDb.version(1).stores({
  products: "id, sku, barcode, name, tracking, updatedAt",
  stockBalances: "id, [locationId+productId+serialAssetId+status], productId, status",
  syncEvents: "id, eventId, [deviceId+deviceSequence], status, occurredAtLocal",
});
