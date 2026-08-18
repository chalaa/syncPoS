import type { PaymentTermOption } from "@/server/partners/types";

export type PaymentTermMutation = (formData: FormData) => Promise<void>;

export type PaymentTermsManagerProps = {
  records: PaymentTermOption[];
  query: string;
  showDeleted: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
  createAction: PaymentTermMutation;
  updateAction: PaymentTermMutation;
  softDeleteAction: PaymentTermMutation;
  restoreAction: PaymentTermMutation;
};
