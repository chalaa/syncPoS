CREATE TYPE "public"."sales_line_approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "sales_line_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_line_id" uuid,
	"line_no" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"source_location_id" uuid NOT NULL,
	"requested_by" uuid,
	"decided_by" uuid,
	"status" "sales_line_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_sales_order_line_id_sales_order_lines_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "public"."sales_order_lines"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sales_line_approvals" ADD CONSTRAINT "sales_line_approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "sales_line_approvals_order_idx" ON "sales_line_approvals" USING btree ("company_id","sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_line_approvals_line_idx" ON "sales_line_approvals" USING btree ("sales_order_line_id");--> statement-breakpoint
CREATE INDEX "sales_line_approvals_location_status_idx" ON "sales_line_approvals" USING btree ("company_id","source_location_id","status");--> statement-breakpoint
INSERT INTO "sales_line_approvals" (
	"company_id",
	"sales_order_id",
	"sales_order_line_id",
	"line_no",
	"product_id",
	"source_location_id",
	"requested_by",
	"decided_by",
	"status",
	"decided_at",
	"metadata"
)
SELECT
	so.company_id,
	so.id,
	sol.id,
	sol.line_no,
	sol.product_id,
	sol.source_location_id,
	so.created_by,
	CASE WHEN EXISTS (
		SELECT 1 FROM location_approvers creator_approval
		WHERE creator_approval.company_id = so.company_id
			AND creator_approval.location_id = sol.source_location_id
			AND creator_approval.user_id = so.created_by
			AND creator_approval.can_approve_outgoing = true
			AND creator_approval.is_active = true
			AND creator_approval.deleted_at IS NULL
	) THEN so.created_by ELSE NULL END,
	CASE WHEN EXISTS (
		SELECT 1 FROM location_approvers creator_approval
		WHERE creator_approval.company_id = so.company_id
			AND creator_approval.location_id = sol.source_location_id
			AND creator_approval.user_id = so.created_by
			AND creator_approval.can_approve_outgoing = true
			AND creator_approval.is_active = true
			AND creator_approval.deleted_at IS NULL
	) THEN 'approved'::sales_line_approval_status ELSE 'pending'::sales_line_approval_status END,
	CASE WHEN EXISTS (
		SELECT 1 FROM location_approvers creator_approval
		WHERE creator_approval.company_id = so.company_id
			AND creator_approval.location_id = sol.source_location_id
			AND creator_approval.user_id = so.created_by
			AND creator_approval.can_approve_outgoing = true
			AND creator_approval.is_active = true
			AND creator_approval.deleted_at IS NULL
	) THEN now() ELSE NULL END,
	jsonb_build_object('backfilled', true)
FROM sales_orders so
INNER JOIN sales_order_lines sol ON sol.sales_order_id = so.id AND sol.deleted_at IS NULL
WHERE so.status = 'quotation'
	AND so.deleted_at IS NULL
	AND sol.source_location_id IS NOT NULL
	AND EXISTS (
		SELECT 1 FROM location_approvers required_approval
		WHERE required_approval.company_id = so.company_id
			AND required_approval.location_id = sol.source_location_id
			AND required_approval.can_approve_outgoing = true
			AND required_approval.is_active = true
			AND required_approval.deleted_at IS NULL
	);
