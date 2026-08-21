CREATE TYPE "public"."refund_placeholder_status" AS ENUM('pending', 'approved', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."return_document_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."return_line_condition" AS ENUM('available', 'returned', 'damaged', 'scrapped');--> statement-breakpoint
CREATE TYPE "public"."serial_ownership_type" AS ENUM('sale', 'customer_return', 'warranty_registration', 'supplier_return');--> statement-breakpoint
CREATE TYPE "public"."warranty_status" AS ENUM('active', 'expired', 'void');--> statement-breakpoint
CREATE TABLE "customer_refund_placeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_return_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"refund_no" varchar(60) NOT NULL,
	"status" "refund_placeholder_status" DEFAULT 'pending' NOT NULL,
	"refund_date" date DEFAULT now() NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_refund_placeholders_amount_chk" CHECK ("customer_refund_placeholders"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_return_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_return_id" uuid NOT NULL,
	"sales_order_line_id" uuid,
	"delivery_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"product_lot_id" uuid,
	"unit_id" uuid NOT NULL,
	"quantity_returned" numeric(20, 6) NOT NULL,
	"condition" "return_line_condition" DEFAULT 'returned' NOT NULL,
	"refund_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"serial_no" varchar(120),
	"lot_no" varchar(120),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_return_lines_line_no_chk" CHECK ("customer_return_lines"."line_no" > 0),
	CONSTRAINT "customer_return_lines_quantity_chk" CHECK ("customer_return_lines"."quantity_returned" > 0),
	CONSTRAINT "customer_return_lines_refund_chk" CHECK ("customer_return_lines"."refund_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"delivery_id" uuid,
	"customer_invoice_id" uuid,
	"customer_id" uuid NOT NULL,
	"return_no" varchar(60) NOT NULL,
	"status" "return_document_status" DEFAULT 'draft' NOT NULL,
	"return_date" date DEFAULT now() NOT NULL,
	"refund_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"stock_movement_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_returns_refund_chk" CHECK ("customer_returns"."refund_amount_minor" >= 0),
	CONSTRAINT "customer_returns_posted_state_chk" CHECK (
        ("customer_returns"."status" = 'posted' and "customer_returns"."posted_at" is not null and "customer_returns"."stock_movement_id" is not null)
        or ("customer_returns"."status" <> 'posted' and "customer_returns"."posted_at" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "serial_ownership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_serial_id" uuid NOT NULL,
	"partner_id" uuid,
	"ownership_type" serial_ownership_type NOT NULL,
	"source_type" varchar(80) NOT NULL,
	"source_id" uuid NOT NULL,
	"source_no" varchar(80) NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_return_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_return_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid,
	"purchase_order_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_serial_id" uuid,
	"product_lot_id" uuid,
	"unit_id" uuid NOT NULL,
	"quantity_returned" numeric(20, 6) NOT NULL,
	"condition" "return_line_condition" DEFAULT 'returned' NOT NULL,
	"refund_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"serial_no" varchar(120),
	"lot_no" varchar(120),
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_return_lines_line_no_chk" CHECK ("supplier_return_lines"."line_no" > 0),
	CONSTRAINT "supplier_return_lines_quantity_chk" CHECK ("supplier_return_lines"."quantity_returned" > 0),
	CONSTRAINT "supplier_return_lines_refund_chk" CHECK ("supplier_return_lines"."refund_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"goods_receipt_id" uuid NOT NULL,
	"vendor_bill_id" uuid,
	"supplier_id" uuid NOT NULL,
	"return_no" varchar(60) NOT NULL,
	"status" "return_document_status" DEFAULT 'draft' NOT NULL,
	"return_date" date DEFAULT now() NOT NULL,
	"refund_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"source_location_id" uuid NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"stock_movement_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_returns_refund_chk" CHECK ("supplier_returns"."refund_amount_minor" >= 0),
	CONSTRAINT "supplier_returns_posted_state_chk" CHECK (
        ("supplier_returns"."status" = 'posted' and "supplier_returns"."posted_at" is not null and "supplier_returns"."stock_movement_id" is not null)
        or ("supplier_returns"."status" <> 'posted' and "supplier_returns"."posted_at" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "vendor_refund_placeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_return_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"refund_no" varchar(60) NOT NULL,
	"status" "refund_placeholder_status" DEFAULT 'pending' NOT NULL,
	"refund_date" date DEFAULT now() NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_refund_placeholders_amount_chk" CHECK ("vendor_refund_placeholders"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "warranty_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_serial_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"sales_order_id" uuid,
	"delivery_id" uuid,
	"customer_invoice_id" uuid,
	"warranty_no" varchar(60) NOT NULL,
	"status" "warranty_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warranty_registrations_date_chk" CHECK ("warranty_registrations"."end_date" >= "warranty_registrations"."start_date")
);
--> statement-breakpoint
ALTER TABLE "customer_refund_placeholders" ADD CONSTRAINT "customer_refund_placeholders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_refund_placeholders" ADD CONSTRAINT "customer_refund_placeholders_customer_return_id_customer_returns_id_fk" FOREIGN KEY ("customer_return_id") REFERENCES "public"."customer_returns"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_refund_placeholders" ADD CONSTRAINT "customer_refund_placeholders_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_refund_placeholders" ADD CONSTRAINT "customer_refund_placeholders_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_customer_return_id_customer_returns_id_fk" FOREIGN KEY ("customer_return_id") REFERENCES "public"."customer_returns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_delivery_line_id_delivery_lines_id_fk" FOREIGN KEY ("delivery_line_id") REFERENCES "public"."delivery_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD CONSTRAINT "customer_return_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_customer_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("customer_invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_destination_location_id_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "customer_returns" ADD CONSTRAINT "customer_returns_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "serial_ownership_history" ADD CONSTRAINT "serial_ownership_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "serial_ownership_history" ADD CONSTRAINT "serial_ownership_history_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "serial_ownership_history" ADD CONSTRAINT "serial_ownership_history_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_supplier_return_id_supplier_returns_id_fk" FOREIGN KEY ("supplier_return_id") REFERENCES "public"."supplier_returns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_product_lot_id_product_lots_id_fk" FOREIGN KEY ("product_lot_id") REFERENCES "public"."product_lots"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_return_lines" ADD CONSTRAINT "supplier_return_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_vendor_bill_id_vendor_bills_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_refund_placeholders" ADD CONSTRAINT "vendor_refund_placeholders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_refund_placeholders" ADD CONSTRAINT "vendor_refund_placeholders_supplier_return_id_supplier_returns_id_fk" FOREIGN KEY ("supplier_return_id") REFERENCES "public"."supplier_returns"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_refund_placeholders" ADD CONSTRAINT "vendor_refund_placeholders_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_refund_placeholders" ADD CONSTRAINT "vendor_refund_placeholders_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_product_serial_id_product_serials_id_fk" FOREIGN KEY ("product_serial_id") REFERENCES "public"."product_serials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "warranty_registrations" ADD CONSTRAINT "warranty_registrations_customer_invoice_id_customer_invoices_id_fk" FOREIGN KEY ("customer_invoice_id") REFERENCES "public"."customer_invoices"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_refund_placeholders_no_active_uidx" ON "customer_refund_placeholders" USING btree ("company_id","refund_no") WHERE "customer_refund_placeholders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customer_refund_placeholders_return_idx" ON "customer_refund_placeholders" USING btree ("customer_return_id");--> statement-breakpoint
CREATE INDEX "customer_refund_placeholders_customer_idx" ON "customer_refund_placeholders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_return_lines_no_active_uidx" ON "customer_return_lines" USING btree ("customer_return_id","line_no") WHERE "customer_return_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customer_return_lines_sales_order_line_idx" ON "customer_return_lines" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "customer_return_lines_delivery_line_idx" ON "customer_return_lines" USING btree ("delivery_line_id");--> statement-breakpoint
CREATE INDEX "customer_return_lines_product_idx" ON "customer_return_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "customer_return_lines_serial_idx" ON "customer_return_lines" USING btree ("product_serial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_returns_no_active_uidx" ON "customer_returns" USING btree ("company_id","return_no") WHERE "customer_returns"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "customer_returns_sales_order_idx" ON "customer_returns" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "customer_returns_delivery_idx" ON "customer_returns" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "customer_returns_invoice_idx" ON "customer_returns" USING btree ("customer_invoice_id");--> statement-breakpoint
CREATE INDEX "customer_returns_customer_idx" ON "customer_returns" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_returns_status_idx" ON "customer_returns" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "serial_ownership_history_serial_idx" ON "serial_ownership_history" USING btree ("product_serial_id","effective_at");--> statement-breakpoint
CREATE INDEX "serial_ownership_history_partner_idx" ON "serial_ownership_history" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "serial_ownership_history_source_idx" ON "serial_ownership_history" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_return_lines_no_active_uidx" ON "supplier_return_lines" USING btree ("supplier_return_id","line_no") WHERE "supplier_return_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "supplier_return_lines_receipt_line_idx" ON "supplier_return_lines" USING btree ("goods_receipt_line_id");--> statement-breakpoint
CREATE INDEX "supplier_return_lines_purchase_order_line_idx" ON "supplier_return_lines" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "supplier_return_lines_product_idx" ON "supplier_return_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_return_lines_serial_idx" ON "supplier_return_lines" USING btree ("product_serial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_returns_no_active_uidx" ON "supplier_returns" USING btree ("company_id","return_no") WHERE "supplier_returns"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "supplier_returns_purchase_order_idx" ON "supplier_returns" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "supplier_returns_receipt_idx" ON "supplier_returns" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "supplier_returns_vendor_bill_idx" ON "supplier_returns" USING btree ("vendor_bill_id");--> statement-breakpoint
CREATE INDEX "supplier_returns_supplier_idx" ON "supplier_returns" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_refund_placeholders_no_active_uidx" ON "vendor_refund_placeholders" USING btree ("company_id","refund_no") WHERE "vendor_refund_placeholders"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vendor_refund_placeholders_return_idx" ON "vendor_refund_placeholders" USING btree ("supplier_return_id");--> statement-breakpoint
CREATE INDEX "vendor_refund_placeholders_supplier_idx" ON "vendor_refund_placeholders" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warranty_registrations_no_active_uidx" ON "warranty_registrations" USING btree ("company_id","warranty_no") WHERE "warranty_registrations"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "warranty_registrations_serial_active_uidx" ON "warranty_registrations" USING btree ("product_serial_id") WHERE "warranty_registrations"."deleted_at" is null and "warranty_registrations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "warranty_registrations_customer_idx" ON "warranty_registrations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "warranty_registrations_sales_order_idx" ON "warranty_registrations" USING btree ("sales_order_id");