export const trackingModeOptions = ["none", "lot", "serial"] as const;
export const taxScopeOptions = ["purchase", "sale", "both"] as const;
export const taxComputationOptions = ["percent", "fixed"] as const;
export type TrackingModeOption = (typeof trackingModeOptions)[number];
export type TaxScopeOption = (typeof taxScopeOptions)[number];
export type TaxComputationOption = (typeof taxComputationOptions)[number];

export type SelectOption = {
  id: string;
  code: string;
  name: string;
  country?: string | null;
};

export type ProductSpecificationField = {
  key: string;
  label: string;
};

export type ProductSpecifications = Record<string, string | null>;

export type CategorySelectOption = SelectOption & {
  specificationSchema: ProductSpecificationField[];
};

export type CatalogReferenceKind = "category" | "brand" | "unit";

export type CatalogReferenceRecord = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  country?: string | null;
  precision?: string;
  specificationSchema?: ProductSpecificationField[];
  isActive: boolean;
  deletedAt: Date | null;
};

export type ProductFormRecord = {
  id: string;
  sku: string;
  name: string;
  standardName: string | null;
  categoryId: string | null;
  brandId: string | null;
  model: string | null;
  country: string | null;
  description: string | null;
  specifications: ProductSpecifications;
  unitId: string;
  trackingMode: TrackingModeOption;
  standardCostMinor: number;
  listPriceMinor: number;
  currencyCode: string;
  isActive: boolean;
  saleTaxIds: string[];
  purchaseTaxIds: string[];
  saleTaxNames?: string;
  purchaseTaxNames?: string;
};

export type ProductDetailStockRow = {
  stockBalanceId: string;
  locationCode: string;
  locationName: string;
  serialNo: string | null;
  lotNo: string | null;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  averageCostMinor: number;
  currencyCode: string;
};

export type ProductDetailTrackingRow = {
  id: string;
  kind: "serial" | "lot";
  referenceNo: string;
  status: string;
  currentLocationCode: string | null;
  landedUnitCostMinor: number | null;
  quantityOnHand: string;
};

export type ProductDetailMovementRow = {
  movementId: string;
  movementNo: string;
  movementType: string;
  movementDate: Date;
  sourceNo: string | null;
  fromLocationCode: string | null;
  toLocationCode: string | null;
  serialNo: string | null;
  lotNo: string | null;
  quantity: string;
  totalCostMinor: number;
  currencyCode: string;
};

export type ProductDetail = ProductFormRecord & {
  categoryName: string | null;
  brandName: string | null;
  unitCode: string;
  unitName: string;
  quantityOnHand: string;
  quantityReserved: string;
  quantityAvailable: string;
  incomingQuantity: string;
  receiptCount: number;
  movementCount: number;
  stockRows: ProductDetailStockRow[];
  trackingRows: ProductDetailTrackingRow[];
  movementRows: ProductDetailMovementRow[];
};

export type ProductPriceListRow = {
  id: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  currencyCode: string;
  itemCount: number;
  isActive: boolean;
  items: ProductPriceListItemRow[];
};

export type ProductPriceListItemRow = {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  minimumQuantity: string;
  unitPriceMinor: number;
  discountMinor: number;
  isActive: boolean;
};

export type PriceListFormOptions = {
  products: SelectOption[];
  owners: Omit<SelectOption, "code">[];
};

export type ProductTrackingListRow = {
  id: string;
  kind: "serial" | "lot";
  referenceNo: string;
  productId: string;
  sku: string;
  productName: string;
  status: string;
  currentLocationCode: string | null;
  landedUnitCostMinor: number | null;
  quantityOnHand: string;
};

export type ProductImportRow = {
  rowNumber: number;
  sku: string;
  productName: string;
  standardName: string;
  category: string;
  categoryName: string;
  brand: string;
  brandName: string;
  model: string;
  country: string;
  unit: string;
  unitName: string;
  trackingMode: TrackingModeOption | "";
  salesUnitPrice: string;
  purchaseUnitCost: string;
  listPriceMinor: number;
  standardCostMinor: number;
  salesTaxes: string;
  purchaseTaxes: string;
  saleTaxIds: string[];
  purchaseTaxIds: string[];
  description: string;
  specifications: ProductSpecifications;
  action: "create" | "update";
  existingProductId: string | null;
  errors: string[];
};

export type ProductImportPreviewState = {
  status: "idle" | "preview" | "error" | "imported";
  message?: string;
  rows: ProductImportRow[];
  importToken?: string;
};

export type ProductImportCommitPayload = {
  importToken: string;
  rows: ProductImportRow[];
};

export type CategoryImportRow = {
  rowNumber: number;
  code: string;
  name: string;
  description: string;
  specificationSchema: ProductSpecificationField[];
  action: "create" | "update";
  existingCategoryId: string | null;
  errors: string[];
};

export type CategoryImportPreviewState = {
  status: "idle" | "preview" | "error" | "imported";
  message?: string;
  rows: CategoryImportRow[];
  importToken?: string;
};

export type CategoryImportCommitPayload = {
  importToken: string;
  rows: CategoryImportRow[];
};

export type TaxRecord = {
  id: string;
  code: string;
  name: string;
  scope: TaxScopeOption;
  computation: TaxComputationOption;
  rate: string;
  amountMinor: number;
  priceIncluded: boolean;
  description: string | null;
  isActive: boolean;
  deletedAt: Date | null;
};

export type ProductTaxOption = TaxRecord & {
  label: string;
};
