import { afterEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
    return builder;
  },
  createMiddleware: () => ({ server: () => ({}) }),
}));
vi.mock("@/lib/auth-middleware", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth-middleware")>()),
  requireAuth: {},
}));
import { sendCredentials } from "./admin.functions";

const invoke = sendCredentials as unknown as (input: unknown) => Promise<{ sent: boolean }>;
const payload = { email: "recipient@example.test", password: "fixture-not-a-real-password", event: "account_created" };
const context = (role: string) => ({ userId: "fixture-user", email: "fixture@example.test", roles: [role], forvaltning: null });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("rejects ordinary users before sending credential mail", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(invoke({ data: payload, context: context("user") })).rejects.toThrow("Endast administratörer");
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(["admin", "superadmin"])("permits %s with a server-only key and exact requested body", async (role) => {
  vi.stubEnv("N8N_BASE_URL", "https://fixture.example.test");
  vi.stubEnv("N8N_MAIL_API_KEY", "fixture-key-not-a-real-secret");
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  expect(await invoke({ data: payload, context: context(role) })).toMatchObject({ sent: true });
  const [url, options] = fetcher.mock.calls[0] ?? [];
  expect(url).toBe("https://fixture.example.test/webhook/99a7a6e8-e622-4f99-bd69-748a0ab4c6b4");
  expect(options.headers["X-Api-Key"]).toBe("fixture-key-not-a-real-secret");
  expect(JSON.parse(options.body)).toEqual(payload);
});

it("does not send mail without the key", async () => {
  vi.stubEnv("N8N_MAIL_API_KEY", "");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(await invoke({ data: payload, context: context("admin") })).toMatchObject({ sent: false });
  expect(fetcher).not.toHaveBeenCalled();
});