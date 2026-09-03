import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { locations } from "@/server/db/schema";

type SystemLocationType = "adjustment" | "scrap";

const systemLocationDefaults: Record<SystemLocationType, { code: string; name: string }> = {
  adjustment: {
    code: "INV-ADJ",
    name: "Inventory Adjustment",
  },
  scrap: {
    code: "SCRAP",
    name: "Scrap Location",
  },
};

export async function getOrCreateSystemStockLocation(companyId: string, locationType: SystemLocationType) {
  const defaults = systemLocationDefaults[locationType];
  const [existing] = await db
    .select({
      id: locations.id,
      code: locations.code,
      name: locations.name,
    })
    .from(locations)
    .where(sql`${locations.companyId} = ${companyId} and ${locations.code} = ${defaults.code} and ${locations.deletedAt} is null`)
    .limit(1);

  if (existing) {
    await db
      .update(locations)
      .set({
        locationType,
        isActive: true,
        offlineSalesEnabled: false,
        allowNegativeStock: false,
        updatedAt: sql`now()`,
      })
      .where(eq(locations.id, existing.id));

    return existing;
  }

  const [created] = await db
    .insert(locations)
    .values({
      companyId,
      code: defaults.code,
      name: defaults.name,
      locationType,
      offlineSalesEnabled: false,
      allowNegativeStock: false,
      isActive: true,
    })
    .returning({
      id: locations.id,
      code: locations.code,
      name: locations.name,
    });

  return created;
}
