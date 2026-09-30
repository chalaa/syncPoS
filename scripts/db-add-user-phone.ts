import postgres from "postgres";
import "dotenv/config";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(dbUrl);

  try {
    console.log("Adding phone and normalized_phone columns to users table...");
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone varchar(40),
      ADD COLUMN IF NOT EXISTS normalized_phone varchar(40);
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_phone_active_uidx
      ON users (company_id, normalized_phone)
      WHERE normalized_phone IS NOT NULL AND deleted_at IS NULL;
    `;

    console.log("Successfully added phone and normalized_phone columns & index to users table.");
  } catch (err) {
    console.error("Error updating database schema:", err);
  } finally {
    await sql.end();
  }
}

main();
