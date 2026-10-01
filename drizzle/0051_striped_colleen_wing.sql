CREATE TYPE "public"."direct_vendor_sale_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TABLE "direct_vendor_sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direct_vendor_sale_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"description" text,
	"unit_id" uuid NOT NULL,
	"quantity" numeric(20, 6) NOT NULL,
	"vendor_unit_cost_minor" bigint DEFAULT 0 NOT NULL,
	"customer_unit_price_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"vendor_line_total_minor" bigint DEFAULT 0 NOT NULL,
	"customer_line_total_minor" bigint DEFAULT 0 NOT NULL,
	"line_margin_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_vendor_sale_lines_line_no_chk" CHECK ("direct_vendor_sale_lines"."line_no" > 0),
	CONSTRAINT "direct_vendor_sale_lines_quantity_chk" CHECK ("direct_vendor_sale_lines"."quantity" > 0),
	CONSTRAINT "direct_vendor_sale_lines_vendor_unit_cost_chk" CHECK ("direct_vendor_sale_lines"."vendor_unit_cost_minor" >= 0),
	CONSTRAINT "direct_vendor_sale_lines_customer_unit_price_chk" CHECK ("direct_vendor_sale_lines"."customer_unit_price_minor" >= 0),
	CONSTRAINT "direct_vendor_sale_lines_discount_chk" CHECK ("direct_vendor_sale_lines"."discount_minor" >= 0),
	CONSTRAINT "direct_vendor_sale_lines_tax_amount_chk" CHECK ("direct_vendor_sale_lines"."tax_amount_minor" >= 0),
	CONSTRAINT "direct_vendor_sale_lines_vendor_total_chk" CHECK ("direct_vendor_sale_lines"."vendor_line_total_minor" >= 0),
	CONSTRAINT "direct_vendor_sale_lines_customer_total_chk" CHECK ("direct_vendor_sale_lines"."customer_line_total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "direct_vendor_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sale_no" varchar(60) NOT NULL,
	"customer_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"owner_id" uuid,
	"sale_date" date DEFAULT now() NOT NULL,
	"status" "direct_vendor_sale_status" DEFAULT 'draft' NOT NULL,
	"currency_code" char(3) NOT NULL,
	"customer_payment_method_id" uuid,
	"customer_payment_account_id" uuid,
	"customer_payment_reference" varchar(120),
	"vendor_payment_method_id" uuid,
	"vendor_payment_account_id" uuid,
	"vendor_payment_reference" varchar(120),
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"tax_amount_minor" bigint DEFAULT 0 NOT NULL,
	"customer_total_minor" bigint DEFAULT 0 NOT NULL,
	"vendor_cost_total_minor" bigint DEFAULT 0 NOT NULL,
	"margin_minor" bigint DEFAULT 0 NOT NULL,
	"customer_paid_minor" bigint DEFAULT 0 NOT NULL,
	"vendor_paid_minor" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_vendor_sales_subtotal_chk" CHECK ("direct_vendor_sales"."subtotal_minor" >= 0),
	CONSTRAINT "direct_vendor_sales_tax_amount_chk" CHECK ("direct_vendor_sales"."tax_amount_minor" >= 0),
	CONSTRAINT "direct_vendor_sales_customer_total_chk" CHECK ("direct_vendor_sales"."customer_total_minor" >= 0),
	CONSTRAINT "direct_vendor_sales_vendor_cost_chk" CHECK ("direct_vendor_sales"."vendor_cost_total_minor" >= 0),
	CONSTRAINT "direct_vendor_sales_customer_paid_chk" CHECK ("direct_vendor_sales"."customer_paid_minor" >= 0),
	CONSTRAINT "direct_vendor_sales_vendor_paid_chk" CHECK ("direct_vendor_sales"."vendor_paid_minor" >= 0),
	CONSTRAINT "direct_vendor_sales_posted_state_chk" CHECK (
        ("direct_vendor_sales"."status" = 'posted' and "direct_vendor_sales"."posted_at" is not null and "direct_vendor_sales"."cancelled_at" is null)
        or ("direct_vendor_sales"."status" = 'cancelled' and "direct_vendor_sales"."cancelled_at" is not null)
        or ("direct_vendor_sales"."status" = 'draft' and "direct_vendor_sales"."posted_at" is null and "direct_vendor_sales"."cancelled_at" is null)
      ),
	CONSTRAINT "direct_vendor_sales_payment_chk" CHECK (
        (
          "direct_vendor_sales"."status" <> 'posted'
          or (
            "direct_vendor_sales"."customer_payment_method_id" is not null
            and "direct_vendor_sales"."customer_payment_account_id" is not null
            and "direct_vendor_sales"."vendor_payment_method_id" is not null
            and "direct_vendor_sales"."vendor_payment_account_id" is not null
            and "direct_vendor_sales"."customer_paid_minor" = "direct_vendor_sales"."customer_total_minor"
            and "direct_vendor_sales"."vendor_paid_minor" = "direct_vendor_sales"."vendor_cost_total_minor"
          )
        )
      )
);
--> statement-breakpoint
ALTER TABLE "direct_vendor_sale_lines" ADD CONSTRAINT "direct_vendor_sale_lines_direct_vendor_sale_id_direct_vendor_sales_id_fk" FOREIGN KEY ("direct_vendor_sale_id") REFERENCES "public"."direct_vendor_sales"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sale_lines" ADD CONSTRAINT "direct_vendor_sale_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sale_lines" ADD CONSTRAINT "direct_vendor_sale_lines_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sale_lines" ADD CONSTRAINT "direct_vendor_sale_lines_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_customer_id_partners_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_vendor_id_partners_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_customer_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("customer_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_customer_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("customer_payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_vendor_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("vendor_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_vendor_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("vendor_payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "direct_vendor_sale_lines_no_active_uidx" ON "direct_vendor_sale_lines" USING btree ("direct_vendor_sale_id","line_no") WHERE "direct_vendor_sale_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "direct_vendor_sale_lines_product_idx" ON "direct_vendor_sale_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_vendor_sales_no_active_uidx" ON "direct_vendor_sales" USING btree ("company_id","sale_no") WHERE "direct_vendor_sales"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "direct_vendor_sales_customer_idx" ON "direct_vendor_sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "direct_vendor_sales_vendor_idx" ON "direct_vendor_sales" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "direct_vendor_sales_status_idx" ON "direct_vendor_sales" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "direct_vendor_sales_date_idx" ON "direct_vendor_sales" USING btree ("company_id","sale_date");