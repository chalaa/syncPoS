export const productTypeOptions = [
  "machinery",
  "spare_part",
  "accessory",
  "consumable",
  "service",
] as const;

export const trackingModeOptions = ["none", "lot", "serial"] as const;
export const taxScopeOptions = ["purchase", "sale", "both"] as const;
export const taxComputationOptions = ["percent", "fixed"] as const;
export const priceListTypeOptions = [
  "retail",
  "wholesale",
  "customer_specific",
  "location_specific",
] as const;

export type ProductTypeOption = (typeof productTypeOptions)[number];
export type TrackingModeOption = (typeof trackingModeOptions)[number];
export type TaxScopeOption = (typeof taxScopeOptions)[number];
export type TaxComputationOption = (typeof taxComputationOptions)[number];
export type PriceListTypeOption = (typeof priceListTypeOptions)[number];

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
  precision?: number;
  isActive: boolean;
  deletedAt: Date | null;
};

export type ProductFormRecord = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  model: string | null;
  description: string | null;
  unitId: string;
  productType: ProductTypeOption;
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
  unitCostMinor: number;
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
  code: string;
  name: string;
  priceListType: string;
  currencyCode: string;
  locationId: string | null;
  locationCode: string | null;
  itemCount: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
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
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
};

export type PriceListFormOptions = {
  products: SelectOption[];
  locations: SelectOption[];
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
