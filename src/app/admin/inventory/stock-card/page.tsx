import {
  ProductStockCardFilters,
  ProductStockCardTable,
} from "@/app/admin/inventory/movement-table";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
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
      <PageHeader eyebrow="Inventory" title="Product Stock Card" />
      <section className="rounded-lg border border-border bg-card">
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
