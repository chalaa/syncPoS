CREATE TYPE "public"."goods_receipt_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."landed_cost_allocation_method" AS ENUM('quantity', 'value', 'weight', 'manual');--> statement-breakpoint
CREATE TYPE "public"."landed_cost_status" AS ENUM('draft', 'allocated', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."landed_cost_type" AS ENUM('freight', 'customs', 'insurance', 'handling', 'other');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'confirmed', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."supplier_bill_status" AS ENUM('placeholder', 'pending', 'matched', 'cancelled');--> statement-breakpoint
CREATE TABLE "goods_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"unit_id" uuid NOT NULL,
	"quantity_received" numeric(20, 6) NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"landed_unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"line_total_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"serial_no" varchar(120),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_lines_line_no_chk" CHECK ("goods_receipt_lines"."line_no" > 0),
	CONSTRAINT "goods_receipt_lines_quantity_chk" CHECK ("goods_receipt_lines"."quantity_received" > 0),
	CONSTRAINT "goods_receipt_lines_unit_cost_chk" CHECK ("goods_receipt_lines"."unit_cost_minor" >= 0),
	CONSTRAINT "goods_receipt_lines_landed_cost_chk" CHECK ("goods_receipt_lines"."landed_unit_cost_minor" >= 0),
	CONSTRAINT "goods_receipt_lines_total_chk" CHECK ("goods_receipt_lines"."line_total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"receipt_no" varchar(60) NOT NULL,
	"status" "goods_receipt_status" DEFAULT 'draft' NOT NULL,
	"receipt_date" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"stock_movement_id" uuid,
	"supplier_bill_placeholder_id" uuid,
	"supplier_invoice_no" varchar(80),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_posted_state_chk" CHECK (
        ("goods_receipts"."status" = 'posted' and "goods_receipts"."posted_at" is not null)
        or ("goods_receipts"."status" <> 'posted' and "goods_receipts"."posted_at" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "landed_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landed_cost_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid NOT NULL,
	"allocated_amount_minor" bigint DEFAULT 0 NOT NULL,
	"allocation_basis" numeric(20, 6),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landed_cost_allocations_amount_chk" CHECK ("landed_cost_allocations"."allocated_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "landed_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"goods_receipt_id" uuid,
	"cost_no" varchar(60) NOT NULL,
	"cost_type" "landed_cost_type" DEFAULT 'other' NOT NULL,
	"status" "landed_cost_status" DEFAULT 'draft' NOT NULL,
	"allocation_method" "landed_cost_allocation_method" DEFAULT 'value' NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"vendor_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "landed_costs_amount_chk" CHECK ("landed_costs"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"description" text,
	"unit_id" uuid NOT NULL,
	"quantity_ordered" numeric(20, 6) NOT NULL,
	"quantity_received" numeric(20, 6) DEFAULT '0' NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"line_total_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_lines_line_no_chk" CHECK ("purchase_order_lines"."line_no" > 0),
	CONSTRAINT "purchase_order_lines_quantity_ordered_chk" CHECK ("purchase_order_lines"."quantity_ordered" > 0),
	CONSTRAINT "purchase_order_lines_quantity_received_chk" CHECK ("purchase_order_lines"."quantity_received" >= 0),
	CONSTRAINT "purchase_order_lines_unit_cost_chk" CHECK ("purchase_order_lines"."unit_cost_minor" >= 0),
	CONSTRAINT "purchase_order_lines_total_chk" CHECK ("purchase_order_lines"."line_total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_no" varchar(60) NOT NULL,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"order_date" date DEFAULT now() NOT NULL,
	"expected_date" date,
	"currency_code" char(3) NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"landed_cost_estimate_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_subtotal_chk" CHECK ("purchase_orders"."subtotal_minor" >= 0),
	CONSTRAINT "purchase_orders_landed_estimate_chk" CHECK ("purchase_orders"."landed_cost_estimate_minor" >= 0),
	CONSTRAINT "purchase_orders_total_chk" CHECK ("purchase_orders"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_bill_placeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"bill_no" varchar(80) NOT NULL,
	"status" "supplier_bill_status" DEFAULT 'placeholder' NOT NULL,
	"bill_date" date DEFAULT now() NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_bill_placeholders_amount_chk" CHECK ("supplier_bill_placeholders"."amount_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_bill_placeholder_id_supplier_bill_placeholders_id_fk" FOREIGN KEY ("supplier_bill_placeholder_id") REFERENCES "public"."supplier_bill_placeholders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_landed_cost_id_landed_costs_id_fk" FOREIGN KEY ("landed_cost_id") REFERENCES "public"."landed_costs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_cost_allocations" ADD CONSTRAINT "landed_cost_allocations_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "landed_costs" ADD CONSTRAINT "landed_costs_vendor_id_partners_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_bill_placeholders" ADD CONSTRAINT "supplier_bill_placeholders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_bill_placeholders" ADD CONSTRAINT "supplier_bill_placeholders_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_bill_placeholders" ADD CONSTRAINT "supplier_bill_placeholders_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_bill_placeholders" ADD CONSTRAINT "supplier_bill_placeholders_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_lines_no_active_uidx" ON "goods_receipt_lines" USING btree ("goods_receipt_id","line_no") WHERE "goods_receipt_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "goods_receipt_lines_po_line_idx" ON "goods_receipt_lines" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "goods_receipt_lines_product_idx" ON "goods_receipt_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_no_active_uidx" ON "goods_receipts" USING btree ("company_id","receipt_no") WHERE "goods_receipts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "goods_receipts_po_idx" ON "goods_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_status_idx" ON "goods_receipts" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "goods_receipts_location_date_idx" ON "goods_receipts" USING btree ("location_id","receipt_date");--> statement-breakpoint
CREATE UNIQUE INDEX "landed_cost_allocations_line_active_uidx" ON "landed_cost_allocations" USING btree ("landed_cost_id","goods_receipt_line_id") WHERE "landed_cost_allocations"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "landed_costs_no_active_uidx" ON "landed_costs" USING btree ("company_id","cost_no") WHERE "landed_costs"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "landed_costs_po_idx" ON "landed_costs" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "landed_costs_receipt_idx" ON "landed_costs" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_lines_no_active_uidx" ON "purchase_order_lines" USING btree ("purchase_order_id","line_no") WHERE "purchase_order_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "purchase_order_lines_product_idx" ON "purchase_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_no_active_uidx" ON "purchase_orders" USING btree ("company_id","order_no") WHERE "purchase_orders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "purchase_orders_date_idx" ON "purchase_orders" USING btree ("company_id","order_date");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_bill_placeholders_no_active_uidx" ON "supplier_bill_placeholders" USING btree ("company_id","bill_no") WHERE "supplier_bill_placeholders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "supplier_bill_placeholders_supplier_idx" ON "supplier_bill_placeholders" USING btree ("supplier_id");