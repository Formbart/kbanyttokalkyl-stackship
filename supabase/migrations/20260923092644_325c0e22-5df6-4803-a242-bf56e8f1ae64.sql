CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::app_role, 'superadmin'::app_role)
  )
$$;

CREATE TABLE public.positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forvaltning text NOT NULL,
  befattning text NOT NULL,
  aid text NOT NULL DEFAULT '',
  manadslon numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX positions_forvaltning_idx ON public.positions (forvaltning, sort_order);

GRANT SELECT ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users can read positions"
  ON public.positions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert positions"
  ON public.positions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can update positions"
  ON public.positions FOR UPDATE TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can delete positions"
  ON public.positions FOR DELETE TO authenticated
  USING (public.is_platform_admin(auth.uid()));