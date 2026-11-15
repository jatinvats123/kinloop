import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";
import { isAllowedOrigin } from "./origin";

describe("isAllowedOrigin", () => {
  it("lets safe methods through without an origin", () => {
    expect(isAllowedOrigin("GET", "/today", null, "kinloop.app")).toBe(true);
  });

  it("accepts a POST whose origin matches the host", () => {
    expect(isAllowedOrigin("POST", "/today", "https://kinloop.app", "kinloop.app")).toBe(true);
  });

  it("rejects a POST from another site", () => {
    expect(isAllowedOrigin("POST", "/today", "https://evil.example", "kinloop.app")).toBe(false);
  });

  it("rejects a POST with no origin header", () => {
    expect(isAllowedOrigin("POST", "/today", null, "kinloop.app")).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isAllowedOrigin("DELETE", "/x", "not a url", "kinloop.app")).toBe(false);
  });

  it("lets the scheduler call the cron endpoint, which authenticates by token", () => {
    expect(isAllowedOrigin("POST", "/api/cron/tick", null, "kinloop.app")).toBe(true);
  });
});

describe("buildCsp", () => {
  it("allows scripts only with the nonce and forbids framing", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("'nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows eval only in development", () => {
    expect(buildCsp("abc", true)).toContain("'unsafe-eval'");
  });
});
