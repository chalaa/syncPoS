"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";

import { cn } from "@/lib/utils";

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
    <label className={cn("inline-flex items-center text-xs font-medium text-muted-foreground w-full sm:w-auto", className)}>
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 w-full sm:w-auto min-w-[120px] rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer"
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
