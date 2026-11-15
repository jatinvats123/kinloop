// Tests that the process-wide singleton holder is created once and shared between callers.
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "@/server/repositories/memory-repository";
import { singletons } from "./singletons";

describe("singletons", () => {
  it("returns the same holder on every call", () => {
    expect(singletons()).toBe(singletons());
  });

  it("keeps a stored instance visible to later callers", () => {
    const repo = new MemoryRepository();
    singletons().repository = repo;
    expect(singletons().repository).toBe(repo);
  });

  it("lives on globalThis so hot reloads reuse it", () => {
    expect(globalThis.__kinloopSingletons).toBe(singletons());
  });
});
