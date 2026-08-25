export const FULL_ACCESS_PERMISSION = "all:all:all";

export const PERMISSIONS = {
  OWNER: {
    ALL: FULL_ACCESS_PERMISSION,
  },
  COMPANY: {
    MANAGE: "company:settings:manage",
  },
  USERS: {
    VIEW: "iam:users:view",
    MANAGE: "iam:users:manage",
  },
  ROLES: {
    VIEW: "iam:roles:view",
    MANAGE: "iam:roles:manage",
  },
  LOCATIONS: {
    MANAGE: "inventory:locations:manage",
  },
  PRODUCTS: {
    VIEW: "catalog:products:view",
    MANAGE: "catalog:products:manage",
  },
  PARTNERS: {
    VIEW: "partners:partners:view",
    MANAGE: "partners:partners:manage",
  },
  INVENTORY: {
    VIEW: "inventory:stock:view",
    RECEIVE: "inventory:stock:receive",
    TRANSFER_APPROVE: "inventory:transfers:approve",
  },
  SALES: {
    CREATE: "sales:orders:create",
    DISCOUNT_OVERRIDE: "sales:discounts:override",
    COST_VIEW: "sales:costs:view",
  },
  REPORTS: {
    PROFIT_VIEW: "reports:profit:view",
  },
} as const;

export type PermissionCatalogItem = {
  code: string;
  legacyCodes: string[];
  description: string;
  application: string;
  feature: string;
  action: string;
};

function parsePermissionCode(code: string) {
  const [application, feature, action] = code.split(":");

  return {
    application: application ?? "system",
    feature: feature ?? "general",
    action: action ?? "access",
  };
}

function catalogItem(code: string, description: string, legacyCodes: string[] = []): PermissionCatalogItem {
  return {
    code,
    legacyCodes,
    description,
    ...parsePermissionCode(code),
  };
}

export const PERMISSION_CATALOG = [
  catalogItem(PERMISSIONS.OWNER.ALL, "Full access to all syncPoS modules"),
  catalogItem(PERMISSIONS.COMPANY.MANAGE, "Manage company settings", ["company.manage"]),
  catalogItem(PERMISSIONS.USERS.VIEW, "View users", ["user.view"]),
  catalogItem(PERMISSIONS.USERS.MANAGE, "Manage users and access", ["user.manage"]),
  catalogItem(PERMISSIONS.ROLES.VIEW, "View roles and permissions", ["role.view"]),
  catalogItem(PERMISSIONS.ROLES.MANAGE, "Manage roles and permissions", ["role.manage"]),
  catalogItem(PERMISSIONS.LOCATIONS.MANAGE, "Manage stock locations", ["location.manage"]),
  catalogItem(PERMISSIONS.PRODUCTS.VIEW, "View products", ["product.view"]),
  catalogItem(PERMISSIONS.PRODUCTS.MANAGE, "Manage products", ["product.manage"]),
  catalogItem(PERMISSIONS.PARTNERS.VIEW, "View customers and suppliers", ["partner.view"]),
  catalogItem(PERMISSIONS.PARTNERS.MANAGE, "Manage customers and suppliers", ["partner.manage"]),
  catalogItem(PERMISSIONS.INVENTORY.VIEW, "View inventory", ["inventory.view"]),
  catalogItem(PERMISSIONS.INVENTORY.RECEIVE, "Receive and post stock", ["inventory.receive"]),
  catalogItem(PERMISSIONS.INVENTORY.TRANSFER_APPROVE, "Approve inventory transfers", ["inventory.transfer.approve"]),
  catalogItem(PERMISSIONS.SALES.CREATE, "Create sales", ["sales.create"]),
  catalogItem(PERMISSIONS.SALES.DISCOUNT_OVERRIDE, "Override sales discounts", ["sales.discount.override"]),
  catalogItem(PERMISSIONS.SALES.COST_VIEW, "View sales cost and margin", ["sales.cost.view"]),
  catalogItem(PERMISSIONS.REPORTS.PROFIT_VIEW, "View management reports", ["report.profit.view"]),
] as const satisfies PermissionCatalogItem[];

export const SYSTEM_ROLES = [
  {
    code: "owner",
    name: "Owner",
    description: "Full access to every module.",
    permissionCodes: [PERMISSIONS.OWNER.ALL],
    isEditable: false,
    isDeletable: false,
  },
  {
    code: "admin",
    name: "Admin",
    description: "System administrator.",
    permissionCodes: [PERMISSIONS.OWNER.ALL],
    isEditable: true,
    isDeletable: false,
  },
  {
    code: "salesperson",
    name: "Salesperson",
    description: "Sales and customer-facing access.",
    permissionCodes: [
      PERMISSIONS.PRODUCTS.VIEW,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.SALES.CREATE,
      PERMISSIONS.PARTNERS.VIEW,
    ],
    isEditable: true,
    isDeletable: false,
  },
  {
    code: "inventory_manager",
    name: "Inventory Manager",
    description: "Stock control, receiving, and transfer approval role.",
    permissionCodes: [
      PERMISSIONS.PRODUCTS.VIEW,
      PERMISSIONS.PRODUCTS.MANAGE,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.INVENTORY.RECEIVE,
      PERMISSIONS.INVENTORY.TRANSFER_APPROVE,
      PERMISSIONS.LOCATIONS.MANAGE,
    ],
    isEditable: true,
    isDeletable: false,
  },
] as const;

export function userHasPermission(userPermissionCodes: Iterable<string>, requiredPermissionCode: string) {
  const codes = new Set(userPermissionCodes);

  if (codes.has(FULL_ACCESS_PERMISSION)) {
    return true;
  }

  if (codes.has(requiredPermissionCode)) {
    return true;
  }

  const [requiredApplication, requiredFeature, requiredAction] = requiredPermissionCode.split(":");

  for (const code of codes) {
    const [application, feature, action] = code.split(":");

    if (
      (application === "*" || application === requiredApplication) &&
      (feature === "*" || feature === requiredFeature) &&
      (action === "*" || action === requiredAction)
    ) {
      return true;
    }
  }

  return false;
}

export function canonicalPermissionCodesFor(seedCode: string) {
  const canonical = PERMISSION_CATALOG.find((item) => item.code === seedCode || item.legacyCodes.includes(seedCode));

  return canonical ? [canonical.code, ...canonical.legacyCodes] : [seedCode];
}
