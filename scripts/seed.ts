import "dotenv/config";

import { createHash, scryptSync } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";

import {
  auditLogs,
  companies,
  currencies,
  devices,
  employees,
  locations,
  owners,
  permissions,
  rolePermissions,
  roles,
  userLocationAccess,
  userRoles,
  users,
} from "@/server/db/schema";
import { PERMISSION_CATALOG, SYSTEM_ROLES } from "@/server/iam/permissions";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const ids = {
  company: "11111111-1111-4111-8111-111111111111",
  adminEmployee: "22222222-2222-4222-8222-222222222222",
  adminUser: "33333333-3333-4333-8333-333333333333",
  defaultOwner: "10101010-1010-4101-8101-101010101010",
  ownerRole: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  adminRole: "44444444-4444-4444-8444-444444444444",
  salespersonRole: "55555555-5555-4555-8555-555555555555",
  inventoryManagerRole: "66666666-6666-4666-8666-666666666666",
  warehouse: "77777777-7777-4777-8777-777777777777",
  displayShop: "88888888-8888-4888-8888-888888888888",
  adjustmentLocation: "12121212-1212-4121-8121-121212121212",
  scrapLocation: "34343434-3434-4343-8343-343434343434",
  vendorLocation: "abababab-abab-4bab-8bab-abababababab",
  customerLocation: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
  offlineDevice: "99999999-9999-4999-8999-999999999999",
  seedAudit: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function hashPassword(password: string) {
  const salt = "syncpos-dev-seed";
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidFromSeed(value: string) {
  const hash = sha256(value);

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const permissionRows = PERMISSION_CATALOG.flatMap((item) => [
  item,
  ...item.legacyCodes.map((legacyCode) => ({
    ...item,
    code: legacyCode,
    description: `${item.description} (legacy alias)`,
  })),
]).map((item) => ({
  id: uuidFromSeed(`permission:${item.code}`),
  ...item,
}));

const roleIdsByCode: Record<string, string> = {
  owner: ids.ownerRole,
  admin: ids.adminRole,
  salesperson: ids.salespersonRole,
  inventory_manager: ids.inventoryManagerRole,
  ...Object.fromEntries(
    SYSTEM_ROLES.map((role) => [role.code, uuidFromSeed(`seed:role:${role.code}`)])
  ),
};

const rolePermissionCodes: Record<string, readonly string[]> = Object.fromEntries(
  SYSTEM_ROLES.map((role) => [role.code, role.permissionCodes])
);

async function main() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(currencies)
        .values({
          code: "ETB",
          name: "Ethiopian Birr",
          minorUnit: 2,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: currencies.code,
          set: {
            name: "Ethiopian Birr",
            minorUnit: 2,
            isActive: true,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(companies)
        .values({
          id: ids.company,
          code: "SYNC",
          legalName: "syncPoS Demo Company",
          tradeName: "syncPoS",
          baseCurrencyCode: "ETB",
          timezone: "Africa/Addis_Ababa",
          fiscalYearStartMonth: 1,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: companies.id,
          set: {
            code: "SYNC",
            legalName: "syncPoS Demo Company",
            tradeName: "syncPoS",
            baseCurrencyCode: "ETB",
            timezone: "Africa/Addis_Ababa",
            fiscalYearStartMonth: 1,
            isActive: true,
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(employees)
        .values({
          id: ids.adminEmployee,
          companyId: ids.company,
          employeeNo: "EMP-ADMIN",
          fullName: "System Administrator",
          email: "admin@syncpos.local",
          status: "active",
        })
        .onConflictDoUpdate({
          target: employees.id,
          set: {
            employeeNo: "EMP-ADMIN",
            fullName: "System Administrator",
            email: "admin@syncpos.local",
            status: "active",
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(users)
        .values({
          id: ids.adminUser,
          companyId: ids.company,
          employeeId: ids.adminEmployee,
          username: "admin",
          email: "admin@syncpos.local",
          normalizedEmail: "admin@syncpos.local",
          passwordHash: hashPassword("admin123"),
          emailVerified: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
          status: "active",
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            username: "admin",
            email: "admin@syncpos.local",
            normalizedEmail: "admin@syncpos.local",
            passwordHash: hashPassword("admin123"),
            emailVerified: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: sql`coalesce(${users.passwordChangedAt}, now())`,
            status: "active",
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
            updatedAt: sql`now()`,
          },
        });

      // Fetch existing permissions from DB
      const existingPermissions = await tx
        .select({ id: permissions.id, code: permissions.code })
        .from(permissions);
      const permIdMap = new Map(existingPermissions.map((p) => [p.code, p.id]));

      for (const perm of permissionRows) {
        if (!permIdMap.has(perm.code)) {
          const [inserted] = await tx
            .insert(permissions)
            .values({
              id: perm.id,
              code: perm.code,
              description: perm.description,
              application: perm.application,
              feature: perm.feature,
              action: perm.action,
              isActive: true,
            })
            .returning({ id: permissions.id });
          permIdMap.set(perm.code, inserted.id);
        }
      }

      // Fetch existing roles from DB for company
      const existingRoles = await tx
        .select({ id: roles.id, code: roles.code })
        .from(roles)
        .where(eq(roles.companyId, ids.company));
      const roleIdMap = new Map(existingRoles.map((r) => [r.code, r.id]));

      for (const roleDef of SYSTEM_ROLES) {
        if (!roleIdMap.has(roleDef.code)) {
          const roleId = roleIdsByCode[roleDef.code] ?? uuidFromSeed(`seed:role:${roleDef.code}`);
          const [inserted] = await tx
            .insert(roles)
            .values({
              id: roleId,
              companyId: ids.company,
              code: roleDef.code,
              name: roleDef.name,
              description: roleDef.description,
              isSystem: true,
              isEditable: roleDef.isEditable,
              isDeletable: roleDef.isDeletable,
              isActive: true,
            })
            .returning({ id: roles.id });
          roleIdMap.set(roleDef.code, inserted.id);
        }
      }

      await tx
        .insert(owners)
        .values({
          id: ids.defaultOwner,
          companyId: ids.company,
          name: "Main Owner",
        })
        .onConflictDoNothing();

      const adminRoleId = roleIdMap.get("admin") ?? ids.adminRole;

      await tx
        .insert(userRoles)
        .values({
          userId: ids.adminUser,
          roleId: adminRoleId,
          assignedBy: ids.adminUser,
        })
        .onConflictDoNothing();

      for (const [roleCode, codes] of Object.entries(rolePermissionCodes)) {
        const rId = roleIdMap.get(roleCode);
        if (!rId) continue;

        for (const code of codes) {
          const pId = permIdMap.get(code);
          if (!pId) continue;

          await tx
            .insert(rolePermissions)
            .values({
              roleId: rId,
              permissionId: pId,
              grantedBy: ids.adminUser,
            })
            .onConflictDoNothing();
        }
      }

      await tx
        .insert(locations)
        .values([
          {
            id: ids.warehouse,
            companyId: ids.company,
            code: "WH-001",
            name: "Main Warehouse",
            locationType: "warehouse",
            offlineSalesEnabled: false,
            allowNegativeStock: false,
            isActive: true,
          },
          {
            id: ids.displayShop,
            companyId: ids.company,
            code: "SHOP-001",
            name: "Main Display Shop",
            locationType: "display_shop",
            offlineSalesEnabled: true,
            allowNegativeStock: false,
            isActive: true,
          },
          {
            id: ids.adjustmentLocation,
            companyId: ids.company,
            code: "INV-ADJ",
            name: "Inventory Adjustment",
            locationType: "adjustment",
            offlineSalesEnabled: false,
            allowNegativeStock: false,
            isActive: true,
          },
          {
            id: ids.scrapLocation,
            companyId: ids.company,
            code: "SCRAP",
            name: "Scrap Location",
            locationType: "scrap",
            offlineSalesEnabled: false,
            allowNegativeStock: false,
            isActive: true,
          },
          {
            id: ids.vendorLocation,
            companyId: ids.company,
            code: "VENDORS",
            name: "Vendor Location",
            locationType: "supplier",
            offlineSalesEnabled: false,
            allowNegativeStock: false,
            isActive: true,
          },
          {
            id: ids.customerLocation,
            companyId: ids.company,
            code: "CUSTOMERS",
            name: "Customer Location",
            locationType: "customer",
            offlineSalesEnabled: false,
            allowNegativeStock: false,
            isActive: true,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(userLocationAccess)
        .values([
          {
            userId: ids.adminUser,
            locationId: ids.warehouse,
            canView: true,
            canTransact: true,
            assignedBy: ids.adminUser,
          },
          {
            userId: ids.adminUser,
            locationId: ids.displayShop,
            canView: true,
            canTransact: true,
            assignedBy: ids.adminUser,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(devices)
        .values({
          id: ids.offlineDevice,
          locationId: ids.displayShop,
          deviceKeyHash: sha256("syncpos-main-display-shop-device-placeholder"),
          name: "Main Display Shop POS",
          platform: "browser-pwa-placeholder",
          isPrimaryOfflineDevice: true,
          status: "active",
          storagePersistent: false,
        })
        .onConflictDoUpdate({
          target: devices.id,
          set: {
            locationId: ids.displayShop,
            name: "Main Display Shop POS",
            platform: "browser-pwa-placeholder",
            isPrimaryOfflineDevice: true,
            status: "active",
            storagePersistent: false,
            deletedAt: null,
            deletedBy: null,
            deleteReason: null,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(auditLogs)
        .values({
          id: ids.seedAudit,
          companyId: ids.company,
          actorUserId: ids.adminUser,
          deviceId: ids.offlineDevice,
          locationId: ids.displayShop,
          action: "seed.foundation",
          entityType: "database_seed",
          entityId: ids.company,
          severity: "info",
          metadata: {
            seed: "foundation",
            defaultUsername: "admin",
          },
        })
        .onConflictDoNothing();
    });

    console.log("Foundation seed completed.");
    console.log("Default login placeholder: admin / admin123");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Foundation seed failed.");
  console.error(error);
  process.exit(1);
});
