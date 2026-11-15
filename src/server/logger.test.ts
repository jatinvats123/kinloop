import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("writes one JSON line with severity and fields to stdout", () => {
    vi.stubEnv("NODE_ENV", "production");
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    logger.info("tick done", { sent: 3 });
    const line = JSON.parse(String(out.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ severity: "INFO", message: "tick done", sent: 3 });
  });

  it("writes errors to stderr", () => {
    vi.stubEnv("NODE_ENV", "production");
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    logger.error("mail failed");
    expect(JSON.parse(String(err.mock.calls[0]?.[0])).severity).toBe("ERROR");
  });

  it("stays silent under test", () => {
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    logger.warn("quiet");
    expect(out).not.toHaveBeenCalled();
  });
});
