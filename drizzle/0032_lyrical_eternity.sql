ALTER TABLE "price_list_items" DROP CONSTRAINT "price_list_items_date_range_chk";--> statement-breakpoint
DROP INDEX "price_list_items_product_date_active_uidx";--> statement-breakpoint
WITH ranked_price_items AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "price_list_id", "product_id", "minimum_quantity"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id"
    ) AS row_no
  FROM "price_list_items"
  WHERE "deleted_at" IS NULL
)
UPDATE "price_list_items"
SET
  "deleted_at" = now(),
  "delete_reason" = 'Duplicate price list item archived after validity dates were removed.',
  "updated_at" = now()
WHERE "id" IN (
  SELECT "id"
  FROM ranked_price_items
  WHERE row_no > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_items_product_qty_active_uidx" ON "price_list_items" USING btree ("price_list_id","product_id","minimum_quantity") WHERE "price_list_items"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "price_list_items" DROP COLUMN "valid_from";--> statement-breakpoint
ALTER TABLE "price_list_items" DROP COLUMN "valid_to";
