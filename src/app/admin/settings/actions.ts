"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requirePermission } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { uniqueViolationMessage } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  authSessions,
  employees,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@/server/db/schema";

const userStatusSchema = z.enum(["active", "disabled", "locked"]);

const userSchema = z.object({
  id: z.string().uuid().optional(),
  username: z.string().trim().min(3).max(80),
  email: z.string().trim().email().optional().or(z.literal("")),
  employeeId: z.string().uuid().optional().or(z.literal("")),
  password: z.string().min(8).max(160).optional().or(z.literal("")),
  status: userStatusSchema,
  emailVerified: z.boolean(),
  roleIds: z.array(z.string().uuid()),
  returnPath: z.string().trim().startsWith("/admin/settings").default("/admin/settings"),
});

const roleSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase().replace(/\s+/g, "_")),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
  permissionIds: z.array(z.string().uuid()),
  returnPath: z.string().trim().startsWith("/admin/settings").default("/admin/settings?view=roles"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function csvIds(formData: FormData, key: string) {
  return formValue(formData, key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  const separator = path.includes("?") ? "&" : "?";

  redirect(`${path}${separator}${key}=${encodeURIComponent(message)}`);
}

function normalizeEmail(email: string | undefined) {
  return email ? email.toLowerCase() : null;
}

function userPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    username: formValue(formData, "username"),
    email: formValue(formData, "email"),
    employeeId: formValue(formData, "employeeId"),
    password: formValue(formData, "password"),
    status: formValue(formData, "status") || "active",
    emailVerified: checkboxValue(formData, "emailVerified"),
    roleIds: csvIds(formData, "roleIds"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings",
  };
}

function rolePayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: formValue(formData, "code"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    isActive: checkboxValue(formData, "isActive"),
    permissionIds: csvIds(formData, "permissionIds"),
    returnPath: formValue(formData, "returnPath") || "/admin/settings?view=roles",
  };
}

async function assertEmployeeBelongsToCompany(employeeId: string | undefined, companyId: string) {
  if (!employeeId) {
    return;
  }

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw new Error("Select a valid active employee.");
  }
}

async function activeRoleIdsForCompany(roleIds: string[], companyId: string) {
  if (roleIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(
      and(
        inArray(roles.id, roleIds),
        eq(roles.companyId, companyId),
        eq(roles.isActive, true),
        isNull(roles.deletedAt),
      ),
    );

  return rows.map((row) => row.id);
}

async function activePermissionIds(permissionIds: string[]) {
  if (permissionIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(and(inArray(permissions.id, permissionIds), eq(permissions.isActive, true), isNull(permissions.deletedAt)));

  return rows.map((row) => row.id);
}

export async function createUser(formData: FormData) {
  const currentUser = await requirePermission("iam:users:manage");
  const parsed = userSchema.safeParse(userPayload(formData));

  if (!parsed.success || !parsed.data.password) {
    redirectWithMessage("/admin/settings", "error", parsed.error?.issues[0]?.message ?? "Password is required for a new user.");
  }

  const password = parsed.data.password;

  try {
    await assertEmployeeBelongsToCompany(parsed.data.employeeId || undefined, currentUser.companyId);
    const validRoleIds = await activeRoleIdsForCompany(parsed.data.roleIds, currentUser.companyId);

    if (validRoleIds.length !== parsed.data.roleIds.length) {
      throw new Error("One or more selected roles are inactive or invalid.");
    }

    await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          companyId: currentUser.companyId,
          username: parsed.data.username,
          email: parsed.data.email || null,
          normalizedEmail: normalizeEmail(parsed.data.email || undefined),
          employeeId: parsed.data.employeeId || null,
          passwordHash: hashPassword(password),
          emailVerified: parsed.data.emailVerified,
          status: parsed.data.status,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        })
        .returning({ id: users.id });

      if (validRoleIds.length > 0) {
        await tx.insert(userRoles).values(
          validRoleIds.map((roleId) => ({
            userId: createdUser.id,
            roleId,
            assignedBy: currentUser.id,
          })),
        );
      }
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not create user."));
  }

  revalidatePath("/admin/settings");
  redirectWithMessage(parsed.data.returnPath, "notice", "User created");
}

