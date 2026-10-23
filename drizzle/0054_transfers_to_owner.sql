ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "to_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_owner_id_owners_id_fk" FOREIGN KEY ("to_owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_to_owner_idx" ON "transfers" USING btree ("company_id","to_owner_id");--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD COLUMN IF NOT EXISTS "to_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_to_owner_id_owners_id_fk" FOREIGN KEY ("to_owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_lines_to_owner_idx" ON "transfer_lines" USING btree ("to_owner_id");
