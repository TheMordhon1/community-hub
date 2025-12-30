-- Add house_number column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS house_number text;

-- Update the handle_new_user trigger function to include house_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with house_number from metadata
  INSERT INTO public.profiles (id, full_name, email, house_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'house_number'
  );
  
  -- Insert default role (always warga for new registrations)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'warga');
  
  RETURN NEW;
END;
$$;