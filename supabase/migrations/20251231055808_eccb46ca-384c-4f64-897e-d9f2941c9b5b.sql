-- Add columns to payments table for proof upload and verification
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS proof_url text,
ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS description text;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment proofs
CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own payment proofs"
ON storage.objects FOR DELETE
USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create finance_records table for income/outcome tracking
CREATE TABLE public.finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'outcome')),
  amount numeric NOT NULL,
  description text NOT NULL,
  category text,
  recorded_by uuid REFERENCES auth.users(id),
  payment_id uuid REFERENCES public.payments(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for finance_records
CREATE POLICY "Anyone can view finance records"
ON public.finance_records FOR SELECT
USING (true);

CREATE POLICY "Bendahara and Admin can insert finance records"
ON public.finance_records FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (has_role(auth.uid(), 'pengurus'::app_role) AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND title = 'bendahara'
  ))
);

CREATE POLICY "Bendahara and Admin can update finance records"
ON public.finance_records FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (has_role(auth.uid(), 'pengurus'::app_role) AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND title = 'bendahara'
  ))
);

CREATE POLICY "Admin can delete finance records"
ON public.finance_records FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update payments RLS to allow warga to insert their own payments
DROP POLICY IF EXISTS "Admins and Pengurus can insert payments" ON public.payments;
CREATE POLICY "Users can insert payments for their house"
ON public.payments FOR INSERT
WITH CHECK (
  auth.uid() = submitted_by AND 
  EXISTS (
    SELECT 1 FROM house_residents 
    WHERE house_id = payments.house_id AND user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_finance_records_updated_at
BEFORE UPDATE ON public.finance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();