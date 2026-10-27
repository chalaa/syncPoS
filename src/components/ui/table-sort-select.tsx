"use client";

import { ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";
import { formatSortValue, parseSortValue, type SortDirection } from "@/lib/table-sort";

export type TableSortOption = {
  value: string; // e.g. "name:asc" or "listPriceMinor:desc" or "default"
  label: string; // e.g. "Name (A → Z)"
};

type TableSortSelectProps = {
  options: TableSortOption[];
  defaultValue?: string;
  className?: string;
  sortByParamName?: string;
  sortOrderParamName?: string;
  /** Optional controlled value for client-side sorting */
  value?: string;
  /** Optional controlled change handler */
  onSortChange?: (field: string, direction: SortDirection) => void;
};

export function TableSortSelect({
  options,
  defaultValue = "",
  className = "",
  sortByParamName = "sortBy",
  sortOrderParamName = "sortOrder",
  value: controlledValue,
  onSortChange,
}: TableSortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslation();

  const isControlled = typeof onSortChange === "function";

  const urlSortBy = searchParams?.get(sortByParamName);
  const urlSortOrder = searchParams?.get(sortOrderParamName);

  let currentValue = defaultValue;
  if (isControlled) {
    currentValue = controlledValue ?? defaultValue;
  } else if (urlSortBy) {
    currentValue = formatSortValue(urlSortBy, (urlSortOrder?.toLowerCase() ?? "asc") as SortDirection);
  }

  function handleChange(selectedValue: string) {
    if (isControlled && onSortChange) {
      if (!selectedValue) {
        onSortChange("", "asc");
      } else {
        const parsed = parseSortValue(selectedValue);
        if (parsed) onSortChange(parsed.sortBy, parsed.sortOrder);
      }
      return;
    }

    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());

    if (!selectedValue) {
      params.delete(sortByParamName);
      params.delete(sortOrderParamName);
    } else {
      const parsed = parseSortValue(selectedValue);
      if (parsed) {
        params.set(sortByParamName, parsed.sortBy);
        params.set(sortOrderParamName, parsed.sortOrder);
      }
    }
    params.delete("page");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "relative inline-flex items-center w-full sm:w-auto",
        className,
      )}
    >
      <div className="pointer-events-none absolute left-2.5 flex items-center text-muted-foreground">
        <ArrowUpDown className="size-3.5" />
      </div>
      <select
        value={currentValue}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 w-full sm:w-auto min-w-[140px] appearance-none rounded-md border border-input bg-background pl-8 pr-7 text-xs text-foreground outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
        aria-label={t("sort.sortBy", "Sort by")}
      >
        <option value="">{t("sort.default", "Default Order")}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.label, opt.label)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2.5 flex items-center text-muted-foreground text-[10px]">
        ▼
      </div>
    </div>
  );
}
