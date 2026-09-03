ALTER TABLE "price_lists" DROP CONSTRAINT "price_lists_date_range_chk";--> statement-breakpoint
ALTER TABLE "price_lists" DROP CONSTRAINT "price_lists_location_id_locations_id_fk";
--> statement-breakpoint
DROP INDEX "price_lists_code_active_uidx";--> statement-breakpoint
DROP INDEX "price_lists_location_active_idx";--> statement-breakpoint
ALTER TABLE "price_lists" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "price_lists" pl
SET "owner_id" = (
  SELECT o."id"
  FROM "owners" o
  WHERE o."company_id" = pl."company_id"
    AND o."deleted_at" IS NULL
  ORDER BY o."created_at" ASC
  LIMIT 1
)
WHERE pl."owner_id" IS NULL;--> statement-breakpoint
UPDATE "sales_order_lines" sol
SET "owner_id" = so."owner_id"
FROM "sales_orders" so
WHERE sol."sales_order_id" = so."id"
  AND sol."owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "price_lists_name_owner_active_uidx" ON "price_lists" USING btree ("company_id","name","owner_id") WHERE "price_lists"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "price_lists_owner_active_idx" ON "price_lists" USING btree ("company_id","owner_id","is_active");--> statement-breakpoint
CREATE INDEX "sales_order_lines_owner_idx" ON "sales_order_lines" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "location_id";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "price_list_type";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "valid_from";--> statement-breakpoint
ALTER TABLE "price_lists" DROP COLUMN "valid_to";--> statement-breakpoint
DROP TYPE "public"."price_list_type";
