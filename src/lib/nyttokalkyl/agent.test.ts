import { afterEach, expect, it, vi } from "vitest";
import { callAgent } from "./agent";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("handles success false even without a data property", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: "Försök igen" }))));
  expect(await callAgent("chat", {})).toEqual({ success: false, error: "Försök igen" });
});

it("aborts after the specified 90 seconds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("Aborted")));
  })));
  const response = callAgent("chat", {});
  await vi.advanceTimersByTimeAsync(89999);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await response).toMatchObject({ success: false, error: expect.stringContaining("90 sekunder") });
  expect(vi.getTimerCount()).toBe(0);
});