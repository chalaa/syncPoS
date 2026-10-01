import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

const migrationTimestamp = 1790081407113;
const migrationPath = "drizzle/0049_smart_betty_brant.sql";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required.");

  const url = new URL(databaseUrl);
  const migrationSql = await readFile(migrationPath, "utf8");
  const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
  const client = postgres(databaseUrl, { max: 1, prepare: false });

  console.log(`Reconciling migration 0049 on ${url.pathname.slice(1)} at ${url.hostname}...`);

  try {
    await client.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('syncpos-migration-0049-repair'))`;

      const [state] = await tx.unsafe<{
        migrationRecorded: boolean;
        ownerLocations: string | null;
        expensesCreatedBy: boolean;
        ownerIndex: boolean;
        locationIndex: boolean;
      }[]>(`
        select
          exists(
            select 1 from drizzle.__drizzle_migrations where created_at = ${migrationTimestamp}
          ) as "migrationRecorded",
          to_regclass($$public.owner_locations$$)::text as "ownerLocations",
          exists(
            select 1 from information_schema.columns
            where table_schema = $$public$$
              and table_name = $$expenses$$
              and column_name = $$created_by$$
          ) as "expensesCreatedBy",
          exists(
            select 1 from pg_indexes
            where schemaname = $$public$$ and indexname = $$owner_locations_owner_idx$$
          ) as "ownerIndex",
          exists(
            select 1 from pg_indexes
            where schemaname = $$public$$ and indexname = $$owner_locations_location_idx$$
          ) as "locationIndex"
      `);

      if (state.migrationRecorded) {
        console.log("Migration 0049 is already recorded; no repair is needed.");
        return;
      }

      assert(state.ownerLocations === "owner_locations", "owner_locations must already exist for this repair.");
      assert(state.expensesCreatedBy, "expenses.created_by must already exist for this repair.");
      assert(state.ownerIndex, "owner_locations_owner_idx must already exist for this repair.");
      assert(state.locationIndex, "owner_locations_location_idx must already exist for this repair.");

      await tx`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${migrationHash}, ${migrationTimestamp})
      `;
    });

    console.log("Migration 0049 reconciliation completed successfully.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
