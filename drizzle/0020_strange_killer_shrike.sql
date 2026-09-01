DROP INDEX "products_barcode_active_uidx";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "barcode";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "product_type";--> statement-breakpoint
DROP TYPE "public"."product_type";