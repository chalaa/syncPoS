import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayMoneyMinor, displayQuantity } from "@/server/inventory/stock";
import type {
  ProductStockCardRow,
  SerialHistoryRow,
  StockFilterOption,
} from "@/server/inventory/stock-types";

export function ProductStockCardFilters({
  query,
  productId,
  asOfDate,
  products,
}: {
  query: string;
  productId: string;
  asOfDate: string;
  products: StockFilterOption[];
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">
        Search
        <input
          name="q"
          defaultValue={query}
          placeholder="Item code, product, movement, or source"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <label className="flex min-w-64 flex-col gap-1 text-sm font-medium">
        Product
        <select
          name="productId"
          defaultValue={productId}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.code} / {product.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-sm font-medium">
        As of
        <input
          name="asOfDate"
          type="date"
          defaultValue={asOfDate}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <Button type="submit" className="h-9">
        Apply
      </Button>
    </form>
  );
}

export function ProductStockCardTable({ rows }: { rows: ProductStockCardRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Movement</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3">Serial</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.movementLineId} className="border-t border-border transition-colors hover:bg-secondary/30">
              <td className="px-4 py-3 text-muted-foreground">{row.movementDate.toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <div className="font-semibold text-foreground">{row.movementNo}</div>
                <div className="text-xs text-muted-foreground">{row.sourceNo ?? row.notes ?? ""}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.ownerName ?? "-"}</td>
              <td className="px-4 py-3 capitalize">
                <Badge variant="outline" className="capitalize text-[11px]">
                  {row.movementType.replace(/_/g, " ")}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.fromLocationCode ?? "-"}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.toLocationCode ?? "-"}</td>
              <td className="px-4 py-3 font-mono text-xs">{row.serialNo ?? "-"}</td>
              <td className="px-4 py-3 text-right font-medium text-foreground">{displayQuantity(row.quantity)}</td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">{displayMoneyMinor(row.totalCostMinor, "ETB")}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No stock card movements found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try selecting a different product or date filter.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function SerialHistoryFilters({
  serialQuery,
  asOfDate,
}: {
  serialQuery: string;
  asOfDate: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <label className="flex min-w-72 flex-1 flex-col gap-1 text-sm font-medium">
        Serial / product
        <input
          name="serial"
          defaultValue={serialQuery}
          placeholder="Serial, engine, chassis, or item code"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <label className="flex min-w-40 flex-col gap-1 text-sm font-medium">
        As of
        <input
          name="asOfDate"
          type="date"
          defaultValue={asOfDate}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <Button type="submit" className="h-9">
        Apply
      </Button>
    </form>
  );
}

export function SerialHistoryTable({ rows }: { rows: SerialHistoryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Serial</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Current Location</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Movement</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.movementLineId} className="border-t border-border transition-colors hover:bg-secondary/30">
              <td className="px-4 py-3 font-mono font-medium text-foreground">{row.serialNo}</td>
              <td className="px-4 py-3">
                <div className="font-semibold text-foreground">{row.sku}</div>
                <div className="text-xs text-muted-foreground">{row.productName}</div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.ownerName ?? "-"}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{row.currentLocationCode ?? "-"}</div>
                <div className="mt-0.5">
                  <StatusBadge status={row.serialStatus} size="sm" />
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.movementDate.toLocaleDateString()}</td>
              <td className="px-4 py-3 font-medium text-foreground">{row.movementNo}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.fromLocationCode ?? "-"}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.toLocationCode ?? "-"}</td>
              <td className="px-4 py-3 text-right font-medium text-foreground">{displayQuantity(row.quantity)}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No serial history found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try searching for a different serial number or keyword.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
