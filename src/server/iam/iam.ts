import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  employees,
} from "@/server/db/schema";
import type { IamManagementData, IamOption, IamPermissionRow, IamRoleRow, IamUserRow } from "@/server/iam/types";

export async function getIamUserList(): Promise<IamUserRow[]> {
  const company = await getDefaultCompany();

  return db.execute<IamUserRow>(sql`
    select
      u.id as "id",
      u.username as "username",
      u.email as "email",
      u.employee_id as "employeeId",
      e.full_name as "employeeName",
      u.status::text as "status",
      u.email_verified as "emailVerified",
      u.failed_login_attempts as "failedLoginAttempts",
      u.locked_until as "lockedUntil",
      u.last_login_at as "lastLoginAt",
      coalesce(string_agg(distinct r.name, ', ' order by r.name), '-') as "roleNames",
      coalesce(array_agg(distinct r.id) filter (where r.id is not null), '{}') as "roleIds"
    from users u
    left join employees e on e.id = u.employee_id
    left join user_roles ur on ur.user_id = u.id
      and (ur.valid_from is null or ur.valid_from <= now())
      and (ur.valid_to is null or ur.valid_to > now())
    left join roles r on r.id = ur.role_id and r.deleted_at is null
    where u.company_id = ${company.id}
      and u.deleted_at is null
    group by u.id, e.id
    order by u.username asc
  `);
}

export async function getIamRoleList(): Promise<IamRoleRow[]> {
  const company = await getDefaultCompany();

  return db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      isEditable: roles.isEditable,
      isDeletable: roles.isDeletable,
      isActive: roles.isActive,
      userCount: sql<number>`count(distinct ${userRoles.userId})::int`,
      permissionCount: sql<number>`count(distinct ${rolePermissions.permissionId})::int`,
      permissionIds: sql<string[]>`coalesce(array_agg(distinct ${rolePermissions.permissionId}) filter (where ${rolePermissions.permissionId} is not null), '{}')`,
    })
    .from(roles)
    .leftJoin(userRoles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(and(eq(roles.companyId, company.id), isNull(roles.deletedAt)))
    .groupBy(roles.id)
    .orderBy(asc(roles.name));
}

export async function getIamEmployeeOptions(): Promise<IamOption[]> {
  const company = await getDefaultCompany();

  return db
    .select({
      id: employees.id,
      label: sql<string>`${employees.fullName} || coalesce(' / ' || ${employees.employeeNo}, '')`,
    })
    .from(employees)
    .where(and(eq(employees.companyId, company.id), isNull(employees.deletedAt), eq(employees.status, "active")))
    .orderBy(asc(employees.fullName));
}

export async function getIamManagementData(): Promise<IamManagementData> {
  const [users, roles, permissions, employeeOptions] = await Promise.all([
    getIamUserList(),
    getIamRoleList(),
    getIamPermissionList(),
    getIamEmployeeOptions(),
  ]);

  return { users, roles, permissions, employeeOptions };
}

export async function getIamPermissionList(): Promise<IamPermissionRow[]> {
  return db
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
    .where(isNull(permissions.deletedAt))
    .orderBy(asc(permissions.application), asc(permissions.feature), asc(permissions.action), asc(permissions.code));
}
