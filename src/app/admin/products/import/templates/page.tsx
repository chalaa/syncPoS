import { ProductTemplateImporter } from "@/app/admin/products/import/templates/product-template-importer";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProductTemplateImportPage() {
  await requirePermission("product.manage");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Product Template Import"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products/import/category-attributes" variant="outline">
              Category attribute import
            </ButtonLink>
            <ButtonLink href="/admin/products/import" variant="outline">
              Product import
            </ButtonLink>
            <ButtonLink href="/admin/products" variant="outline">
              Back to products
            </ButtonLink>
          </div>
        }
      />
      <ProductTemplateImporter />
    </PageShell>
  );
}
