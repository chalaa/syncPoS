export const stockLocationTypeOptions = [
  "warehouse",
  "display_shop",
  "transit",
  "adjustment",
  "scrap",
] as const;

export const stockSelectableLocationTypeOptions = [
  "warehouse",
  "display_shop",
  "transit",
] as const;

export type StockLocationTypeOption = (typeof stockLocationTypeOptions)[number];

export type StockLocationRecord = {
  id: string;
  code: string;
  name: string;
  locationType: StockLocationTypeOption;
  addressText: string;
  offlineSalesEnabled: boolean;
  allowNegativeStock: boolean;
  isActive: boolean;
  deletedAt: Date | null;
};

export function formatStockLocationType(value: string) {
  return value.replace(/_/g, " ");
}
