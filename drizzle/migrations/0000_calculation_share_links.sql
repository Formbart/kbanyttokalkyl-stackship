ALTER TABLE public.calculations ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE;
CREATE OR REPLACE FUNCTION public.get_shared_calculation(_token uuid)
RETURNS TABLE(title text, data jsonb, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.title, c.data::jsonb, c.updated_at FROM public.calculations c WHERE c.share_token = _token AND _token IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.get_shared_calculation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_calculation(uuid) TO anon, authenticated;