"use client";

import { EditIcon, KeyRoundIcon, PlusIcon, ShieldIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  createRole,
  createUser,
  disableUser,
  softDeleteRole,
  unlockUser,
  updateRole,
  updateUser,
} from "@/app/admin/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ManyToManyTags, type ManyToManyTagOption } from "@/components/ui/many-to-many-tags";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { IamManagementData, IamRoleRow, IamUserRow } from "@/server/iam/types";

type UserMutation = (formData: FormData) => Promise<void>;
type RoleMutation = (formData: FormData) => Promise<void>;
type SettingsView = "users" | "roles" | "permissions";

type IamManagerProps = IamManagementData & {
  view: SettingsView;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewRoles: boolean;
  canManageRoles: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
};

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus:border-primary";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus:border-primary";

function UserForm({
  title,
  action,
  user,
  roles,
  employeeOptions,
  returnPath,
}: {
  title: string;
  action: UserMutation;
  user?: IamUserRow;
  roles: ManyToManyTagOption[];
  employeeOptions: ManyToManyTagOption[];
  returnPath: string;
}) {
  const { t } = useTranslation();
  const [roleIds, setRoleIds] = useState(user?.roleIds ?? []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t("iam.userModalDesc", "Assign login access and business roles.")}</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {user ? <input type="hidden" name="id" value={user.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("field.username", "Username")}
          <input name="username" required defaultValue={user?.username} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("Phone Number", "Phone Number")}
          <input name="phone" type="tel" placeholder="e.g. 0911223344" defaultValue={user?.phone ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("field.email", "Email")}
          <input name="email" type="email" defaultValue={user?.email ?? ""} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("Employee", "Employee")}
          <select name="employeeId" defaultValue={user?.employeeId ?? ""} className={inputClass}>
            <option value="">{t("iam.noEmployee", "No employee")}</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("field.status")}
          <select name="status" defaultValue={user?.status ?? "active"} className={inputClass}>
            <option value="active">{t("status.active")}</option>
            <option value="disabled">{t("status.disabled")}</option>
            <option value="locked">{t("status.locked")}</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.password", "Password")}
        <input
          name="password"
          type="password"
          required={!user}
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("iam.roles", "Roles")}
        <ManyToManyTags
          name="roleIds"
          options={roles}
          value={roleIds}
          onChange={setRoleIds}
          placeholder={t("iam.selectRole", "Select role")}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="emailVerified"
          defaultChecked={user?.emailVerified ?? false}
          className="size-4 rounded border-input"
        />
        {t("iam.emailVerified", "Email verified")}
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("action.cancel")}
          </Button>
        </DialogClose>
        <Button>{user ? t("Save changes") : t("iam.createUser", "Create user")}</Button>
      </DialogFooter>
    </form>
  );
}

function UserDialog({
  label,
  action,
  user,
  roles,
  employeeOptions,
  returnPath,
  children,
}: {
  label: string;
  action: UserMutation;
  user?: IamUserRow;
  roles: ManyToManyTagOption[];
  employeeOptions: ManyToManyTagOption[];
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <UserForm
          title={label}
          action={action}
          user={user}
          roles={roles}
          employeeOptions={employeeOptions}
          returnPath={returnPath}
        />
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({
  title,
  action,
  role,
  permissions,
  returnPath,
}: {
  title: string;
  action: RoleMutation;
  role?: IamRoleRow;
  permissions: ManyToManyTagOption[];
  returnPath: string;
}) {
  const { t } = useTranslation();
  const [permissionIds, setPermissionIds] = useState(role?.permissionIds ?? []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t("iam.roleModalDesc", "Configure access rules for a group of users.")}</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {role ? <input type="hidden" name="id" value={role.id} /> : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.name", "Name")}
        <input name="name" required defaultValue={role?.name} className={inputClass} />
      </label>
      {role ? <input type="hidden" name="code" value={role.code} /> : null}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("field.description", "Description")}
        <textarea name="description" defaultValue={role?.description ?? ""} className={textareaClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("Permissions", "Permissions")}
        <ManyToManyTags
          name="permissionIds"
          options={permissions}
          value={permissionIds}
          onChange={setPermissionIds}
          placeholder={t("iam.selectPermission", "Select permission")}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={role?.isActive ?? true}
          className="size-4 rounded border-input"
        />
        {t("field.active", "Active")}
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("action.cancel")}
          </Button>
        </DialogClose>
        <Button>{role ? t("Save changes") : t("iam.createRole", "Create role")}</Button>
      </DialogFooter>
    </form>
  );
}

