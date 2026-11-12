// Serverkod: lösenord, sessioner och cookie. Importeras bara dynamiskt
// inifrån serverfunktioner och middleware.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { query } from "./db.server";

export type AppRole = "user" | "admin" | "superadmin";

export const SESSION_COOKIE = "nk_session";
const SESSION_HOURS = 12;
const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** Lagras som `scrypt$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "!7";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [hashToken(token), userId, SESSION_HOURS],
  );
  await query("UPDATE users SET last_sign_in_at = now() WHERE id = $1", [userId]);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  forvaltning: string | null;
  roles: AppRole[];
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const rows = await query<{
    id: string;
    email: string;
    full_name: string | null;
    forvaltning: string | null;
    roles: AppRole[] | null;
  }>(
    `SELECT u.id, u.email, p.full_name, p.forvaltning,
            array_remove(array_agg(r.role), NULL) AS roles
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN user_roles r ON r.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > now()
      GROUP BY u.id, u.email, p.full_name, p.forvaltning`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    forvaltning: row.forvaltning,
    roles: row.roles ?? [],
  };
}
