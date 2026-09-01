import Link from "next/link";

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
    <form className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">
        Search
        <input
          name="q"
          defaultValue={query}
          placeholder="Item code, product, or serial"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      <label className="flex min-w-52 flex-col gap-1 text-sm font-medium">
        Location
        <select
          name="locationId"
          defaultValue={locationId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} / {location.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-sm font-medium">
        Status
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All</option>
          <option value="in_stock">In stock</option>
          <option value="reserved">Reserved</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="negative">Negative</option>
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-sm font-medium">
        As of
        <input
          name="asOfDate"
          type="date"
          defaultValue={asOfDate}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      <Button>Apply</Button>
    </form>
  );
}

export function StockByLocationTable({ rows }: { rows: StockByLocationRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Tracking</th>
            <th className="px-4 py-3 text-right">On hand</th>
            <th className="px-4 py-3 text-right">Reserved</th>
            <th className="px-4 py-3 text-right">Available</th>
            <th className="px-4 py-3 text-right">Avg cost</th>
            <th className="px-4 py-3">Last movement</th>
            <th className="px-4 py-3 text-right">Card</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.stockBalanceId}
              className="border-t border-border"
            >
              <td className="px-4 py-3">
                <div className="font-medium">{row.locationCode}</div>
                <div className="text-xs text-muted-foreground">{row.locationName}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{row.sku}</div>
                <div className="text-xs text-muted-foreground">{row.productName}</div>
              </td>
              <td className="px-4 py-3">
                <div>{row.serialNo ?? row.lotNo ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{row.serialNo ? "Serial" : row.lotNo ? "Lot" : "Bulk"}</div>
              </td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.quantityOnHand)}</td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.quantityReserved)}</td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.quantityAvailable)}</td>
              <td className="px-4 py-3 text-right">
                {displayMoneyMinor(row.averageCostMinor, row.currencyCode)}
              </td>
              <td className="px-4 py-3">
                {row.lastMovementAt ? row.lastMovementAt.toLocaleDateString() : "-"}
              </td>
              <td className="px-4 py-3 text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/inventory/stock-card?productId=${row.productId}`}>
                    Open
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                No stock records found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
