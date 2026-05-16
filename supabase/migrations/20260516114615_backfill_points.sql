
-- Correcting the backfill migration to use the right table and handle unique constraints

-- 1. Profile Update (Full Name and Phone)
INSERT INTO public.user_point_history (user_id, action_key, points_awarded)
SELECT id, 'profile_update', 50
FROM public.profiles
WHERE full_name IS NOT NULL AND phone IS NOT NULL
ON CONFLICT (user_id, action_key) DO NOTHING;

-- 2. House Data (Joined a house)
INSERT INTO public.user_point_history (user_id, action_key, points_awarded)
SELECT hm.user_id, 'house_data', 50
FROM public.house_members hm
JOIN public.profiles p ON hm.user_id = p.id
WHERE hm.user_id IS NOT NULL AND hm.status = 'approved'
ON CONFLICT (user_id, action_key) DO NOTHING;

-- 3. Family Member Add (Added members without user_id)
-- For now, due to UNIQUE(user_id, action_key), this only awards once per head
INSERT INTO public.user_point_history (user_id, action_key, points_awarded)
SELECT DISTINCT hm_head.user_id, 'family_member_add', 25
FROM public.house_members hm_extra
JOIN public.house_members hm_head ON hm_extra.house_id = hm_head.house_id
JOIN public.profiles p ON hm_head.user_id = p.id
WHERE hm_extra.user_id IS NULL 
  AND hm_extra.status = 'approved'
  AND hm_head.is_head = true
  AND hm_head.user_id IS NOT NULL
ON CONFLICT (user_id, action_key) DO NOTHING;

-- 4. House Location Update
-- Award to the head of the house if the house has a location
INSERT INTO public.user_point_history (user_id, action_key, points_awarded)
SELECT hm.user_id, 'house_location_update', 100
FROM public.houses h
JOIN public.house_members hm ON h.id = hm.house_id
JOIN public.profiles p ON hm.user_id = p.id
WHERE h.location IS NOT NULL
  AND hm.is_head = true
  AND hm.status = 'approved'
ON CONFLICT (user_id, action_key) DO NOTHING;

-- 5. Store Creation
INSERT INTO public.user_point_history (user_id, action_key, points_awarded)
SELECT s.created_by, 'store_creation', 200
FROM public.stores s
JOIN public.profiles p ON s.created_by = p.id
WHERE s.created_by IS NOT NULL
ON CONFLICT (user_id, action_key) DO NOTHING;

-- Finally, update the profiles.points column based on history
UPDATE public.profiles p
SET points = (
    SELECT COALESCE(SUM(points_awarded), 0)
    FROM public.user_point_history
    WHERE user_id = p.id
);
