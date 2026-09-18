"use client";

import { ButtonLink } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

export function BackToProductsButton() {
  const { t } = useTranslation();
  return (
    <ButtonLink href="/admin/products" variant="outline">
      {t("action.backToProducts", "Back to Products")}
    </ButtonLink>
  );
}
