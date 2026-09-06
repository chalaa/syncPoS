DROP TABLE "product_variant_attribute_values" CASCADE;--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_template_id_product_templates_id_fk";
--> statement-breakpoint
DROP INDEX "products_template_idx";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "template_id";--> statement-breakpoint
DROP TABLE "product_template_attribute_values" CASCADE;--> statement-breakpoint
DROP TABLE "product_category_attributes" CASCADE;--> statement-breakpoint
DROP TABLE "catalog_attribute_values" CASCADE;--> statement-breakpoint
DROP TABLE "catalog_attributes" CASCADE;--> statement-breakpoint
DROP TABLE "product_templates" CASCADE;
