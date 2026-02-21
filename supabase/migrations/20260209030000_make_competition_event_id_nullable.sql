-- Make event_id nullable in event_competitions table
ALTER TABLE "public"."event_competitions" ALTER COLUMN "event_id" DROP NOT NULL;
