"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/use-translation";

type DetailStatCardProps = {
  href: string;
  count?: number | string | null;
  label: string;
  translationKey?: string;
};

export function DetailStatCard({ href, count, label, translationKey }: DetailStatCardProps) {
  const { t } = useTranslation();
  const translatedLabel = t(translationKey || label, label);

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs transition-all hover:border-primary/50 hover:bg-secondary/40"
    >
      <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
        {count ?? 0}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{translatedLabel}</span>
    </Link>
  );
}
