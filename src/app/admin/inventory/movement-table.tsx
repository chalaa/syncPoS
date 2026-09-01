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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      <label className="flex min-w-64 flex-col gap-1 text-sm font-medium">
        Product
        <select
          name="productId"
          defaultValue={productId}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      <button className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
        Apply
      </button>
    </form>
  );
}

export function ProductStockCardTable({ rows }: { rows: ProductStockCardRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Movement</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3">Serial</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Unit cost</th>
            <th className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.movementId}-${row.serialNo ?? row.quantity}`} className="border-t border-border">
              <td className="px-4 py-3">{row.movementDate.toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{row.movementNo}</div>
                <div className="text-xs text-muted-foreground">{row.sourceNo ?? row.notes ?? ""}</div>
              </td>
              <td className="px-4 py-3">{row.movementType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{row.fromLocationCode ?? "-"}</td>
              <td className="px-4 py-3">{row.toLocationCode ?? "-"}</td>
              <td className="px-4 py-3">{row.serialNo ?? "-"}</td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.quantity)}</td>
              <td className="px-4 py-3 text-right">{displayMoneyMinor(row.unitCostMinor, "ETB")}</td>
              <td className="px-4 py-3 text-right">{displayMoneyMinor(row.totalCostMinor, "ETB")}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                No stock card movements found.
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        />
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
      <button className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
        Apply
      </button>
    </form>
  );
}

export function SerialHistoryTable({ rows }: { rows: SerialHistoryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Serial</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Current</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Movement</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.movementId}-${row.serialNo}`} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{row.serialNo}</td>
              <td className="px-4 py-3">
                <div>{row.sku}</div>
                <div className="text-xs text-muted-foreground">{row.productName}</div>
              </td>
              <td className="px-4 py-3">
                <div>{row.currentLocationCode ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{row.serialStatus}</div>
              </td>
              <td className="px-4 py-3">{row.movementDate.toLocaleDateString()}</td>
              <td className="px-4 py-3">{row.movementNo}</td>
              <td className="px-4 py-3">{row.fromLocationCode ?? "-"}</td>
              <td className="px-4 py-3">{row.toLocationCode ?? "-"}</td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.quantity)}</td>
              <td className="px-4 py-3 text-right">{displayMoneyMinor(row.unitCostMinor, "ETB")}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                No serial history found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
