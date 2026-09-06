CREATE TABLE "payment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"payment_account_id" uuid NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"reference" varchar(120),
	"note" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_lines_no_chk" CHECK ("payment_lines"."line_no" > 0),
	CONSTRAINT "payment_lines_amount_chk" CHECK ("payment_lines"."amount_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_lines" ADD CONSTRAINT "payment_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_lines" ADD CONSTRAINT "payment_lines_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_lines" ADD CONSTRAINT "payment_lines_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_lines" ADD CONSTRAINT "payment_lines_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_lines_no_active_uidx" ON "payment_lines" USING btree ("payment_id","line_no") WHERE "payment_lines"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "payment_lines_company_idx" ON "payment_lines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payment_lines_payment_idx" ON "payment_lines" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_lines_method_idx" ON "payment_lines" USING btree ("payment_method_id");--> statement-breakpoint
CREATE INDEX "payment_lines_account_idx" ON "payment_lines" USING btree ("payment_account_id");--> statement-breakpoint
INSERT INTO "payment_lines" (
	"id",
	"company_id",
	"payment_id",
	"line_no",
	"payment_method_id",
	"payment_account_id",
	"amount_minor",
	"reference",
	"note",
	"deleted_at",
	"deleted_by",
	"delete_reason",
	"created_at",
	"updated_at"
)
SELECT
	gen_random_uuid(),
	"company_id",
	"id",
	1,
	"payment_method_id",
	"payment_account_id",
	"amount_minor",
	"reference",
	"notes",
	"deleted_at",
	"deleted_by",
	"delete_reason",
	"created_at",
	"updated_at"
FROM "payments" p
WHERE NOT EXISTS (
	SELECT 1
	FROM "payment_lines" pl
	WHERE pl."payment_id" = p."id"
);
