import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionInfo } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const info = await getSessionInfo();
    if (!info.user) throw redirect({ to: "/auth" });
    return { user: info.user };
  },
  component: () => <Outlet />,
});
