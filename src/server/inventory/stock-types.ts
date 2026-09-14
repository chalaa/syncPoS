import { minorToDisplay } from "@/lib/catalog-utils";

export const stockStatusOptions = [
  "all",
  "in_stock",
  "low_stock",
  "reserved",
  "out_of_stock",
  "negative",
] as const;

export type StockStatusOption = (typeof stockStatusOptions)[number];

export type StockFilterOption = {
  id: string;
  code: string;
  name: string;
};

export type InventorySummaryMetrics = {
  totalValuationMinor: number;
  currencyCode: string;
  totalSkusOnHand: number;
  totalQuantityOnHand: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalReservedQuantity: number;
};

export type StockByLocationRow = {
  stockBalanceId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  sku: string;
  productName: string;
  trackingMode: string;
  serialNo: string | null;
  lotNo: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  averageCostMinor: number;
  currencyCode: string;
  lastMovementAt: Date | null;
};

export type ProductStockCardRow = {
  movementLineId: string;
  movementId: string;
  movementNo: string;
  movementType: string;
  movementDate: Date;
  sourceNo: string | null;
  ownerId: string | null;
  ownerName: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  serialNo: string | null;
  quantity: string;
  totalCostMinor: number;
  notes: string | null;
};

export type SerialHistoryRow = ProductStockCardRow & {
  productName: string;
  sku: string;
  currentLocationCode: string | null;
  serialStatus: string;
};

export const inventoryOperationViewOptions = [
  "all",
  "receipts",
  "deliveries",
  "transfers",
  "adjustments",
  "scrap",
  "returns",
] as const;

export type InventoryOperationView = (typeof inventoryOperationViewOptions)[number];

export type InventoryOperationListRow = {
  id: string;
  movementNo: string;
  movementType: string;
  status: string;
  movementDate: string;
  sourceType: string | null;
  sourceNo: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  lineCount: number;
  totalQuantity: string;
  totalCostMinor: number;
  currencyCode: string | null;
};

export type InventoryOperationDetailLine = {
  id: string;
  lineNo: number;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  sku: string;
  productName: string;
  trackingMode: string;
  serialNo: string | null;
  lotNo: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  quantity: string;
  totalCostMinor: number;
  currencyCode: string;
  notes: string | null;
};

export type InventoryOperationDetail = {
  id: string;
  movementNo: string;
  movementType: string;
  status: string;
  movementDate: Date;
  sourceType: string | null;
  sourceId: string | null;
  sourceNo: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  postedAt: Date | null;
  notes: string | null;
  lineCount: number;
  totalQuantity: string;
  totalCostMinor: number;
  currencyCode: string | null;
  lines: InventoryOperationDetailLine[];
};

export type InventoryOperationFormOption = {
  id: string;
  code: string;
  name: string;
};

export type InventoryOperationProductOption = InventoryOperationFormOption & {
  trackingMode: "none" | "lot" | "serial";
};

export type InventoryOperationFormOptions = {
  company: {
    id: string;
    baseCurrencyCode: string;
  };
  owners: Omit<InventoryOperationFormOption, "code">[];
  locations: InventoryOperationFormOption[];
  products: InventoryOperationProductOption[];
};

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
