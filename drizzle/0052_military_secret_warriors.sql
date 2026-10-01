ALTER TABLE "direct_vendor_sales" DROP CONSTRAINT "direct_vendor_sales_payment_chk";--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD COLUMN "customer_payment_term" "sales_payment_term" DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD COLUMN "vendor_payment_term" "purchase_payment_term" DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_vendor_sales" ADD CONSTRAINT "direct_vendor_sales_payment_chk" CHECK (
        (
          "direct_vendor_sales"."status" <> 'posted'
          or (
            (
              (
                "direct_vendor_sales"."customer_payment_term" = 'cash'
                and "direct_vendor_sales"."customer_payment_method_id" is not null
                and "direct_vendor_sales"."customer_payment_account_id" is not null
                and "direct_vendor_sales"."customer_paid_minor" = "direct_vendor_sales"."customer_total_minor"
              )
              or (
                "direct_vendor_sales"."customer_payment_term" = 'credit'
                and "direct_vendor_sales"."customer_paid_minor" = 0
              )
            )
            and (
              (
                "direct_vendor_sales"."vendor_payment_term" = 'cash'
                and "direct_vendor_sales"."vendor_payment_method_id" is not null
                and "direct_vendor_sales"."vendor_payment_account_id" is not null
                and "direct_vendor_sales"."vendor_paid_minor" = "direct_vendor_sales"."vendor_cost_total_minor"
              )
              or (
                "direct_vendor_sales"."vendor_payment_term" = 'credit'
                and "direct_vendor_sales"."vendor_paid_minor" = 0
              )
            )
          )
        )
      );