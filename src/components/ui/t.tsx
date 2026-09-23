"use client";

import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * Translates a static string in place, usable from Server Components
 * without converting the whole tree to a client component. `k` doubles
 * as the translation key (direct-lookup pattern used across the app).
 */
export function T({ k, fallback }: { k: string; fallback?: string }) {
  const { t } = useTranslation();
  return <>{t(k, fallback ?? k)}</>;
}

export function useT(k: string, fallback?: string) {
  const { t } = useTranslation();
  return t(k, fallback ?? k);
}
