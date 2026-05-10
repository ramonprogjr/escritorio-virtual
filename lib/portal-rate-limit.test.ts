import { describe, it, expect, beforeEach } from "vitest";
import { checkPortalVerifyRateLimit, _resetPortalRateLimitForTests } from "./portal-rate-limit";

describe("checkPortalVerifyRateLimit", () => {
  beforeEach(() => {
    _resetPortalRateLimitForTests();
  });

  it("allows under cap", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkPortalVerifyRateLimit("k1", 5, 60_000).ok).toBe(true);
    }
  });

  it("blocks after cap", () => {
    for (let i = 0; i < 3; i++) {
      checkPortalVerifyRateLimit("k2", 3, 60_000);
    }
    const last = checkPortalVerifyRateLimit("k2", 3, 60_000);
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.retryAfterSec).toBeGreaterThan(0);
  });
});
