// Serverkod: anslutning till Stackship PostgreSQL. Importeras bara dynamiskt
// inifrån serverfunktioner så att `pg` aldrig hamnar i webbläsarens bundle.
import pg from "pg";

let pool: pg.Pool | undefined;

/**
 * Stackship ger en connection string med `?sslmode=require`. Nyare `pg` tolkar
 * det som full certifikatkontroll, vilket fallerar mot klustrets egna CA.
 * Vi tar därför bort sslmode ur URL:en och sätter TLS-inställningen själva:
 * kryptering när sslmode kräver det, utan kontroll av certifikatkedjan
 * (som libpq gör vid sslmode=require).
 */
function poolConfig(raw: string): pg.PoolConfig {
  let connectionString = raw;
  let ssl: pg.PoolConfig["ssl"] = undefined;
  try {
    const url = new URL(raw);
    const mode = url.searchParams.get("sslmode");
    url.searchParams.delete("sslmode");
    connectionString = url.toString();
    if (mode === "verify-full" || mode === "verify-ca") ssl = { rejectUnauthorized: true };
    else if (mode && mode !== "disable" && mode !== "allow" && mode !== "prefer") ssl = { rejectUnauthorized: false };
  } catch {
    // Ej en URL (t.ex. nyckel=värde-format) – skicka vidare oförändrad.
  }
  return { connectionString, ssl, max: 5, idleTimeoutMillis: 30_000 };
}

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error("DATABASE_URL saknas. Sätt den på containern i Stackship.");
    }
    pool = new pg.Pool(poolConfig(connectionString));
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
