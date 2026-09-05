import { CategoryAttributeImporter } from "@/app/admin/products/import/category-attributes/category-attribute-importer";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function CategoryAttributeImportPage() {
  await requirePermission("product.manage");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Category Attribute Import"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products/import/templates" variant="outline">
              Product template import
            </ButtonLink>
            <ButtonLink href="/admin/products/import" variant="outline">
              Product import
            </ButtonLink>
          </div>
        }
      />
      <CategoryAttributeImporter />
    </PageShell>
  );
}
