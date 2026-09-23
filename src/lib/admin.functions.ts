import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "user" | "admin" | "superadmin";

export interface AppUserRow {
  id: string;
  email: string;
  fullName: string | null;
  roles: AppRole[];
  isAdmin: boolean;
  createdAt: string;
}

async function assertRole(
  context: {
    supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
    userId: string;
  },
  role: AppRole,
  message: string,
) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: role,
  });
  if (data !== true) throw new Error(message);
}

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  await assertRole(context, "admin", "Endast administratörer har tillgång.");
}

async function assertSuperAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  await assertRole(context, "superadmin", "Endast superadministratörer kan ändra roller.");
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
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      rolesByUser.set(r.user_id, list);
    }
    return (profiles ?? []).map((p) => {
      const userRoles = rolesByUser.get(p.id) ?? [];
      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        roles: userRoles,
        isAdmin: userRoles.includes("admin") || userRoles.includes("superadmin"),
        createdAt: p.created_at,
      };
    });
  });

/** Superadministratör sätter rollen för ett konto (en roll per konto). */
export const setAppUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: string }) => {
    const role = data.role as AppRole;
    if (!["user", "admin", "superadmin"].includes(role)) {
      throw new Error("Ogiltig roll.");
    }
    return { userId: data.userId, role };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as never);
    if (data.userId === (context as { userId: string }).userId) {
      throw new Error("Du kan inte ändra rollen på ditt eget konto.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);
    return { ok: true };
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
          email: data.email,
          password: data.password,
           event: data.event,
          fullName: data.fullName ?? null,
          appName: "Nyttokalkyl – Kungsbacka kommun",
           loginUrl: "https://id-preview--16699c16-cabf-4f2e-ae89-5b2138dfbb3a.lovable.app/auth",
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
