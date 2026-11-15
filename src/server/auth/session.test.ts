import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCircle, makeMember } from "@/test/fixtures";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import { setRepositoryForTests } from "@/server/repositories";

const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
const headerValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) =>
      jar.set(name, { value, options }),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

const {
  SESSION_COOKIE,
  clientKey,
  endSession,
  homeFor,
  readSession,
  requireSession,
  startSession,
} = await import("./session");

const CODE = "ACDEFGHJ";
const NOW = new Date("2026-11-15T06:30:00.000Z");
const kamla = makeMember({ id: "m-elder", passcodeHash: "hash-1" });
let repo: MemoryRepository;

beforeEach(async () => {
  jar.clear();
  headerValues.clear();
  repo = new MemoryRepository();
  setRepositoryForTests(repo);
  await repo.createCircle({ circle: makeCircle({ code: CODE }), members: [kamla] });
});

describe("session cookie", () => {
  it("issues an httpOnly, SameSite=Lax, 12-hour cookie and reads the member back", async () => {
    await startSession(CODE, kamla);
    const cookie = jar.get(SESSION_COOKIE);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 });
    const ctx = await readSession(NOW);
    expect(ctx?.member.id).toBe("m-elder");
    expect(ctx?.circle.code).toBe(CODE);
  });

  it("returns null without a cookie, with a tampered token, or after signing out", async () => {
    expect(await readSession(NOW)).toBeNull();
    jar.set(SESSION_COOKIE, { value: "not.a.token" });
    expect(await readSession(NOW)).toBeNull();
    await startSession(CODE, kamla);
    await endSession();
    expect(await readSession(NOW)).toBeNull();
  });

  it("ends the session when the passcode is regenerated or the member is removed", async () => {
    await startSession(CODE, kamla);
    await repo.putMember(CODE, { ...kamla, passcodeHash: "hash-2" });
    expect(await readSession(NOW)).toBeNull();
    await repo.putMember(CODE, kamla);
    expect(await readSession(NOW)).not.toBeNull();
    await repo.deleteMember(CODE, kamla.id);
    expect(await readSession(NOW)).toBeNull();
  });

  it("ends the session when a demo circle has expired", async () => {
    await startSession(CODE, kamla);
    await repo.updateCircle(CODE, { isDemo: true, expiresAt: "2026-11-15T06:00:00.000Z" });
    expect(await readSession(NOW)).toBeNull();
  });

  it("redirects to sign-in from the guard when there is no session", async () => {
    await expect(requireSession()).rejects.toThrow("redirect:/sign-in");
    await startSession(CODE, kamla);
    expect((await requireSession()).member.name).toBe("Kamla Devi");
  });
});

describe("homeFor and clientKey", () => {
  it("sends the elder to Today and everyone else to the overview", () => {
    expect(homeFor({ role: "elder" })).toBe("/today");
    expect(homeFor({ role: "family" })).toBe("/overview");
    expect(homeFor({ role: "caretaker" })).toBe("/overview");
  });

  it("keys rate limits by a salted hash of the first forwarded IP, never the IP itself", async () => {
    headerValues.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");
    const a = await clientKey("ai");
    expect(a).toMatch(/^ai-[\w-]{22}$/);
    expect(a).not.toContain("203.0.113.7");
    headerValues.set("x-forwarded-for", "203.0.113.8");
    expect(await clientKey("ai")).not.toBe(a);
    headerValues.clear();
    expect(await clientKey("ai")).toMatch(/^ai-/);
  });
});
