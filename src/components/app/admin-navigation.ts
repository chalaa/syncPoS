import {
  BarChart3Icon,
  BoxesIcon,
  ClipboardListIcon,
  GaugeIcon,
  PackageCheckIcon,
  SettingsIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  UsersIcon,
} from "lucide-react";

import type { AdminMenuItem, AdminSubMenuItem } from "@/components/app/types";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

export const adminMenuItems: AdminMenuItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/admin",
    icon: GaugeIcon,
    permission: PERMISSIONS.REPORTS.PROFIT_VIEW,
    submenus: [
      { label: "Overview", href: "/admin", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Daily Activity", href: "/admin?view=daily", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Sync Status", href: "/admin?view=sync", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
    ],
  },
  {
    key: "products",
    label: "Products",
    href: "/admin/products",
    icon: BoxesIcon,
    permission: PERMISSIONS.PRODUCTS.VIEW,
    submenus: [
      { label: "Products", href: "/admin/products", permission: PERMISSIONS.PRODUCTS.VIEW },
      { label: "Templates", href: "/admin/products/templates", permission: PERMISSIONS.PRODUCTS.VIEW },
      {
        label: "Import",
        href: "/admin/products/import",
        permission: PERMISSIONS.PRODUCTS.MANAGE,
        children: [
          { label: "Products", href: "/admin/products/import", permission: PERMISSIONS.PRODUCTS.MANAGE },
          { label: "Category Attributes", href: "/admin/products/import/category-attributes", permission: PERMISSIONS.PRODUCTS.MANAGE },
          { label: "Product Templates", href: "/admin/products/import/templates", permission: PERMISSIONS.PRODUCTS.MANAGE },
        ],
      },
      {
        label: "Configuration",
        href: "/admin/products/categories",
        permission: PERMISSIONS.PRODUCTS.VIEW,
        children: [
          { label: "Categories", href: "/admin/products/categories", permission: PERMISSIONS.PRODUCTS.VIEW },
          { label: "Attributes", href: "/admin/products/attributes", permission: PERMISSIONS.PRODUCTS.VIEW },
          { label: "Brands", href: "/admin/products/brands", permission: PERMISSIONS.PRODUCTS.VIEW },
          { label: "Units", href: "/admin/products/units", permission: PERMISSIONS.PRODUCTS.VIEW },
          { label: "Taxes", href: "/admin/products/taxes", permission: PERMISSIONS.PRODUCTS.VIEW },
          { label: "Price Lists", href: "/admin/products/price-lists", permission: PERMISSIONS.PRODUCTS.VIEW },
          { label: "Lots / Serials", href: "/admin/products/tracking", permission: PERMISSIONS.PRODUCTS.VIEW },
        ],
      },
    ],
  },
  {
    key: "partners",
    label: "Partners",
    href: "/admin/partners",
    icon: UsersIcon,
    permission: PERMISSIONS.PARTNERS.VIEW,
    submenus: [
      { label: "All Partners", href: "/admin/partners", permission: PERMISSIONS.PARTNERS.VIEW },
      { label: "Customers", href: "/admin/partners?role=customer", permission: PERMISSIONS.PARTNERS.VIEW },
      { label: "Suppliers", href: "/admin/partners?role=supplier", permission: PERMISSIONS.PARTNERS.VIEW },
      { label: "Payment Terms", href: "/admin/partners/payment-terms", permission: PERMISSIONS.PARTNERS.VIEW },
    ],
  },
  {
    key: "purchasing",
    label: "Purchasing",
    href: "/admin/purchasing",
    icon: ShoppingBagIcon,
    permission: PERMISSIONS.INVENTORY.RECEIVE,
    submenus: [
      { label: "RFQs / Orders", href: "/admin/purchasing", permission: PERMISSIONS.INVENTORY.RECEIVE },
      { label: "Receipts", href: "/admin/purchasing?view=receipts", permission: PERMISSIONS.INVENTORY.RECEIVE },
      { label: "Landed Costs", href: "/admin/purchasing?view=landed-costs", permission: PERMISSIONS.INVENTORY.RECEIVE },
      { label: "Payments", href: "/admin/purchasing?view=payments", permission: PERMISSIONS.INVENTORY.RECEIVE },
      { label: "Returns", href: "/admin/purchasing?view=returns", permission: PERMISSIONS.INVENTORY.RECEIVE },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    href: "/admin/sales",
    icon: ShoppingCartIcon,
    permission: PERMISSIONS.SALES.CREATE,
    submenus: [
      { label: "Quotations / Orders", href: "/admin/sales", permission: PERMISSIONS.SALES.CREATE },
      { label: "Deliveries", href: "/admin/sales?view=deliveries", permission: PERMISSIONS.SALES.CREATE },
      { label: "Payments", href: "/admin/sales?view=payments", permission: PERMISSIONS.SALES.CREATE },
      { label: "Returns", href: "/admin/sales?view=returns", permission: PERMISSIONS.SALES.CREATE },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    href: "/admin/inventory",
    icon: PackageCheckIcon,
    permission: PERMISSIONS.INVENTORY.VIEW,
    submenus: [
      { label: "Stock", href: "/admin/inventory", permission: PERMISSIONS.INVENTORY.VIEW },
      {
        label: "Operations",
        href: "/admin/inventory/operations",
        permission: PERMISSIONS.INVENTORY.VIEW,
      },
      { label: "Stock Card", href: "/admin/inventory/stock-card", permission: PERMISSIONS.INVENTORY.VIEW },
      { label: "Serial History", href: "/admin/inventory/serial-history", permission: PERMISSIONS.INVENTORY.VIEW },
      { label: "Locations", href: "/admin/inventory/locations", permission: PERMISSIONS.LOCATIONS.MANAGE },
      { label: "Opening Stock", href: "/admin/inventory/opening-stock", permission: PERMISSIONS.INVENTORY.RECEIVE },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart3Icon,
    permission: PERMISSIONS.REPORTS.PROFIT_VIEW,
    submenus: [
      { label: "Report Hub", href: "/admin/reports", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Sales", href: "/admin/reports/sales", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Expenses", href: "/admin/reports/expenses", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Payments", href: "/admin/reports/payments", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Payment Accounts", href: "/admin/reports/payment-accounts", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Stock", href: "/admin/reports/stock", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Receivables", href: "/admin/reports/receivables", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
      { label: "Payables", href: "/admin/reports/payables", permission: PERMISSIONS.REPORTS.PROFIT_VIEW },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    icon: SettingsIcon,
    submenus: [
      { label: "Users", href: "/admin/settings?view=users", permission: PERMISSIONS.USERS.VIEW },
      { label: "Roles", href: "/admin/settings?view=roles", permission: PERMISSIONS.ROLES.VIEW },
      { label: "Permissions", href: "/admin/settings?view=permissions", permission: PERMISSIONS.ROLES.VIEW },
      { label: "Owners", href: "/admin/settings/owners", permission: PERMISSIONS.COMPANY.MANAGE },
      { label: "Payments", href: "/admin/settings/payments", permission: PERMISSIONS.COMPANY.MANAGE },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    href: "/admin/operations",
    icon: ClipboardListIcon,
    permission: PERMISSIONS.COMPANY.MANAGE,
    submenus: [
      { label: "Tasks", href: "/admin/operations", permission: PERMISSIONS.COMPANY.MANAGE },
      { label: "Approvals", href: "/admin/operations?view=approvals", permission: PERMISSIONS.COMPANY.MANAGE },
      { label: "Expenses", href: "/admin/operations/expenses", permission: PERMISSIONS.COMPANY.MANAGE },
      { label: "Expense Categories", href: "/admin/operations/expenses/categories", permission: PERMISSIONS.COMPANY.MANAGE },
    ],
  },
];

function filterAdminSubmenus(
  items: AdminSubMenuItem[],
  permissionCodes: Iterable<string>,
): AdminSubMenuItem[] {
  return items
    .filter((item) => !item.permission || userHasPermission(permissionCodes, item.permission))
    .map((item): AdminSubMenuItem => {
      const children = item.children ? filterAdminSubmenus(item.children, permissionCodes) : undefined;

      return {
        ...item,
        children,
      };
    })
    .filter((item) => !item.children || item.children.length > 0);
}

export function filterAdminMenuItems(permissionCodes: Iterable<string>) {
  return adminMenuItems
    .filter((item) => !item.permission || userHasPermission(permissionCodes, item.permission))
    .map((item) => ({
      ...item,
      submenus: filterAdminSubmenus(item.submenus, permissionCodes),
    }))
    .filter((item) => item.submenus.length > 0);
}
