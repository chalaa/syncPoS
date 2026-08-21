ALTER TYPE "public"."stock_movement_type" ADD VALUE 'sale_delivery' BEFORE 'customer_return';--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_location_direction_chk";--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_direction_chk" CHECK (
        (
          "stock_movements"."movement_type" in ('purchase_receipt', 'customer_return', 'opening_balance')
          and "stock_movements"."to_location_id" is not null
        )
        or (
          "stock_movements"."movement_type" in ('sale_issue', 'sale_delivery', 'supplier_return')
          and "stock_movements"."from_location_id" is not null
        )
        or (
          "stock_movements"."movement_type" = 'transfer'
          and "stock_movements"."from_location_id" is not null
          and "stock_movements"."to_location_id" is not null
          and "stock_movements"."from_location_id" <> "stock_movements"."to_location_id"
        )
        or "stock_movements"."movement_type" in ('adjustment', 'stock_count')
      );