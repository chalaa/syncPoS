import { CatalogReferenceManager } from "@/app/admin/products/catalog-reference-manager";
import {
  createUnit,
  restoreUnit,
  softDeleteUnit,
  updateUnit,
} from "@/app/admin/products/actions";
import { requirePermission } from "@/server/auth/session";
import { getCatalogReferenceList } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

type UnitsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
  }>;
};

export default async function UnitsPage({ searchParams }: UnitsPageProps) {
  await requirePermission("product.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const showDeleted = params.show === "deleted";
  const records = await getCatalogReferenceList({
    kind: "unit",
    query,
    showDeleted,
  });
  const returnPath = `/admin/products/units${showDeleted ? "?show=deleted" : ""}`;

  return (
    <CatalogReferenceManager
      kind="unit"
      eyebrow="Catalog"
      title="Units of Measure"
      description="Maintain base units used for products, stock movement, purchasing, and sales."
      createLabel="New unit"
      showPrecision
      basePath="/admin/products/units"
      createAction={createUnit}
      updateAction={updateUnit}
      softDeleteAction={softDeleteUnit}
      restoreAction={restoreUnit}
      records={records}
      query={query}
      showDeleted={showDeleted}
      notice={params.notice}
      error={params.error}
      returnPath={returnPath}
    />
  );
}
