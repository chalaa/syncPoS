CREATE TYPE "public"."sales_payment_term" AS ENUM('cash', 'credit');--> statement-breakpoint
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_target_chk";--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "sales_order_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "payment_term" "sales_payment_term" DEFAULT 'credit' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_sales_order_active_uidx" ON "payment_allocations" USING btree ("payment_id","sales_order_id") WHERE "payment_allocations"."deleted_at" is null and "payment_allocations"."sales_order_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_allocations_sales_order_idx" ON "payment_allocations" USING btree ("sales_order_id");--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_target_chk" CHECK (
        (case when "payment_allocations"."vendor_bill_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."purchase_order_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."expense_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."customer_invoice_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."sales_order_id" is not null then 1 else 0 end)
        = 1
      );