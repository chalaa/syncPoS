export type PurchaseFormOption = {
  id: string;
  code: string;
  name: string;
  listPriceMinor?: number;
  standardCostMinor?: number;
  saleTaxIds?: string[];
  purchaseTaxIds?: string[];
};

export type PurchaseTaxOption = PurchaseFormOption & {
  computation: "percent" | "fixed";
  rate: string;
  amountMinor: number;
  priceIncluded: boolean;
};

export type PurchaseOrderListRow = {
  id: string;
  orderNo: string;
  vendorReference: string | null;
  paymentTerm: "cash" | "credit";
  ownerId: string | null;
  ownerName: string | null;
  supplierName: string;
  status: string;
  orderDate: string;
  paymentDueDate: string | null;
  deliverToLocationId: string | null;
  deliverToLocationCode: string | null;
  currencyCode: string;
  totalMinor: number;
  paidMinor: number;
  residualAmountMinor: number;
  lineCount: number;
  quantityOrdered: string;
  quantityReceived: string;
};

export type PurchaseReceiptListRow = {
  id: string;
  receiptNo: string;
  status: string;
  receiptDate: string;
  purchaseOrderId: string;
  orderNo: string;
  supplierName: string;
  locationCode: string | null;
  supplierInvoiceNo: string | null;
  currencyCode: string;
  lineCount: number;
  quantityReceived: string;
  totalMinor: number;
};

export type PurchaseVendorBillListRow = {
  id: string;
  billNo: string;
  vendorReference: string | null;
  status: string;
  billDate: string;
  dueDate: string | null;
  purchaseOrderId: string | null;
  orderNo: string | null;
  supplierName: string;
  productSummary: string | null;
  source: "vendor_bill" | "placeholder";
  paymentStatus: string;
  currencyCode: string;
  untaxedAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  residualAmountMinor: number;
  lineCount: number;
};

export type PurchaseLandedCostListRow = {
  id: string;
  costNo: string;
  costType: string;
  status: string;
  allocationMethod: string;
  purchaseOrderId: string | null;
  orderNo: string | null;
  receiptNo: string | null;
  vendorName: string | null;
  amountMinor: number;
  currencyCode: string;
  allocationCount: number;
};

export type PurchaseOrderReceiptLine = {
  id: string;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  productName: string;
  sku: string;
  trackingMode: string;
  unitId: string;
  currencyCode: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCostMinor: number;
};

export type PurchaseOrderDetailLine = {
  id: string;
  lineNo: number;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  productName: string;
  sku: string;
  trackingMode: "none" | "lot" | "serial";
  quantityOrdered: string;
  quantityReceived: string;
  unitCostMinor: number;
  taxAmountMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
  taxIds: string[];
  taxNames: string | null;
};

export type PurchaseOrderReceiptDocument = {
  id: string;
  receiptNo: string;
  status: string;
  receiptDate: string;
  locationCode: string | null;
  lines: PurchaseOrderReceiptDocumentLine[];
};

export type PurchaseReceiptDetail = PurchaseOrderReceiptDocument & {
  purchaseOrderId: string;
  orderNo: string;
  supplierName: string;
  supplierInvoiceNo: string | null;
  sourceLocationCode: string | null;
  existingVendorBillId: string | null;
  landedCostCount: number;
  currencyCode: string;
  totalMinor: number;
};

export type PurchaseOrderReceiptDocumentLine = {
  id: string;
  receiptId: string;
  lineNo: number;
  productName: string;
  sku: string;
  quantityReceived: string;
  unitCostMinor: number;
  landedUnitCostMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
  serialNo: string | null;
  lotNo: string | null;
};

export type PurchaseOrderVendorBillDocument = {
  id: string;
  billNo: string;
  vendorReference: string | null;
  status: string;
  billDate: string;
  dueDate: string | null;
  untaxedAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  residualAmountMinor: number;
  paymentStatus: string;
  currencyCode: string;
  source: "vendor_bill" | "placeholder";
  lines: PurchaseOrderVendorBillDocumentLine[];
};

export type PurchaseVendorBillDetail = PurchaseOrderVendorBillDocument & {
  purchaseOrderId: string | null;
  orderNo: string | null;
  goodsReceiptId: string | null;
  receiptNo: string | null;
  supplierName: string;
  paymentCount: number;
};

export type PurchaseOrderVendorBillDocumentLine = {
  id: string;
  billId: string;
  lineNo: number;
  productName: string | null;
  sku: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number;
  taxAmountMinor: number;
  taxNames: string | null;
  totalMinor: number;
  currencyCode: string;
};

export type PurchaseOrderDetail = {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  ownerId: string | null;
  ownerName: string | null;
  deliverToLocationId: string | null;
  vendorReference: string | null;
  paymentTerm: "cash" | "credit";
  status: string;
  orderDate: string;
  paymentDueDate: string | null;
  currencyCode: string;
  subtotalMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  paidMinor: number;
  residualAmountMinor: number;
  notes: string | null;
  receiptCount: number;
  vendorBillCount: number;
  landedCostCount: number;
  paymentCount: number;
  returnCount: number;
  lines: PurchaseOrderDetailLine[];
  receipts: PurchaseOrderReceiptDocument[];
  vendorBills: PurchaseOrderVendorBillDocument[];
};

export type PurchaseLandedCostFormOptions = {
  receipts: {
    id: string;
    receiptNo: string;
    orderNo: string;
    purchaseOrderId: string;
    supplierName: string;
    currencyCode: string;
    lines: PurchaseLandedCostFormReceiptLine[];
  }[];
  vendors: PurchaseFormOption[];
};

export type PurchaseLandedCostFormReceiptLine = {
  id: string;
  lineNo: number;
  productName: string;
  sku: string;
  quantityReceived: string;
  lineTotalMinor: number;
  currencyCode: string;
};

export type PurchaseLandedCostDetail = {
  id: string;
  costNo: string;
  costType: string;
  status: string;
  allocationMethod: string;
  purchaseOrderId: string | null;
  orderNo: string | null;
  goodsReceiptId: string | null;
  receiptNo: string | null;
  vendorId: string | null;
  vendorName: string | null;
  amountMinor: number;
  currencyCode: string;
  notes: string | null;
  allocations: PurchaseLandedCostAllocationDetail[];
};

export type PurchaseLandedCostAllocationDetail = {
  id: string;
  goodsReceiptLineId: string;
  lineNo: number;
  productName: string;
  sku: string;
  quantityReceived: string;
  unitCostMinor: number;
  landedUnitCostMinor: number;
  allocatedAmountMinor: number;
  allocationBasis: string | null;
  currencyCode: string;
};
