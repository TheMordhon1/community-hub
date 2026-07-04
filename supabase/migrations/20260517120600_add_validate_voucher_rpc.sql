CREATE OR REPLACE FUNCTION public.validate_store_voucher(
  p_redeem_code TEXT,
  p_store_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_redemption RECORD;
  v_new_usage_count INT;
  v_status TEXT;
  v_is_authorized BOOLEAN;
BEGIN
  -- Verify the store exists and the user is authorized (owner or house member)
  SELECT 
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = p_store_id
      AND (
          stores.created_by = auth.uid()
          OR EXISTS (
              SELECT 1 FROM public.house_members
              WHERE house_members.house_id = stores.house_id
              AND house_members.user_id = auth.uid()
              AND house_members.status = 'approved'
          )
      )
    ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tidak diizinkan mengakses toko ini');
  END IF;

  -- Find the redemption by code
  SELECT * INTO v_redemption 
  FROM public.point_redemptions 
  WHERE redeem_code = p_redeem_code 
  AND status IN ('approved', 'completed'); 

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kode voucher tidak valid');
  END IF;

  -- If it's already used AT THIS STORE
  IF v_redemption.used_in_id = p_store_id THEN
     RETURN jsonb_build_object('success', true, 'message', 'Voucher sudah tervalidasi sebelumnya di toko ini');
  END IF;

  -- Check if usage limit reached
  IF v_redemption.usage_count >= v_redemption.usage_limit THEN
    RETURN jsonb_build_object('success', false, 'message', 'Batas penggunaan voucher telah habis');
  END IF;

  -- Proceed to update
  v_new_usage_count := COALESCE(v_redemption.usage_count, 0) + 1;
  v_status := CASE WHEN v_new_usage_count >= v_redemption.usage_limit THEN 'completed' ELSE 'approved' END;

  UPDATE public.point_redemptions
  SET 
    usage_count = v_new_usage_count,
    used_at = now(),
    used_in_id = p_store_id,
    status = v_status
  WHERE id = v_redemption.id;

  RETURN jsonb_build_object('success', true, 'message', 'Voucher berhasil divalidasi');
END;
$$;
