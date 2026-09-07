import type { CategorySelectOption, SelectOption } from "@/server/catalog/types";
import type { PurchaseFormOption, PurchaseTaxOption } from "@/server/purchasing/types";

export type SalesFormOption = PurchaseFormOption;
export type SalesTaxOption = PurchaseTaxOption;

export type SalesOrderListRow = {
  id: string;
  orderNo: string;
  customerReference: string | null;
  fsNumber: string | null;
  paymentTerm: "cash" | "credit";
  ownerId: string | null;
  ownerName: string | null;
  customerName: string;
  status: string;
  orderDate: string;
  validUntil: string | null;
  expectedDeliveryDate: string | null;
  sourceLocationCode: string | null;
  currencyCode: string;
  totalMinor: number;
  paidMinor: number;
  residualAmountMinor: number;
  lineCount: number;
  quantityOrdered: string;
  quantityDelivered: string;
  quantityInvoiced: string;
};

export type SalesOrderDetailLine = {
  id: string;
  lineNo: number;
  ownerId: string | null;
  ownerName: string | null;
  productId: string;
  productName: string;
  sku: string;
  trackingMode: "none" | "lot" | "serial";
  quantityOrdered: string;
  quantityReserved: string;
  quantityDelivered: string;
  quantityInvoiced: string;
  unitPriceMinor: number;
  discountMinor: number;
  taxAmountMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
  taxIds: string[];
  taxNames: string | null;
};

export type SalesOrderDetail = {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  ownerId: string | null;
  ownerName: string | null;
  sourceLocationId: string | null;
  customerReference: string | null;
  fsNumber: string | null;
  paymentTerm: "cash" | "credit";
  status: string;
  orderDate: string;
  validUntil: string | null;
  expectedDeliveryDate: string | null;
  currencyCode: string;
  subtotalMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  paidMinor: number;
  residualAmountMinor: number;
  reserveOnConfirm: boolean;
  notes: string | null;
  deliveryCount: number;
  invoiceCount: number;
  paymentCount: number;
  returnCount: number;
  lines: SalesOrderDetailLine[];
  serialOptions: DeliverySerialOption[];
  lotOptions: DeliveryLotOption[];
};

export type SalesFormOptions = {
  company: {
    id: string;
    baseCurrencyCode: string;
  };
  customers: SalesFormOption[];
  owners: SalesFormOption[];
  products: SalesFormOption[];
  productCategories: CategorySelectOption[];
  productBrands: SelectOption[];
  productUnits: SelectOption[];
  locations: SalesFormOption[];
  taxes: SalesTaxOption[];
};

export type DeliveryListRow = {
  id: string;
  deliveryNo: string;
  salesOrderId: string;
  orderNo: string;
  customerName: string;
  status: string;
  deliveryDate: string;
  sourceLocationCode: string;
  lineCount: number;
  quantityDelivered: string;
  currencyCode: string;
  totalCostMinor: number;
};

export type DeliveryDetailLine = {
  id: string;
  lineNo: number;
  salesOrderLineId: string | null;
  productId: string;
  productName: string;
  sku: string;
  trackingMode: "none" | "lot" | "serial";
  quantityOrdered: string | null;
  quantityAlreadyDelivered: string | null;
  quantityDelivered: string;
  unitCostMinor: number;
  totalCostMinor: number;
  currencyCode: string;
  serialNo: string | null;
  lotNo: string | null;
};

export type DeliverySerialOption = {
  id: string;
  productId: string;
  serialNo: string;
  quantityAvailable: string;
};

export type DeliveryLotOption = {
  id: string;
  productId: string;
  lotNo: string;
  quantityAvailable: string;
};

export type DeliveryDetail = {
  id: string;
  deliveryNo: string;
  salesOrderId: string;
  orderNo: string;
  customerName: string;
  sourceLocationId: string;
  sourceLocationCode: string;
  destinationLocationCode: string | null;
  status: string;
  deliveryDate: string;
  postedAt: string | null;
  stockMovementId: string | null;
  notes: string | null;
  lines: DeliveryDetailLine[];
  serialOptions: DeliverySerialOption[];
  lotOptions: DeliveryLotOption[];
};

export type CustomerInvoiceListRow = {
  id: string;
  invoiceNo: string;
  customerReference: string | null;
  status: string;
  paymentStatus: string;
  invoiceDate: string;
  dueDate: string | null;
  salesOrderId: string | null;
  orderNo: string | null;
  deliveryId: string | null;
  deliveryNo: string | null;
  customerName: string;
  productSummary: string | null;
  currencyCode: string;
  untaxedAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  residualAmountMinor: number;
  lineCount: number;
};

export type CustomerInvoiceDetailLine = {
  id: string;
  lineNo: number;
  productName: string | null;
  sku: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number;
  discountMinor: number;
  taxAmountMinor: number;
  taxNames: string | null;
  lineTotalMinor: number;
  currencyCode: string;
};

export type CustomerInvoiceDetail = {
  id: string;
  invoiceNo: string;
  customerReference: string | null;
  status: string;
  paymentStatus: string;
  invoiceDate: string;
  dueDate: string | null;
  untaxedAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  residualAmountMinor: number;
  currencyCode: string;
  salesOrderId: string | null;
  orderNo: string | null;
  deliveryId: string | null;
  deliveryNo: string | null;
  customerName: string;
  paymentCount: number;
  notes: string | null;
  lines: CustomerInvoiceDetailLine[];
};
