"use client";

import { Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Language } from "@/stores/types";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage } = useTranslation();

  function toggleLanguage() {
    const nextLang: Language = language === "en" ? "am" : "en";
    setLanguage(nextLang);
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={language === "en" ? "Switch to Amharic (አማርኛ)" : "Switch to English"}
      aria-label="Toggle language"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer select-none",
        className,
      )}
    >
      <Globe className="size-3.5 text-[#0B5D4B] shrink-0" />
      <span className="font-medium">
        {language === "en" ? "EN" : "AM"}
      </span>
      <span className="hidden sm:inline text-muted-foreground text-[11px]">
        {language === "en" ? "(English)" : "(አማርኛ)"}
      </span>
    </button>
  );
}
