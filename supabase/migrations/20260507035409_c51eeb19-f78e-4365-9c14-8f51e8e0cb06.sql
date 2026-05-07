ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS methods jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.emergency_contacts ec
SET methods = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('platform', ec.platform, 'value', p)), '[]'::jsonb)
  FROM unnest(
    CASE WHEN array_length(ec.phones,1) IS NOT NULL AND array_length(ec.phones,1) > 0
         THEN ec.phones
         ELSE ARRAY[ec.phone] END
  ) AS p
  WHERE p IS NOT NULL AND p <> ''
)
WHERE methods = '[]'::jsonb OR methods IS NULL;