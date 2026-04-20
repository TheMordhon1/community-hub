-- Add geojson location column to houses (stores a GeoJSON Feature/Geometry as JSONB)
ALTER TABLE public.houses
ADD COLUMN IF NOT EXISTS location jsonb;

-- Allow approved house members, admins, and pengurus to update house location
CREATE POLICY "House members admins pengurus can update house location"
ON public.houses
FOR UPDATE
TO authenticated
USING (
  is_house_member(auth.uid(), id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'pengurus'::app_role)
)
WITH CHECK (
  is_house_member(auth.uid(), id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'pengurus'::app_role)
);