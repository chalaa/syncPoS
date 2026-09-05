import { notFound } from "next/navigation";

import { requirePermission } from "@/server/auth/session";
import { getCatalogFormOptions, getProductById } from "@/server/catalog/products";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  await requirePermission("product.manage");

  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const [product, options] = await Promise.all([getProductById(id), getCatalogFormOptions()]);

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      mode="edit"
      product={product}
      categories={options.categories}
      brands={options.brands}
      units={options.units}
      templates={options.templates}
      taxes={options.taxes}
      error={queryParams.error}
    />
  );
}
