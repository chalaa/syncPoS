export const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export type PaginationParams = {
  page?: string;
  pageSize?: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: PageSize;
  totalRows: number;
  totalPages: number;
  from: number;
  to: number;
};

export function parsePagination(params: PaginationParams) {
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const requestedPageSize = Number.parseInt(params.pageSize ?? "25", 10);

  return {
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: PAGE_SIZES.includes(requestedPageSize as PageSize)
      ? (requestedPageSize as PageSize)
      : 25,
  };
}

export function paginateRows<T>(rows: T[], params: PaginationParams) {
  const parsed = parsePagination(params);
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / parsed.pageSize));
  const page = Math.min(parsed.page, totalPages);
  const start = (page - 1) * parsed.pageSize;
  const end = Math.min(start + parsed.pageSize, totalRows);

  return {
    rows: rows.slice(start, end),
    pagination: {
      page,
      pageSize: parsed.pageSize,
      totalRows,
      totalPages,
      from: totalRows === 0 ? 0 : start + 1,
      to: end,
    } satisfies PaginationMeta,
  };
}
