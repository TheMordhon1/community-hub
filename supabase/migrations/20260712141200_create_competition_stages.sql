CREATE TABLE "public"."competition_stages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "competition_id" uuid NOT NULL,
  "name" text NOT NULL,
  "order_number" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "competition_stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "competition_stages_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."event_competitions"("id") ON DELETE CASCADE,
  CONSTRAINT "competition_stages_order_number_key" UNIQUE ("competition_id", "order_number")
);

ALTER TABLE "public"."competition_stages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."competition_stages"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable all access for authenticated users" ON "public"."competition_stages"
AS PERMISSIVE FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
