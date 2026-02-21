-- Add occupancy columns to houses table
ALTER TABLE public.houses 
ADD COLUMN IF NOT EXISTS occupancy_status TEXT DEFAULT 'occupied',
ADD COLUMN IF NOT EXISTS vacancy_reason TEXT,
ADD COLUMN IF NOT EXISTS estimated_return_date DATE;

-- Update RLS if necessary (assuming current policies allow authenticated users to update their own house via house_residents link)
-- Usually houses table is updated by staff/admin, but if user can update their house, we need to check policy.
-- For now, we'll assume the user can update these fields if they are a resident.
