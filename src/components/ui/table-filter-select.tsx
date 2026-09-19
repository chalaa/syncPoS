"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";

export type FilterOption = {
  value: string;
  label: string;
};

type TableFilterSelectProps = {
  paramName: string;
  label?: string;
  defaultValue?: string;
  options: FilterOption[];
  allLabel?: string;
  className?: string;
};

export function TableFilterSelect({
  paramName,
  label,
  defaultValue = "",
  options,
  allLabel = "All",
  className = "",
}: TableFilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();

  const currentValue = searchParams.get(paramName) ?? defaultValue;

  const displayLabel = label ? t(`field.${label.toLowerCase()}`, t(label, label)) : undefined;
  const displayAllLabel = t(`action.all${paramName.charAt(0).toUpperCase() + paramName.slice(1)}s`, t(allLabel, allLabel));

  function handleChange(newValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set(paramName, newValue);
    } else {
      params.delete(paramName);
    }
    params.delete("page");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <label className={`flex items-center gap-2 text-xs font-medium text-muted-foreground ${className}`}>
      {displayLabel ? <span className="shrink-0">{displayLabel}:</span> : null}
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">{displayAllLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.label, opt.label)}
          </option>
        ))}
      </select>
    </label>
  );
}
