export type ReturnFormOption = {
  id: string;
  code: string;
  name: string;
};

export type ReturnProductOption = ReturnFormOption & {
  trackingMode: "none" | "lot" | "serial";
};

export type CustomerReturnListRow = {
  id: string;
  returnNo: string;
  status: string;
  returnDate: string;
  orderNo: string;
  customerName: string;
  refundAmountMinor: number;
  currencyCode: string;
  lineCount: number;
};

export type SupplierReturnListRow = {
  id: string;
  returnNo: string;
  status: string;
  returnDate: string;
  receiptNo: string;
  supplierName: string;
  refundAmountMinor: number;
  currencyCode: string;
  lineCount: number;
};

export type ReturnDetailLine = {
  id: string;
  lineNo: number;
  productName: string;
  sku: string;
  quantityReturned: string;
  condition: string;
  refundAmountMinor: number;
  currencyCode: string;
  serialNo: string | null;
  lotNo: string | null;
};

export type CustomerReturnDetail = CustomerReturnListRow & {
  salesOrderId: string;
  deliveryId: string | null;
  customerInvoiceId: string | null;
  destinationLocationCode: string;
  stockMovementId: string | null;
  notes: string | null;
  lines: ReturnDetailLine[];
};

export type SupplierReturnDetail = SupplierReturnListRow & {
  purchaseOrderId: string | null;
  goodsReceiptId: string;
  vendorBillId: string | null;
  sourceLocationCode: string;
  stockMovementId: string | null;
  notes: string | null;
  lines: ReturnDetailLine[];
};

export type ReturnFormOptions = {
  salesOrders: ReturnFormOption[];
  receipts: ReturnFormOption[];
  locations: ReturnFormOption[];
  products: ReturnProductOption[];
};
