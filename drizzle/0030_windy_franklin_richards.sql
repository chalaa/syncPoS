ALTER TABLE "units_of_measure" DROP CONSTRAINT "units_of_measure_precision_chk";--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "precision" SET DATA TYPE numeric(20, 6)
USING (
	CASE
		WHEN "precision" <= 0 THEN 1
		ELSE power(10::numeric, -"precision")
	END
);--> statement-breakpoint
ALTER TABLE "units_of_measure" ALTER COLUMN "precision" SET DEFAULT '1';--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_precision_chk" CHECK ("units_of_measure"."precision" > 0);
