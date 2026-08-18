CREATE TYPE "public"."payment_status" AS ENUM('draft', 'posted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"vendor_bill_id" uuid,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_amount_chk" CHECK ("payment_allocations"."amount_minor" > 0),
	CONSTRAINT "payment_allocations_target_chk" CHECK ("payment_allocations"."vendor_bill_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"partner_id" uuid,
	"payment_no" varchar(60) NOT NULL,
	"payment_type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'draft' NOT NULL,
	"payment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"payment_account_id" uuid NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"reference" varchar(120),
	"notes" text,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_chk" CHECK ("payments"."amount_minor" > 0),
	CONSTRAINT "payments_posted_state_chk" CHECK (
        ("payments"."status" = 'posted' and "payments"."posted_at" is not null and "payments"."cancelled_at" is null)
        or ("payments"."status" = 'cancelled' and "payments"."cancelled_at" is not null)
        or ("payments"."status" = 'draft' and "payments"."posted_at" is null and "payments"."cancelled_at" is null)
      )
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_vendor_bill_id_vendor_bills_id_fk" FOREIGN KEY ("vendor_bill_id") REFERENCES "public"."vendor_bills"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_vendor_bill_active_uidx" ON "payment_allocations" USING btree ("payment_id","vendor_bill_id") WHERE "payment_allocations"."deleted_at" is null and "payment_allocations"."vendor_bill_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_vendor_bill_idx" ON "payment_allocations" USING btree ("vendor_bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_no_active_uidx" ON "payments" USING btree ("company_id","payment_no") WHERE "payments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "payments_partner_idx" ON "payments" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("company_id","payment_date");