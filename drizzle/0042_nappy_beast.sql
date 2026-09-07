ALTER TABLE "products" ADD COLUMN "standard_name" varchar(260);--> statement-breakpoint
UPDATE "products"
SET "standard_name" = "name"
WHERE "standard_name" IS NULL;
