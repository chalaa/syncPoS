import { minorToDisplay } from "@/lib/catalog-utils";

export function displayReportMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${minorToDisplay(value)}`;
}
