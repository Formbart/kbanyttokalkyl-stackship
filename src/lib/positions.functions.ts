import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  FORVALTNINGAR,
  type PersonalData,
  type Position,
} from "@/lib/nyttokalkyl/types";

type AuthContext = {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>;
  };
  userId: string;
};

async function assertAdmin(context: AuthContext) {
  const { data } = await context.supabase.rpc("is_platform_admin", {
    _user_id: context.userId,
  });
  if (data !== true) throw new Error("Endast administratörer har tillgång.");
}

/** Alla förvaltningars befattningslistor — gemensamma för hela kommunen. */
export const listPositions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonalData> => {
    const { data, error } = await (
      context as unknown as {
        supabase: {
          from: (t: string) => {
            select: (c: string) => {
              order: (
                c: string,
                o: { ascending: boolean },
              ) => {
                order: (
                  c: string,
                  o: { ascending: boolean },
                ) => Promise<{
                  data:
                    | {
                        forvaltning: string;
                        befattning: string;
                        aid: string;
                        manadslon: number | string;
                      }[]
                    | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      }
    ).supabase
      .from("positions")
      .select("forvaltning, befattning, aid, manadslon")
      .order("forvaltning", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const result: PersonalData = {};
    for (const row of data ?? []) {
      const list = (result[row.forvaltning] ??= []);
      list.push({
        befattning: row.befattning,
        aid: row.aid ?? "",
        manadslon: Number(row.manadslon) || 0,
      });
    }
    return result;
  });

/** Ersätter hela den valda förvaltningens lista. */
export const replacePositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { forvaltning: string; positions: Position[] }) => {
      if (!FORVALTNINGAR.includes(data.forvaltning))
        throw new Error("Okänd förvaltning.");
      const positions = (data.positions ?? [])
        .map((p) => ({
          befattning: String(p.befattning ?? "").trim(),
          aid: String(p.aid ?? "").trim(),
          manadslon: Math.round((Number(p.manadslon) || 0) * 100) / 100,
        }))
        .filter((p) => p.befattning !== "");
      if (positions.length === 0)
        throw new Error("Filen innehåller inga giltiga befattningsrader.");
      return { forvaltning: data.forvaltning, positions };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthContext);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: delError } = await supabaseAdmin
      .from("positions")
      .delete()
      .eq("forvaltning", data.forvaltning);
    if (delError) throw new Error(delError.message);
    const { error } = await supabaseAdmin.from("positions").insert(
      data.positions.map((p, i) => ({
        forvaltning: data.forvaltning,
        befattning: p.befattning,
        aid: p.aid,
        manadslon: p.manadslon,
        sort_order: i,
      })),
    );
    if (error) throw new Error(error.message);
    return { count: data.positions.length };
  });

/** Tömmer en förvaltnings lista helt. */
export const clearPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { forvaltning: string }) => {
    if (!FORVALTNINGAR.includes(data.forvaltning))
      throw new Error("Okänd förvaltning.");
    return { forvaltning: data.forvaltning };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AuthContext);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("positions")
      .delete()
      .eq("forvaltning", data.forvaltning);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
