CREATE TYPE "public"."address_type" AS ENUM('billing', 'delivery', 'office', 'warehouse');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('active', 'blocked', 'inactive');--> statement-breakpoint
CREATE TABLE "partner_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"address_type" "address_type" DEFAULT 'office' NOT NULL,
	"label" varchar(100),
	"line1" varchar(200) NOT NULL,
	"line2" varchar(200),
	"city" varchar(120),
	"region" varchar(120),
	"country" varchar(120) DEFAULT 'Ethiopia' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"role_title" varchar(100),
	"phone" varchar(40),
	"email" varchar(160),
	"is_primary" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"legal_name" varchar(200),
	"tin" varchar(30),
	"is_customer" boolean DEFAULT false NOT NULL,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"payment_term_id" uuid,
	"credit_limit_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" char(3) NOT NULL,
	"status" "partner_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_role_chk" CHECK ("partners"."is_customer" = true or "partners"."is_supplier" = true),
	CONSTRAINT "partners_credit_limit_minor_chk" CHECK ("partners"."credit_limit_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"due_days" smallint DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_terms_due_days_chk" CHECK ("payment_terms"."due_days" >= 0)
);
--> statement-breakpoint
ALTER TABLE "partner_addresses" ADD CONSTRAINT "partner_addresses_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_payment_term_id_payment_terms_id_fk" FOREIGN KEY ("payment_term_id") REFERENCES "public"."payment_terms"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_addresses_primary_type_active_uidx" ON "partner_addresses" USING btree ("partner_id","address_type") WHERE "partner_addresses"."is_primary" = true and "partner_addresses"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "partner_addresses_partner_idx" ON "partner_addresses" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_contacts_primary_active_uidx" ON "partner_contacts" USING btree ("partner_id") WHERE "partner_contacts"."is_primary" = true and "partner_contacts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "partner_contacts_partner_idx" ON "partner_contacts" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_code_active_uidx" ON "partners" USING btree ("company_id","code") WHERE "partners"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_tin_active_uidx" ON "partners" USING btree ("company_id","tin") WHERE "partners"."tin" is not null and "partners"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "partners_company_display_name_idx" ON "partners" USING btree ("company_id","display_name");--> statement-breakpoint
CREATE INDEX "partners_status_idx" ON "partners" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_terms_code_active_uidx" ON "payment_terms" USING btree ("company_id","code") WHERE "payment_terms"."deleted_at" is null;