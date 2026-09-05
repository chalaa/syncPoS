import { requirePermission } from "@/server/auth/session";
import { categoryAttributeImportTemplateCsv } from "@/server/catalog/category-attribute-import";

export async function GET() {
  await requirePermission("product.manage");

  return new Response(categoryAttributeImportTemplateCsv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"category-attribute-import-template.csv\"",
    },
  });
}
