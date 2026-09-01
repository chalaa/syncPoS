"use client";

import { EditIcon, KeyRoundIcon, PlusIcon, ShieldIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
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
import type { IamManagementData, IamRoleRow, IamUserRow } from "@/server/iam/types";

type UserMutation = (formData: FormData) => Promise<void>;
type RoleMutation = (formData: FormData) => Promise<void>;

type IamManagerProps = IamManagementData & {
  view: "users" | "roles" | "permissions";
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewRoles: boolean;
  canManageRoles: boolean;
  notice?: string;
  error?: string;
  returnPath: string;
};

const inputClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SettingsViewNav({
  view,
  canViewUsers,
  canViewRoles,
}: {
  view: IamManagerProps["view"];
  canViewUsers: boolean;
  canViewRoles: boolean;
}) {
  return (
    <div className="flex rounded-md border border-border bg-muted p-1 text-sm">
      {canViewUsers ? (
        <Button asChild variant={view === "users" ? "secondary" : "ghost"} size="sm">
          <Link href="/admin/settings">Users</Link>
        </Button>
      ) : null}
      {canViewRoles ? (
        <>
          <Button asChild variant={view === "roles" ? "secondary" : "ghost"} size="sm">
            <Link href="/admin/settings?view=roles">Roles</Link>
          </Button>
          <Button asChild variant={view === "permissions" ? "secondary" : "ghost"} size="sm">
            <Link href="/admin/settings?view=permissions">Permissions</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}

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
  const [roleIds, setRoleIds] = useState(user?.roleIds ?? []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Assign login access and business roles.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {user ? <input type="hidden" name="id" value={user.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Username
          <input name="username" required defaultValue={user?.username} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" defaultValue={user?.email ?? ""} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Employee
          <select name="employeeId" defaultValue={user?.employeeId ?? ""} className={inputClass}>
            <option value="">No employee</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Status
          <select name="status" defaultValue={user?.status ?? "active"} className={inputClass}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="locked">Locked</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
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
        Roles
        <ManyToManyTags
          name="roleIds"
          options={roles}
          value={roleIds}
          onChange={setRoleIds}
          placeholder="Select role"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="emailVerified"
          defaultChecked={user?.emailVerified ?? false}
          className="size-4 rounded border-input"
        />
        Email verified
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button>{user ? "Save changes" : "Create user"}</Button>
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
  const [permissionIds, setPermissionIds] = useState(role?.permissionIds ?? []);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Configure access rules for a group of users.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="returnPath" value={returnPath} />
      {role ? <input type="hidden" name="id" value={role.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[0.7fr_1fr]">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Code
          <input name="code" placeholder={role ? undefined : "Auto"} defaultValue={role?.code} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input name="name" required defaultValue={role?.name} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Description
        <textarea name="description" defaultValue={role?.description ?? ""} className={textareaClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Permissions
        <ManyToManyTags
          name="permissionIds"
          options={permissions}
          value={permissionIds}
          onChange={setPermissionIds}
          placeholder="Select permission"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={role?.isActive ?? true}
          className="size-4 rounded border-input"
        />
        Active
      </label>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button>{role ? "Save changes" : "Create role"}</Button>
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
  canViewUsers,
  canManageUsers,
  canViewRoles,
  canManageRoles,
  notice,
  error,
  returnPath,
}: IamManagerProps) {
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
            <div className="flex flex-wrap items-center gap-2">
              <SettingsViewNav view={view} canViewUsers={canViewUsers} canViewRoles={canViewRoles} />
              {canManageRoles ? (
                <RoleDialog
                  label="New role"
                  action={createRole}
                  permissions={activePermissions}
                  returnPath={returnPath}
                >
                  <Button>
                    <PlusIcon data-icon="inline-start" />
                    New role
                  </Button>
                </RoleDialog>
              ) : null}
            </div>
          }
        />

        {notice ? <Alert kind="success">{notice}</Alert> : null}
        {error ? <Alert kind="error">{error}</Alert> : null}

        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3 text-right">Users</th>
                <th className="px-4 py-3 text-right">Permissions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{role.name}</div>
                    <div className="text-xs text-muted-foreground">{role.code} / {role.description ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {role.isSystem ? "System" : "Custom"} / {role.isEditable ? "Editable" : "Locked"} / {role.isDeletable ? "Deletable" : "Protected"}
                  </td>
                  <td className="px-4 py-3 text-right">{role.userCount}</td>
                  <td className="px-4 py-3 text-right">{role.permissionCount}</td>
                  <td className="px-4 py-3">{role.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {canManageRoles ? (
                        <>
                          <RoleDialog
                            label={`Edit ${role.name}`}
                            action={updateRole}
                            role={role}
                            permissions={activePermissions}
                            returnPath={returnPath}
                          >
                            <Button type="button" variant="outline" size="icon" disabled={!role.isEditable}>
                              <EditIcon />
                              <span className="sr-only">Edit role</span>
                            </Button>
                          </RoleDialog>
                          <form action={softDeleteRole}>
                            <input type="hidden" name="id" value={role.id} />
                            <input type="hidden" name="returnPath" value={returnPath} />
                            <Button variant="danger" size="icon" disabled={!role.isDeletable}>
                              <Trash2Icon />
                              <span className="sr-only">Delete role</span>
                            </Button>
                          </form>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
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
        <PageHeader
          eyebrow="Settings"
          title="Permissions"
          actions={<SettingsViewNav view={view} canViewUsers={canViewUsers} canViewRoles={canViewRoles} />}
        />

        {notice ? <Alert kind="success">{notice}</Alert> : null}
        {error ? <Alert kind="error">{error}</Alert> : null}

        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-3">Permission</th>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{permission.code}</div>
                    <div className="text-xs text-muted-foreground">{permission.description ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">{permission.application ?? "-"}</td>
                  <td className="px-4 py-3">{permission.feature ?? "-"}</td>
                  <td className="px-4 py-3">{permission.action ?? "-"}</td>
                  <td className="px-4 py-3">{permission.isActive ? "Active" : "Inactive"}</td>
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
          <div className="flex flex-wrap items-center gap-2">
            <SettingsViewNav view={view} canViewUsers={canViewUsers} canViewRoles={canViewRoles} />
            {canManageUsers ? (
              <UserDialog
                label="New user"
                action={createUser}
                roles={activeRoles}
                employeeOptions={employeeOptions}
                returnPath={returnPath}
              >
                <Button>
                  <UserPlusIcon data-icon="inline-start" />
                  New user
                </Button>
              </UserDialog>
            ) : null}
          </div>
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Email Verified</th>
              <th className="px-4 py-3">Failed Logins</th>
              <th className="px-4 py-3">Locked Until</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="font-medium">{user.username}</div>
                  <div className="text-xs text-muted-foreground">{user.email ?? "-"}</div>
                </td>
                <td className="px-4 py-3">{user.employeeName ?? "-"}</td>
                <td className="px-4 py-3">{user.roleNames}</td>
                <td className="px-4 py-3">{user.emailVerified ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{user.failedLoginAttempts}</td>
                <td className="px-4 py-3">{user.lockedUntil?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-3">{user.lastLoginAt?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-3 capitalize">{user.status}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {canManageUsers ? (
                      <>
                        <UserDialog
                          label={`Edit ${user.username}`}
                          action={updateUser}
                          user={user}
                          roles={activeRoles}
                          employeeOptions={employeeOptions}
                          returnPath={returnPath}
                        >
                          <Button type="button" variant="outline" size="icon">
                            <EditIcon />
                            <span className="sr-only">Edit user</span>
                          </Button>
                        </UserDialog>
                        <form action={unlockUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="outline" size="icon" disabled={user.status === "active" && !user.lockedUntil}>
                            <KeyRoundIcon />
                            <span className="sr-only">Unlock user</span>
                          </Button>
                        </form>
                        <form action={disableUser}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button variant="danger" size="icon" disabled={user.status === "disabled"}>
                            <ShieldIcon />
                            <span className="sr-only">Disable user</span>
                          </Button>
                        </form>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">View only</span>
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
