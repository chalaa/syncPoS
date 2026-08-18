ALTER TABLE "purchase_orders" ADD COLUMN "deliver_to_location_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "vendor_reference" varchar(80);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "order_deadline" date;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_deliver_to_location_id_locations_id_fk" FOREIGN KEY ("deliver_to_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "purchase_orders_deliver_to_idx" ON "purchase_orders" USING btree ("deliver_to_location_id");