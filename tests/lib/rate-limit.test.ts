/**
 * Tests for Rate Limit Utility
 * Verifies sliding window counter logic, tier enforcement,
 * window reset behavior, and store cleanup.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit, resetRateLimitStore } from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimitStore();
});

describe("rateLimit", () => {
  describe("within limits", () => {
    it("allows first request", () => {
      const result = rateLimit("test-ip:strict", 5);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(5);
    });

    it("allows requests up to the limit", () => {
      for (let i = 0; i < 5; i++) {
        const result = rateLimit("test-ip:strict", 5);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it("tracks different keys independently", () => {
      // Exhaust one key
      for (let i = 0; i < 5; i++) {
        rateLimit("ip-a:strict", 5);
      }
      const blocked = rateLimit("ip-a:strict", 5);
      expect(blocked.success).toBe(false);

      // Different key should still work
      const allowed = rateLimit("ip-b:strict", 5);
      expect(allowed.success).toBe(true);
      expect(allowed.remaining).toBe(4);
    });
  });

  describe("over limits", () => {
    it("blocks requests exceeding the limit", () => {
      for (let i = 0; i < 5; i++) {
        rateLimit("test-ip:strict", 5);
      }

      const result = rateLimit("test-ip:strict", 5);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("returns resetIn when blocked", () => {
      for (let i = 0; i < 5; i++) {
        rateLimit("test-ip:strict", 5);
      }

      const result = rateLimit("test-ip:strict", 5);
      expect(result.success).toBe(false);
      expect(result.resetIn).toBeGreaterThan(0);
      expect(result.resetIn).toBeLessThanOrEqual(60_000);
    });
  });

  describe("window reset", () => {
    it("resets counter after window expires", () => {
      // Use a short window for testing
      for (let i = 0; i < 5; i++) {
        rateLimit("test-ip:strict", 5, 100);
      }
      const blocked = rateLimit("test-ip:strict", 5, 100);
      expect(blocked.success).toBe(false);

      // Wait for window to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = rateLimit("test-ip:strict", 5, 100);
          expect(result.success).toBe(true);
          expect(result.remaining).toBe(4);
          resolve();
        }, 150);
      });
    });
  });

  describe("tier limits", () => {
    it("enforces strict tier (5 req/min)", () => {
      for (let i = 0; i < 5; i++) {
        const result = rateLimit("ip:strict", 5);
        expect(result.success).toBe(true);
      }
      expect(rateLimit("ip:strict", 5).success).toBe(false);
    });

    it("enforces moderate tier (20 req/min)", () => {
      for (let i = 0; i < 20; i++) {
        const result = rateLimit("ip:moderate", 20);
        expect(result.success).toBe(true);
      }
      expect(rateLimit("ip:moderate", 20).success).toBe(false);
    });

    it("enforces relaxed tier (100 req/min)", () => {
      for (let i = 0; i < 100; i++) {
        const result = rateLimit("ip:relaxed", 100);
        expect(result.success).toBe(true);
      }
      expect(rateLimit("ip:relaxed", 100).success).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles single request limit", () => {
      const first = rateLimit("test:single", 1);
      expect(first.success).toBe(true);
      expect(first.remaining).toBe(0);

      const second = rateLimit("test:single", 1);
      expect(second.success).toBe(false);
    });

    it("handles concurrent keys without interference", () => {
      rateLimit("user-1:strict", 5);
      rateLimit("user-2:moderate", 20);
      rateLimit("user-3:relaxed", 100);

      const r1 = rateLimit("user-1:strict", 5);
      expect(r1.remaining).toBe(3);

      const r2 = rateLimit("user-2:moderate", 20);
      expect(r2.remaining).toBe(18);

      const r3 = rateLimit("user-3:relaxed", 100);
      expect(r3.remaining).toBe(98);
    });
  });
});