ALTER TABLE "auth_sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "ip_address" varchar(80);--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "rotated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "application" varchar(80);--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "feature" varchar(80);--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN "action" varchar(80);--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_editable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_deletable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "normalized_email" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_ip" varchar(80);--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_parts_active_uidx" ON "permissions" USING btree ("application","feature","action") WHERE "permissions"."application" is not null and "permissions"."feature" is not null and "permissions"."action" is not null and "permissions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_active_uidx" ON "users" USING btree ("company_id","normalized_email") WHERE "users"."normalized_email" is not null and "users"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_expires_after_created_chk" CHECK ("auth_sessions"."expires_at" > "auth_sessions"."created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_failed_login_attempts_chk" CHECK ("users"."failed_login_attempts" >= 0);