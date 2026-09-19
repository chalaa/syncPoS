import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

const migrationTimestamp = 1789647009800;
const previousMigrationTimestamp = 1789234368127;
const migrationPath = "drizzle/0047_dazzling_wraith.sql";

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

  console.log(`Reconciling migration 0047 on ${url.pathname.slice(1)} at ${url.hostname}...`);

  try {
    await client.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('syncpos-migration-0047-repair'))`;

      const [state] = await tx<{
        ownerLocations: string | null;
        approvals: string | null;
        latestMigrationAt: string | null;
        migrationRecorded: boolean;
      }[]>`
        select
          to_regclass('public.owner_locations')::text as "ownerLocations",
          to_regclass('public.sales_line_approvals')::text as approvals,
          (select max(created_at)::text from drizzle.__drizzle_migrations) as "latestMigrationAt",
          exists(
            select 1 from drizzle.__drizzle_migrations where created_at = ${migrationTimestamp}
          ) as "migrationRecorded"
      `;

      if (state.migrationRecorded) {
        console.log("Migration 0047 is already recorded; no repair is needed.");
        return;
      }

      assert(state.ownerLocations === "owner_locations", "owner_locations must already exist for this repair.");
      assert(state.approvals === null, "Migration 0048 appears partially applied; aborting for manual review.");
      assert(
        Number(state.latestMigrationAt) === previousMigrationTimestamp,
        `Expected migration ledger to stop at 0046 (${previousMigrationTimestamp}), found ${state.latestMigrationAt ?? "none"}.`,
      );

      await tx`
        update owner_locations
        set created_at = coalesce(created_at, now()),
            updated_at = coalesce(updated_at, now())
        where created_at is null or updated_at is null
      `;
      await tx`alter table owner_locations alter column created_at set not null`;
      await tx`alter table owner_locations alter column updated_at set not null`;
      await tx`alter table purchase_orders alter column payment_term set default 'cash'`;
      await tx`alter table sales_orders alter column payment_term set default 'cash'`;
      await tx`alter table expenses add column if not exists created_by uuid`;

      await tx.unsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'owner_locations'::regclass AND conname = 'owner_locations_pkey'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'owner_locations'::regclass
              AND conname = 'owner_locations_owner_id_location_id_pk'
          ) THEN
            ALTER TABLE owner_locations RENAME CONSTRAINT owner_locations_pkey
              TO owner_locations_owner_id_location_id_pk;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'owner_locations'::regclass AND conname = 'owner_locations_owner_id_fkey'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'owner_locations'::regclass
              AND conname = 'owner_locations_owner_id_owners_id_fk'
          ) THEN
            ALTER TABLE owner_locations RENAME CONSTRAINT owner_locations_owner_id_fkey
              TO owner_locations_owner_id_owners_id_fk;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'owner_locations'::regclass AND conname = 'owner_locations_location_id_fkey'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'owner_locations'::regclass
              AND conname = 'owner_locations_location_id_locations_id_fk'
          ) THEN
            ALTER TABLE owner_locations RENAME CONSTRAINT owner_locations_location_id_fkey
              TO owner_locations_location_id_locations_id_fk;
          END IF;

          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'expenses'::regclass AND conname = 'expenses_created_by_fkey'
          ) AND NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'expenses'::regclass
              AND conname = 'expenses_created_by_users_id_fk'
          ) THEN
            ALTER TABLE expenses RENAME CONSTRAINT expenses_created_by_fkey
              TO expenses_created_by_users_id_fk;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'expenses'::regclass
              AND conname = 'expenses_created_by_users_id_fk'
          ) THEN
            ALTER TABLE expenses ADD CONSTRAINT expenses_created_by_users_id_fk
              FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $$;
      `);

      await tx`create index if not exists owner_locations_owner_idx on owner_locations(owner_id)`;
      await tx`create index if not exists owner_locations_location_idx on owner_locations(location_id)`;

      await tx`
        insert into drizzle.__drizzle_migrations (hash, created_at)
        values (${migrationHash}, ${migrationTimestamp})
      `;
    });

    console.log("Migration 0047 reconciliation completed successfully.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
