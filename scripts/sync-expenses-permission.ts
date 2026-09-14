import postgres from "postgres";
import "dotenv/config";

async function syncExpensesPermission() {
  const sql = postgres(process.env.DATABASE_URL!);
  const [comp] = await sql`SELECT id FROM companies WHERE deleted_at IS NULL LIMIT 1`;
  const permCode = 'expenses:expenses:view';
  const [perm] = await sql`SELECT id FROM permissions WHERE code = ${permCode} AND deleted_at IS NULL`;

  const rolesToAssign = ['sales', 'sales_manager', 'inventory_manager', 'accountant'];
  for (const rCode of rolesToAssign) {
    const [role] = await sql`SELECT id FROM roles WHERE company_id = ${comp.id} AND code = ${rCode} AND deleted_at IS NULL`;
    if (role && perm) {
      await sql`
        INSERT INTO role_permissions (role_id, permission_id, granted_by)
        VALUES (${role.id}, ${perm.id}, ${role.id})
        ON CONFLICT DO NOTHING
      `;
      console.log(`Granted ${permCode} to role ${rCode}`);
    }
  }
  await sql.end();
}

syncExpensesPermission();
