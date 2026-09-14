import "dotenv/config";
import { db } from "@/server/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Ensuring owner_locations table exists...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS owner_locations (
      owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE ON UPDATE CASCADE,
      location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE ON UPDATE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (owner_id, location_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS owner_locations_owner_idx ON owner_locations(owner_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS owner_locations_location_idx ON owner_locations(location_id)`);
  console.log("owner_locations table created/verified successfully.");

  // Also seed default connections for existing owners and shops if any exist
  const ownersList = await db.execute(sql`SELECT id FROM owners WHERE deleted_at IS NULL`);
  const locationsList = await db.execute(sql`SELECT id FROM locations WHERE deleted_at IS NULL AND is_active = true`);

  const ownersArr = Array.from(ownersList) as { id: string }[];
  const locationsArr = Array.from(locationsList) as { id: string }[];

  if (ownersArr.length > 0 && locationsArr.length > 0) {
    for (const owner of ownersArr) {
      for (const loc of locationsArr) {
        await db.execute(sql`
          INSERT INTO owner_locations (owner_id, location_id, is_primary)
          VALUES (${owner.id}::uuid, ${loc.id}::uuid, true)
          ON CONFLICT (owner_id, location_id) DO NOTHING
        `);
      }
    }
    console.log("Seeded default owner_locations associations.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
