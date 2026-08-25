import type { LucideIcon } from "lucide-react";

export type AdminMenuKey =
  | "dashboard"
  | "products"
  | "partners"
  | "purchasing"
  | "sales"
  | "inventory"
  | "reports"
  | "operations"
  | "settings";

export type AdminSubMenuItem = {
  label: string;
  href: string;
  permission?: string;
  children?: AdminSubMenuItem[];
};

export type AdminMenuItem = {
  key: AdminMenuKey;
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  submenus: AdminSubMenuItem[];
};
