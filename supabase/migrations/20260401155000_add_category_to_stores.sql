-- Migration to replace single category with categories array
ALTER TABLE public.stores DROP COLUMN IF EXISTS category;
ALTER TABLE public.stores ADD COLUMN categories TEXT[] DEFAULT '{}';
