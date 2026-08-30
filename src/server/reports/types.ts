export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  status?: string;
  paymentType?: "inbound" | "outbound";
  paymentAccountId?: string;
};

export type DashboardMetric = {
  label: string;
  value: string;
  href: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export type DashboardPaymentAccount = {
  id: string;
  code: string;
  name: string;
  institutionName: string | null;
  currencyCode: string;
  openingBalanceMinor: number;
  inboundMinor: number;
  outboundMinor: number;
  netBalanceMinor: number;
};

export type DashboardRecentActivity = {
  id: string;
  documentNo: string;
  activityType: string;
  activityDate: string;
  partyName: string | null;
  amountMinor: number;
  currencyCode: string;
  href: string;
};

export type DashboardLowStockRow = {
  productId: string;
  sku: string;
  productName: string;
  locationCode: string;
  quantityAvailable: string;
};

export type DashboardReport = {
  metrics: DashboardMetric[];
  paymentAccounts: DashboardPaymentAccount[];
  recentActivity: DashboardRecentActivity[];
  lowStock: DashboardLowStockRow[];
};

export type SalesReportRow = {
  id: string;
  invoiceNo: string;
  orderNo: string | null;
  customerName: string;
  status: string;
  paymentStatus: string;
  invoiceDate: string;
  locationCode: string | null;
  untaxedAmountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  paidAmountMinor: number;
  residualAmountMinor: number;
  currencyCode: string;
};

export type ExpenseReportRow = {
  id: string;
  expenseNo: string;
  status: string;
  paymentStatus: string;
  expenseDate: string;
  categoryName: string;
  employeeName: string | null;
  vendorName: string | null;
  locationName: string | null;
  amountMinor: number;
  paidAmountMinor: number;
  residualAmountMinor: number;
  currencyCode: string;
  description: string | null;
};

export type PaymentAccountStatementRow = {
  id: string;
  paymentNo: string;
  paymentType: "inbound" | "outbound";
  status: string;
  paymentDate: string;
  partnerName: string | null;
  paymentMethodName: string;
  paymentAccountName: string;
  institutionName: string | null;
  reference: string | null;
  amountMinor: number;
  signedAmountMinor: number;
  allocatedAmountMinor: number;
  currencyCode: string;
};

export type PaymentReportRow = PaymentAccountStatementRow & {
  sourceDocuments: string | null;
  sourceTypes: string | null;
};

export type StockReportRow = {
  productId: string;
  locationId: string;
  productSerialId: string | null;
  productLotId: string | null;
  sku: string;
  productName: string;
  trackingMode: string;
  locationCode: string;
  locationName: string;
  serialNo: string | null;
  lotNo: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  averageCostMinor: number;
  stockValueMinor: number;
  currencyCode: string;
};

export type ReceivableReportRow = {
  id: string;
  invoiceNo: string;
  orderNo: string | null;
  customerName: string;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  totalMinor: number;
  paidAmountMinor: number;
  residualAmountMinor: number;
  currencyCode: string;
};

export type PayableReportRow = {
  id: string;
  billNo: string;
  orderNo: string | null;
  supplierName: string;
  status: string;
  billDate: string;
  dueDate: string | null;
  totalMinor: number;
  paidAmountMinor: number;
  residualAmountMinor: number;
  currencyCode: string;
};

export type ReportSummary = {
  count: number;
  totalMinor: number;
  paidMinor?: number;
  residualMinor?: number;
  currencyCode: string;
};
