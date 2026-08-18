CREATE TYPE "public"."payment_method_type" AS ENUM('cash', 'bank_transfer', 'mobile_money', 'card');--> statement-breakpoint
CREATE TABLE "payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"institution_name" varchar(120),
	"account_number" varchar(80),
	"opening_balance_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"method_type" "payment_method_type" NOT NULL,
	"allow_inbound" boolean DEFAULT true NOT NULL,
	"allow_outbound" boolean DEFAULT false NOT NULL,
	"requires_reference" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_methods_direction_chk" CHECK ("payment_methods"."allow_inbound" = true or "payment_methods"."allow_outbound" = true)
);
--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_accounts_code_active_uidx" ON "payment_accounts" USING btree ("company_id","code") WHERE "payment_accounts"."deleted_at" is null and "payment_accounts"."is_active" = true;--> statement-breakpoint
CREATE INDEX "payment_accounts_method_idx" ON "payment_accounts" USING btree ("payment_method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_methods_code_active_uidx" ON "payment_methods" USING btree ("company_id","code") WHERE "payment_methods"."deleted_at" is null and "payment_methods"."is_active" = true;--> statement-breakpoint
CREATE INDEX "payment_methods_type_idx" ON "payment_methods" USING btree ("company_id","method_type");