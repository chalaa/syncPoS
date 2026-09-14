import "server-only";

import { sql } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";

export type AuditSeverity = "info" | "warning" | "critical";

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  severity: AuditSeverity;
  actorUsername: string | null;
  locationCode: string | null;
  ipAddress: string | null;
  occurredAt: string;
};

export type AuditLogDetail = AuditLogRow & {
  metadata: unknown;
};

export type AuditLogFilters = {
  query?: string;
  severity?: string;
  action?: string;
  entityType?: string;
  page?: number;
};

const pageSize = 50;

export function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditMetadata);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const normalized = key.toLowerCase();

      if (
        normalized.includes("api_key") ||
        normalized.includes("apikey") ||
        normalized.includes("authorization") ||
        normalized.includes("password") ||
        normalized.includes("secret") ||
        normalized.includes("token")
      ) {
        return [key, "[redacted]"];
      }

      return [key, sanitizeAuditMetadata(item)];
    }),
  );
}

function normalizedSeverity(value?: string) {
  return value === "info" || value === "warning" || value === "critical" ? value : "";
}

export async function getAuditLogList(filters: AuditLogFilters) {
  const company = await getDefaultCompany();
  const query = filters.query?.trim() ?? "";
  const severity = normalizedSeverity(filters.severity);
  const action = filters.action?.trim() ?? "";
  const entityType = filters.entityType?.trim() ?? "";
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const whereClause = sql`
    al.company_id = ${company.id}
    and (${query || null}::text is null or (
      al.action ilike ${`%${query}%`}
      or al.entity_type ilike ${`%${query}%`}
      or al.entity_id::text ilike ${`%${query}%`}
      or coalesce(u.username, '') ilike ${`%${query}%`}
      or al.metadata::text ilike ${`%${query}%`}
    ))
    and (${severity || null}::text is null or al.severity::text = ${severity})
    and (${action || null}::text is null or al.action ilike ${`%${action}%`})
    and (${entityType || null}::text is null or al.entity_type ilike ${`%${entityType}%`})
  `;

  const [rows, totals] = await Promise.all([
    db.execute<AuditLogRow>(sql`
      select
        al.id as "id",
        al.action as "action",
        al.entity_type as "entityType",
        al.entity_id as "entityId",
        al.severity::text as "severity",
        u.username as "actorUsername",
        loc.code as "locationCode",
        al.ip_address as "ipAddress",
        al.occurred_at::text as "occurredAt"
      from audit_logs al
      left join users u on u.id = al.actor_user_id
      left join locations loc on loc.id = al.location_id
      where ${whereClause}
      order by al.occurred_at desc
      limit ${pageSize}
      offset ${offset}
    `),
    db.execute<{ count: number }>(sql`
      select count(*)::int as "count"
      from audit_logs al
      left join users u on u.id = al.actor_user_id
      left join locations loc on loc.id = al.location_id
      where ${whereClause}
    `),
  ]);

  const total = totals[0]?.count ?? 0;

  return {
    rows,
    page,
    pageSize,
    total,
    pageCount: Math.max(Math.ceil(total / pageSize), 1),
  };
}

export async function getAuditLogDetail(id: string): Promise<AuditLogDetail | null> {
  const company = await getDefaultCompany();
  const [row] = await db.execute<AuditLogDetail>(sql`
    select
      al.id as "id",
      al.action as "action",
      al.entity_type as "entityType",
      al.entity_id as "entityId",
      al.severity::text as "severity",
      u.username as "actorUsername",
      loc.code as "locationCode",
      al.metadata as "metadata",
      al.ip_address as "ipAddress",
      al.occurred_at::text as "occurredAt"
    from audit_logs al
    left join users u on u.id = al.actor_user_id
    left join locations loc on loc.id = al.location_id
    where al.id = ${id}
      and al.company_id = ${company.id}
    limit 1
  `);

  return row ?? null;
}
