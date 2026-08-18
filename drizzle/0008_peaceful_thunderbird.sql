CREATE TABLE "product_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_no" varchar(120) NOT NULL,
	"status" serial_status DEFAULT 'available' NOT NULL,
	"current_location_id" uuid,
	"landed_unit_cost_minor" bigint,
	"expiry_date" date,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "stock_balances_location_product_active_uidx";--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD COLUMN "product_lot_id" uuid;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD COLUMN "lot_no" varchar(120);--> statement-breakpoint
ALTER TABLE "stock_balances" ADD COLUMN "product_lot_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD COLUMN "product_lot_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD COLUMN "product_lot_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD COLUMN "product_lot_id" uuid;--> statement-breakpoint
ALTER TABLE "product_lots" ADD CONSTRAINT "product_lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_lots" ADD CONSTRAINT "product_lots_current_location_id_locations_id_fk" FOREIGN KEY ("current_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "product_lots_product_lot_no_active_uidx" ON "product_lots" USING btree ("product_id","lot_no") WHERE "product_lots"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_lots_product_status_location_idx" ON "product_lots" USING btree ("product_id","status","current_location_id");--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "goods_receipt_lines_lot_idx" ON "goods_receipt_lines" USING btree ("product_lot_id");--> statement-breakpoint
CREATE INDEX "stock_balances_lot_idx" ON "stock_balances" USING btree ("product_lot_id");--> statement-breakpoint
CREATE INDEX "stock_movement_lines_lot_idx" ON "stock_movement_lines" USING btree ("product_lot_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_lot_idx" ON "stock_reservations" USING btree ("product_lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_location_product_active_uidx" ON "stock_balances" USING btree ("company_id","location_id","product_id",coalesce("product_serial_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("product_lot_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "stock_balances"."deleted_at" is null;