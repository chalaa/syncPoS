import "server-only";

import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { locations, userLocationAccess } from "@/server/db/schema";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

export type ShopOption = {
  id: string;
  code: string;
  name: string;
};

async function getAllActiveDisplayShops(companyId: string) {
  return db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
    })
    .from(locations)
    .where(
      and(
        eq(locations.companyId, companyId),
        eq(locations.locationType, "display_shop"),
        eq(locations.isActive, true),
        isNull(locations.deletedAt),
      ),
    )
    .orderBy(asc(locations.name));
}

export async function getUserShopOptions(
  userId: string,
  companyId: string,
  permissionCodes: Iterable<string> = [],
): Promise<ShopOption[]> {
  if (
    userHasPermission(permissionCodes, PERMISSIONS.LOCATIONS.MANAGE) ||
    userHasPermission(permissionCodes, PERMISSIONS.COMPANY.MANAGE)
  ) {
    return getAllActiveDisplayShops(companyId);
  }

  const accessibleShops = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
    })
    .from(userLocationAccess)
    .innerJoin(locations, eq(userLocationAccess.locationId, locations.id))
    .where(
      and(
        eq(userLocationAccess.userId, userId),
        eq(userLocationAccess.canTransact, true),
        or(isNull(userLocationAccess.validFrom), sql`${userLocationAccess.validFrom} <= now()`),
        or(isNull(userLocationAccess.validTo), sql`${userLocationAccess.validTo} > now()`),
        eq(locations.companyId, companyId),
        eq(locations.locationType, "display_shop"),
        eq(locations.isActive, true),
        isNull(locations.deletedAt),
      ),
    )
    .orderBy(asc(locations.name));

  if (accessibleShops.length > 0) {
    return accessibleShops;
  }

  return getAllActiveDisplayShops(companyId);
}
