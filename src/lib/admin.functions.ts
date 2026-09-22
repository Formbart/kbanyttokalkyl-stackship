import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AppUserRow {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  createdAt: string;
}

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Endast administratörer har tillgång.");
}

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "!7";
}

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUserRow[]> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    const admins = new Set((roles ?? []).map((r) => r.user_id));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      isAdmin: admins.has(p.id),
      createdAt: p.created_at,
    }));
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; fullName?: string }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Ogiltig e-postadress.");
    return { email, fullName: (data.fullName ?? "").trim().slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName || null },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Kunde inte skapa användaren.");
    }
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, email: data.email, full_name: data.fullName || null });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "user" }, { onConflict: "user_id,role" });
    return { id: created.user.id, email: data.email, password };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === (context as { userId: string }).userId) {
      throw new Error("Du kan inte radera ditt eget administratörskonto här.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("calculations").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetAppUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();
    const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password,
    });
    if (error || !updated.user) throw new Error(error?.message ?? "Kunde inte byta lösenord.");
    return { email: updated.user.email ?? "", password };
  });

/** Skickar inloggningsuppgifterna vidare till n8n, som mejlar användaren. */
export const sendCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; fullName?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const url = process.env["N8N_USER_WEBHOOK_URL"];
    if (!url) {
      return { sent: false, reason: "missing_webhook" as const };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_credentials",
          email: data.email,
          password: data.password,
          fullName: data.fullName ?? null,
          appName: "Nyttokalkyl – Kungsbacka kommun",
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
