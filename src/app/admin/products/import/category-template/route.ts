import { categoryImportTemplateCsv } from "@/server/catalog/category-import";
import { requirePermission } from "@/server/auth/session";

export async function GET() {
  await requirePermission("product.manage");

  return new Response(categoryImportTemplateCsv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"category-import-template.csv\"",
    },
  });
}
