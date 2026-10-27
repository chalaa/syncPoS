export type SortDirection = "asc" | "desc";

export type ColumnSortType = "string" | "number" | "date" | "boolean" | "alphanumeric";

export type SortParams = {
  sortBy?: string;
  sortOrder?: string;
};

export type SortColumnConfig<T = unknown> = {
  key?: string;
  type?: ColumnSortType;
  /** Custom accessor if property is nested or transformed */
  accessor?: (row: T) => unknown;
  /** Custom comparator if full custom sorting is needed */
  comparator?: (a: T, b: T, direction: SortDirection) => number;
};

/**
 * Automatically infers column data type from sample value
 */
export function inferSortType(val: unknown): ColumnSortType {
  if (typeof val === "number") return "number";
  if (typeof val === "boolean") return "boolean";
  if (val instanceof Date) return "date";
  if (typeof val === "string") {
    // ISO date or standard YYYY-MM-DD pattern
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(val) && !Number.isNaN(Date.parse(val))) {
      return "date";
    }
  }
  return "alphanumeric";
}

/**
 * Sorts an array of objects based on sort parameters and column configurations.
 * Handles numbers, dates, booleans, and natural alphanumeric strings.
 * Gracefully places null/undefined values at the end regardless of direction.
 */
export function sortRows<T>(
  rows: T[],
  params: SortParams,
  configs?: Record<string, SortColumnConfig<T>>,
): T[] {
  const { sortBy, sortOrder } = params;
  if (!sortBy) return rows;

  const direction: SortDirection = sortOrder?.toLowerCase() === "desc" ? "desc" : "asc";
  const config = configs?.[sortBy];

  return [...rows].sort((itemA, itemB) => {
    if (config?.comparator) {
      return config.comparator(itemA, itemB, direction);
    }

    const valA = config?.accessor
      ? config.accessor(itemA)
      : (itemA as Record<string, unknown>)[sortBy];
    const valB = config?.accessor
      ? config.accessor(itemB)
      : (itemB as Record<string, unknown>)[sortBy];

    // Always sort nullish / empty values to the bottom
    const aEmpty = valA === null || valA === undefined || valA === "";
    const bEmpty = valB === null || valB === undefined || valB === "";

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const sortType = config?.type ?? inferSortType(valA);

    switch (sortType) {
      case "number": {
        const numA = typeof valA === "number" ? valA : Number(valA);
        const numB = typeof valB === "number" ? valB : Number(valB);
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          return direction === "asc" ? numA - numB : numB - numA;
        }
        break;
      }
      case "date": {
        const timeA = valA instanceof Date ? valA.getTime() : new Date(valA as string | number).getTime();
        const timeB = valB instanceof Date ? valB.getTime() : new Date(valB as string | number).getTime();
        if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
          return direction === "asc" ? timeA - timeB : timeB - timeA;
        }
        break;
      }
      case "boolean": {
        const boolA = valA ? 1 : 0;
        const boolB = valB ? 1 : 0;
        return direction === "asc" ? boolA - boolB : boolB - boolA;
      }
      case "string":
      case "alphanumeric":
      default: {
        const strA = String(valA);
        const strB = String(valB);
        return direction === "asc"
          ? strA.localeCompare(strB, undefined, { numeric: true, sensitivity: "base" })
          : strB.localeCompare(strA, undefined, { numeric: true, sensitivity: "base" });
      }
    }

    const fallbackA = String(valA);
    const fallbackB = String(valB);
    return direction === "asc"
      ? fallbackA.localeCompare(fallbackB, undefined, { numeric: true, sensitivity: "base" })
      : fallbackB.localeCompare(fallbackA, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Parses a combined string like "name:asc" or "price:desc" into separate sortBy and sortOrder.
 */
export function parseSortValue(value: string): { sortBy: string; sortOrder: SortDirection } | null {
  if (!value) return null;
  const [field, order] = value.split(":");
  if (!field) return null;
  return {
    sortBy: field,
    sortOrder: order?.toLowerCase() === "desc" ? "desc" : "asc",
  };
}

/**
 * Formats sortBy and sortOrder into a single value string like "price:desc"
 */
export function formatSortValue(sortBy: string, sortOrder: SortDirection): string {
  return `${sortBy}:${sortOrder}`;
}
