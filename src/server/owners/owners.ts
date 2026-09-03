import "server-only";

import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import { owners } from "@/server/db/schema";
import type { OwnerListRow, OwnerOption } from "@/server/owners/types";

export async function getOwnerOptions(): Promise<OwnerOption[]> {
  const company = await getDefaultCompany();

  return db
    .select({
      id: owners.id,
      name: owners.name,
    })
    .from(owners)
    .where(and(eq(owners.companyId, company.id), isNull(owners.deletedAt)))
    .orderBy(asc(owners.name));
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

  return db
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
