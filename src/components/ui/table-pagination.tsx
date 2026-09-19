"use client";

import {
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { PAGE_SIZES, type PageSize, type PaginationMeta } from "@/lib/pagination";

type PageItem = number | "start-ellipsis" | "end-ellipsis";

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "end-ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [
      1,
      "start-ellipsis",
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "start-ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "end-ellipsis",
    totalPages,
  ];
}

export function TablePagination({ pagination }: { pagination: PaginationMeta }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(page: number, pageSize: PageSize = pagination.pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(Math.max(1, Math.min(page, pagination.totalPages))));
    params.set("pageSize", String(pageSize));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const isFirstPage = pagination.page <= 1;
  const isLastPage = pagination.page >= pagination.totalPages;
  const pageItems = getPageItems(pagination.page, pagination.totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-muted/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {pagination.from}-{pagination.to} of {pagination.totalRows}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Rows
          <select
            value={pagination.pageSize}
            disabled={isPending}
            onChange={(event) => navigate(1, Number(event.target.value) as PageSize)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button type="button" variant="outline" size="icon" className="size-8" disabled={isPending || isFirstPage} onClick={() => navigate(1)} title="First page" aria-label="First page">
            <ChevronsLeftIcon className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-8" disabled={isPending || isFirstPage} onClick={() => navigate(pagination.page - 1)} title="Previous page" aria-label="Previous page">
            <ChevronLeftIcon className="size-4" />
          </Button>
          {pageItems.map((item) =>
            typeof item === "number" ? (
              <Button
                key={item}
                type="button"
                variant={item === pagination.page ? "default" : "outline"}
                size="icon"
                className="size-8 text-xs"
                disabled={isPending}
                onClick={() => navigate(item)}
                aria-label={`Page ${item}`}
                aria-current={item === pagination.page ? "page" : undefined}
              >
                {item}
              </Button>
            ) : (
              <span
                key={item}
                className="flex size-8 items-center justify-center text-xs text-muted-foreground"
                aria-hidden="true"
              >
                ...
              </span>
            ),
          )}
          <Button type="button" variant="outline" size="icon" className="size-8" disabled={isPending || isLastPage} onClick={() => navigate(pagination.page + 1)} title="Next page" aria-label="Next page">
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-8" disabled={isPending || isLastPage} onClick={() => navigate(pagination.totalPages)} title="Last page" aria-label="Last page">
            <ChevronsRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
