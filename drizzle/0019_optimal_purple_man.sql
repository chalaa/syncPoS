CREATE TABLE "product_purchase_taxes" (
	"product_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_purchase_taxes_product_id_tax_id_pk" PRIMARY KEY("product_id","tax_id")
);
--> statement-breakpoint
CREATE TABLE "product_sale_taxes" (
	"product_id" uuid NOT NULL,
	"tax_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sale_taxes_product_id_tax_id_pk" PRIMARY KEY("product_id","tax_id")
);
--> statement-breakpoint
ALTER TABLE "product_purchase_taxes" ADD CONSTRAINT "product_purchase_taxes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_purchase_taxes" ADD CONSTRAINT "product_purchase_taxes_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_sale_taxes" ADD CONSTRAINT "product_sale_taxes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_sale_taxes" ADD CONSTRAINT "product_sale_taxes_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "product_purchase_taxes_tax_idx" ON "product_purchase_taxes" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "product_sale_taxes_tax_idx" ON "product_sale_taxes" USING btree ("tax_id");