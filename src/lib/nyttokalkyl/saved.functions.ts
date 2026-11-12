import { createServerFn } from "@tanstack/react-start";
import { requireAuth, type AuthContext } from "@/lib/auth-middleware";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown, label = "id"): string {
  const s = String(value ?? "");
  if (!UUID.test(s)) throw new Error(`Ogiltigt ${label}.`);
  return s;
}

function title(value: unknown): string {
  const s = String(value ?? "").trim().slice(0, 200);
  if (!s) throw new Error("Skriv en rubrik först.");
  return s;
}

const db = () => import("@/lib/db.server");

export const listCalculationsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await db();
    const rows = await query<{ id: string; title: string; updated_at: Date }>(
      `SELECT id, title, updated_at FROM calculations
        WHERE user_id = $1 ORDER BY updated_at DESC`,
      [(context as AuthContext).userId],
    );
    return rows.map((r) => ({ id: r.id, title: r.title, updated_at: new Date(r.updated_at).toISOString() }));
  });

export const saveCalculationFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id?: string | null; title: string; state: unknown }) => ({
    id: data.id ? uuid(data.id) : null,
    title: title(data.title),
    state: data.state ?? {},
  }))
  .handler(async ({ data, context }) => {
    const { query } = await db();
    const userId = (context as AuthContext).userId;
    const json = JSON.stringify(data.state);
    if (data.id) {
      const rows = await query<{ id: string }>(
        `UPDATE calculations SET title = $1, data = $2::jsonb
          WHERE id = $3 AND user_id = $4 RETURNING id`,
        [data.title, json, data.id, userId],
      );
      if (!rows[0]) throw new Error("Kalkylen hittades inte.");
      return rows[0].id;
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO calculations (user_id, title, data) VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [userId, data.title, json],
    );
    return rows[0]!.id;
  });

export const loadCalculationFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => ({ id: uuid(data.id) }))
  .handler(async ({ data, context }) => {
    const { query } = await db();
    const rows = await query<{ title: string; data: unknown }>(
      "SELECT title, data FROM calculations WHERE id = $1 AND user_id = $2",
      [data.id, (context as AuthContext).userId],
    );
    if (!rows[0]) throw new Error("Kalkylen hittades inte.");
    return { title: rows[0].title, dataJson: JSON.stringify(rows[0].data ?? {}) };
  });

export const renameCalculationFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string; title: string }) => ({ id: uuid(data.id), title: title(data.title) }))
  .handler(async ({ data, context }) => {
    const { query } = await db();
    const rows = await query(
      "UPDATE calculations SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING id",
      [data.title, data.id, (context as AuthContext).userId],
    );
    if (!rows[0]) throw new Error("Kalkylen hittades inte.");
    return { ok: true };
  });

export const deleteCalculationFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => ({ id: uuid(data.id) }))
  .handler(async ({ data, context }) => {
    const { query } = await db();
    await query("DELETE FROM calculations WHERE id = $1 AND user_id = $2", [
      data.id,
      (context as AuthContext).userId,
    ]);
    return { ok: true };
  });

export const getShareTokenFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => ({ id: uuid(data.id) }))
  .handler(async ({ data, context }) => {
    const { query } = await db();
    const rows = await query<{ share_token: string }>(
      `UPDATE calculations SET share_token = COALESCE(share_token, gen_random_uuid())
        WHERE id = $1 AND user_id = $2 RETURNING share_token`,
      [data.id, (context as AuthContext).userId],
    );
    if (!rows[0]) throw new Error("Kalkylen hittades inte.");
    return rows[0].share_token;
  });

export const stopSharingFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { id: string }) => ({ id: uuid(data.id) }))
  .handler(async ({ data, context }) => {
    const { query } = await db();
    await query("UPDATE calculations SET share_token = NULL WHERE id = $1 AND user_id = $2", [
      data.id,
      (context as AuthContext).userId,
    ]);
    return { ok: true };
  });

/** Publik: kräver ingen inloggning, bara en giltig delningstoken. */
export const loadSharedCalculationFn = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data.token ?? "") }))
  .handler(async ({ data }) => {
    if (!UUID.test(data.token)) return null;
    const { query } = await db();
    const rows = await query<{ title: string; data: unknown }>(
      "SELECT title, data FROM get_shared_calculation($1::uuid)",
      [data.token],
    );
    if (!rows[0]) return null;
    return { title: rows[0].title, dataJson: JSON.stringify(rows[0].data ?? {}) };
  });
