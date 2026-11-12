import { createServerFn } from "@tanstack/react-start";
import {
  assertAdmin,
  assertSuperAdmin,
  requireAuth,
  type AuthContext,
} from "@/lib/auth-middleware";
import { FORVALTNINGAR } from "@/lib/nyttokalkyl/types";

export type AppRole = "user" | "admin" | "superadmin";

export interface AppUserRow {
  id: string;
  email: string;
  fullName: string | null;
  forvaltning: string | null;
  roles: AppRole[];
  isAdmin: boolean;
  createdAt: string;
}

const db = () => import("@/lib/db.server");
const auth = () => import("@/lib/auth.server");

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AppUserRow[]> => {
    assertAdmin(context as AuthContext);
    const { query } = await db();
    const rows = await query<{
      id: string;
      email: string;
      full_name: string | null;
      forvaltning: string | null;
      created_at: Date;
      roles: AppRole[] | null;
    }>(
      `SELECT u.id, u.email, p.full_name, p.forvaltning, u.created_at,
              array_remove(array_agg(r.role ORDER BY r.role), NULL) AS roles
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         LEFT JOIN user_roles r ON r.user_id = u.id
        GROUP BY u.id, u.email, p.full_name, p.forvaltning, u.created_at
        ORDER BY u.created_at`,
    );
    return rows.map((r) => {
      const roles = r.roles ?? [];
      return {
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        forvaltning: r.forvaltning,
        roles,
        isAdmin: roles.includes("admin") || roles.includes("superadmin"),
        createdAt: new Date(r.created_at).toISOString(),
      };
    });
  });

/** Superadministratör sätter rollen för ett konto (en roll per konto). */
export const setAppUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { userId: string; role: string }) => {
    const role = data.role as AppRole;
    if (!["user", "admin", "superadmin"].includes(role)) throw new Error("Ogiltig roll.");
    return { userId: String(data.userId), role };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as AuthContext;
    assertSuperAdmin(ctx);
    if (data.userId === ctx.userId) throw new Error("Du kan inte ändra rollen på ditt eget konto.");
    const { transaction } = await db();
    await transaction(async (client) => {
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [data.userId]);
      await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [
        data.userId,
        data.role,
      ]);
    });
    return { ok: true };
  });

/** Superadministratör kopplar ett konto till en förvaltning (eller ingen). */
export const setAppUserForvaltning = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { userId: string; forvaltning: string | null }) => {
    const value = (data.forvaltning ?? "").trim();
    if (value !== "" && !FORVALTNINGAR.includes(value)) throw new Error("Okänd förvaltning.");
    return { userId: String(data.userId), forvaltning: value === "" ? null : value };
  })
  .handler(async ({ data, context }) => {
    assertSuperAdmin(context as AuthContext);
    const { query } = await db();
    await query("UPDATE profiles SET forvaltning = $1 WHERE id = $2", [
      data.forvaltning,
      data.userId,
    ]);
    return { ok: true };
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { email: string; fullName?: string }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Ogiltig e-postadress.");
    return { email, fullName: (data.fullName ?? "").trim().slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context as AuthContext);
    const { query, transaction } = await db();
    const { hashPassword, generatePassword } = await auth();
    const existing = await query("SELECT 1 FROM users WHERE email = $1", [data.email]);
    if (existing[0]) throw new Error("Det finns redan ett konto med den e-postadressen.");
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    const id = await transaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [data.email, passwordHash],
      );
      const userId = rows[0]!.id;
      // Triggern on_user_created har redan skapat profil och rollen 'user'.
      await client.query("UPDATE profiles SET full_name = $1 WHERE id = $2", [
        data.fullName || null,
        userId,
      ]);
      return userId;
    });
    return { id, email: data.email, password };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { userId: string }) => ({ userId: String(data.userId) }))
  .handler(async ({ data, context }) => {
    const ctx = context as AuthContext;
    assertAdmin(ctx);
    if (data.userId === ctx.userId) {
      throw new Error("Du kan inte radera ditt eget administratörskonto här.");
    }
    const { query } = await db();
    const target = await query<{ is_super: boolean }>(
      "SELECT has_role($1, 'superadmin') AS is_super",
      [data.userId],
    );
    if (target[0]?.is_super) {
      assertSuperAdmin(ctx, "Endast superadministratörer kan radera en superadministratör.");
      const supers = await query<{ n: number }>(
        "SELECT count(*)::int AS n FROM user_roles WHERE role = 'superadmin'",
      );
      if ((supers[0]?.n ?? 0) <= 1) throw new Error("Den sista superadministratören kan inte raderas.");
    }
    // Kalkyler, profil, roller och sessioner raderas via ON DELETE CASCADE.
    await query("DELETE FROM users WHERE id = $1", [data.userId]);
    return { ok: true };
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { userId: string }) => ({ userId: String(data.userId) }))
  .handler(async ({ data, context }) => {
    assertAdmin(context as AuthContext);
    const { query } = await db();
    const { hashPassword, generatePassword } = await auth();
    const password = generatePassword();
    const rows = await query<{ email: string }>(
      "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING email",
      [await hashPassword(password), data.userId],
    );
    if (!rows[0]) throw new Error("Kunde inte byta lösenord.");
    await query("DELETE FROM sessions WHERE user_id = $1", [data.userId]);
    return { email: rows[0].email, password };
  });

/** Skickar inloggningsuppgifterna vidare till n8n, som mejlar användaren. */
export const sendCredentials = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(
    (data: {
      email: string;
      password: string;
      fullName?: string | undefined;
      event: "account_created" | "password_reset";
    }) => ({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      fullName: data.fullName?.trim() || undefined,
      event: data.event === "password_reset" ? "password_reset" : "account_created",
    }),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context as AuthContext);
    const baseUrl = process.env["N8N_BASE_URL"]?.replace(/\/$/, "");
    const url = baseUrl
      ? `${baseUrl}/webhook/99a7a6e8-e622-4f99-bd69-748a0ab4c6b4`
      : process.env["N8N_USER_WEBHOOK_URL"];
    const apiKey = process.env["N8N_MAIL_API_KEY"];
    if (!url || !apiKey) {
      return { sent: false, reason: "missing_webhook" as const };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          event: data.event,
        }),
      });
      if (!res.ok) {
        console.error("n8n credentials webhook failed", res.status, await res.text());
        return { sent: false, reason: "webhook_error" as const };
      }
      return { sent: true, reason: null };
    } catch (error) {
      console.error("n8n credentials webhook error", error);
      return { sent: false, reason: "webhook_error" as const };
    }
  });
