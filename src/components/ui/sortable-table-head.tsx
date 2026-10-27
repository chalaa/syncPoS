"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useTransition } from "react";

import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/table-sort";

export type SortableTableHeadProps = {
  /** The key matching the row property or sort param */
  sortKey: string;
  /** Label to display */
  label?: ReactNode;
  children?: ReactNode;
  /** Alignment: left, center, or right */
  align?: "left" | "center" | "right";
  /** Optional class for the th */
  className?: string;
  /** Query parameter name for sortBy (defaults to "sortBy") */
  sortByParamName?: string;
  /** Query parameter name for sortOrder (defaults to "sortOrder") */
  sortOrderParamName?: string;
  /** Controlled sort state for client-only tables */
  currentSortBy?: string;
  currentSortOrder?: SortDirection;
  /** Callback for client-only sorting */
  onSort?: (key: string, direction: SortDirection) => void;
};

export function SortableTableHead({
  sortKey,
  label,
  children,
  align = "left",
  className,
  sortByParamName = "sortBy",
  sortOrderParamName = "sortOrder",
  currentSortBy: controlledSortBy,
  currentSortOrder: controlledSortOrder,
  onSort,
}: SortableTableHeadProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const isControlled = typeof onSort === "function";
  const activeSortBy = isControlled ? controlledSortBy : (searchParams?.get(sortByParamName) ?? "");
  const activeSortOrder = (isControlled
    ? controlledSortOrder
    : (searchParams?.get(sortOrderParamName) ?? "asc")
  )?.toLowerCase() as SortDirection;

  const isSorted = activeSortBy === sortKey;
  const isAsc = isSorted && activeSortOrder === "asc";
  const isDesc = isSorted && activeSortOrder === "desc";

  function handleClick() {
    const nextOrder: SortDirection = isSorted && isAsc ? "desc" : "asc";

    if (isControlled && onSort) {
      onSort(sortKey, nextOrder);
      return;
    }

    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(sortByParamName, sortKey);
    params.set(sortOrderParamName, nextOrder);
    params.delete("page");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  const content = label ?? children;

  return (
    <th
      scope="col"
      aria-sort={isSorted ? (isAsc ? "ascending" : "descending") : "none"}
      className={cn(
        "select-none transition-colors",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
          isSorted ? "text-primary font-bold" : "text-muted-foreground",
          align === "right" && "ml-auto flex-row-reverse",
          align === "center" && "mx-auto justify-center",
        )}
        title={
          isSorted
            ? isAsc
              ? "Sorted ascending (Click to sort descending)"
              : "Sorted descending (Click to sort ascending)"
            : "Click to sort"
        }
      >
        <span>{content}</span>
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center rounded transition-all",
            isSorted
              ? "text-primary"
              : "text-muted-foreground/40 opacity-0 group-hover:opacity-100",
          )}
        >
          {isAsc ? (
            <ArrowUp className="size-3.5 stroke-[2.5]" />
          ) : isDesc ? (
            <ArrowDown className="size-3.5 stroke-[2.5]" />
          ) : (
            <ArrowUpDown className="size-3.5" />
          )}
        </span>
      </button>
    </th>
  );
}
