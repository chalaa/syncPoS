CREATE TABLE "catalog_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value" varchar(120) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_category_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_template_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"attribute_value_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid,
	"brand_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"unit_id" uuid,
	"tracking_mode" "tracking_mode" DEFAULT 'none' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"attribute_value_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog_attribute_values" ADD CONSTRAINT "catalog_attribute_values_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_attribute_values" ADD CONSTRAINT "catalog_attribute_values_attribute_id_catalog_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."catalog_attributes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_attributes" ADD CONSTRAINT "catalog_attributes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_category_attributes" ADD CONSTRAINT "product_category_attributes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_category_attributes" ADD CONSTRAINT "product_category_attributes_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_category_attributes" ADD CONSTRAINT "product_category_attributes_attribute_id_catalog_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."catalog_attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_template_attribute_values" ADD CONSTRAINT "product_template_attribute_values_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_template_attribute_values" ADD CONSTRAINT "product_template_attribute_values_template_id_product_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_template_attribute_values" ADD CONSTRAINT "product_template_attribute_values_attribute_id_catalog_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."catalog_attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_template_attribute_values" ADD CONSTRAINT "product_template_attribute_values_attribute_value_id_catalog_attribute_values_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."catalog_attribute_values"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_templates" ADD CONSTRAINT "product_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_templates" ADD CONSTRAINT "product_templates_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_templates" ADD CONSTRAINT "product_templates_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_templates" ADD CONSTRAINT "product_templates_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_attribute_id_catalog_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."catalog_attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_attribute_values" ADD CONSTRAINT "product_variant_attribute_values_attribute_value_id_catalog_attribute_values_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."catalog_attribute_values"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_attribute_values_active_uidx" ON "catalog_attribute_values" USING btree ("attribute_id","value") WHERE "catalog_attribute_values"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "catalog_attribute_values_attribute_idx" ON "catalog_attribute_values" USING btree ("attribute_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_attributes_code_active_uidx" ON "catalog_attributes" USING btree ("company_id","code") WHERE "catalog_attributes"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_attributes_name_active_uidx" ON "catalog_attributes" USING btree ("company_id","name") WHERE "catalog_attributes"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_category_attributes_active_uidx" ON "product_category_attributes" USING btree ("category_id","attribute_id") WHERE "product_category_attributes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_category_attributes_category_idx" ON "product_category_attributes" USING btree ("category_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_template_attribute_values_active_uidx" ON "product_template_attribute_values" USING btree ("template_id","attribute_value_id") WHERE "product_template_attribute_values"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_template_attribute_values_template_idx" ON "product_template_attribute_values" USING btree ("template_id","attribute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_templates_name_active_uidx" ON "product_templates" USING btree ("company_id","name") WHERE "product_templates"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_templates_category_idx" ON "product_templates" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_templates_brand_idx" ON "product_templates" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_attribute_values_active_uidx" ON "product_variant_attribute_values" USING btree ("product_id","attribute_id") WHERE "product_variant_attribute_values"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_variant_attribute_values_product_idx" ON "product_variant_attribute_values" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variant_attribute_values_value_idx" ON "product_variant_attribute_values" USING btree ("attribute_value_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_template_id_product_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."product_templates"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "products_template_idx" ON "products" USING btree ("template_id");