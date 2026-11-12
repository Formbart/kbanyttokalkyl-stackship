import { createServerFn } from "@tanstack/react-start";
import {
  assertAdmin,
  isSuperAdmin,
  requireAuth,
  type AuthContext,
} from "@/lib/auth-middleware";
import { FORVALTNINGAR, type PersonalData, type Position } from "@/lib/nyttokalkyl/types";

/**
 * Administratörer får bara ändra sin egen förvaltnings lista.
 * Superadministratörer får ändra alla förvaltningar.
 */
function assertCanManage(context: AuthContext, forvaltning: string) {
  assertAdmin(context);
  if (isSuperAdmin(context)) return;
  const own = context.forvaltning;
  if (!own) {
    throw new Error(
      "Ditt konto är inte kopplat till någon förvaltning. En superadministratör behöver tilldela en förvaltning.",
    );
  }
  if (own !== forvaltning) throw new Error(`Du kan bara hantera befattningar för ${own}.`);
}

/** Alla förvaltningars befattningslistor — gemensamma för hela kommunen. */
export const listPositions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<PersonalData> => {
    const { query } = await import("@/lib/db.server");
    const rows = await query<{
      forvaltning: string;
      befattning: string;
      aid: string | null;
      manadslon: string;
    }>(
      `SELECT forvaltning, befattning, aid, manadslon
         FROM positions ORDER BY forvaltning, sort_order`,
    );
    const result: PersonalData = {};
    for (const row of rows) {
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
  .middleware([requireAuth])
  .inputValidator((data: { forvaltning: string; positions: Position[] }) => {
    if (!FORVALTNINGAR.includes(data.forvaltning)) throw new Error("Okänd förvaltning.");
    const positions = (data.positions ?? [])
      .map((p) => ({
        befattning: String(p.befattning ?? "").trim(),
        aid: String(p.aid ?? "").trim(),
        manadslon: Math.round((Number(p.manadslon) || 0) * 100) / 100,
      }))
      .filter((p) => p.befattning !== "");
    if (positions.length === 0) throw new Error("Filen innehåller inga giltiga befattningsrader.");
    return { forvaltning: data.forvaltning, positions };
  })
  .handler(async ({ data, context }) => {
    assertCanManage(context as AuthContext, data.forvaltning);
    const { transaction } = await import("@/lib/db.server");
    await transaction(async (client) => {
      await client.query("DELETE FROM positions WHERE forvaltning = $1", [data.forvaltning]);
      await client.query(
        `INSERT INTO positions (forvaltning, befattning, aid, manadslon, sort_order)
         SELECT $1, p.befattning, p.aid, p.manadslon, p.ord - 1
           FROM ROWS FROM (
                  jsonb_to_recordset($2::jsonb) AS (befattning text, aid text, manadslon numeric)
                ) WITH ORDINALITY AS p(befattning, aid, manadslon, ord)`,
        [data.forvaltning, JSON.stringify(data.positions)],
      );
    });
    return { count: data.positions.length };
  });

/** Tömmer en förvaltnings lista helt. */
export const clearPositions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { forvaltning: string }) => {
    if (!FORVALTNINGAR.includes(data.forvaltning)) throw new Error("Okänd förvaltning.");
    return { forvaltning: data.forvaltning };
  })
  .handler(async ({ data, context }) => {
    assertCanManage(context as AuthContext, data.forvaltning);
    const { query } = await import("@/lib/db.server");
    await query("DELETE FROM positions WHERE forvaltning = $1", [data.forvaltning]);
    return { ok: true };
  });
