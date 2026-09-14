ALTER TABLE "company_outreach_leads" ADD COLUMN "address_verification_connection_id" uuid;
ALTER TABLE "company_outreach_leads" ADD CONSTRAINT "company_outreach_leads_address_verification_connection_id_company_outreach_connections_id_fk" FOREIGN KEY ("address_verification_connection_id") REFERENCES "public"."company_outreach_connections"("id") ON DELETE set null ON UPDATE no action;

UPDATE "company_outreach_leads" AS "lead"
SET "address_verification_connection_id" = "latest"."connection_id"
FROM (
  SELECT DISTINCT ON ("lead_id") "lead_id", "connection_id"
  FROM "company_outreach_receipts"
  WHERE "type" = 'lead_verified' AND "lead_id" IS NOT NULL
  ORDER BY "lead_id", "occurred_at" DESC
) AS "latest"
WHERE "lead"."id" = "latest"."lead_id" AND "lead"."address_verification_connection_id" IS NULL;
