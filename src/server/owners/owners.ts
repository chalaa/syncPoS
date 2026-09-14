import "server-only";

import { and, asc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { locations, ownerLocations, owners } from "@/server/db/schema";
import type { OwnerListRow, OwnerOption } from "@/server/owners/types";

export async function getOwnerOptions(): Promise<OwnerOption[]> {
  const company = await getDefaultCompany();

  const ownerRows = await db
    .select({
      id: owners.id,
      name: owners.name,
    })
    .from(owners)
    .where(and(eq(owners.companyId, company.id), isNull(owners.deletedAt)))
    .orderBy(asc(owners.name));

  if (ownerRows.length === 0) {
    return [];
  }

  const ownerIds = ownerRows.map((o) => o.id);
  const links = await db
    .select({
      ownerId: ownerLocations.ownerId,
      locationId: ownerLocations.locationId,
    })
    .from(ownerLocations)
    .where(inArray(ownerLocations.ownerId, ownerIds));

  const linksByOwner = new Map<string, string[]>();
  links.forEach((link) => {
    const list = linksByOwner.get(link.ownerId) ?? [];
    list.push(link.locationId);
    linksByOwner.set(link.ownerId, list);
  });

  return ownerRows.map((owner) => ({
    id: owner.id,
    name: owner.name,
    code: owner.name,
    locationIds: linksByOwner.get(owner.id) ?? [],
  }));
}

export async function getOwnerList({
  query = "",
  showDeleted = false,
}: {
  query?: string;
  showDeleted?: boolean;
} = {}): Promise<OwnerListRow[]> {
  const company = await getDefaultCompany();
  const search = query.trim();

  const ownerRows = await db
    .select({
      id: owners.id,
      name: owners.name,
      deletedAt: owners.deletedAt,
    })
    .from(owners)
    .where(
      and(
        eq(owners.companyId, company.id),
        showDeleted ? sql`${owners.deletedAt} is not null` : isNull(owners.deletedAt),
        search ? ilike(owners.name, `%${search}%`) : undefined,
      ),
    )
    .orderBy(asc(owners.name));

  if (ownerRows.length === 0) {
    return [];
  }

  const ownerIds = ownerRows.map((o) => o.id);
  const locLinks = await db
    .select({
      ownerId: ownerLocations.ownerId,
      locationId: locations.id,
      locationName: locations.name,
      locationCode: locations.code,
    })
    .from(ownerLocations)
    .innerJoin(locations, eq(ownerLocations.locationId, locations.id))
    .where(and(inArray(ownerLocations.ownerId, ownerIds), isNull(locations.deletedAt)));

  const locsByOwner = new Map<string, { id: string; name: string; code: string }[]>();
  locLinks.forEach((link) => {
    const list = locsByOwner.get(link.ownerId) ?? [];
    list.push({ id: link.locationId, name: link.locationName, code: link.locationCode });
    locsByOwner.set(link.ownerId, list);
  });

  return ownerRows.map((owner) => {
    const ownerLocs = locsByOwner.get(owner.id) ?? [];
    return {
      id: owner.id,
      name: owner.name,
      code: owner.name,
      deletedAt: owner.deletedAt,
      locations: ownerLocs,
      locationIds: ownerLocs.map((l) => l.id),
    };
  });
}

export async function getDefaultOwnerId(companyId: string): Promise<string | null> {
  const [owner] = await db
    .select({ id: owners.id })
    .from(owners)
    .where(and(eq(owners.companyId, companyId), isNull(owners.deletedAt)))
    .orderBy(asc(owners.name))
    .limit(1);

  return owner?.id ?? null;
}