export async function updateUser(formData: FormData) {
  const currentUser = await requirePermission("iam:users:manage");
  const parsed = userSchema.safeParse(userPayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/settings", "error", parsed.error?.issues[0]?.message ?? "User ID, username, and status are required.");
  }

  const userId = parsed.data.id;

  try {
    await assertEmployeeBelongsToCompany(parsed.data.employeeId || undefined, currentUser.companyId);
    const validRoleIds = await activeRoleIdsForCompany(parsed.data.roleIds, currentUser.companyId);

    if (validRoleIds.length !== parsed.data.roleIds.length) {
      throw new Error("One or more selected roles are inactive or invalid.");
    }

    await db.transaction(async (tx) => {
      const updateValues: Partial<typeof users.$inferInsert> = {
        username: parsed.data.username,
        email: parsed.data.email || null,
        normalizedEmail: normalizeEmail(parsed.data.email || undefined),
        employeeId: parsed.data.employeeId || null,
        emailVerified: parsed.data.emailVerified,
        status: parsed.data.status,
        lockedUntil: parsed.data.status === "locked" ? sql`coalesce(${users.lockedUntil}, now() + interval '15 minutes')` as never : null,
        updatedAt: new Date(),
      };

      if (parsed.data.password) {
        updateValues.passwordHash = hashPassword(parsed.data.password);
        updateValues.passwordChangedAt = new Date();
        updateValues.failedLoginAttempts = 0;
        updateValues.lockedUntil = null;
      }

      await tx
        .update(users)
        .set(updateValues)
        .where(and(eq(users.id, userId), eq(users.companyId, currentUser.companyId), isNull(users.deletedAt)));

      await tx.delete(userRoles).where(eq(userRoles.userId, userId));

      if (validRoleIds.length > 0) {
        await tx.insert(userRoles).values(
          validRoleIds.map((roleId) => ({
            userId,
            roleId,
            assignedBy: currentUser.id,
          })),
        );
      }

      if (parsed.data.status !== "active" || parsed.data.password) {
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
      }
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not update user."));
  }

  revalidatePath("/admin/settings");
  redirectWithMessage(parsed.data.returnPath, "notice", "User updated");
}

export async function unlockUser(formData: FormData) {
  const currentUser = await requirePermission("iam:users:manage");
  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings";

  if (!id) {
    redirectWithMessage(returnPath, "error", "User ID is missing.");
  }

  await db
    .update(users)
    .set({ status: "active", failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.companyId, currentUser.companyId), isNull(users.deletedAt)));

  revalidatePath("/admin/settings");
  redirectWithMessage(returnPath, "notice", "User unlocked");
}

export async function disableUser(formData: FormData) {
  const currentUser = await requirePermission("iam:users:manage");
  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings";

  if (!id) {
    redirectWithMessage(returnPath, "error", "User ID is missing.");
  }

  if (id === currentUser.id) {
    redirectWithMessage(returnPath, "error", "You cannot disable your own user.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.companyId, currentUser.companyId), isNull(users.deletedAt)));

    await tx
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(authSessions.userId, id), isNull(authSessions.revokedAt)));
  });

  revalidatePath("/admin/settings");
  redirectWithMessage(returnPath, "notice", "User disabled");
}

export async function createRole(formData: FormData) {
  const currentUser = await requirePermission("iam:roles:manage");
  const parsed = roleSchema.safeParse(rolePayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/settings?view=roles", "error", parsed.error.issues[0]?.message ?? "Invalid role.");
  }

  try {
    const validPermissionIds = await activePermissionIds(parsed.data.permissionIds);

    if (validPermissionIds.length !== parsed.data.permissionIds.length) {
      throw new Error("One or more selected permissions are inactive or invalid.");
    }

    await db.transaction(async (tx) => {
      const [createdRole] = await tx
        .insert(roles)
        .values({
          companyId: currentUser.companyId,
          code: parsed.data.code,
          name: parsed.data.name,
          description: parsed.data.description || null,
          isSystem: false,
          isEditable: true,
          isDeletable: true,
          isActive: parsed.data.isActive,
        })
        .returning({ id: roles.id });

      if (validPermissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          validPermissionIds.map((permissionId) => ({
            roleId: createdRole.id,
            permissionId,
            grantedBy: currentUser.id,
          })),
        );
      }
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not create role."));
  }

  revalidatePath("/admin/settings");
  redirectWithMessage(parsed.data.returnPath, "notice", "Role created");
}

export async function updateRole(formData: FormData) {
  const currentUser = await requirePermission("iam:roles:manage");
  const parsed = roleSchema.safeParse(rolePayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/settings?view=roles", "error", parsed.error?.issues[0]?.message ?? "Role ID, code, and name are required.");
  }

  const roleId = parsed.data.id;

  try {
    const [role] = await db
      .select({ id: roles.id, isEditable: roles.isEditable })
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.companyId, currentUser.companyId), isNull(roles.deletedAt)))
      .limit(1);

    if (!role) {
      throw new Error("Role was not found.");
    }

    if (!role.isEditable) {
      throw new Error("This protected role cannot be edited.");
    }

    const validPermissionIds = await activePermissionIds(parsed.data.permissionIds);

    if (validPermissionIds.length !== parsed.data.permissionIds.length) {
      throw new Error("One or more selected permissions are inactive or invalid.");
    }

    await db.transaction(async (tx) => {
      await tx
        .update(roles)
        .set({
          code: parsed.data.code,
          name: parsed.data.name,
          description: parsed.data.description || null,
          isActive: parsed.data.isActive,
          updatedAt: new Date(),
        })
        .where(and(eq(roles.id, roleId), eq(roles.companyId, currentUser.companyId), isNull(roles.deletedAt)));

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      if (validPermissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          validPermissionIds.map((permissionId) => ({
            roleId,
            permissionId,
            grantedBy: currentUser.id,
          })),
        );
      }
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, error instanceof Error ? error.message : "Could not update role."));
  }

  revalidatePath("/admin/settings");
  redirectWithMessage(parsed.data.returnPath, "notice", "Role updated");
}

export async function softDeleteRole(formData: FormData) {
  const currentUser = await requirePermission("iam:roles:manage");
  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/settings?view=roles";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Role ID is missing.");
  }

  const [role] = await db
    .select({ isDeletable: roles.isDeletable })
    .from(roles)
    .where(and(eq(roles.id, id), eq(roles.companyId, currentUser.companyId), isNull(roles.deletedAt)))
    .limit(1);

  if (!role?.isDeletable) {
    redirectWithMessage(returnPath, "error", "This protected role cannot be deleted.");
  }

  await db
    .update(roles)
    .set({
      isActive: false,
      deletedAt: sql`now()`,
      deleteReason: "Deleted from role management.",
      updatedAt: new Date(),
    })
    .where(and(eq(roles.id, id), eq(roles.companyId, currentUser.companyId), isNull(roles.deletedAt)));

  revalidatePath("/admin/settings");
  redirectWithMessage(returnPath, "notice", "Role deleted");
}
