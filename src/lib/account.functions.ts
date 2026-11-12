import { createServerFn } from "@tanstack/react-start";
import { requireAuth, type AuthContext } from "@/lib/auth-middleware";

/** Raderar det egna kontot och all data som hör till det. */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const ctx = context as AuthContext;
    const { query } = await import("@/lib/db.server");
    if (ctx.roles.includes("superadmin")) {
      const supers = await query<{ n: number }>(
        "SELECT count(*)::int AS n FROM user_roles WHERE role = 'superadmin'",
      );
      if ((supers[0]?.n ?? 0) <= 1) {
        throw new Error("Den sista superadministratören kan inte radera sitt konto.");
      }
    }
    // Kalkyler, profil, roller och sessioner raderas via ON DELETE CASCADE.
    await query("DELETE FROM users WHERE id = $1", [ctx.userId]);
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie("nk_session", { path: "/" });
    return { ok: true };
  });
