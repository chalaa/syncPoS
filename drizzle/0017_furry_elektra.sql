CREATE TYPE "public"."transfer_line_discrepancy" AS ENUM('none', 'shortage', 'overage', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('draft', 'approved', 'dispatched', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TABLE "transfer_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"product_lot_id" uuid,
	"unit_id" uuid NOT NULL,
	"quantity_requested" numeric(20, 6) NOT NULL,
	"quantity_dispatched" numeric(20, 6) DEFAULT '0' NOT NULL,
	"quantity_received" numeric(20, 6) DEFAULT '0' NOT NULL,
	"discrepancy" "transfer_line_discrepancy" DEFAULT 'none' NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"serial_no" varchar(120),
	"lot_no" varchar(120),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_lines_line_no_chk" CHECK ("transfer_lines"."line_no" > 0),
	CONSTRAINT "transfer_lines_requested_chk" CHECK ("transfer_lines"."quantity_requested" > 0),
	CONSTRAINT "transfer_lines_dispatched_chk" CHECK ("transfer_lines"."quantity_dispatched" >= 0),
	CONSTRAINT "transfer_lines_received_chk" CHECK ("transfer_lines"."quantity_received" >= 0),
	CONSTRAINT "transfer_lines_cost_chk" CHECK ("transfer_lines"."unit_cost_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"transfer_no" varchar(60) NOT NULL,
	"status" "transfer_status" DEFAULT 'draft' NOT NULL,
	"from_location_id" uuid NOT NULL,
	"transit_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"transfer_date" date DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"dispatched_at" timestamp with time zone,
	"dispatched_by" uuid,
	"received_at" timestamp with time zone,
	"received_by" uuid,
	"dispatch_movement_id" uuid,
	"receipt_movement_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_location_chk" CHECK ("transfers"."from_location_id" <> "transfers"."to_location_id" and "transfers"."from_location_id" <> "transfers"."transit_location_id" and "transfers"."to_location_id" <> "transfers"."transit_location_id"),
	CONSTRAINT "transfers_approved_state_chk" CHECK (
        ("transfers"."status" in ('approved', 'dispatched', 'partially_received', 'received') and "transfers"."approved_at" is not null)
        or ("transfers"."status" = 'draft' and "transfers"."approved_at" is null)
        or ("transfers"."status" = 'cancelled')
      ),
	CONSTRAINT "transfers_dispatched_state_chk" CHECK (
        ("transfers"."status" in ('dispatched', 'partially_received', 'received') and "transfers"."dispatched_at" is not null and "transfers"."dispatch_movement_id" is not null)
        or ("transfers"."status" in ('draft', 'approved', 'cancelled') and "transfers"."dispatched_at" is null)
      )
);
--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_transit_location_id_locations_id_fk" FOREIGN KEY ("transit_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_dispatch_movement_id_stock_movements_id_fk" FOREIGN KEY ("dispatch_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_receipt_movement_id_stock_movements_id_fk" FOREIGN KEY ("receipt_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_lines_no_active_uidx" ON "transfer_lines" USING btree ("transfer_id","line_no") WHERE "transfer_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transfer_lines_product_idx" ON "transfer_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "transfer_lines_serial_idx" ON "transfer_lines" USING btree ("product_serial_id");--> statement-breakpoint
CREATE INDEX "transfer_lines_lot_idx" ON "transfer_lines" USING btree ("product_lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_no_active_uidx" ON "transfers" USING btree ("company_id","transfer_no") WHERE "transfers"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "transfers" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "transfers_from_location_idx" ON "transfers" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX "transfers_to_location_idx" ON "transfers" USING btree ("to_location_id");