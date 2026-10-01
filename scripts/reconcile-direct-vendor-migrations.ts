import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

type MigrationRepair = {
  tag: string;
  timestamp: number;
  path: string;
  checkSql: string;
};

const migrations: MigrationRepair[] = [
  {
    tag: "0051_striped_colleen_wing",
    timestamp: 1790843049241,
    path: "drizzle/0051_striped_colleen_wing.sql",
    checkSql: `
      select
        to_regtype('public.direct_vendor_sale_status') is not null
        and to_regclass('public.direct_vendor_sales') is not null
        and to_regclass('public.direct_vendor_sale_lines') is not null
        as ready
    `,
  },
  {
    tag: "0052_military_secret_warriors",
    timestamp: 1790846374746,
    path: "drizzle/0052_military_secret_warriors.sql",
    checkSql: `
      select count(*) = 2 as ready
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'direct_vendor_sales'
        and column_name in ('customer_payment_term', 'vendor_payment_term')
    `,
  },
  {
    tag: "0053_goofy_pete_wisdom",
    timestamp: 1790852986624,
    path: "drizzle/0053_goofy_pete_wisdom.sql",
    checkSql: `
      select count(*) = 2 as ready
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'payment_allocations'
        and column_name in ('customer_direct_vendor_sale_id', 'vendor_direct_vendor_sale_id')
    `,
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function migrationHash(path: string) {
  const migrationSql = await readFile(path, "utf8");
  return createHash("sha256").update(migrationSql).digest("hex");
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required.");

  const url = new URL(databaseUrl);
  const client = postgres(databaseUrl, { max: 1, prepare: false });

  console.log(`Reconciling direct vendor migrations on ${url.pathname.slice(1)} at ${url.hostname}...`);

  try {
    await client.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('syncpos-direct-vendor-migration-repair'))`;

      for (const migration of migrations) {
        const [{ recorded }] = await tx<{ recorded: boolean }[]>`
          select exists(
            select 1
            from drizzle.__drizzle_migrations
            where created_at = ${migration.timestamp}
          ) as recorded
        `;

        if (recorded) {
          console.log(`${migration.tag} is already recorded.`);
          continue;
        }

        const [{ ready }] = await tx.unsafe<{ ready: boolean }[]>(migration.checkSql);
        assert(
          ready,
          `${migration.tag} is not recorded, but its schema objects are not fully present. Run pnpm db:migrate and inspect the first failing statement.`,
        );

        await tx`
          insert into drizzle.__drizzle_migrations (hash, created_at)
          select ${await migrationHash(migration.path)}, ${migration.timestamp}
          where not exists (
            select 1
            from drizzle.__drizzle_migrations
            where created_at = ${migration.timestamp}
          )
        `;
        console.log(`${migration.tag} recorded in the migration ledger.`);
      }
    });

    console.log("Direct vendor migration reconciliation completed successfully.");
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
