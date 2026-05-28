/**
 * Tests for Organization Access Guard
 * Verifies org suspension enforcement at the data level.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { checkOrgActive } from "@/lib/org-guard";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";
import { cleanDatabase } from "../helpers/cleanup";

const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let userId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Test User",
    email: "test@example.com",
    hashedPassword: "hash",
  });
  userId = user.id;
});

describe("checkOrgActive", () => {
  it("returns true for an active organization", async () => {
    const org = await orgRepo.create({ name: "Active Org", slug: "active-org" }, userId);
    const result = await checkOrgActive(org.id);
    expect(result).toBe(true);
  });

  it("returns false for a suspended organization", async () => {
    const org = await orgRepo.create({ name: "Suspended Org", slug: "suspended-org" }, userId);
    await prisma.organization.update({
      where: { id: org.id },
      data: { status: "suspended" },
    });

    const result = await checkOrgActive(org.id);
    expect(result).toBe(false);
  });

  it("returns false for a non-existent organization", async () => {
    const result = await checkOrgActive("nonexistent-id");
    expect(result).toBe(false);
  });

  it("returns true after reactivating a suspended org", async () => {
    const org = await orgRepo.create({ name: "Test Org", slug: "test-org" }, userId);
    await prisma.organization.update({
      where: { id: org.id },
      data: { status: "suspended" },
    });

    expect(await checkOrgActive(org.id)).toBe(false);

    await prisma.organization.update({
      where: { id: org.id },
      data: { status: "active" },
    });

    expect(await checkOrgActive(org.id)).toBe(true);
  });
});