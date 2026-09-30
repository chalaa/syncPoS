ALTER TABLE "users" ADD COLUMN "phone" varchar(40);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "normalized_phone" varchar(40);--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_phone_active_uidx" ON "users" USING btree ("company_id","normalized_phone") WHERE "users"."normalized_phone" is not null and "users"."deleted_at" is null;