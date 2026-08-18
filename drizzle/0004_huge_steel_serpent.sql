CREATE TYPE "public"."stock_count_line_status" AS ENUM('pending', 'counted', 'recount_required', 'approved');--> statement-breakpoint
CREATE TYPE "public"."stock_count_status" AS ENUM('draft', 'in_progress', 'completed', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_status" AS ENUM('draft', 'posted', 'void');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('opening_balance', 'purchase_receipt', 'sale_issue', 'customer_return', 'supplier_return', 'transfer', 'adjustment', 'stock_count');--> statement-breakpoint
CREATE TYPE "public"."stock_reservation_status" AS ENUM('active', 'fulfilled', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"quantity_on_hand" numeric(20, 6) DEFAULT '0' NOT NULL,
	"quantity_reserved" numeric(20, 6) DEFAULT '0' NOT NULL,
	"quantity_available" numeric(20, 6) DEFAULT '0' NOT NULL,
	"average_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"last_movement_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balances_reserved_chk" CHECK ("stock_balances"."quantity_reserved" >= 0),
	CONSTRAINT "stock_balances_average_cost_chk" CHECK ("stock_balances"."average_cost_minor" >= 0),
	CONSTRAINT "stock_balances_available_chk" CHECK ("stock_balances"."quantity_available" = "stock_balances"."quantity_on_hand" - "stock_balances"."quantity_reserved")
);
--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"expected_quantity" numeric(20, 6) DEFAULT '0' NOT NULL,
	"counted_quantity" numeric(20, 6),
	"variance_quantity" numeric(20, 6) DEFAULT '0' NOT NULL,
	"status" "stock_count_line_status" DEFAULT 'pending' NOT NULL,
	"counted_at" timestamp with time zone,
	"counted_by" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_count_lines_line_no_chk" CHECK ("stock_count_lines"."line_no" > 0),
	CONSTRAINT "stock_count_lines_expected_quantity_chk" CHECK ("stock_count_lines"."expected_quantity" >= 0),
	CONSTRAINT "stock_count_lines_counted_quantity_chk" CHECK ("stock_count_lines"."counted_quantity" is null or "stock_count_lines"."counted_quantity" >= 0),
	CONSTRAINT "stock_count_lines_variance_chk" CHECK ("stock_count_lines"."counted_quantity" is null or "stock_count_lines"."variance_quantity" = "stock_count_lines"."counted_quantity" - "stock_count_lines"."expected_quantity")
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"count_no" varchar(60) NOT NULL,
	"status" "stock_count_status" DEFAULT 'draft' NOT NULL,
	"count_date" date DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_counts_completed_range_chk" CHECK ("stock_counts"."completed_at" is null or "stock_counts"."started_at" is null or "stock_counts"."completed_at" >= "stock_counts"."started_at")
);
--> statement-breakpoint
CREATE TABLE "stock_movement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_movement_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"unit_id" uuid NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"total_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_lines_line_no_chk" CHECK ("stock_movement_lines"."line_no" > 0),
	CONSTRAINT "stock_movement_lines_quantity_chk" CHECK ("stock_movement_lines"."quantity" <> 0),
	CONSTRAINT "stock_movement_lines_unit_cost_chk" CHECK ("stock_movement_lines"."unit_cost_minor" >= 0),
	CONSTRAINT "stock_movement_lines_total_cost_chk" CHECK ("stock_movement_lines"."total_cost_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"movement_no" varchar(60) NOT NULL,
	"movement_type" "stock_movement_type" NOT NULL,
	"status" "stock_movement_status" DEFAULT 'draft' NOT NULL,
	"movement_date" timestamp with time zone DEFAULT now() NOT NULL,
	"from_location_id" uuid,
	"to_location_id" uuid,
	"source_type" varchar(80),
	"source_id" uuid,
	"source_no" varchar(80),
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"device_id" uuid,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_location_direction_chk" CHECK (
        (
          "stock_movements"."movement_type" in ('purchase_receipt', 'customer_return', 'opening_balance')
          and "stock_movements"."to_location_id" is not null
        )
        or (
          "stock_movements"."movement_type" in ('sale_issue', 'supplier_return')
          and "stock_movements"."from_location_id" is not null
        )
        or (
          "stock_movements"."movement_type" = 'transfer'
          and "stock_movements"."from_location_id" is not null
          and "stock_movements"."to_location_id" is not null
          and "stock_movements"."from_location_id" <> "stock_movements"."to_location_id"
        )
        or "stock_movements"."movement_type" in ('adjustment', 'stock_count')
      ),
	CONSTRAINT "stock_movements_posted_state_chk" CHECK (
        ("stock_movements"."status" = 'posted' and "stock_movements"."posted_at" is not null)
        or ("stock_movements"."status" <> 'posted' and "stock_movements"."posted_at" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reservation_no" varchar(60) NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"partner_id" uuid,
	"source_type" varchar(80),
	"source_id" uuid,
	"source_no" varchar(80),
	"quantity" numeric(20, 6) NOT NULL,
	"status" "stock_reservation_status" DEFAULT 'active' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_reservations_quantity_chk" CHECK ("stock_reservations"."quantity" > 0),
	CONSTRAINT "stock_reservations_expiry_chk" CHECK ("stock_reservations"."expires_at" is null or "stock_reservations"."expires_at" > "stock_reservations"."reserved_at")
);
--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_location_product_active_uidx" ON "stock_balances" USING btree ("company_id","location_id","product_id",coalesce("product_serial_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "stock_balances"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_balances_product_idx" ON "stock_balances" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_balances_location_idx" ON "stock_balances" USING btree ("company_id","location_id");--> statement-breakpoint
CREATE INDEX "stock_balances_serial_idx" ON "stock_balances" USING btree ("product_serial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_lines_no_active_uidx" ON "stock_count_lines" USING btree ("stock_count_id","line_no") WHERE "stock_count_lines"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_lines_product_active_uidx" ON "stock_count_lines" USING btree ("stock_count_id","product_id",coalesce("product_serial_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "stock_count_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_count_lines_product_idx" ON "stock_count_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_count_lines_serial_idx" ON "stock_count_lines" USING btree ("product_serial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_counts_no_active_uidx" ON "stock_counts" USING btree ("company_id","count_no") WHERE "stock_counts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_counts_location_date_idx" ON "stock_counts" USING btree ("location_id","count_date");--> statement-breakpoint
CREATE INDEX "stock_counts_status_idx" ON "stock_counts" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movement_lines_no_active_uidx" ON "stock_movement_lines" USING btree ("stock_movement_id","line_no") WHERE "stock_movement_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_movement_lines_product_idx" ON "stock_movement_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movement_lines_serial_idx" ON "stock_movement_lines" USING btree ("product_serial_id");--> statement-breakpoint
CREATE INDEX "stock_movement_lines_from_location_idx" ON "stock_movement_lines" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX "stock_movement_lines_to_location_idx" ON "stock_movement_lines" USING btree ("to_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_no_active_uidx" ON "stock_movements" USING btree ("company_id","movement_no") WHERE "stock_movements"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_movements_company_date_idx" ON "stock_movements" USING btree ("company_id","movement_date");--> statement-breakpoint
CREATE INDEX "stock_movements_status_idx" ON "stock_movements" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "stock_movements_source_idx" ON "stock_movements" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "stock_movements_from_location_idx" ON "stock_movements" USING btree ("from_location_id");--> statement-breakpoint
CREATE INDEX "stock_movements_to_location_idx" ON "stock_movements" USING btree ("to_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_no_active_uidx" ON "stock_reservations" USING btree ("company_id","reservation_no") WHERE "stock_reservations"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_reservations_status_idx" ON "stock_reservations" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "stock_reservations_product_location_idx" ON "stock_reservations" USING btree ("product_id","location_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_source_idx" ON "stock_reservations" USING btree ("source_type","source_id");