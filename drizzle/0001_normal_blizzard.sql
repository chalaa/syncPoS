CREATE TYPE "public"."compatibility_type" AS ENUM('compatible', 'substitute', 'accessory', 'bundle', 'upsell');--> statement-breakpoint
CREATE TYPE "public"."price_list_type" AS ENUM('retail', 'wholesale', 'customer_specific', 'location_specific');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('machinery', 'spare_part', 'accessory', 'consumable', 'service');--> statement-breakpoint
CREATE TYPE "public"."serial_status" AS ENUM('available', 'reserved', 'in_transit', 'sold', 'returned', 'damaged', 'scrapped');--> statement-breakpoint
CREATE TYPE "public"."tracking_mode" AS ENUM('none', 'lot', 'serial');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"price_list_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"minimum_quantity" numeric(20, 6) DEFAULT '1' NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_items_minimum_quantity_chk" CHECK ("price_list_items"."minimum_quantity" > 0),
	CONSTRAINT "price_list_items_unit_price_minor_chk" CHECK ("price_list_items"."unit_price_minor" >= 0),
	CONSTRAINT "price_list_items_discount_minor_chk" CHECK ("price_list_items"."discount_minor" >= 0),
	CONSTRAINT "price_list_items_date_range_chk" CHECK ("price_list_items"."valid_to" is null or "price_list_items"."valid_to" >= "price_list_items"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"price_list_type" "price_list_type" DEFAULT 'retail' NOT NULL,
	"currency_code" char(3) NOT NULL,
	"valid_from" date,
	"valid_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_lists_date_range_chk" CHECK ("price_lists"."valid_to" is null or "price_lists"."valid_from" is null or "price_lists"."valid_to" >= "price_lists"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"attribute_name" varchar(80) NOT NULL,
	"attribute_value" varchar(200) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_compatibilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"related_product_id" uuid NOT NULL,
	"compatibility_type" "compatibility_type" DEFAULT 'compatible' NOT NULL,
	"notes" text,
	"effective_from" date,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_compatibilities_not_self_chk" CHECK ("product_compatibilities"."product_id" <> "product_compatibilities"."related_product_id"),
	CONSTRAINT "product_compatibilities_date_range_chk" CHECK ("product_compatibilities"."effective_to" is null or "product_compatibilities"."effective_from" is null or "product_compatibilities"."effective_to" >= "product_compatibilities"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "product_serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"serial_no" varchar(120) NOT NULL,
	"engine_no" varchar(120),
	"chassis_no" varchar(120),
	"status" serial_status DEFAULT 'available' NOT NULL,
	"current_location_id" uuid,
	"landed_unit_cost_minor" bigint,
	"warranty_start_date" date,
	"warranty_end_date" date,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sku" varchar(60) NOT NULL,
	"barcode" varchar(80),
	"name" varchar(200) NOT NULL,
	"category_id" uuid,
	"brand_id" uuid,
	"model" varchar(100),
	"description" text,
	"unit_id" uuid NOT NULL,
	"product_type" "product_type" NOT NULL,
	"tracking_mode" "tracking_mode" DEFAULT 'none' NOT NULL,
	"standard_cost_minor" bigint DEFAULT 0 NOT NULL,
	"list_price_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_standard_cost_minor_chk" CHECK ("products"."standard_cost_minor" >= 0),
	CONSTRAINT "products_list_price_minor_chk" CHECK ("products"."list_price_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(80) NOT NULL,
	"precision" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_of_measure_precision_chk" CHECK ("units_of_measure"."precision" between 0 and 6)
);
--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_category_id_product_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_compatibilities" ADD CONSTRAINT "product_compatibilities_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_compatibilities" ADD CONSTRAINT "product_compatibilities_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_current_location_id_locations_id_fk" FOREIGN KEY ("current_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_code_active_uidx" ON "brands" USING btree ("company_id","code") WHERE "brands"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_active_uidx" ON "brands" USING btree ("company_id","name") WHERE "brands"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "price_list_items_product_date_active_uidx" ON "price_list_items" USING btree ("price_list_id","product_id","minimum_quantity","valid_from") WHERE "price_list_items"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "price_list_items_product_idx" ON "price_list_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "price_lists_code_active_uidx" ON "price_lists" USING btree ("company_id","code") WHERE "price_lists"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "price_lists_location_active_idx" ON "price_lists" USING btree ("location_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "product_attributes_name_active_uidx" ON "product_attributes" USING btree ("product_id","attribute_name") WHERE "product_attributes"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_code_active_uidx" ON "product_categories" USING btree ("company_id","code") WHERE "product_categories"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_name_active_uidx" ON "product_categories" USING btree ("company_id",coalesce("parent_category_id", '00000000-0000-0000-0000-000000000000'::uuid),"name") WHERE "product_categories"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_categories_company_name_idx" ON "product_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "product_categories_parent_idx" ON "product_categories" USING btree ("parent_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_compatibilities_active_uidx" ON "product_compatibilities" USING btree ("product_id","related_product_id","compatibility_type") WHERE "product_compatibilities"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_serials_serial_no_uidx" ON "product_serials" USING btree ("serial_no");--> statement-breakpoint
CREATE UNIQUE INDEX "product_serials_engine_no_uidx" ON "product_serials" USING btree ("engine_no") WHERE "product_serials"."engine_no" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_serials_chassis_no_uidx" ON "product_serials" USING btree ("chassis_no") WHERE "product_serials"."chassis_no" is not null;--> statement-breakpoint
CREATE INDEX "product_serials_product_status_location_idx" ON "product_serials" USING btree ("product_id","status","current_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_active_uidx" ON "products" USING btree ("company_id","sku") WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_barcode_active_uidx" ON "products" USING btree ("company_id","barcode") WHERE "products"."barcode" is not null and "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_company_name_idx" ON "products" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "products_category_active_idx" ON "products" USING btree ("category_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "units_of_measure_code_active_uidx" ON "units_of_measure" USING btree ("company_id","code") WHERE "units_of_measure"."deleted_at" is null;