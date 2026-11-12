// Serverkod: anslutning till Stackship PostgreSQL. Importeras bara dynamiskt
// inifrån serverfunktioner så att `pg` aldrig hamnar i webbläsarens bundle.
import pg from "pg";

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error("DATABASE_URL saknas. Sätt den på containern i Stackship.");
    }
    pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
    pool.on("error", (error) => console.error("[db] idle client error", error));
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

/** Kör flera frågor i en transaktion. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
