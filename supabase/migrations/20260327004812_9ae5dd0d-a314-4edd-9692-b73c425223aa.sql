
-- Create a SQL function to auto-update house status
CREATE OR REPLACE FUNCTION public.auto_update_house_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.houses
  SET 
    occupancy_status = 'occupied',
    is_occupied = true,
    vacancy_reason = NULL,
    estimated_return_date = NULL,
    updated_at = now()
  WHERE occupancy_status != 'occupied'
    AND estimated_return_date IS NOT NULL
    AND estimated_return_date <= CURRENT_DATE;
END;
$$;

-- Schedule the cron job to run daily at midnight
SELECT cron.schedule(
  'auto-update-house-status-daily',
  '0 0 * * *',
  $$SELECT public.auto_update_house_status()$$
);
