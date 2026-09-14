ALTER TABLE "company_social_posts" ADD COLUMN "media_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL;
