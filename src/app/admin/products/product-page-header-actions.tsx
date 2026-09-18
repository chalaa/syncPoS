"use client";

import { Download, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import { NewProductModal } from "./new-product-modal";
import type { CategorySelectOption, SelectOption } from "@/server/catalog/types";

export function ProductPageHeaderActions({
  categories,
  brands,
  units,
  taxes,
  initialOpen,
  initialProductName,
  canManageProducts,
}: {
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  taxes: { id: string; label: string; scope: "purchase" | "sale" | "both" }[];
  initialOpen?: boolean;
  initialProductName?: string;
  canManageProducts: boolean;
}) {
  const { t } = useTranslation();

  if (!canManageProducts) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink href="/admin/products/import" variant="outline" className="gap-1.5 font-medium">
        <Upload className="size-3.5 text-muted-foreground" />
        {t("action.import")}
      </ButtonLink>
      <ButtonLink href="/admin/products/export" variant="outline" className="gap-1.5 font-medium">
        <Download className="size-3.5 text-muted-foreground" />
        {t("action.export")}
      </ButtonLink>
      <NewProductModal
        categories={categories}
        brands={brands}
        units={units}
        taxes={taxes}
        initialOpen={initialOpen}
        initialProductName={initialProductName}
      />
    </div>
  );
}
