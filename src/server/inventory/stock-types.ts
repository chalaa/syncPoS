export const stockStatusOptions = [
  "all",
  "in_stock",
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

export type StockByLocationRow = {
  stockBalanceId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
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
  movementId: string;
  movementNo: string;
  movementType: string;
  movementDate: Date;
  sourceNo: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  serialNo: string | null;
  quantity: string;
  unitCostMinor: number;
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
  productId: string;
  sku: string;
  productName: string;
  trackingMode: string;
  serialNo: string | null;
  lotNo: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  quantity: string;
  unitCostMinor: number;
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
