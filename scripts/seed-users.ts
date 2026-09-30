import { scryptSync, randomBytes } from "node:crypto";
import postgres from "postgres";
import "dotenv/config";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = postgres(dbUrl);

  try {
    const [company] = await sql`SELECT id FROM companies WHERE deleted_at IS NULL LIMIT 1`;
    if (!company) {
      console.error("No company found");
      process.exit(1);
    }
    console.log(`Using company ID: ${company.id}`);

    const roleRows = await sql`SELECT id, code FROM roles WHERE company_id = ${company.id} AND deleted_at IS NULL AND is_active = true`;
    const roleByCode = new Map(roleRows.map(r => [r.code, r.id]));
    console.log("Found roles:", Array.from(roleByCode.keys()));

    const usersToCreate = [
      { username: "admin", phone: "0900000000", email: "admin@syncpos.local", roleCode: "owner" },
      { username: "mesud", phone: "0911111111", email: "mesud@syncpos.local", roleCode: "owner" },
      { username: "aisha", phone: "0922222222", email: "aisha@syncpos.local", roleCode: "owner" },
      { username: "abdulkadir", phone: "0933333333", email: "abdulkadir@syncpos.local", roleCode: "owner" },
      { username: "beti", phone: "0944444444", email: "beti@syncpos.local", roleCode: "accountant" },
      { username: "yadu", phone: "0955555555", email: "yadu@syncpos.local", roleCode: "accountant" },
      { username: "mukerem", phone: "0966666666", email: "mukerem@syncpos.local", roleCode: "inventory_manager" },
    ];

    for (const u of usersToCreate) {
      const roleId = roleByCode.get(u.roleCode);
      if (!roleId) {
        console.error(`Role ${u.roleCode} not found for user ${u.username}!`);
        continue;
      }

      const password = u.username === "admin" ? "admin123" : `${u.username}123456`;
      const passwordHash = hashPassword(password);

      // Check if user already exists
      const existing = await sql`
        SELECT id FROM users WHERE company_id = ${company.id} AND (username = ${u.username} OR phone = ${u.phone}) AND deleted_at IS NULL
      `;

      let userId: string;

      if (existing.length > 0) {
        userId = existing[0].id;
        await sql`
          UPDATE users
          SET phone = ${u.phone}, normalized_phone = ${u.phone}, password_hash = ${passwordHash}, password_changed_at = now()
          WHERE id = ${userId}
        `;
        console.log(`Updated phone (${u.phone}) and password for ${u.username} (${password})`);
      } else {
        const [inserted] = await sql`
          INSERT INTO users (
            id, company_id, username, phone, normalized_phone, email, normalized_email, password_hash, email_verified, failed_login_attempts, password_changed_at, status
          ) VALUES (
            gen_random_uuid(), ${company.id}, ${u.username}, ${u.phone}, ${u.phone}, ${u.email}, ${u.email.toLowerCase()}, ${passwordHash}, true, 0, now(), 'active'
          )
          RETURNING id
        `;
        userId = inserted.id;
        console.log(`Created user ${u.username} with phone ${u.phone} and password ${password} (ID: ${userId})`);
      }

      // Assign role if not assigned
      const existingRole = await sql`
        SELECT user_id FROM user_roles WHERE user_id = ${userId} AND role_id = ${roleId}
      `;

      if (existingRole.length === 0) {
        await sql`
          INSERT INTO user_roles (user_id, role_id, assigned_by)
          VALUES (${userId}, ${roleId}, ${userId})
        `;
        console.log(`Assigned role ${u.roleCode} to ${u.username}`);
      } else {
        console.log(`User ${u.username} already has role ${u.roleCode}`);
      }
    }

    console.log("\nAll users and phone number assignments processed successfully!");
  } catch (err) {
    console.error("Error creating users:", err);
  } finally {
    await sql.end();
  }
}

main();
