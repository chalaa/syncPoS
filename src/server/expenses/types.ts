export type ExpenseCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: Date | null;
};

export type ExpenseListRow = {
  id: string;
  expenseNo: string;
  status: "posted" | "cancelled";
  paymentStatus: "unpaid" | "paid";
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

export type ExpenseAttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
};

export type ExpenseDetail = ExpenseListRow & {
  categoryId: string;
  employeeId: string | null;
  vendorId: string | null;
  locationId: string | null;
  paymentCount: number;
  attachments: ExpenseAttachmentRow[];
};

export type ExpenseFormOption = {
  id: string;
  code: string;
  name: string;
};

export type ExpenseFormOptions = {
  categories: ExpenseFormOption[];
  employees: ExpenseFormOption[];
  vendors: ExpenseFormOption[];
  locations: ExpenseFormOption[];
};
