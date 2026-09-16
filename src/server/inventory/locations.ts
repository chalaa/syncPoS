import "server-only";

import { and, asc, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { locationApprovers, locations, users } from "@/server/db/schema";
import {
  stockLocationTypeOptions,
  type StockLocationUserOption,
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
  type?: string;
  status?: string;
}): Promise<StockLocationRecord[]> {
  const company = await getDefaultCompany();
  const query = params.query?.trim();
  const deletedFilter = params.showDeleted ? isNotNull(locations.deletedAt) : isNull(locations.deletedAt);
  const typeFilter = params.type ? eq(locations.locationType, params.type as any) : undefined;
  const statusFilter =
    params.status === "active"
      ? eq(locations.isActive, true)
      : params.status === "inactive"
        ? eq(locations.isActive, false)
        : undefined;
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
        typeFilter,
        statusFilter,
        searchFilter,
      ),
    )
    .orderBy(asc(locations.locationType), asc(locations.name));
  const approverRows = rows.length === 0
    ? []
    : await db
        .select({
          locationId: locationApprovers.locationId,
          userId: users.id,
          username: users.username,
        })
        .from(locationApprovers)
        .innerJoin(users, eq(locationApprovers.userId, users.id))
        .where(
          and(
            eq(locationApprovers.companyId, company.id),
            inArray(locationApprovers.locationId, rows.map((row) => row.id)),
            eq(locationApprovers.isActive, true),
            isNull(locationApprovers.deletedAt),
            isNull(users.deletedAt),
          ),
        )
        .orderBy(asc(users.username));
  const approversByLocation = new Map<string, { ids: string[]; names: string[] }>();

  for (const approver of approverRows) {
    const current = approversByLocation.get(approver.locationId) ?? { ids: [], names: [] };
    current.ids.push(approver.userId);
    current.names.push(approver.username);
    approversByLocation.set(approver.locationId, current);
  }

  return rows.map((row) => ({
    ...row,
    locationType: row.locationType as StockLocationRecord["locationType"],
    addressText: addressText(row.addressJson),
    approverIds: approversByLocation.get(row.id)?.ids ?? [],
    approverNames: approversByLocation.get(row.id)?.names ?? [],
  }));
}

export async function getStockLocationUserOptions(): Promise<StockLocationUserOption[]> {
  const company = await getDefaultCompany();

  return db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.companyId, company.id), eq(users.status, "active"), isNull(users.deletedAt)))
    .orderBy(asc(users.username));
}
