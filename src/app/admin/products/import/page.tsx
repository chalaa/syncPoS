import { ProductImporter } from "@/app/admin/products/import/product-importer";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ProductImportPage() {
  await requirePermission("product.manage");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Product Import"
        actions={<ButtonLink href="/admin/products" variant="outline">Back to products</ButtonLink>}
      />
      <ProductImporter />
    </PageShell>
  );
}
