/**
 * Tests for cron authorization.
 *
 * The scheduled-jobs endpoint is unauthenticated by a user session — it is
 * called by an external scheduler (Vercel Cron / GitHub Actions) that presents
 * a shared secret as a Bearer token. Auth must FAIL CLOSED: if no secret is
 * configured, no request is authorized (the endpoint is never left open).
 */
import { describe, it, expect, afterEach } from "vitest";
import { isAuthorizedCron } from "@/lib/cron-auth";

const ORIGINAL = process.env.CRON_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

describe("isAuthorizedCron", () => {
  it("rejects everything when no secret is configured (fail closed)", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCron("Bearer anything")).toBe(false);
    expect(isAuthorizedCron(null)).toBe(false);
  });

  it("accepts a matching bearer token", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isAuthorizedCron("Bearer s3cret-value")).toBe(true);
  });

  it("rejects a wrong token", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isAuthorizedCron("Bearer wrong")).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isAuthorizedCron(null)).toBe(false);
    expect(isAuthorizedCron(undefined)).toBe(false);
    expect(isAuthorizedCron("s3cret-value")).toBe(false); // no "Bearer " prefix
  });
});
