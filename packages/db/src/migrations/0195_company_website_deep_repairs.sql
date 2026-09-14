CREATE UNIQUE INDEX "issues_active_company_website_deep_repair_uq"
ON "issues" ("company_id", "origin_kind", "origin_id")
WHERE "origin_kind" = 'company_website_deep_repair'
  AND "origin_id" IS NOT NULL
  AND "hidden_at" IS NULL
  AND "status" NOT IN ('done', 'cancelled');

CREATE UNIQUE INDEX "issues_company_website_deep_repair_request_uq"
ON "issues" ("company_id", "origin_kind", "origin_run_id")
WHERE "origin_kind" = 'company_website_deep_repair'
  AND "origin_run_id" IS NOT NULL;
