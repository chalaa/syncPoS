import postgres from "postgres";
import "dotenv/config";

async function syncAllRolePermissions() {
  const sql = postgres(process.env.DATABASE_URL!);
  const [comp] = await sql`SELECT id FROM companies WHERE deleted_at IS NULL LIMIT 1`;

  const permsToAssign = [
    'expenses:expenses:view',
    'purchasing:orders:view',
    'purchasing:orders:create',
    'purchasing:receipts:manage'
  ];

  const [adminUser] = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;

  for (const permCode of permsToAssign) {
    const [perm] = await sql`SELECT id FROM permissions WHERE code = ${permCode} AND deleted_at IS NULL`;
    if (perm) {
      const [role] = await sql`SELECT id FROM roles WHERE company_id = ${comp.id} AND code = 'inventory_manager' AND deleted_at IS NULL`;
      if (role && adminUser) {
        await sql`
          INSERT INTO role_permissions (role_id, permission_id, granted_by)
          VALUES (${role.id}, ${perm.id}, ${adminUser.id})
          ON CONFLICT DO NOTHING
        `;
        console.log(`Granted ${permCode} to role inventory_manager`);
      }
    }
  }

  await sql.end();
}

syncAllRolePermissions();
