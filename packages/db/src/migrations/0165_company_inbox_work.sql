ALTER TABLE "company_inbox_messages" ADD COLUMN "work_issue_id" uuid;--> statement-breakpoint
ALTER TABLE "company_inbox_messages" ADD CONSTRAINT "company_inbox_messages_work_issue_id_issues_id_fk" FOREIGN KEY ("work_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_inbox_messages_work_issue_uq" ON "company_inbox_messages" USING btree ("work_issue_id") WHERE "work_issue_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "issues_customer_message_origin_uq" ON "issues" USING btree ("company_id","origin_kind","origin_id") WHERE "origin_kind" = 'customer_message' and "origin_id" is not null;--> statement-breakpoint
ALTER TABLE "company_inbox_receipts" DROP CONSTRAINT "company_inbox_receipts_type_check";--> statement-breakpoint
ALTER TABLE "company_inbox_receipts" ADD CONSTRAINT "company_inbox_receipts_type_check" CHECK ("type" in ('connected', 'synced', 'message_received', 'work_created', 'reply_drafted', 'reply_requested', 'reply_reserved', 'reply_submitted', 'reply_failed', 'revoked'));--> statement-breakpoint
CREATE UNIQUE INDEX "company_inbox_receipts_message_work_created_uq" ON "company_inbox_receipts" USING btree ("message_id","type") WHERE "message_id" is not null and "type" = 'work_created';
