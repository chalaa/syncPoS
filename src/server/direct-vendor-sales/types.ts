import type { CategorySelectOption, SelectOption } from "@/server/catalog/types";
import type { OwnerOption } from "@/server/owners/types";
import type { SalesFormOption } from "@/server/sales/types";

export type DirectVendorSaleStatus = "draft" | "posted" | "cancelled";
export type DirectVendorSalePaymentTerm = "cash" | "credit";

export type DirectVendorSalePaymentOption = {
  id: string;
  code: string;
  name: string;
  paymentMethodId: string;
  paymentMethodName: string;
  requiresReference: boolean;
  currencyCode: string;
};

export type DirectVendorSaleProductOption = SalesFormOption & {
  sku?: string | null;
  listPriceMinor: number;
  standardCostMinor: number;
};

export type DirectVendorSaleFormOptions = {
  company: {
    id: string;
    baseCurrencyCode: string;
  };
  customers: SalesFormOption[];
  vendors: SalesFormOption[];
  owners: OwnerOption[];
  products: DirectVendorSaleProductOption[];
  productCategories: CategorySelectOption[];
  productBrands: SelectOption[];
  productUnits: SelectOption[];
  inboundPaymentAccounts: DirectVendorSalePaymentOption[];
  outboundPaymentAccounts: DirectVendorSalePaymentOption[];
};

export type DirectVendorSaleListRow = {
  id: string;
  saleNo: string;
  customerName: string;
  vendorName: string;
  ownerName: string | null;
  status: DirectVendorSaleStatus;
  saleDate: string;
  currencyCode: string;
  customerTotalMinor: number;
  vendorCostTotalMinor: number;
  marginMinor: number;
  customerPaymentTerm: DirectVendorSalePaymentTerm;
  vendorPaymentTerm: DirectVendorSalePaymentTerm;
  customerPaymentName: string | null;
  vendorPaymentName: string | null;
  lineCount: number;
  quantity: string;
};

export type DirectVendorSaleDetailLine = {
  id: string;
  lineNo: number;
  productName: string;
  sku: string;
  description: string | null;
  unitCode: string;
  quantity: string;
  vendorUnitCostMinor: number;
  customerUnitPriceMinor: number;
  discountMinor: number;
  taxAmountMinor: number;
  vendorLineTotalMinor: number;
  customerLineTotalMinor: number;
  lineMarginMinor: number;
  currencyCode: string;
};

export type DirectVendorSaleDetail = {
  id: string;
  saleNo: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  ownerName: string | null;
  saleDate: string;
  status: DirectVendorSaleStatus;
  currencyCode: string;
  customerPaymentTerm: DirectVendorSalePaymentTerm;
  vendorPaymentTerm: DirectVendorSalePaymentTerm;
  customerPaymentName: string | null;
  customerPaymentReference: string | null;
  vendorPaymentName: string | null;
  vendorPaymentReference: string | null;
  subtotalMinor: number;
  taxAmountMinor: number;
  customerTotalMinor: number;
  vendorCostTotalMinor: number;
  marginMinor: number;
  customerPaidMinor: number;
  vendorPaidMinor: number;
  customerPaymentCount: number;
  vendorPaymentCount: number;
  notes: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  lines: DirectVendorSaleDetailLine[];
};
