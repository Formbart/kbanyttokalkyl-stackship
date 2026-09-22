import { createFileRoute } from "@tanstack/react-router";

/**
 * Engångsuppsättning av administratörskontot. Anropet är idempotent: när kontot
 * redan finns görs ingenting utom att administratörsrollen säkerställs.
 */
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const email = process.env["ADMIN_BOOTSTRAP_EMAIL"];
        const password = process.env["ADMIN_BOOTSTRAP_PASSWORD"];
        if (!email || !password) {
          return Response.json({ ok: false, error: "missing_config" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let userId = existing?.id ?? null;
        if (!userId) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: "Lev Grünberg" },
          });
          if (error || !data.user) {
            return Response.json({ ok: false, error: error?.message }, { status: 500 });
          }
          userId = data.user.id;
          await supabaseAdmin
            .from("profiles")
            .upsert({ id: userId, email, full_name: "Lev Grünberg" });
        }

        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

        return Response.json({ ok: true, created: !existing });
      },
    },
  },
});
