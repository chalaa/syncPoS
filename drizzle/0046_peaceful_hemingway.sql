CREATE TYPE "public"."stock_out_approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "location_approvers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"can_approve_outgoing" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_out_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_type" varchar(80) NOT NULL,
	"source_id" uuid,
	"stock_movement_id" uuid,
	"source_no" varchar(120),
	"source_location_id" uuid NOT NULL,
	"requested_by" uuid,
	"approver_user_id" uuid,
	"status" "stock_out_approval_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location_approvers" ADD CONSTRAINT "location_approvers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "location_approvers" ADD CONSTRAINT "location_approvers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "location_approvers" ADD CONSTRAINT "location_approvers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_out_approvals" ADD CONSTRAINT "stock_out_approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_out_approvals" ADD CONSTRAINT "stock_out_approvals_stock_movement_id_stock_movements_id_fk" FOREIGN KEY ("stock_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_out_approvals" ADD CONSTRAINT "stock_out_approvals_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_out_approvals" ADD CONSTRAINT "stock_out_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stock_out_approvals" ADD CONSTRAINT "stock_out_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "location_approvers_location_user_active_uidx" ON "location_approvers" USING btree ("company_id","location_id","user_id") WHERE "location_approvers"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "location_approvers_location_idx" ON "location_approvers" USING btree ("company_id","location_id");--> statement-breakpoint
CREATE INDEX "location_approvers_user_idx" ON "location_approvers" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "stock_out_approvals_company_status_idx" ON "stock_out_approvals" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "stock_out_approvals_source_idx" ON "stock_out_approvals" USING btree ("company_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "stock_out_approvals_movement_idx" ON "stock_out_approvals" USING btree ("stock_movement_id");--> statement-breakpoint
CREATE INDEX "stock_out_approvals_location_idx" ON "stock_out_approvals" USING btree ("company_id","source_location_id");--> statement-breakpoint
CREATE INDEX "stock_out_approvals_approver_idx" ON "stock_out_approvals" USING btree ("company_id","approver_user_id");