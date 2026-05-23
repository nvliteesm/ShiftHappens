/**
 * Tests for User Repository (Entity Layer)
 * Verifies CRUD operations against a real PostgreSQL database.
 * Each test starts with a clean database via beforeEach cleanup.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { UserRepository } from "@/repositories/user.repository";
import { prisma } from "@/lib/prisma";

const userRepo = new UserRepository();

beforeEach(async () => {
  await prisma.invitationToken.deleteMany();
  await prisma.departmentMembership.deleteMany();
  await prisma.department.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
});

describe("UserRepository", () => {
  describe("create", () => {
    it("creates a new user", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hashed_password_123",
      });

      expect(user.id).toBeDefined();
      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john@example.com");
      expect(user.emailVerified).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("finds an existing user by email", async () => {
      await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hashed_password_123",
      });

      const found = await userRepo.findByEmail("john@example.com");
      expect(found).not.toBeNull();
      expect(found!.name).toBe("John Doe");
    });

    it("returns null for non-existent email", async () => {
      const found = await userRepo.findByEmail("nobody@example.com");
      expect(found).toBeNull();
    });
  });

  describe("findById", () => {
    it("finds an existing user by id", async () => {
      const created = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hashed_password_123",
      });

      const found = await userRepo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe("john@example.com");
    });
  });

  describe("updateProfile", () => {
    it("updates user name", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hashed_password_123",
      });

      const updated = await userRepo.updateProfile(user.id, {
        name: "Jane Doe",
      });
      expect(updated.name).toBe("Jane Doe");
    });

    it("updates user password", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "old_hash",
      });

      const updated = await userRepo.updateProfile(user.id, {
        hashedPassword: "new_hash",
      });
      expect(updated.hashedPassword).toBe("new_hash");
    });
  });

  describe("verifyEmail", () => {
    it("sets emailVerified timestamp", async () => {
      const user = await userRepo.create({
        name: "John Doe",
        email: "john@example.com",
        hashedPassword: "hashed_password_123",
      });

      const verified = await userRepo.verifyEmail(user.id);
      expect(verified.emailVerified).not.toBeNull();
    });
  });
});