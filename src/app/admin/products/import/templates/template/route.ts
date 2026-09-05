import { requirePermission } from "@/server/auth/session";
import { productTemplateImportTemplateCsv } from "@/server/catalog/product-template-import";

export async function GET() {
  await requirePermission("product.manage");

  return new Response(productTemplateImportTemplateCsv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"product-template-import-template.csv\"",
    },
  });
}
