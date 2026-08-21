CREATE TYPE "public"."customer_invoice_payment_status" AS ENUM('not_paid', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."customer_invoice_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('quotation', 'confirmed', 'partially_delivered', 'delivered', 'invoiced', 'cancelled');--> statement-breakpoint
CREATE TABLE "customer_invoice_line_taxes" (
	"customer_invoice_line_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invoice_line_taxes_customer_invoice_line_id_tax_id_pk" PRIMARY KEY("customer_invoice_line_id","tax_id"),
	CONSTRAINT "customer_invoice_line_taxes_amount_chk" CHECK ("customer_invoice_line_taxes"."tax_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_invoice_id" uuid NOT NULL,
	"sales_order_line_id" uuid,
	"delivery_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"unit_price_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"line_total_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invoice_lines_line_no_chk" CHECK ("customer_invoice_lines"."line_no" > 0),
	CONSTRAINT "customer_invoice_lines_quantity_chk" CHECK ("customer_invoice_lines"."quantity" > 0),
	CONSTRAINT "customer_invoice_lines_unit_price_chk" CHECK ("customer_invoice_lines"."unit_price_minor" >= 0),
	CONSTRAINT "customer_invoice_lines_discount_chk" CHECK ("customer_invoice_lines"."discount_minor" >= 0),
	CONSTRAINT "customer_invoice_lines_tax_amount_chk" CHECK ("customer_invoice_lines"."tax_amount_minor" >= 0),
	CONSTRAINT "customer_invoice_lines_total_chk" CHECK ("customer_invoice_lines"."line_total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_order_id" uuid,
	"delivery_id" uuid,
	"customer_id" uuid NOT NULL,
	"invoice_address_id" uuid,
	"invoice_no" varchar(60) NOT NULL,
	"customer_reference" varchar(80),
	"status" "customer_invoice_status" DEFAULT 'draft' NOT NULL,
	"payment_status" "customer_invoice_payment_status" DEFAULT 'not_paid' NOT NULL,
	"invoice_date" date DEFAULT now() NOT NULL,
	"due_date" date,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"currency_code" char(3) NOT NULL,
	"untaxed_amount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_invoices_untaxed_chk" CHECK ("customer_invoices"."untaxed_amount_minor" >= 0),
	CONSTRAINT "customer_invoices_tax_amount_chk" CHECK ("customer_invoices"."tax_amount_minor" >= 0),
	CONSTRAINT "customer_invoices_total_chk" CHECK ("customer_invoices"."total_minor" >= 0),
	CONSTRAINT "customer_invoices_posted_state_chk" CHECK (
        ("customer_invoices"."status" = 'posted' and "customer_invoices"."posted_at" is not null)
        or ("customer_invoices"."status" <> 'posted' and "customer_invoices"."posted_at" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"source_location_id" uuid NOT NULL,
	"delivery_address_id" uuid,
	"delivery_no" varchar(60) NOT NULL,
	"status" "delivery_status" DEFAULT 'draft' NOT NULL,
	"delivery_date" timestamp with time zone DEFAULT now() NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"stock_movement_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_posted_state_chk" CHECK (
        ("deliveries"."status" = 'posted' and "deliveries"."posted_at" is not null and "deliveries"."stock_movement_id" is not null)
        or ("deliveries"."status" <> 'posted' and "deliveries"."posted_at" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "delivery_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"sales_order_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"product_lot_id" uuid,
	"unit_id" uuid NOT NULL,
	"quantity_delivered" numeric(20, 6) NOT NULL,
	"unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"total_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"serial_no" varchar(120),
	"lot_no" varchar(120),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_lines_line_no_chk" CHECK ("delivery_lines"."line_no" > 0),
	CONSTRAINT "delivery_lines_quantity_chk" CHECK ("delivery_lines"."quantity_delivered" > 0),
	CONSTRAINT "delivery_lines_unit_cost_chk" CHECK ("delivery_lines"."unit_cost_minor" >= 0),
	CONSTRAINT "delivery_lines_total_cost_chk" CHECK ("delivery_lines"."total_cost_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_order_line_taxes" (
	"sales_order_line_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_line_taxes_sales_order_line_id_tax_id_pk" PRIMARY KEY("sales_order_line_id","tax_id"),
	CONSTRAINT "sales_order_line_taxes_amount_chk" CHECK ("sales_order_line_taxes"."tax_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"description" text,
	"unit_id" uuid NOT NULL,
	"quantity_ordered" numeric(20, 6) NOT NULL,
	"quantity_reserved" numeric(20, 6) DEFAULT '0' NOT NULL,
	"quantity_delivered" numeric(20, 6) DEFAULT '0' NOT NULL,
	"quantity_invoiced" numeric(20, 6) DEFAULT '0' NOT NULL,
	"unit_price_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"line_total_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_order_lines_line_no_chk" CHECK ("sales_order_lines"."line_no" > 0),
	CONSTRAINT "sales_order_lines_quantity_ordered_chk" CHECK ("sales_order_lines"."quantity_ordered" > 0),
	CONSTRAINT "sales_order_lines_quantity_reserved_chk" CHECK ("sales_order_lines"."quantity_reserved" >= 0),
	CONSTRAINT "sales_order_lines_quantity_delivered_chk" CHECK ("sales_order_lines"."quantity_delivered" >= 0),
	CONSTRAINT "sales_order_lines_quantity_invoiced_chk" CHECK ("sales_order_lines"."quantity_invoiced" >= 0),
	CONSTRAINT "sales_order_lines_unit_price_chk" CHECK ("sales_order_lines"."unit_price_minor" >= 0),
	CONSTRAINT "sales_order_lines_discount_chk" CHECK ("sales_order_lines"."discount_minor" >= 0),
	CONSTRAINT "sales_order_lines_tax_amount_chk" CHECK ("sales_order_lines"."tax_amount_minor" >= 0),
	CONSTRAINT "sales_order_lines_total_chk" CHECK ("sales_order_lines"."line_total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_address_id" uuid,
	"delivery_address_id" uuid,
	"source_location_id" uuid,
	"price_list_id" uuid,
	"order_no" varchar(60) NOT NULL,
	"customer_reference" varchar(80),
	"status" "sales_order_status" DEFAULT 'quotation' NOT NULL,
	"order_date" date DEFAULT now() NOT NULL,
	"valid_until" date,
	"expected_delivery_date" date,
	"currency_code" char(3) NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"reserve_on_confirm" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_orders_subtotal_chk" CHECK ("sales_orders"."subtotal_minor" >= 0),
	CONSTRAINT "sales_orders_tax_amount_chk" CHECK ("sales_orders"."tax_amount_minor" >= 0),
	CONSTRAINT "sales_orders_total_chk" CHECK ("sales_orders"."total_minor" >= 0),
	CONSTRAINT "sales_orders_confirmed_state_chk" CHECK (
        ("sales_orders"."status" in ('confirmed', 'partially_delivered', 'delivered', 'invoiced') and "sales_orders"."confirmed_at" is not null)
        or ("sales_orders"."status" in ('quotation', 'cancelled') and "sales_orders"."confirmed_at" is null)
      )
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_target_chk";--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "customer_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_invoice_line_taxes" ADD CONSTRAINT "customer_invoice_line_taxes_customer_invoice_line_id_customer_invoice_lines_id_fk" FOREIGN KEY ("customer_invoice_line_id") REFERENCES "public"."customer_invoice_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoice_line_taxes" ADD CONSTRAINT "customer_invoice_line_taxes_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_customer_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("customer_invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_delivery_line_id_delivery_lines_id_fk" FOREIGN KEY ("delivery_line_id") REFERENCES "public"."delivery_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_invoice_address_id_partner_addresses_id_fk" FOREIGN KEY ("invoice_address_id") REFERENCES "public"."partner_addresses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_delivery_address_id_partner_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."partner_addresses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_line_taxes" ADD CONSTRAINT "sales_order_line_taxes_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_line_taxes" ADD CONSTRAINT "sales_order_line_taxes_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_invoice_address_id_partner_addresses_id_fk" FOREIGN KEY ("invoice_address_id") REFERENCES "public"."partner_addresses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_delivery_address_id_partner_addresses_id_fk" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."partner_addresses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "customer_invoice_line_taxes_tax_idx" ON "customer_invoice_line_taxes" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_invoice_lines_no_active_uidx" ON "customer_invoice_lines" USING btree ("customer_invoice_id","line_no") WHERE "customer_invoice_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customer_invoice_lines_order_line_idx" ON "customer_invoice_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "customer_invoice_lines_delivery_line_idx" ON "customer_invoice_lines" USING btree ("delivery_line_id");--> statement-breakpoint
CREATE INDEX "customer_invoice_lines_product_idx" ON "customer_invoice_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_invoices_no_active_uidx" ON "customer_invoices" USING btree ("company_id","invoice_no") WHERE "customer_invoices"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customer_invoices_sales_order_idx" ON "customer_invoices" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_delivery_idx" ON "customer_invoices" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_customer_idx" ON "customer_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_invoices_status_idx" ON "customer_invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "customer_invoices_payment_status_idx" ON "customer_invoices" USING btree ("company_id","payment_status");--> statement-breakpoint
CREATE INDEX "customer_invoices_date_idx" ON "customer_invoices" USING btree ("company_id","invoice_date");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_no_active_uidx" ON "deliveries" USING btree ("company_id","delivery_no") WHERE "deliveries"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "deliveries_sales_order_idx" ON "deliveries" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "deliveries_customer_idx" ON "deliveries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "deliveries" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "deliveries_location_date_idx" ON "deliveries" USING btree ("source_location_id","delivery_date");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_lines_no_active_uidx" ON "delivery_lines" USING btree ("delivery_id","line_no") WHERE "delivery_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "delivery_lines_sales_order_line_idx" ON "delivery_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "delivery_lines_product_idx" ON "delivery_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "delivery_lines_serial_idx" ON "delivery_lines" USING btree ("product_serial_id");--> statement-breakpoint
CREATE INDEX "delivery_lines_lot_idx" ON "delivery_lines" USING btree ("product_lot_id");--> statement-breakpoint
CREATE INDEX "sales_order_line_taxes_tax_idx" ON "sales_order_line_taxes" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_order_lines_no_active_uidx" ON "sales_order_lines" USING btree ("sales_order_id","line_no") WHERE "sales_order_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sales_order_lines_product_idx" ON "sales_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_orders_no_active_uidx" ON "sales_orders" USING btree ("company_id","order_no") WHERE "sales_orders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sales_orders_customer_idx" ON "sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_orders_source_location_idx" ON "sales_orders" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_idx" ON "sales_orders" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "sales_orders_date_idx" ON "sales_orders" USING btree ("company_id","order_date");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_customer_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("customer_invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_customer_invoice_active_uidx" ON "payment_allocations" USING btree ("payment_id","customer_invoice_id") WHERE "payment_allocations"."deleted_at" is null and "payment_allocations"."customer_invoice_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_allocations_customer_invoice_idx" ON "payment_allocations" USING btree ("customer_invoice_id");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_target_chk" CHECK (
        (case when "payment_allocations"."vendor_bill_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."expense_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."customer_invoice_id" is not null then 1 else 0 end)
        = 1
      );