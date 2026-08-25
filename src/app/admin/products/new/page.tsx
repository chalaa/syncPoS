import { getCatalogFormOptions } from "@/server/catalog/products";
import { requirePermission } from "@/server/auth/session";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  await requirePermission("product.manage");

  const [params, options] = await Promise.all([searchParams, getCatalogFormOptions()]);

  return (
    <ProductForm
      mode="create"
      categories={options.categories}
      brands={options.brands}
      units={options.units}
      taxes={options.taxes}
      error={params.error}
    />
  );
}