function RoleDialog({
  label,
  action,
  role,
  permissions,
  returnPath,
  children,
}: {
  label: string;
  action: RoleMutation;
  role?: IamRoleRow;
  permissions: ManyToManyTagOption[];
  returnPath: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <RoleForm
          title={label}
          action={action}
          role={role}
          permissions={permissions}
          returnPath={returnPath}
        />
      </DialogContent>
    </Dialog>
  );
}

export function IamManager({
  users,
  roles,
  permissions,
  employeeOptions,
  view,
  canManageUsers,
  canManageRoles,
  notice,
  error,
  returnPath,
}: IamManagerProps) {
  const { t } = useTranslation();
  const activeRoles = roles
    .filter((role) => role.isActive)
    .map((role) => ({ id: role.id, label: role.name }));
  const activePermissions = permissions
    .filter((permission) => permission.isActive)
    .map((permission) => ({
      id: permission.id,
      label: permission.application && permission.feature && permission.action
        ? `${permission.application}:${permission.feature}:${permission.action}`
        : permission.code,
    }));

  if (view === "roles") {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Settings"
          title="Roles"
          actions={
            canManageRoles ? (
              <RoleDialog
                label={t("iam.newRole", "New role")}
                action={createRole}
                permissions={activePermissions}
                returnPath={returnPath}
              >
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  {t("iam.newRole", "New role")}
                </Button>
              </RoleDialog>
            ) : null
          }
        />

        {notice ? <Alert kind="success">{notice}</Alert> : null}
        {error ? <Alert kind="error">{error}</Alert> : null}

        <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">{t("Role", "Role")}</th>
                <th className="px-4 py-3">{t("iam.flags", "Flags")}</th>
                <th className="px-4 py-3 text-right">{t("Users", "Users")}</th>
                <th className="px-4 py-3 text-right">{t("Permissions", "Permissions")}</th>
                <th className="px-4 py-3">{t("field.status")}</th>
                <th className="px-4 py-3 text-right">{t("action.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{role.name}</div>
                    <div className="text-xs text-muted-foreground">{role.code} / {role.description ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={role.isSystem ? "dark" : "outline"} className="text-[10px]">
                        {role.isSystem ? t("iam.system", "System") : t("iam.custom", "Custom")}
                      </Badge>
                      <Badge variant={role.isEditable ? "secondary" : "muted"} className="text-[10px]">
                        {role.isEditable ? t("iam.editable", "Editable") : t("status.locked")}
                      </Badge>
                      {role.isDeletable ? null : (
                        <Badge variant="destructive" className="text-[10px]">
                          {t("iam.protected", "Protected")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{role.userCount}</td>
                  <td className="px-4 py-3 text-right font-medium">{role.permissionCount}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={role.isActive ? "active" : "inactive"} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canManageRoles ? (
                        <>
                          <RoleDialog
                            label={`${t("action.edit", "Edit")} ${role.name}`}
                            action={updateRole}
                            role={role}
                            permissions={activePermissions}
                            returnPath={returnPath}
                          >
                            <Button type="button" variant="outline" size="icon" disabled={!role.isEditable}>
                              <EditIcon />
                              <span className="sr-only">{t("iam.editRole", "Edit role")}</span>
                            </Button>
                          </RoleDialog>
                          <DeleteConfirmationDialog
                            action={softDeleteRole}
                            hiddenInputs={{ id: role.id, returnPath }}
                            itemName={role.name}
                          >
                            <Button variant="danger" size="icon" disabled={!role.isDeletable}>
                              <Trash2Icon />
                              <span className="sr-only">{t("iam.deleteRole", "Delete role")}</span>
                            </Button>
                          </DeleteConfirmationDialog>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("iam.viewOnly", "View only")}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </PageShell>
    );
  }

  if (view === "permissions") {
    return (
      <PageShell>
        <PageHeader eyebrow="Settings" title="Permissions" />

        {notice ? <Alert kind="success">{notice}</Alert> : null}
        {error ? <Alert kind="error">{error}</Alert> : null}

        <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">{t("Permission", "Permission")}</th>
                <th className="px-4 py-3">{t("iam.application", "Application")}</th>
                <th className="px-4 py-3">{t("iam.feature", "Feature")}</th>
                <th className="px-4 py-3">{t("field.action", "Action")}</th>
                <th className="px-4 py-3">{t("field.status")}</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{permission.code}</div>
                    <div className="text-xs text-muted-foreground">{permission.description ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize text-[11px]">
                      {permission.application ?? "-"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{permission.feature ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{permission.action ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={permission.isActive ? "active" : "inactive"} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="Users"
        actions={
          canManageUsers ? (
            <UserDialog
              label={t("iam.newUser", "New user")}
              action={createUser}
              roles={activeRoles}
              employeeOptions={employeeOptions}
              returnPath={returnPath}
            >
              <Button>
                <UserPlusIcon data-icon="inline-start" />
                {t("iam.newUser", "New user")}
              </Button>
            </UserDialog>
          ) : null
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">{t("User", "User")}</th>
              <th className="px-4 py-3">{t("Employee", "Employee")}</th>
              <th className="px-4 py-3">{t("iam.roles", "Roles")}</th>
              <th className="px-4 py-3">{t("iam.emailVerified", "Email verified")}</th>
              <th className="px-4 py-3">{t("iam.failedLogins", "Failed Logins")}</th>
              <th className="px-4 py-3">{t("iam.lockedUntil", "Locked Until")}</th>
              <th className="px-4 py-3">{t("iam.lastLogin", "Last Login")}</th>
              <th className="px-4 py-3">{t("field.status")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{user.username}</div>
                  <div className="text-xs font-mono text-primary">{user.phone ? user.phone : (user.email ?? "-")}</div>
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{user.employeeName ?? "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roleNames
                      ? user.roleNames.split(", ").map((role) => (
                          <Badge key={role} variant="secondary" className="text-[11px]">
                            {role}
                          </Badge>
                        ))
                      : "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.emailVerified ? "success" : "muted"} className="text-[11px]">
                    {user.emailVerified ? t("status.verified") : t("iam.unverified", "Unverified")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.failedLoginAttempts}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{user.lockedUntil?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{user.lastLoginAt?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.status} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canManageUsers ? (
                      <>
                        <UserDialog
                          label={`${t("action.edit", "Edit")} ${user.username}`}
                          action={updateUser}
                          user={user}
                          roles={activeRoles}
                          employeeOptions={employeeOptions}
                          returnPath={returnPath}
                        >
                          <Button type="button" variant="outline" size="icon">
                            <EditIcon />
                            <span className="sr-only">{t("iam.editUser", "Edit user")}</span>
                          </Button>
                        </UserDialog>
                        <form action={unlockUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="outline" size="icon" disabled={user.status === "active" && !user.lockedUntil}>
                            <KeyRoundIcon />
                            <span className="sr-only">{t("iam.unlockUser", "Unlock user")}</span>
                          </Button>
                        </form>
                        <form action={disableUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="danger" size="icon" disabled={user.status === "disabled"}>
                            <ShieldIcon />
                            <span className="sr-only">{t("iam.disableUser", "Disable user")}</span>
                          </Button>
                        </form>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("iam.viewOnly", "View only")}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
