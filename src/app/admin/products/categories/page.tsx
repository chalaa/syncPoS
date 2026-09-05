import { CatalogReferenceManager } from "@/app/admin/products/catalog-reference-manager";
import { CategoryAttributeManager } from "@/app/admin/products/category-attribute-manager";
import {
  createCategory,
  restoreCategory,
  softDeleteCategory,
  updateCategory,
} from "@/app/admin/products/actions";
import { requirePermission } from "@/server/auth/session";
import {
  getCatalogAttributeList,
  getCatalogReferenceList,
  getCategoryAttributeList,
} from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type CategoriesPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  await requirePermission("product.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const [records, attributes, assignments] = await Promise.all([
    getCatalogReferenceList({
      kind: "category",
      query,
      showDeleted,
    }),
    getCatalogAttributeList(),
    getCategoryAttributeList(),
  ]);
  const returnPath = `/admin/products/categories${showDeleted ? "?show=deleted" : ""}`;

  return (
    <CatalogReferenceManager
      kind="category"
      eyebrow="Catalog"
      title="Product Categories"
      description="Group machinery, spare parts, accessories, consumables, and service items for reporting and product setup."
      createLabel="New category"
      showPrecision={false}
      basePath="/admin/products/categories"
      createAction={createCategory}
      updateAction={updateCategory}
      softDeleteAction={softDeleteCategory}
      restoreAction={restoreCategory}
      records={records}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
      afterContent={
        !showDeleted ? (
          <CategoryAttributeManager
            categories={records}
            attributes={attributes}
            assignments={assignments}
            returnPath={returnPath}
          />
        ) : null
      }
    />
  );
}
