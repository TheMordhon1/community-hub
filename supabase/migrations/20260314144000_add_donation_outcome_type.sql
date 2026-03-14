-- Remove existing check constraints on finance_records and finance_categories type columns
ALTER TABLE public.finance_records DROP CONSTRAINT IF EXISTS finance_records_type_check;
ALTER TABLE public.finance_categories DROP CONSTRAINT IF EXISTS finance_categories_type_check;

-- Add new check constraints including 'donation_outcome' type for tracking donation expenses
ALTER TABLE public.finance_categories ADD CONSTRAINT finance_categories_type_check CHECK (type IN ('income', 'outcome', 'donation', 'donation_outcome'));
ALTER TABLE public.finance_records ADD CONSTRAINT finance_records_type_check CHECK (type IN ('income', 'outcome', 'donation', 'donation_outcome'));
