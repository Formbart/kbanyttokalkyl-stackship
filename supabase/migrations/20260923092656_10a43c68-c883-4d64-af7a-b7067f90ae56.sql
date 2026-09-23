REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;