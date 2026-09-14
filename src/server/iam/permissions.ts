export const FULL_ACCESS_PERMISSION = "all:all:all";

export const PERMISSIONS = {
  OWNER: {
    ALL: FULL_ACCESS_PERMISSION,
  },
  COMPANY: {
    MANAGE: "company:settings:manage",
    OWNERS_MANAGE: "company:owners:manage",
    AUDIT_VIEW: "company:audit:view",
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
    CATEGORIES_MANAGE: "catalog:categories:manage",
    PRICES_MANAGE: "catalog:prices:manage",
    TAXES_MANAGE: "catalog:taxes:manage",
    TRACKING_VIEW: "catalog:tracking:view",
  },
  PARTNERS: {
    VIEW: "partners:partners:view",
    MANAGE: "partners:partners:manage",
    CUSTOMERS_MANAGE: "partners:customers:manage",
    SUPPLIERS_MANAGE: "partners:suppliers:manage",
    PAYMENT_TERMS_MANAGE: "partners:payment_terms:manage",
  },
  PURCHASING: {
    RFQ_MANAGE: "purchasing:rfq:manage",
    ORDERS_VIEW: "purchasing:orders:view",
    ORDERS_CREATE: "purchasing:orders:create",
    ORDERS_APPROVE: "purchasing:orders:approve",
    RECEIPTS_MANAGE: "purchasing:receipts:manage",
    LANDED_COSTS_MANAGE: "purchasing:landed_costs:manage",
    BILLS_MANAGE: "purchasing:bills:manage",
    PAYMENTS_MANAGE: "purchasing:payments:manage",
  },
  SALES: {
    QUOTES_MANAGE: "sales:quotes:manage",
    ORDERS_VIEW: "sales:orders:view",
    CREATE: "sales:orders:create",
    APPROVE: "sales:orders:approve",
    DISCOUNT_OVERRIDE: "sales:discounts:override",
    COST_VIEW: "sales:costs:view",
    DELIVERIES_MANAGE: "sales:deliveries:manage",
    INVOICES_MANAGE: "sales:invoices:manage",
    PAYMENTS_MANAGE: "sales:payments:manage",
    RETURNS_MANAGE: "sales:returns:manage",
  },
  INVENTORY: {
    VIEW: "inventory:stock:view",
    RECEIVE: "inventory:stock:receive",
    TRANSFER_CREATE: "inventory:transfers:create",
    TRANSFER_APPROVE: "inventory:transfers:approve",
    ADJUSTMENTS_CREATE: "inventory:adjustments:create",
    SCRAP_CREATE: "inventory:scrap:create",
    OPENING_STOCK_MANAGE: "inventory:opening_stock:manage",
  },
  EXPENSES: {
    VIEW: "expenses:expenses:view",
    CREATE: "expenses:expenses:create",
    APPROVE: "expenses:expenses:approve",
    PAYMENTS_MANAGE: "expenses:payments:manage",
    CATEGORIES_MANAGE: "expenses:categories:manage",
  },
  REPORTS: {
    HUB_VIEW: "reports:hub:view",
    SALES_VIEW: "reports:sales:view",
    EXPENSES_VIEW: "reports:expenses:view",
    PAYMENTS_VIEW: "reports:payments:view",
    STOCK_VIEW: "reports:stock:view",
    RECEIVABLES_VIEW: "reports:receivables:view",
    PAYABLES_VIEW: "reports:payables:view",
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
  if (code.includes(":")) {
    const [application, feature, action] = code.split(":");

    return {
      application: application ?? "system",
      feature: feature ?? "general",
      action: action ?? "access",
    };
  }

  const [feature, action] = code.split(".");

  return {
    application: "legacy",
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
  catalogItem(PERMISSIONS.OWNER.ALL, "Full access to all syncPoS sectors and settings"),
  catalogItem(PERMISSIONS.COMPANY.MANAGE, "Manage company settings, fiscal year, and configuration", ["company.manage"]),
  catalogItem(PERMISSIONS.COMPANY.OWNERS_MANAGE, "Manage company legal owners"),
  catalogItem(PERMISSIONS.COMPANY.AUDIT_VIEW, "View system audit logs and compliance history"),
  catalogItem(PERMISSIONS.USERS.VIEW, "View users directory and account details", ["user.view"]),
  catalogItem(PERMISSIONS.USERS.MANAGE, "Create, edit, lock, and manage user accounts", ["user.manage"]),
  catalogItem(PERMISSIONS.ROLES.VIEW, "View roles and permission assignments", ["role.view"]),
  catalogItem(PERMISSIONS.ROLES.MANAGE, "Create, edit, delete, and configure roles", ["role.manage"]),
  catalogItem(PERMISSIONS.LOCATIONS.MANAGE, "Manage stock locations, warehouses, and shops", ["location.manage"]),

  // Catalog / Products Sector
  catalogItem(PERMISSIONS.PRODUCTS.VIEW, "View product catalog, SKUs, and inventory cards", ["product.view"]),
  catalogItem(PERMISSIONS.PRODUCTS.MANAGE, "Create, edit, archive, and import products", ["product.manage"]),
  catalogItem(PERMISSIONS.PRODUCTS.CATEGORIES_MANAGE, "Manage categories, brands, and units of measure"),
  catalogItem(PERMISSIONS.PRODUCTS.PRICES_MANAGE, "Manage price lists and tier pricing"),
  catalogItem(PERMISSIONS.PRODUCTS.TAXES_MANAGE, "Manage tax rates and tax categories"),
  catalogItem(PERMISSIONS.PRODUCTS.TRACKING_VIEW, "View serial numbers, lot tracking, and expirations"),

  // Partners Sector
  catalogItem(PERMISSIONS.PARTNERS.VIEW, "View customer and supplier directory", ["partner.view"]),
  catalogItem(PERMISSIONS.PARTNERS.MANAGE, "Create and edit customer and supplier accounts", ["partner.manage"]),
  catalogItem(PERMISSIONS.PARTNERS.CUSTOMERS_MANAGE, "Manage customer profiles and credit limits"),
  catalogItem(PERMISSIONS.PARTNERS.SUPPLIERS_MANAGE, "Manage vendor profiles and supplier details"),
  catalogItem(PERMISSIONS.PARTNERS.PAYMENT_TERMS_MANAGE, "Manage payment terms and credit schedules"),

  // Purchasing Sector
  catalogItem(PERMISSIONS.PURCHASING.RFQ_MANAGE, "Create and manage RFQs and supplier quotes"),
  catalogItem(PERMISSIONS.PURCHASING.ORDERS_VIEW, "View purchase orders and vendor quotes"),
  catalogItem(PERMISSIONS.PURCHASING.ORDERS_CREATE, "Create draft purchase orders"),
  catalogItem(PERMISSIONS.PURCHASING.ORDERS_APPROVE, "Approve and confirm purchase orders"),
  catalogItem(PERMISSIONS.PURCHASING.RECEIPTS_MANAGE, "Receive goods receipt notes (GRN) and warehouse check-in"),
  catalogItem(PERMISSIONS.PURCHASING.LANDED_COSTS_MANAGE, "Calculate and allocate landed costs (freight, duty, customs)"),
  catalogItem(PERMISSIONS.PURCHASING.BILLS_MANAGE, "Manage vendor bills and supplier invoices"),
  catalogItem(PERMISSIONS.PURCHASING.PAYMENTS_MANAGE, "Register and process vendor payments"),

  // Sales & POS Sector
  catalogItem(PERMISSIONS.SALES.QUOTES_MANAGE, "Create and manage customer quotations"),
  catalogItem(PERMISSIONS.SALES.ORDERS_VIEW, "View sales orders and quotes"),
  catalogItem(PERMISSIONS.SALES.CREATE, "Create sales orders and POS transactions", ["sales.create"]),
  catalogItem(PERMISSIONS.SALES.APPROVE, "Approve sales orders and credit holds"),
  catalogItem(PERMISSIONS.SALES.DISCOUNT_OVERRIDE, "Override sales discount caps and pricing", ["sales.discount.override"]),
  catalogItem(PERMISSIONS.SALES.COST_VIEW, "View product cost and profit margins on sales", ["sales.cost.view"]),
  catalogItem(PERMISSIONS.SALES.DELIVERIES_MANAGE, "Dispatch customer orders and generate packing slips"),
  catalogItem(PERMISSIONS.SALES.INVOICES_MANAGE, "Issue customer invoices and credit notes"),
  catalogItem(PERMISSIONS.SALES.PAYMENTS_MANAGE, "Register customer payments and cash settlements"),
  catalogItem(PERMISSIONS.SALES.RETURNS_MANAGE, "Process customer returns and refunds"),

  // Inventory Sector
  catalogItem(PERMISSIONS.INVENTORY.VIEW, "View inventory stock levels and balance ledgers", ["inventory.view"]),
  catalogItem(PERMISSIONS.INVENTORY.RECEIVE, "Receive and post inbound warehouse stock", ["inventory.receive"]),
  catalogItem(PERMISSIONS.INVENTORY.TRANSFER_CREATE, "Create internal stock transfer requests"),
  catalogItem(PERMISSIONS.INVENTORY.TRANSFER_APPROVE, "Approve and execute internal stock transfers", ["inventory.transfer.approve"]),
  catalogItem(PERMISSIONS.INVENTORY.ADJUSTMENTS_CREATE, "Perform physical stock count reconciliations and adjustments"),
  catalogItem(PERMISSIONS.INVENTORY.SCRAP_CREATE, "Decommission and write-off damaged or obsolete stock"),
  catalogItem(PERMISSIONS.INVENTORY.OPENING_STOCK_MANAGE, "Post opening inventory balances"),

  // Expenses Sector
  catalogItem(PERMISSIONS.EXPENSES.VIEW, "View operational expenses and reimbursement logs"),
  catalogItem(PERMISSIONS.EXPENSES.CREATE, "Record new operational and administrative expenses"),
  catalogItem(PERMISSIONS.EXPENSES.APPROVE, "Approve expense requests and authorize payouts"),
  catalogItem(PERMISSIONS.EXPENSES.PAYMENTS_MANAGE, "Register expense payments and bank settlements"),
  catalogItem(PERMISSIONS.EXPENSES.CATEGORIES_MANAGE, "Create and manage expense categories"),

  // Reports Sector
  catalogItem(PERMISSIONS.REPORTS.HUB_VIEW, "Access central reports hub"),
  catalogItem(PERMISSIONS.REPORTS.SALES_VIEW, "View sales and revenue performance reports"),
  catalogItem(PERMISSIONS.REPORTS.EXPENSES_VIEW, "View expense breakdown and cost logs"),
  catalogItem(PERMISSIONS.REPORTS.PAYMENTS_VIEW, "View payment activity and bank accounts balance"),
  catalogItem(PERMISSIONS.REPORTS.STOCK_VIEW, "View stock valuation and inventory movement reports"),
  catalogItem(PERMISSIONS.REPORTS.RECEIVABLES_VIEW, "View Accounts Receivable (AR) aging and customer balances"),
  catalogItem(PERMISSIONS.REPORTS.PAYABLES_VIEW, "View Accounts Payable (AP) aging and vendor balances"),
  catalogItem(PERMISSIONS.REPORTS.PROFIT_VIEW, "View Profit & Loss (P&L) and profitability reports", ["report.profit.view"]),
] as const satisfies PermissionCatalogItem[];

export const SYSTEM_ROLES = [
  // ── System account roles (not assignable to regular employees) ───────────────
  {
    code: "owner",
    name: "Owner",
    description: "Full unrestricted access to every syncPoS sector and setting.",
    permissionCodes: [PERMISSIONS.OWNER.ALL],
    isEditable: false,
    isDeletable: false,
  },
  {
    code: "admin",
    name: "Admin",
    description: "System administrator with full unrestricted access.",
    permissionCodes: [PERMISSIONS.OWNER.ALL],
    isEditable: false,
    isDeletable: false,
  },

  // ── 1. Sales (Salesperson / Cashier) ────────────────────────────────────────
  {
    code: "sales",
    name: "Sales",
    description: "Frontline sales, POS transactions, order entry, and customer lookup.",
    permissionCodes: [
      PERMISSIONS.PRODUCTS.VIEW,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.PARTNERS.VIEW,
      PERMISSIONS.SALES.ORDERS_VIEW,
      PERMISSIONS.SALES.CREATE,
      PERMISSIONS.EXPENSES.VIEW,
    ],
    isEditable: true,
    isDeletable: false,
  },

  // ── 3. Sales Manager ────────────────────────────────────────────────────────
  {
    code: "sales_manager",
    name: "Sales Manager",
    description: "Full sales management — quotes, orders, pricing overrides, deliveries, invoicing, customer payments, returns, and sales reports.",
    permissionCodes: [
      PERMISSIONS.PRODUCTS.VIEW,
      PERMISSIONS.PARTNERS.VIEW,
      PERMISSIONS.PARTNERS.CUSTOMERS_MANAGE,
      PERMISSIONS.SALES.QUOTES_MANAGE,
      PERMISSIONS.SALES.ORDERS_VIEW,
      PERMISSIONS.SALES.CREATE,
      PERMISSIONS.SALES.APPROVE,
      PERMISSIONS.SALES.DISCOUNT_OVERRIDE,
      PERMISSIONS.SALES.COST_VIEW,
      PERMISSIONS.SALES.DELIVERIES_MANAGE,
      PERMISSIONS.SALES.INVOICES_MANAGE,
      PERMISSIONS.SALES.PAYMENTS_MANAGE,
      PERMISSIONS.SALES.RETURNS_MANAGE,
      PERMISSIONS.REPORTS.HUB_VIEW,
      PERMISSIONS.REPORTS.SALES_VIEW,
      PERMISSIONS.REPORTS.RECEIVABLES_VIEW,
      PERMISSIONS.EXPENSES.VIEW,
    ],
    isEditable: true,
    isDeletable: false,
  },

  // ── 4. Accountant ───────────────────────────────────────────────────────────
  {
    code: "accountant",
    name: "Accountant",
    description: "Full accounting access — expenses, vendor bills, customer invoices, payments, AR/AP aging, and all financial reports.",
    permissionCodes: [
      PERMISSIONS.EXPENSES.VIEW,
      PERMISSIONS.EXPENSES.CREATE,
      PERMISSIONS.EXPENSES.APPROVE,
      PERMISSIONS.EXPENSES.PAYMENTS_MANAGE,
      PERMISSIONS.EXPENSES.CATEGORIES_MANAGE,
      PERMISSIONS.PURCHASING.BILLS_MANAGE,
      PERMISSIONS.PURCHASING.PAYMENTS_MANAGE,
      PERMISSIONS.SALES.INVOICES_MANAGE,
      PERMISSIONS.SALES.PAYMENTS_MANAGE,
      PERMISSIONS.PARTNERS.VIEW,
      PERMISSIONS.PARTNERS.PAYMENT_TERMS_MANAGE,
      PERMISSIONS.REPORTS.HUB_VIEW,
      PERMISSIONS.REPORTS.SALES_VIEW,
      PERMISSIONS.REPORTS.EXPENSES_VIEW,
      PERMISSIONS.REPORTS.PAYMENTS_VIEW,
      PERMISSIONS.REPORTS.RECEIVABLES_VIEW,
      PERMISSIONS.REPORTS.PAYABLES_VIEW,
      PERMISSIONS.REPORTS.PROFIT_VIEW,
    ],
    isEditable: true,
    isDeletable: false,
  },

  // ── 5. Inventory Manager ────────────────────────────────────────────────────
  {
    code: "inventory_manager",
    name: "Inventory Manager",
    description: "Full stock control — locations, receiving, transfers, adjustments, scrap, opening balances, product catalog, and stock reports.",
    permissionCodes: [
      PERMISSIONS.PRODUCTS.VIEW,
      PERMISSIONS.PRODUCTS.MANAGE,
      PERMISSIONS.PRODUCTS.CATEGORIES_MANAGE,
      PERMISSIONS.PRODUCTS.PRICES_MANAGE,
      PERMISSIONS.PRODUCTS.TRACKING_VIEW,
      PERMISSIONS.INVENTORY.VIEW,
      PERMISSIONS.INVENTORY.RECEIVE,
      PERMISSIONS.INVENTORY.TRANSFER_CREATE,
      PERMISSIONS.INVENTORY.TRANSFER_APPROVE,
      PERMISSIONS.INVENTORY.ADJUSTMENTS_CREATE,
      PERMISSIONS.INVENTORY.SCRAP_CREATE,
      PERMISSIONS.INVENTORY.OPENING_STOCK_MANAGE,
      PERMISSIONS.LOCATIONS.MANAGE,
      PERMISSIONS.REPORTS.HUB_VIEW,
      PERMISSIONS.REPORTS.STOCK_VIEW,
      PERMISSIONS.EXPENSES.VIEW,
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
