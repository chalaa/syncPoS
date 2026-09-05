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
};

export type CatalogReferenceKind = "category" | "brand" | "unit";

export type CatalogReferenceRecord = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  precision?: string;
  isActive: boolean;
  deletedAt: Date | null;
};

export type ProductFormRecord = {
  id: string;
  sku: string;
  templateId: string | null;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  model: string | null;
  description: string | null;
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

export type CatalogAttributeValueRecord = {
  id: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
};

export type CatalogAttributeRecord = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  deletedAt: Date | null;
  values: CatalogAttributeValueRecord[];
};

export type CategoryAttributeRecord = {
  id: string;
  categoryId: string;
  categoryName: string;
  attributeId: string;
  attributeName: string;
  isRequired: boolean;
  sortOrder: number;
};

export type ProductTemplateListRow = {
  id: string;
  name: string;
  categoryName: string | null;
  brandName: string | null;
  unitCode: string | null;
  trackingMode: TrackingModeOption;
  variantCount: number;
  isActive: boolean;
};

export type ProductTemplateAttributeOption = {
  attributeId: string;
  attributeName: string;
  isRequired: boolean;
  sortOrder: number;
  values: CatalogAttributeValueRecord[];
  selectedValueIds: string[];
};

export type ProductTemplateDetail = {
  id: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  unitId: string | null;
  trackingMode: TrackingModeOption;
  description: string | null;
  isActive: boolean;
  attributes: ProductTemplateAttributeOption[];
  variants: {
    id: string;
    sku: string;
    name: string;
    model: string | null;
    listPriceMinor: number;
    standardCostMinor: number;
    currencyCode: string;
    isActive: boolean;
    attributeSummary: string | null;
  }[];
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
  category: string;
  categoryName: string;
  brand: string;
  brandName: string;
  model: string;
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

export type ProductTemplateImportRow = {
  rowNumber: number;
  productTemplate: string;
  category: string;
  categoryName: string;
  brand: string;
  brandName: string;
  unit: string;
  unitName: string;
  trackingMode: TrackingModeOption | "";
  description: string;
  isActive: boolean;
  attributeValuesText: string;
  variantAttributes: {
    attribute: string;
    value: string;
  }[];
  action: "create" | "update";
  errors: string[];
};

export type ProductTemplateImportPreviewState = {
  status: "idle" | "preview" | "error" | "imported";
  message?: string;
  rows: ProductTemplateImportRow[];
  importToken?: string;
};

export type ProductTemplateImportCommitPayload = {
  importToken: string;
  rows: ProductTemplateImportRow[];
};

export type CategoryAttributeImportRow = {
  rowNumber: number;
  categoryCode: string;
  categoryName: string;
  attributeCode: string;
  attributeName: string;
  value: string;
  isRequired: boolean;
  sortOrder: number;
  action: "create" | "update";
  errors: string[];
};

export type CategoryAttributeImportPreviewState = {
  status: "idle" | "preview" | "error" | "imported";
  message?: string;
  rows: CategoryAttributeImportRow[];
  importToken?: string;
};

export type CategoryAttributeImportCommitPayload = {
  importToken: string;
  rows: CategoryAttributeImportRow[];
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
