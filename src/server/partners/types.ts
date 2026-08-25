export const partnerStatusOptions = ["active", "blocked", "inactive"] as const;
export const addressTypeOptions = ["billing", "delivery", "office", "warehouse"] as const;

export type PartnerStatusOption = (typeof partnerStatusOptions)[number];
export type AddressTypeOption = (typeof addressTypeOptions)[number];

export type PaymentTermOption = {
  id: string;
  code: string;
  name: string;
  dueDays: number;
  description: string | null;
  isActive: boolean;
  deletedAt?: Date | null;
};

export type PartnerFormRecord = {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  tin: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  paymentTermId: string | null;
  creditLimitMinor: number;
  status: PartnerStatusOption;
  notes: string | null;
  primaryContact?: {
    fullName: string;
    roleTitle: string | null;
    phone: string | null;
    email: string | null;
  };
  primaryAddress?: {
    addressType: AddressTypeOption;
    label: string | null;
    line1: string;
    line2: string | null;
    city: string | null;
    region: string | null;
    country: string;
  };
};

export type PartnerFinancialSummary = {
  invoiceCount: number;
  billCount: number;
  receivableResidualMinor: number;
  payableResidualMinor: number;
  remainingCreditMinor: number;
  netBalanceMinor: number;
};

export type PartnerDetailRecord = PartnerFormRecord & {
  currencyCode: string;
  paymentTermName: string | null;
  paymentTermDueDays: number | null;
  financial: PartnerFinancialSummary;
};
