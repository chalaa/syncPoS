import { CatalogReferenceManager } from "@/app/admin/products/catalog-reference-manager";
import {
  createBrand,
  restoreBrand,
  softDeleteBrand,
  updateBrand,
} from "@/app/admin/products/actions";
import { requirePermission } from "@/server/auth/session";
import { getCatalogReferenceList } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type BrandsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  await requirePermission("product.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const records = await getCatalogReferenceList({
    kind: "brand",
    query,
    showDeleted,
  });
  const returnPath = `/admin/products/brands${showDeleted ? "?show=deleted" : ""}`;

  return (
    <CatalogReferenceManager
      kind="brand"
      eyebrow="Catalog"
      title="Brands"
      description="Maintain equipment and spare-part brands used in the product catalog."
      createLabel="New brand"
      showPrecision={false}
      basePath="/admin/products/brands"
      createAction={createBrand}
      updateAction={updateBrand}
      softDeleteAction={softDeleteBrand}
      restoreAction={restoreBrand}
      records={records}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
    />
  );
}
