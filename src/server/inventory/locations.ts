import "server-only";

import { and, asc, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { locations } from "@/server/db/schema";
import {
  stockLocationTypeOptions,
  type StockLocationRecord,
} from "@/server/inventory/location-types";

function addressText(value: unknown) {
  if (!value || typeof value !== "object" || !("addressText" in value)) {
    return "";
  }

  const text = (value as { addressText?: unknown }).addressText;

  return typeof text === "string" ? text : "";
}

export async function getStockLocationList(params: {
  query?: string;
  showDeleted?: boolean;
}): Promise<StockLocationRecord[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(locations.deletedAt) : isNull(locations.deletedAt);
  const searchFilter = query
    ? or(
        ilike(locations.code, `%${query}%`),
        ilike(locations.name, `%${query}%`),
      )
    : undefined;
  const rows = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
      locationType: locations.locationType,
      addressJson: locations.addressJson,
      offlineSalesEnabled: locations.offlineSalesEnabled,
      allowNegativeStock: locations.allowNegativeStock,
      isActive: locations.isActive,
      deletedAt: locations.deletedAt,
    })
    .from(locations)
    .where(
      and(
        eq(locations.companyId, company.id),
        inArray(locations.locationType, [...stockLocationTypeOptions]),
        deletedFilter,
        searchFilter,
      ),
    )
    .orderBy(asc(locations.locationType), asc(locations.name));

  return rows.map((row) => ({
    ...row,
    locationType: row.locationType as StockLocationRecord["locationType"],
    addressText: addressText(row.addressJson),
  }));
}
