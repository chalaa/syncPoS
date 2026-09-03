export type TransferOption = {
  id: string;
  code: string;
  name: string;
};

export type TransferProductOption = TransferOption & {
  trackingMode: "none" | "lot" | "serial";
};

export type TransferListRow = {
  id: string;
  transferNo: string;
  status: string;
  ownerName: string | null;
  transferDate: string;
  fromLocationCode: string;
  transitLocationCode: string;
  toLocationCode: string;
  lineCount: number;
  quantityRequested: string;
  quantityDispatched: string;
  quantityReceived: string;
};

export type TransferDetailLine = {
  id: string;
  lineNo: number;
  ownerName: string | null;
  productName: string;
  sku: string;
  trackingMode: "none" | "lot" | "serial";
  quantityRequested: string;
  quantityDispatched: string;
  quantityReceived: string;
  discrepancy: string;
  unitCostMinor: number;
  currencyCode: string;
  serialNo: string | null;
  lotNo: string | null;
};

export type TransferDetail = TransferListRow & {
  ownerId: string | null;
  fromLocationId: string;
  transitLocationId: string;
  toLocationId: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  receivedAt: string | null;
  dispatchMovementId: string | null;
  receiptMovementId: string | null;
  notes: string | null;
  lines: TransferDetailLine[];
};

export type TransferFormOptions = {
  owners: Omit<TransferOption, "code">[];
  locations: TransferOption[];
  transitLocations: TransferOption[];
  products: TransferProductOption[];
};
