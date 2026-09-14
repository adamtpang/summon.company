ALTER TABLE "user" ADD COLUMN "account_state" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deactivated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_account_state_check" CHECK ("account_state" in ('active', 'deactivated', 'deleted'));
