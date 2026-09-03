export type OpeningStockImportRow = {
  rowNumber: number;
  sku: string;
  productName: string;
  trackingMode: "none" | "lot" | "serial";
  ownerName: string;
  locationCode: string;
  locationName: string;
  quantity: string;
  unitCost: string;
  unitCostMinor: number;
  totalCostMinor: number;
  serialNo: string;
  notes: string;
  errors: string[];
};

export type OpeningStockPreviewState = {
  status: "idle" | "preview" | "error" | "imported";
  message?: string;
  rows: OpeningStockImportRow[];
  importToken?: string;
  movementNo?: string;
};

export type OpeningStockCommitPayload = {
  importToken: string;
  rows: OpeningStockImportRow[];
};
