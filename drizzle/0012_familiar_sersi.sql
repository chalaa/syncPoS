CREATE TYPE "public"."expense_payment_status" AS ENUM('unpaid', 'paid');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('posted', 'cancelled');--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"employee_id" uuid,
	"vendor_id" uuid,
	"location_id" uuid,
	"expense_no" varchar(60) NOT NULL,
	"status" "expense_status" DEFAULT 'posted' NOT NULL,
	"payment_status" "expense_payment_status" DEFAULT 'unpaid' NOT NULL,
	"expense_date" date DEFAULT now() NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"description" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_chk" CHECK ("expenses"."amount_minor" > 0),
	CONSTRAINT "expenses_cancelled_state_chk" CHECK (
        ("expenses"."status" = 'cancelled' and "expenses"."cancelled_at" is not null)
        or ("expenses"."status" <> 'cancelled' and "expenses"."cancelled_at" is null)
      )
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_target_chk";--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "expense_id" uuid;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_partners_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_code_active_uidx" ON "expense_categories" USING btree ("company_id","code") WHERE "expense_categories"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_no_active_uidx" ON "expenses" USING btree ("company_id","expense_no") WHERE "expenses"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_vendor_idx" ON "expenses" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "expenses_employee_idx" ON "expenses" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "expenses_location_idx" ON "expenses" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "expenses_status_idx" ON "expenses" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("company_id","expense_date");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_expense_active_uidx" ON "payment_allocations" USING btree ("payment_id","expense_id") WHERE "payment_allocations"."deleted_at" is null and "payment_allocations"."expense_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_allocations_expense_idx" ON "payment_allocations" USING btree ("expense_id");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_target_chk" CHECK (
        (case when "payment_allocations"."vendor_bill_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."expense_id" is not null then 1 else 0 end)
        = 1
      );