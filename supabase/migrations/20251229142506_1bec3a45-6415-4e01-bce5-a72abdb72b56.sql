-- Create enum for pengurus titles
CREATE TYPE public.pengurus_title AS ENUM ('ketua', 'wakil_ketua', 'sekretaris', 'bendahara', 'menteri_keamanan', 'menteri_agama', 'menteri_humas','menteri_olahraga','menteri_sisdigi', 'anggota');

-- Add title column to user_roles for pengurus positions
ALTER TABLE public.user_roles ADD COLUMN title pengurus_title;

-- Update handle_new_user to always create warga role (no role from metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  );
  
  -- Insert default role (always warga for new registrations)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'warga');
  
  RETURN NEW;
END;
$$;