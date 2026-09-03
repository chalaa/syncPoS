CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_name_not_empty_chk" CHECK (length(trim("owners"."name")) > 0)
);
--> statement-breakpoint
DROP INDEX "stock_balances_location_product_active_uidx";--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "owners_company_name_active_uidx" ON "owners" USING btree ("company_id","name") WHERE "owners"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "owners_company_name_idx" ON "owners" USING btree ("company_id","name");--> statement-breakpoint
INSERT INTO "owners" ("id", "company_id", "name")
SELECT
  CASE
    WHEN "companies"."id" = '11111111-1111-4111-8111-111111111111'::uuid
      THEN '10101010-1010-4101-8101-101010101010'::uuid
    ELSE gen_random_uuid()
  END,
  "companies"."id",
  'Main Owner'
FROM "companies"
WHERE "companies"."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "owners"
    WHERE "owners"."company_id" = "companies"."id"
      AND "owners"."name" = 'Main Owner'
      AND "owners"."deleted_at" IS NULL
  );--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
UPDATE "purchase_orders"
SET "owner_id" = "owners"."id"
FROM "owners"
WHERE "purchase_orders"."company_id" = "owners"."company_id"
  AND "owners"."name" = 'Main Owner'
  AND "owners"."deleted_at" IS NULL
  AND "purchase_orders"."owner_id" IS NULL;--> statement-breakpoint
UPDATE "sales_orders"
SET "owner_id" = "owners"."id"
FROM "owners"
WHERE "sales_orders"."company_id" = "owners"."company_id"
  AND "owners"."name" = 'Main Owner'
  AND "owners"."deleted_at" IS NULL
  AND "sales_orders"."owner_id" IS NULL;--> statement-breakpoint
UPDATE "stock_movements"
SET "owner_id" = "owners"."id"
FROM "owners"
WHERE "stock_movements"."company_id" = "owners"."company_id"
  AND "owners"."name" = 'Main Owner'
  AND "owners"."deleted_at" IS NULL
  AND "stock_movements"."owner_id" IS NULL;--> statement-breakpoint
UPDATE "stock_movement_lines"
SET "owner_id" = "stock_movements"."owner_id"
FROM "stock_movements"
WHERE "stock_movement_lines"."stock_movement_id" = "stock_movements"."id"
  AND "stock_movement_lines"."owner_id" IS NULL
  AND "stock_movements"."owner_id" IS NOT NULL;--> statement-breakpoint
UPDATE "stock_balances"
SET "owner_id" = "owners"."id"
FROM "owners"
WHERE "stock_balances"."company_id" = "owners"."company_id"
  AND "owners"."name" = 'Main Owner'
  AND "owners"."deleted_at" IS NULL
  AND "stock_balances"."owner_id" IS NULL;--> statement-breakpoint
CREATE INDEX "purchase_orders_owner_idx" ON "purchase_orders" USING btree ("company_id","owner_id");--> statement-breakpoint
CREATE INDEX "sales_orders_owner_idx" ON "sales_orders" USING btree ("company_id","owner_id");--> statement-breakpoint
CREATE INDEX "stock_balances_owner_idx" ON "stock_balances" USING btree ("company_id","owner_id");--> statement-breakpoint
CREATE INDEX "stock_movement_lines_owner_idx" ON "stock_movement_lines" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "stock_movements_owner_idx" ON "stock_movements" USING btree ("company_id","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_location_product_active_uidx" ON "stock_balances" USING btree ("company_id","location_id","product_id",coalesce("owner_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("product_serial_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("product_lot_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "stock_balances"."deleted_at" is null;
