import { createMiddleware } from "@tanstack/react-start";
import type { AppRole } from "./auth.server";

export interface AuthContext {
  userId: string;
  email: string;
  roles: AppRole[];
  forvaltning: string | null;
}

/** Kräver en giltig session (cookien nk_session) och lägger användaren i context. */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { getSessionUser } = await import("./auth.server");
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized: Du är inte inloggad.");
  return next({
    context: {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      forvaltning: user.forvaltning,
    } satisfies AuthContext,
  });
});

export function isAdmin(context: Pick<AuthContext, "roles">): boolean {
  return context.roles.includes("admin") || context.roles.includes("superadmin");
}

export function isSuperAdmin(context: Pick<AuthContext, "roles">): boolean {
  return context.roles.includes("superadmin");
}

export function assertAdmin(context: Pick<AuthContext, "roles">): void {
  if (!isAdmin(context)) throw new Error("Endast administratörer har tillgång.");
}

export function assertSuperAdmin(
  context: Pick<AuthContext, "roles">,
  message = "Endast superadministratörer kan ändra roller.",
): void {
  if (!isSuperAdmin(context)) throw new Error(message);
}
