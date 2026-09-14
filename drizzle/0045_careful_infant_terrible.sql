CREATE TYPE "public"."payment_verification_status" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TABLE "payment_line_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_line_id" uuid NOT NULL,
	"provider" varchar(40) DEFAULT 'verify_et' NOT NULL,
	"provider_request_id" varchar(120),
	"bank" varchar(40) NOT NULL,
	"reference" varchar(120) NOT NULL,
	"settlement_account" varchar(120),
	"status" "payment_verification_status" DEFAULT 'pending' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"amount_minor" bigint,
	"currency_code" char(3),
	"sender_name" varchar(200),
	"receiver_name" varchar(200),
	"receiver_account" varchar(120),
	"settlement_matched" boolean,
	"raw_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "verify_et_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "verify_et_bank" varchar(40);--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD COLUMN "verify_et_settlement_account" varchar(120);--> statement-breakpoint
ALTER TABLE "payment_line_verifications" ADD CONSTRAINT "payment_line_verifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_line_verifications" ADD CONSTRAINT "payment_line_verifications_payment_line_id_payment_lines_id_fk" FOREIGN KEY ("payment_line_id") REFERENCES "public"."payment_lines"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "payment_line_verifications_company_idx" ON "payment_line_verifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "payment_line_verifications_line_idx" ON "payment_line_verifications" USING btree ("payment_line_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_line_verifications_provider_request_idx" ON "payment_line_verifications" USING btree ("provider","provider_request_id");