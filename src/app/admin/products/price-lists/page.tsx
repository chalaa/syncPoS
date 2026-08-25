import { PriceListManager } from "@/app/admin/products/price-list-manager";
import { requirePermission } from "@/server/auth/session";
import { getPriceListFormOptions, getProductPriceListRows } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type ProductPriceListsPageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function ProductPriceListsPage({ searchParams }: ProductPriceListsPageProps) {
  await requirePermission("product.view");

  const [params, rows, options] = await Promise.all([
    searchParams,
    getProductPriceListRows(),
    getPriceListFormOptions(),
  ]);

  return (
    <PriceListManager
      rows={rows}
      options={options}
      notice={params.notice}
      error={params.error}
    />
  );
}
