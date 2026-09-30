import {
  ProductStockCardFilters,
  ProductStockCardTable,
} from "@/app/admin/inventory/movement-table";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import {
  getInventoryFilterOptions,
  getProductStockCard,
  parseAsOfDate,
} from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type StockCardPageProps = {
  searchParams: Promise<{
    q?: string;
    productId?: string;
    asOfDate?: string;
  }>;
};

export default async function StockCardPage({ searchParams }: StockCardPageProps) {
  await requirePermission("inventory.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const productId = params.productId ?? "";
  const asOfDate = params.asOfDate ?? "";
  const [options, rows] = await Promise.all([
    getInventoryFilterOptions(),
    getProductStockCard({
      query,
      productId: productId || undefined,
      asOfDate: parseAsOfDate(asOfDate),
    }),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.inventoryWorkspace" fallback="Inventory Workspace" />}
        title={<T k="inventory.stockCardTitle" fallback="Product Stock Card" />}
        description={
          <T
            k="inventory.stockCardDesc"
            fallback="Continuous running balance ledger tracking ins, outs, unit costs, and remaining quantities."
          />
        }
      />

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <ProductStockCardFilters
          query={query}
          productId={productId}
          asOfDate={asOfDate}
          products={options.products}
        />
        <ProductStockCardTable rows={rows} />
      </section>
    </PageShell>
  );
}
