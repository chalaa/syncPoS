import Link from "next/link";
import { Filter, Search } from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayMoneyMinor, displayQuantity } from "@/server/inventory/stock";
import type {
  StockByLocationRow,
  StockFilterOption,
  StockStatusOption,
} from "@/server/inventory/stock-types";

export function StockFilters({
  query,
  locationId,
  status,
  asOfDate,
  locations,
}: {
  query: string;
  locationId: string;
  status: StockStatusOption;
  asOfDate: string;
  locations: StockFilterOption[];
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/20 p-4">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Search Product / Serial
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Item code, SKU, product, or serial..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm font-normal text-foreground"
          />
        </div>
      </label>
      <label className="flex min-w-52 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Location
        <select
          name="locationId"
          defaultValue={locationId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
        >
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} / {location.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Stock Status
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
        >
          <option value="all">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="reserved">Reserved</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="negative">Negative</option>
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        As of Date
        <input
          name="asOfDate"
          type="date"
          defaultValue={asOfDate}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
        />
      </label>
      <Button type="submit" className="h-10 gap-1.5 px-4 font-semibold">
        <Filter className="size-4" />
        Filter Stock
      </Button>
    </form>
  );
}

export function StockByLocationTable({ rows }: { rows: StockByLocationRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Tracking</th>
            <th className="px-4 py-3 text-right">On hand</th>
            <th className="px-4 py-3 text-right">Reserved</th>
            <th className="px-4 py-3 text-right">Available</th>
            <th className="px-4 py-3 text-right">Avg cost</th>
            <th className="px-4 py-3">Last movement</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row) => {
            const availableNum = Number(row.quantityAvailable);
            const isOutOfStock = availableNum <= 0;
            const trackingType = row.serialNo ? "Serial" : row.lotNo ? "Lot" : "Bulk";

            return (
              <tr
                key={row.stockBalanceId}
                className="transition-colors hover:bg-secondary/40"
              >
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-foreground">{row.locationCode}</div>
                  <div className="text-xs text-muted-foreground">{row.locationName}</div>
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{row.ownerName ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-primary">{row.sku}</div>
                  <div className="text-xs text-foreground">{row.productName}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center rounded border border-border/80 bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
                      {trackingType}
                    </span>
                    {(row.serialNo || row.lotNo) ? (
                      <span className="font-mono text-xs text-muted-foreground">{row.serialNo ?? row.lotNo}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{displayQuantity(row.quantityOnHand)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                  {Number(row.quantityReserved) > 0 ? (
                    <span className="font-medium text-gold">{displayQuantity(row.quantityReserved)}</span>
                  ) : (
                    "0"
                  )}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">
                  {isOutOfStock ? (
                    <StatusBadge status="out_of_stock" label={displayQuantity(row.quantityAvailable)} />
                  ) : (
                    <span className="font-bold text-primary">{displayQuantity(row.quantityAvailable)}</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {displayMoneyMinor(row.averageCostMinor, row.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  {row.lastMovementAt ? row.lastMovementAt.toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/inventory/stock-card?productId=${row.productId}`}>
                      Stock Card
                    </Link>
                  </Button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                No stock balance records found matching the active filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

