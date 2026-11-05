DROP POLICY IF EXISTS "Users can view complaints based on visibility" ON public.complaints;
CREATE POLICY "Users can view complaints based on visibility" ON public.complaints FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role) OR is_public = true);