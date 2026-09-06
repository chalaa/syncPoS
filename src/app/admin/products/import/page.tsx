import { CategoryImporter, ProductImporter } from "@/app/admin/products/import/product-importer";
import { ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type ProductImportPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function ProductImportPage({ searchParams }: ProductImportPageProps) {
  await requirePermission("product.manage");
  const params = await searchParams;
  const defaultTab = params.tab === "categories" ? "categories" : "products";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Product Import"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products" variant="outline">
              Back to products
            </ButtonLink>
          </div>
        }
      />
      <Notebook
        defaultValue={defaultTab}
        items={[
          {
            value: "products",
            label: "Products",
            content: <ProductImporter />,
          },
          {
            value: "categories",
            label: "Categories",
            content: <CategoryImporter />,
          },
        ]}
      />
    </PageShell>
  );
}
