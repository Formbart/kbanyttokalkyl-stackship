import { createServerFn } from "@tanstack/react-start";
import { requireAuth, type AuthContext } from "./auth-middleware";

export interface SessionInfo {
  user: { id: string; email: string } | null;
  fullName: string | null;
  forvaltning: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const SIGNED_OUT: SessionInfo = {
  user: null,
  fullName: null,
  forvaltning: null,
  isAdmin: false,
  isSuperAdmin: false,
};

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => ({
    email: String(data.email ?? "").trim().toLowerCase(),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { query } = await import("./db.server");
    const { verifyPassword, createSession } = await import("./auth.server");
    const rows = await query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [data.email],
    );
    const user = rows[0];
    // Samma svar oavsett om e-post eller lösenord är fel.
    const ok = user ? await verifyPassword(data.password, user.password_hash) : false;
    if (!user || !ok) return { ok: false as const };
    await createSession(user.id);
    return { ok: true as const };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("./auth.server");
  await destroySession();
  return { ok: true };
});

export const getSessionInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionInfo> => {
    const { getSessionUser } = await import("./auth.server");
    const user = await getSessionUser();
    if (!user) return SIGNED_OUT;
    return {
      user: { id: user.id, email: user.email },
      fullName: user.fullName,
      forvaltning: user.forvaltning,
      isAdmin: user.roles.includes("admin") || user.roles.includes("superadmin"),
      isSuperAdmin: user.roles.includes("superadmin"),
    };
  },
);

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { currentPassword: string; newPassword: string }) => {
    const newPassword = String(data.newPassword ?? "");
    if (newPassword.length < 8) throw new Error("Det nya lösenordet måste vara minst 8 tecken.");
    return { currentPassword: String(data.currentPassword ?? ""), newPassword };
  })
  .handler(async ({ data, context }) => {
    const { userId } = context as AuthContext;
    const { query } = await import("./db.server");
    const { verifyPassword, hashPassword } = await import("./auth.server");
    const rows = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    if (!rows[0] || !(await verifyPassword(data.currentPassword, rows[0].password_hash))) {
      throw new Error("Nuvarande lösenord stämmer inte.");
    }
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      await hashPassword(data.newPassword),
      userId,
    ]);
    return { ok: true };
  });
