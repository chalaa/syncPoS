import { ProductTemplateForm } from "@/app/admin/products/template-form";
import { requirePermission } from "@/server/auth/session";
import {
  getCatalogAttributeList,
  getCatalogFormOptions,
  getCategoryAttributeList,
} from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type NewProductTemplatePageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function NewProductTemplatePage({ searchParams }: NewProductTemplatePageProps) {
  await requirePermission("product.manage");
  const [params, options, attributes, categoryAttributes] = await Promise.all([
    searchParams,
    getCatalogFormOptions(),
    getCatalogAttributeList(),
    getCategoryAttributeList(),
  ]);

  return (
    <ProductTemplateForm
      mode="create"
      categories={options.categories}
      brands={options.brands}
      units={options.units}
      attributes={attributes}
      categoryAttributes={categoryAttributes}
      notice={params.notice}
      error={params.error}
    />
  );
}
