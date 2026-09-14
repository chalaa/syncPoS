import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  permissions,
  rolePermissions,
  roles,
} from "@/server/db/schema";
import { PERMISSION_CATALOG, SYSTEM_ROLES } from "@/server/iam/permissions";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidFromSeed(value: string) {
  const hash = sha256(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

type PermissionSeedRow = {
  id: string;
  code: string;
  description: string;
  application: string | null;
  feature: string | null;
  action: string | null;
  isActive: boolean;
};

const permissionRows: PermissionSeedRow[] = PERMISSION_CATALOG.flatMap((item) => [
  {
    id: uuidFromSeed(`permission:${item.code}`),
    code: item.code,
    description: item.description,
    application: item.application,
    feature: item.feature,
    action: item.action,
    isActive: true,
  },
  ...item.legacyCodes.map((legacyCode) => ({
    id: uuidFromSeed(`permission:${legacyCode}`),
    code: legacyCode,
    description: `${item.description} (legacy alias)`,
    application: null as string | null,
    feature: null as string | null,
    action: null as string | null,
    isActive: true,
  })),
]);

/** Warm-process memo: seed at most once per server instance once DB matches catalog. */
let seededThisProcess = false;
let seedInFlight: Promise<void> | null = null;

export async function ensurePermissionsSeeded() {
  if (seededThisProcess) return;
  if (seedInFlight) return seedInFlight;

  seedInFlight = syncPermissionsCatalog()
    .then(() => {
      seededThisProcess = true;
    })
    .finally(() => {
      seedInFlight = null;
    });

  return seedInFlight;
}

async function syncPermissionsCatalog() {
  const company = await getDefaultCompany();

  const existingDbPermissions = await db
    .select({
      id: permissions.id,
      code: permissions.code,
      description: permissions.description,
      application: permissions.application,
      feature: permissions.feature,
      action: permissions.action,
      isActive: permissions.isActive,
    })
    .from(permissions)
    .where(isNull(permissions.deletedAt));

  const permByCode = new Map(existingDbPermissions.map((p) => [p.code, p]));
  const toInsert: PermissionSeedRow[] = [];
  const toUpdate: PermissionSeedRow[] = [];

  for (const perm of permissionRows) {
    const existing = permByCode.get(perm.code);

    if (!existing) {
      toInsert.push(perm);
      continue;
    }

    if (
      existing.description !== perm.description ||
      existing.application !== perm.application ||
      existing.feature !== perm.feature ||
      existing.action !== perm.action ||
      existing.isActive !== true
    ) {
      toUpdate.push({ ...perm, id: existing.id });
    }
  }

  if (toInsert.length > 0) {
    const inserted = await db.insert(permissions).values(toInsert).returning({
      id: permissions.id,
      code: permissions.code,
    });
    for (const row of inserted) {
      permByCode.set(row.code, {
        id: row.id,
        code: row.code,
        description: null,
        application: null,
        feature: null,
        action: null,
        isActive: true,
      });
    }
  }

  // Only write rows that actually differ from the catalog.
  await Promise.all(
    toUpdate.map((perm) =>
      db
        .update(permissions)
        .set({
          description: perm.description,
          application: perm.application,
          feature: perm.feature,
          action: perm.action,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(permissions.id, perm.id)),
    ),
  );

  const permIdByCode = new Map(
    [...permByCode.entries()].map(([code, row]) => [code, row.id]),
  );

  const existingCompanyRoles = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      isEditable: roles.isEditable,
      isDeletable: roles.isDeletable,
      isActive: roles.isActive,
    })
    .from(roles)
    .where(and(eq(roles.companyId, company.id), isNull(roles.deletedAt)));

  const roleByCode = new Map(existingCompanyRoles.map((r) => [r.code, r]));
  const activeCodes: Set<string> = new Set(SYSTEM_ROLES.map((r) => r.code));

  const orphanIds = existingCompanyRoles
    .filter((role) => role.isSystem && !activeCodes.has(role.code))
    .map((role) => role.id);

  if (orphanIds.length > 0) {
    await db
      .update(roles)
      .set({ isActive: false, isSystem: false, updatedAt: new Date() })
      .where(inArray(roles.id, orphanIds));
  }

  const systemRoleIds: string[] = [];

  for (const roleDef of SYSTEM_ROLES) {
    const existing = roleByCode.get(roleDef.code);
    let activeRoleId = existing?.id;

    if (existing) {
      const needsUpdate =
        existing.name !== roleDef.name ||
        existing.description !== roleDef.description ||
        existing.isSystem !== true ||
        existing.isActive !== true ||
        existing.isEditable !== roleDef.isEditable ||
        existing.isDeletable !== roleDef.isDeletable;

      if (needsUpdate) {
        await db
          .update(roles)
          .set({
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
            isActive: true,
            isEditable: roleDef.isEditable,
            isDeletable: roleDef.isDeletable,
            updatedAt: new Date(),
          })
          .where(eq(roles.id, existing.id));
      }
    } else {
      const roleId = uuidFromSeed(`company:${company.id}:role:${roleDef.code}`);
      const [insertedRole] = await db
        .insert(roles)
        .values({
          id: roleId,
          companyId: company.id,
          code: roleDef.code,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          isEditable: roleDef.isEditable,
          isDeletable: roleDef.isDeletable,
          isActive: true,
        })
        .returning({ id: roles.id });

      activeRoleId = insertedRole.id;
      roleByCode.set(roleDef.code, {
        id: activeRoleId,
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
        isEditable: roleDef.isEditable,
        isDeletable: roleDef.isDeletable,
        isActive: true,
      });
    }

    if (activeRoleId) systemRoleIds.push(activeRoleId);
  }

  if (systemRoleIds.length === 0) return;

  const currentAssignments = await db
    .select({
      roleId: rolePermissions.roleId,
      permissionId: rolePermissions.permissionId,
    })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, systemRoleIds));

  const assignmentsByRole = new Map<string, Set<string>>();
  for (const row of currentAssignments) {
    let set = assignmentsByRole.get(row.roleId);
    if (!set) {
      set = new Set();
      assignmentsByRole.set(row.roleId, set);
    }
    set.add(row.permissionId);
  }

  const toDelete: { roleId: string; permissionId: string }[] = [];
  const toAdd: { roleId: string; permissionId: string }[] = [];

  for (const roleDef of SYSTEM_ROLES) {
    const role = roleByCode.get(roleDef.code);
    if (!role) continue;

    const desiredPermIds = new Set<string>();
    for (const code of roleDef.permissionCodes) {
      const pId = permIdByCode.get(code);
      if (pId) desiredPermIds.add(pId);
    }

    const currentPermIds = assignmentsByRole.get(role.id) ?? new Set<string>();

    for (const pId of currentPermIds) {
      if (!desiredPermIds.has(pId)) {
        toDelete.push({ roleId: role.id, permissionId: pId });
      }
    }

    for (const pId of desiredPermIds) {
      if (!currentPermIds.has(pId)) {
        toAdd.push({ roleId: role.id, permissionId: pId });
      }
    }
  }

  if (toDelete.length > 0) {
    await Promise.all(
      toDelete.map((row) =>
        db
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, row.roleId),
              eq(rolePermissions.permissionId, row.permissionId),
            ),
          ),
      ),
    );
  }

  if (toAdd.length > 0) {
    await db.insert(rolePermissions).values(toAdd);
  }
}
