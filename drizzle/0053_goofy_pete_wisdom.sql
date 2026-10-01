ALTER TABLE "direct_vendor_sales" DROP CONSTRAINT "direct_vendor_sales_payment_chk";--> statement-breakpoint
ALTER TABLE "payment_allocations" DROP CONSTRAINT "payment_allocations_target_chk";--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "customer_direct_vendor_sale_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD COLUMN "vendor_direct_vendor_sale_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_customer_direct_vendor_sale_id_direct_vendor_sales_id_fk" FOREIGN KEY ("customer_direct_vendor_sale_id") REFERENCES "public"."direct_vendor_sales"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_vendor_direct_vendor_sale_id_direct_vendor_sales_id_fk" FOREIGN KEY ("vendor_direct_vendor_sale_id") REFERENCES "public"."direct_vendor_sales"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_customer_direct_vendor_sale_active_uidx" ON "payment_allocations" USING btree ("payment_id","customer_direct_vendor_sale_id") WHERE "payment_allocations"."deleted_at" is null and "payment_allocations"."customer_direct_vendor_sale_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_vendor_direct_vendor_sale_active_uidx" ON "payment_allocations" USING btree ("payment_id","vendor_direct_vendor_sale_id") WHERE "payment_allocations"."deleted_at" is null and "payment_allocations"."vendor_direct_vendor_sale_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_allocations_customer_direct_vendor_sale_idx" ON "payment_allocations" USING btree ("customer_direct_vendor_sale_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_vendor_direct_vendor_sale_idx" ON "payment_allocations" USING btree ("vendor_direct_vendor_sale_id");--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_payment_chk" CHECK (
        (
          "direct_vendor_sales"."status" <> 'posted'
          or (
            "direct_vendor_sales"."customer_paid_minor" <= "direct_vendor_sales"."customer_total_minor"
            and "direct_vendor_sales"."vendor_paid_minor" <= "direct_vendor_sales"."vendor_cost_total_minor"
          )
        )
      );--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_target_chk" CHECK (
        (case when "payment_allocations"."vendor_bill_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."purchase_order_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."expense_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."customer_invoice_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."sales_order_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."customer_direct_vendor_sale_id" is not null then 1 else 0 end)
        + (case when "payment_allocations"."vendor_direct_vendor_sale_id" is not null then 1 else 0 end)
        = 1
      );