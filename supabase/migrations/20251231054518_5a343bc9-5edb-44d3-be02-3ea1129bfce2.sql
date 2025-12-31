-- Fix signup failure: handle_new_user was inserting into a non-existent column (profiles.house_number)
-- This function is invoked during user creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile (match current public.profiles schema)
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );

  -- Assign default role (always warga for new registrations)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'warga');

  RETURN NEW;
END;
$$;