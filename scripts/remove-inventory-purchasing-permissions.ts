import postgres from "postgres";
import "dotenv/config";

async function removePurchasingFromInventoryManager() {
  const sql = postgres(process.env.DATABASE_URL!);
  const [comp] = await sql`SELECT id FROM companies WHERE deleted_at IS NULL LIMIT 1`;

  const permsToRemove = [
    'purchasing:orders:view',
    'purchasing:orders:create',
    'purchasing:receipts:manage'
  ];

  const [role] = await sql`SELECT id FROM roles WHERE company_id = ${comp.id} AND code = 'inventory_manager' AND deleted_at IS NULL`;

  if (role) {
    for (const permCode of permsToRemove) {
      const [perm] = await sql`SELECT id FROM permissions WHERE code = ${permCode} AND deleted_at IS NULL`;
      if (perm) {
        await sql`
          DELETE FROM role_permissions
          WHERE role_id = ${role.id} AND permission_id = ${perm.id}
        `;
        console.log(`Removed ${permCode} from inventory_manager`);
      }
    }
  }

  await sql.end();
}

removePurchasingFromInventoryManager();
