
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS related_urls text[] NOT NULL DEFAULT '{}';

UPDATE public.announcements
SET related_urls = ARRAY[related_url]
WHERE related_url IS NOT NULL
  AND related_url <> ''
  AND (related_urls IS NULL OR array_length(related_urls, 1) IS NULL);
