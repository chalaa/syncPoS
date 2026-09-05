import { notFound } from "next/navigation";

import { ProductTemplateForm } from "@/app/admin/products/template-form";
import { requirePermission } from "@/server/auth/session";
import {
  getCatalogAttributeList,
  getCatalogFormOptions,
  getCategoryAttributeList,
  getProductTemplateDetail,
} from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type ProductTemplatePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

export default async function ProductTemplatePage({ params, searchParams }: ProductTemplatePageProps) {
  await requirePermission("product.manage");
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const [template, options, attributes, categoryAttributes] = await Promise.all([
    getProductTemplateDetail(id),
    getCatalogFormOptions(),
    getCatalogAttributeList(),
    getCategoryAttributeList(),
  ]);

  if (!template) {
    notFound();
  }

  return (
    <ProductTemplateForm
      mode="edit"
      template={template}
      categories={options.categories}
      brands={options.brands}
      units={options.units}
      attributes={attributes}
      categoryAttributes={categoryAttributes}
      notice={queryParams.notice}
      error={queryParams.error}
    />
  );
}
