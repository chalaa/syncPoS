import { requirePermission } from "@/server/auth/session";
import { getProductList, minorToDisplay } from "@/server/catalog/products";

function csvValue(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, "\"\"")}"`;
}

export async function GET() {
  await requirePermission("product.view");

  const products = await getProductList({ showDeleted: false });
  const rows = products.map((product) => [
    product.sku,
    product.name,
    product.categoryName ?? "",
    product.brandName ?? "",
    product.model ?? "",
    product.unitCode,
    product.trackingMode,
    product.currencyCode,
    minorToDisplay(product.standardCostMinor),
    minorToDisplay(product.listPriceMinor),
    product.isActive ? "Active" : "Inactive",
  ]);
  const csv = [
    [
      "item_code",
      "product_name",
      "category",
      "brand",
      "model",
      "unit",
      "tracking_mode",
      "currency",
      "purchase_unit_cost",
      "sales_unit_price",
      "status",
    ],
    ...rows,
  ]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "content-disposition": "attachment; filename=\"products-export.xls\"",
      "content-type": "application/vnd.ms-excel; charset=utf-8",
    },
  });
}
