import { requirePermission } from "@/server/auth/session";
import { openingStockTemplateCsv } from "@/server/inventory/opening-stock";

export async function GET() {
  await requirePermission("inventory.receive");

  return new Response(openingStockTemplateCsv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"opening-stock-template.csv\"",
    },
  });
}
