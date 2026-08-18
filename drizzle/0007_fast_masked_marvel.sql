CREATE TYPE "public"."tax_computation" AS ENUM('percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."tax_scope" AS ENUM('purchase', 'sale', 'both');--> statement-breakpoint
CREATE TYPE "public"."vendor_bill_payment_status" AS ENUM('not_paid', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."vendor_bill_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TABLE "purchase_order_line_taxes" (
	"purchase_order_line_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_line_taxes_pk" PRIMARY KEY("purchase_order_line_id","tax_id"),
	CONSTRAINT "purchase_order_line_taxes_amount_chk" CHECK ("purchase_order_line_taxes"."tax_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tax_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tax_group_id" uuid,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"scope" "tax_scope" DEFAULT 'purchase' NOT NULL,
	"computation" "tax_computation" DEFAULT 'percent' NOT NULL,
	"rate" numeric(9, 4) DEFAULT '0' NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"price_included" boolean DEFAULT false NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taxes_rate_chk" CHECK ("taxes"."rate" >= 0),
	CONSTRAINT "taxes_amount_chk" CHECK ("taxes"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_bill_line_taxes" (
	"vendor_bill_line_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_bill_line_taxes_pk" PRIMARY KEY("vendor_bill_line_id","tax_id"),
	CONSTRAINT "vendor_bill_line_taxes_amount_chk" CHECK ("vendor_bill_line_taxes"."tax_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_bill_id" uuid NOT NULL,
	"purchase_order_line_id" uuid,
	"goods_receipt_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"unit_id" uuid,
	"quantity" numeric(20, 6) NOT NULL,
	"unit_price_minor" bigint DEFAULT 0 NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_bill_lines_line_no_chk" CHECK ("vendor_bill_lines"."line_no" > 0),
	CONSTRAINT "vendor_bill_lines_quantity_chk" CHECK ("vendor_bill_lines"."quantity" > 0),
	CONSTRAINT "vendor_bill_lines_unit_price_chk" CHECK ("vendor_bill_lines"."unit_price_minor" >= 0),
	CONSTRAINT "vendor_bill_lines_subtotal_chk" CHECK ("vendor_bill_lines"."subtotal_minor" >= 0),
	CONSTRAINT "vendor_bill_lines_tax_chk" CHECK ("vendor_bill_lines"."tax_amount_minor" >= 0),
	CONSTRAINT "vendor_bill_lines_total_chk" CHECK ("vendor_bill_lines"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"goods_receipt_id" uuid,
	"bill_no" varchar(80) NOT NULL,
	"vendor_reference" varchar(120),
	"status" "vendor_bill_status" DEFAULT 'draft' NOT NULL,
	"payment_status" "vendor_bill_payment_status" DEFAULT 'not_paid' NOT NULL,
	"bill_date" date DEFAULT now() NOT NULL,
	"accounting_date" date,
	"due_date" date,
	"untaxed_amount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_bills_untaxed_chk" CHECK ("vendor_bills"."untaxed_amount_minor" >= 0),
	CONSTRAINT "vendor_bills_tax_chk" CHECK ("vendor_bills"."tax_amount_minor" >= 0),
	CONSTRAINT "vendor_bills_total_chk" CHECK ("vendor_bills"."total_minor" >= 0),
	CONSTRAINT "vendor_bills_posted_state_chk" CHECK (
        ("vendor_bills"."status" = 'posted' and "vendor_bills"."posted_at" is not null)
        or ("vendor_bills"."status" <> 'posted' and "vendor_bills"."posted_at" is null)
      )
);
--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "tax_amount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "tax_amount_minor" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_line_taxes" ADD CONSTRAINT "purchase_order_line_taxes_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "purchase_order_line_taxes" ADD CONSTRAINT "purchase_order_line_taxes_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tax_groups" ADD CONSTRAINT "tax_groups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_tax_group_id_tax_groups_id_fk" FOREIGN KEY ("tax_group_id") REFERENCES "public"."tax_groups"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_line_taxes" ADD CONSTRAINT "vendor_bill_line_taxes_vendor_bill_line_id_vendor_bill_lines_id_fk" FOREIGN KEY ("vendor_bill_line_id") REFERENCES "public"."vendor_bill_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_line_taxes" ADD CONSTRAINT "vendor_bill_line_taxes_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_vendor_bill_id_vendor_bills_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_supplier_id_partners_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "public"."goods_receipts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "purchase_order_line_taxes_tax_idx" ON "purchase_order_line_taxes" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_groups_code_active_uidx" ON "tax_groups" USING btree ("company_id","code") WHERE "tax_groups"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_groups_name_active_uidx" ON "tax_groups" USING btree ("company_id","name") WHERE "tax_groups"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "taxes_code_active_uidx" ON "taxes" USING btree ("company_id","code") WHERE "taxes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "taxes_group_idx" ON "taxes" USING btree ("tax_group_id");--> statement-breakpoint
CREATE INDEX "taxes_scope_active_idx" ON "taxes" USING btree ("company_id","scope","is_active");--> statement-breakpoint
CREATE INDEX "vendor_bill_line_taxes_tax_idx" ON "vendor_bill_line_taxes" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_bill_lines_no_active_uidx" ON "vendor_bill_lines" USING btree ("vendor_bill_id","line_no") WHERE "vendor_bill_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_po_line_idx" ON "vendor_bill_lines" USING btree ("purchase_order_line_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_receipt_line_idx" ON "vendor_bill_lines" USING btree ("goods_receipt_line_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_product_idx" ON "vendor_bill_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_bills_no_active_uidx" ON "vendor_bills" USING btree ("company_id","bill_no") WHERE "vendor_bills"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_bills_vendor_reference_active_uidx" ON "vendor_bills" USING btree ("company_id","supplier_id","vendor_reference") WHERE "vendor_bills"."vendor_reference" is not null and "vendor_bills"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vendor_bills_supplier_idx" ON "vendor_bills" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_po_idx" ON "vendor_bills" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_receipt_idx" ON "vendor_bills" USING btree ("goods_receipt_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_status_idx" ON "vendor_bills" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "vendor_bills_date_idx" ON "vendor_bills" USING btree ("company_id","bill_date");--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_amount_chk" CHECK ("purchase_order_lines"."tax_amount_minor" >= 0);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tax_amount_chk" CHECK ("purchase_orders"."tax_amount_minor" >= 0);