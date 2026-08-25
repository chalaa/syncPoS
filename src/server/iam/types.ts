export type IamUserRow = {
  id: string;
  username: string;
  email: string | null;
  employeeId: string | null;
  employeeName: string | null;
  status: string;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  roleNames: string;
  roleIds: string[];
};

export type IamRoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isEditable: boolean;
  isDeletable: boolean;
  isActive: boolean;
  userCount: number;
  permissionCount: number;
  permissionIds: string[];
};

export type IamPermissionRow = {
  id: string;
  code: string;
  description: string | null;
  application: string | null;
  feature: string | null;
  action: string | null;
  isActive: boolean;
};

export type IamOption = {
  id: string;
  label: string;
};

export type IamManagementData = {
  users: IamUserRow[];
  roles: IamRoleRow[];
  permissions: IamPermissionRow[];
  employeeOptions: IamOption[];
};
