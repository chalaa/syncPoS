import "dotenv/config";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const url = new URL(databaseUrl);
const client = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});
const db = drizzle(client);

async function main() {
  console.log(`Migrating database ${url.pathname.replace(/^\//, "")} on ${url.hostname}...`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
