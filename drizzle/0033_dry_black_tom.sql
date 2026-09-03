ALTER TABLE "transfer_lines" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_lines" ADD CONSTRAINT "transfer_lines_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "transfer_lines_owner_idx" ON "transfer_lines" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "transfers_owner_idx" ON "transfers" USING btree ("company_id","owner_id");