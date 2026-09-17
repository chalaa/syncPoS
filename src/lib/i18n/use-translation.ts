"use client";

import { useAppStore } from "@/stores/app-store";
import type { Language } from "@/stores/types";
import { translations, type TranslationKey } from "./translations";

export function useTranslation() {
  const language = useAppStore((state) => state.language) ?? ("en" as Language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  function t(key: TranslationKey | string, fallback?: string): string {
    const dict = translations[language] as Record<string, string> | undefined;
    if (dict && key in dict) {
      return dict[key]!;
    }
    const enDict = translations.en as Record<string, string>;
    if (key in enDict) {
      return enDict[key]!;
    }
    return fallback ?? key;
  }

  return { language, setLanguage, t };
}
