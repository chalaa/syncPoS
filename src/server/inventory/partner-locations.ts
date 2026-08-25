import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { locations } from "@/server/db/schema";

type PartnerLocationType = "supplier" | "customer";

const partnerLocationDefaults: Record<PartnerLocationType, { code: string; name: string }> = {
  supplier: {
    code: "VENDORS",
    name: "Vendor Location",
  },
  customer: {
    code: "CUSTOMERS",
    name: "Customer Location",
  },
};

export async function getOrCreatePartnerStockLocation(companyId: string, locationType: PartnerLocationType) {
  const defaults = partnerLocationDefaults[locationType];
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
