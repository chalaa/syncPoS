import { Alert } from "@/components/ui/alert";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { getCatalogFormOptions, getProductDetail, getProductList } from "@/server/catalog/products";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

import { ProductPageHeaderActions } from "./product-page-header-actions";
import { ProductKpiCards } from "./product-kpi-cards";
import { ProductListTable } from "./product-list-table";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
    new?: string;
    name?: string;
    productId?: string;
    category?: string;
    brand?: string;
    status?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requirePermission(PERMISSIONS.PRODUCTS.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canManageProducts = userHasPermission(userPerms, PERMISSIONS.PRODUCTS.MANAGE);

  const params = await searchParams;
  const showDeleted = params.show === "deleted";
  const query = params.q ?? "";
  const categoryId = params.category ?? "";
  const brandId = params.brand ?? "";
  const status = params.status ?? "";

  const [products, formOptions, initialProductDetail] = await Promise.all([
    getProductList({ query, showDeleted, categoryId, brandId, status }),
    getCatalogFormOptions(),
    params.productId ? getProductDetail(params.productId) : Promise.resolve(null),
  ]);

  const categoryOptions = formOptions.categories.map((c) => ({ value: c.id, label: c.name }));
  const brandOptions = formOptions.brands.map((b) => ({ value: b.id, label: b.name }));
  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog Management"
        title="Products & Pricing"
        description="Manage unified product definitions, tracking modes, tax assignments, and catalog prices."
        actions={
          <ProductPageHeaderActions
            categories={formOptions.categories}
            brands={formOptions.brands}
            units={formOptions.units}
            taxes={formOptions.taxes}
            initialOpen={params.new === "1" || params.new === "true"}
            initialProductName={params.name}
            canManageProducts={canManageProducts}
          />
        }
      />

      <ProductKpiCards
        products={products}
        categoriesCount={formOptions.categories.length}
        brandsCount={formOptions.brands.length}
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <TableSearchInput
              defaultValue={query}
              placeholder="Search item code, SKU, product name, or model..."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TableFilterSelect
              paramName="category"
              label="Category"
              options={categoryOptions}
              allLabel="All Categories"
            />
            <TableFilterSelect
              paramName="brand"
              label="Brand"
              options={brandOptions}
              allLabel="All Brands"
            />
            <TableFilterSelect
              paramName="status"
              label="Status"
              options={statusOptions}
              allLabel="All Statuses"
            />
          </div>
        </div>

        <ProductListTable
          products={products}
          showDeleted={showDeleted}
          initialProductId={params.productId}
          initialProductDetail={initialProductDetail}
        />
      </section>
    </PageShell>
  );
}
