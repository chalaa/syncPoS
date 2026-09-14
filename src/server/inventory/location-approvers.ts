import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { locationApprovers, locations, users } from "@/server/db/schema";

export async function getLocationApproverManagementData(companyId: string) {
  const [approvers, locationOptions, userOptions] = await Promise.all([
    db
      .select({
        id: locationApprovers.id,
        locationId: locationApprovers.locationId,
        locationCode: locations.code,
        locationName: locations.name,
        userId: locationApprovers.userId,
        username: users.username,
        userEmail: users.email,
        isActive: locationApprovers.isActive,
      })
      .from(locationApprovers)
      .innerJoin(locations, eq(locationApprovers.locationId, locations.id))
      .innerJoin(users, eq(locationApprovers.userId, users.id))
      .where(and(eq(locationApprovers.companyId, companyId), isNull(locationApprovers.deletedAt)))
      .orderBy(asc(locations.code), asc(users.username)),
    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
        locationType: locations.locationType,
      })
      .from(locations)
      .where(
        and(
          eq(locations.companyId, companyId),
          eq(locations.isActive, true),
          isNull(locations.deletedAt),
          sql`${locations.locationType} in ('warehouse', 'display_shop', 'transit')`,
        ),
      )
      .orderBy(asc(locations.code)),
    db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.status, "active"), isNull(users.deletedAt)))
      .orderBy(asc(users.username)),
  ]);

  return {
    approvers,
    locations: locationOptions,
    users: userOptions,
  };
}
