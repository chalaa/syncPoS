export type PaymentMethodType = "cash" | "bank_transfer" | "mobile_money" | "card";

export type PaymentDirection = "inbound" | "outbound";
export type PaymentDocumentStatus = "draft" | "posted" | "cancelled";

export type PaymentMethodRow = {
  id: string;
  code: string;
  name: string;
  methodType: PaymentMethodType;
  allowInbound: boolean;
  allowOutbound: boolean;
  requiresReference: boolean;
  isActive: boolean;
  notes: string | null;
  deletedAt: Date | null;
};

export type PaymentAccountRow = {
  id: string;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentMethodType: PaymentMethodType;
  code: string;
  name: string;
  institutionName: string | null;
  accountNumber: string | null;
  openingBalanceMinor: number;
  currencyCode: string;
  isActive: boolean;
  notes: string | null;
  deletedAt: Date | null;
};

export type PaymentMethodOption = {
  id: string;
  code: string;
  name: string;
  methodType: PaymentMethodType;
  requiresReference: boolean;
};

export type PaymentAccountOption = {
  id: string;
  code: string;
  name: string;
  paymentMethodId: string;
  currencyCode: string;
};

export type PaymentListRow = {
  id: string;
  paymentNo: string;
  paymentType: PaymentDirection;
  status: PaymentDocumentStatus;
  paymentDate: string;
  partnerName: string | null;
  paymentMethodName: string;
  paymentAccountName: string;
  amountMinor: number;
  allocatedAmountMinor: number;
  currencyCode: string;
  reference: string | null;
};

export type PaymentAllocationRow = {
  id: string;
  vendorBillId: string | null;
  billNo: string | null;
  expenseId: string | null;
  expenseNo: string | null;
  customerInvoiceId: string | null;
  invoiceNo: string | null;
  amountMinor: number;
  currencyCode: string;
};

export type PaymentDetail = PaymentListRow & {
  notes: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  allocations: PaymentAllocationRow[];
};

export type VendorBillPaymentSummary = {
  paymentCount: number;
  postedPaidMinor: number;
  residualAmountMinor: number;
  paymentStatus: "not_paid" | "partial" | "paid";
};

export type CustomerInvoicePaymentSummary = VendorBillPaymentSummary;
