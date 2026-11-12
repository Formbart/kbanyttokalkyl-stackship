import { createFileRoute } from "@tanstack/react-router";

/**
 * Engångsuppsättning av ett superadministratörskonto. Anropet är idempotent:
 * när kontot redan finns görs ingenting utom att superadmin-rollen säkerställs.
 * Svarar 404 om ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD inte är satta.
 */
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const email = process.env["ADMIN_BOOTSTRAP_EMAIL"]?.trim().toLowerCase();
        const password = process.env["ADMIN_BOOTSTRAP_PASSWORD"];
        if (!email || !password) {
          return Response.json({ ok: false }, { status: 404 });
        }
        const { query } = await import("@/lib/db.server");
        const { hashPassword } = await import("@/lib/auth.server");

        const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
        let userId = existing[0]?.id ?? null;
        if (!userId) {
          const rows = await query<{ id: string }>(
            "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
            [email, await hashPassword(password)],
          );
          userId = rows[0]!.id;
        }
        await query(
          `INSERT INTO user_roles (user_id, role) VALUES ($1, 'superadmin')
           ON CONFLICT (user_id, role) DO NOTHING`,
          [userId],
        );
        return Response.json({ ok: true, created: !existing[0] });
      },
    },
  },
});
