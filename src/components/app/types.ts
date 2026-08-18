import type { LucideIcon } from "lucide-react";

export type AdminMenuKey =
  | "dashboard"
  | "products"
  | "partners"
  | "purchasing"
  | "sales"
  | "inventory"
  | "operations"
  | "settings";

export type AdminSubMenuItem = {
  label: string;
  href: string;
};

export type AdminMenuItem = {
  key: AdminMenuKey;
  label: string;
  href: string;
  icon: LucideIcon;
  submenus: AdminSubMenuItem[];
};
