CREATE TABLE "owner_locations" (
	"owner_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_locations_owner_id_location_id_pk" PRIMARY KEY("owner_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "payment_term" SET DEFAULT 'cash';--> statement-breakpoint
ALTER TABLE "sales_orders" ALTER COLUMN "payment_term" SET DEFAULT 'cash';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "owner_locations" ADD CONSTRAINT "owner_locations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "owner_locations" ADD CONSTRAINT "owner_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "owner_locations_owner_idx" ON "owner_locations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "owner_locations_location_idx" ON "owner_locations" USING btree ("location_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;