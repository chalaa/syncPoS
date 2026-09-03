import { requirePermission } from "@/server/auth/session";
import { productImportTemplateCsv } from "@/server/catalog/product-import";

export async function GET() {
  await requirePermission("product.manage");

  return new Response(productImportTemplateCsv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"product-import-template.csv\"",
    },
  });
}
