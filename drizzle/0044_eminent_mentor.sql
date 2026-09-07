ALTER TABLE "sales_order_lines" ADD COLUMN "source_location_id" uuid;--> statement-breakpoint
UPDATE "sales_order_lines" sol
SET "source_location_id" = so."source_location_id"
FROM "sales_orders" so
WHERE sol."sales_order_id" = so."id"
  AND sol."source_location_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sales_order_lines_source_location_idx" ON "sales_order_lines" USING btree ("source_location_id");
