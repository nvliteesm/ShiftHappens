/**
 * Tests for AuditLog Repository (Entity Layer)
 * Verifies audit log creation, querying with filters,
 * and pagination.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { AuditLogRepository } from "@/repositories/audit-log.repository";
import { OrganizationRepository } from "@/repositories/organization.repository";
import { UserRepository } from "@/repositories/user.repository";
import { cleanDatabase } from "../helpers/cleanup";

const auditRepo = new AuditLogRepository();
const orgRepo = new OrganizationRepository();
const userRepo = new UserRepository();

let orgId: string;
let userId: string;

beforeEach(async () => {
  await cleanDatabase();

  const user = await userRepo.create({
    name: "Admin",
    email: "admin@example.com",
    hashedPassword: "hash",
  });
  userId = user.id;

  const org = await orgRepo.create(
    { name: "Test Org", slug: "test-org" },
    user.id
  );
  orgId = org.id;
});

describe("AuditLogRepository", () => {
  describe("create", () => {
    it("creates an audit log entry", async () => {
      const log = await auditRepo.create({
        organizationId: orgId,
        userId,
        action: "task.created",
        entityType: "task",
        entityId: "task-123",
        details: { title: "Test task" },
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe("task.created");
      expect(log.entityType).toBe("task");
      expect(log.userId).toBe(userId);
    });

    it("creates entry without optional fields", async () => {
      const log = await auditRepo.create({
        organizationId: orgId,
        action: "settings.updated",
        entityType: "settings",
      });

      expect(log.id).toBeDefined();
      expect(log.userId).toBeNull();
      expect(log.entityId).toBeNull();
      expect(log.details).toBeNull();
    });
  });

  describe("findByOrganizationId", () => {
    it("returns all logs for an organization", async () => {
      await auditRepo.create({
        organizationId: orgId,
        action: "task.created",
        entityType: "task",
      });
      await auditRepo.create({
        organizationId: orgId,
        action: "task.updated",
        entityType: "task",
      });

      const logs = await auditRepo.findByOrganizationId(orgId);
      expect(logs).toHaveLength(2);
      const actions = logs.map((l) => l.action);
      expect(actions).toContain("task.created");
      expect(actions).toContain("task.updated");
    });

    it("filters by action", async () => {
      await auditRepo.create({
        organizationId: orgId,
        action: "task.created",
        entityType: "task",
      });
      await auditRepo.create({
        organizationId: orgId,
        action: "task.deleted",
        entityType: "task",
      });

      const logs = await auditRepo.findByOrganizationId(orgId, {
        action: "task.created",
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("task.created");
    });

    it("filters by entity type", async () => {
      await auditRepo.create({
        organizationId: orgId,
        action: "task.created",
        entityType: "task",
      });
      await auditRepo.create({
        organizationId: orgId,
        action: "department.created",
        entityType: "department",
      });

      const logs = await auditRepo.findByOrganizationId(orgId, {
        entityType: "department",
      });
      expect(logs).toHaveLength(1);
    });

    it("paginates results", async () => {
      for (let i = 0; i < 5; i++) {
        await auditRepo.create({
          organizationId: orgId,
          action: "task.created",
          entityType: "task",
        });
      }

      const page1 = await auditRepo.findByOrganizationId(orgId, {}, 2, 0);
      expect(page1).toHaveLength(2);

      const page2 = await auditRepo.findByOrganizationId(orgId, {}, 2, 2);
      expect(page2).toHaveLength(2);

      const page3 = await auditRepo.findByOrganizationId(orgId, {}, 2, 4);
      expect(page3).toHaveLength(1);
    });

    it("includes user details", async () => {
      await auditRepo.create({
        organizationId: orgId,
        userId,
        action: "task.created",
        entityType: "task",
      });

      const logs = await auditRepo.findByOrganizationId(orgId);
      expect(logs[0].user).toBeDefined();
      expect(logs[0].user!.name).toBe("Admin");
    });

    it("does not return logs from other organizations", async () => {
      const user2 = await userRepo.create({
        name: "Other",
        email: "other@example.com",
        hashedPassword: "hash",
      });
      const org2 = await orgRepo.create(
        { name: "Other Org", slug: "other-org" },
        user2.id
      );

      await auditRepo.create({
        organizationId: orgId,
        action: "task.created",
        entityType: "task",
      });
      await auditRepo.create({
        organizationId: org2.id,
        action: "task.created",
        entityType: "task",
      });

      const logs = await auditRepo.findByOrganizationId(orgId);
      expect(logs).toHaveLength(1);
    });
  });

  describe("countByOrganizationId", () => {
    it("returns total count", async () => {
      for (let i = 0; i < 3; i++) {
        await auditRepo.create({
          organizationId: orgId,
          action: "task.created",
          entityType: "task",
        });
      }

      const count = await auditRepo.countByOrganizationId(orgId);
      expect(count).toBe(3);
    });

    it("counts with filters", async () => {
      await auditRepo.create({
        organizationId: orgId,
        action: "task.created",
        entityType: "task",
      });
      await auditRepo.create({
        organizationId: orgId,
        action: "task.deleted",
        entityType: "task",
      });

      const count = await auditRepo.countByOrganizationId(orgId, {
        action: "task.created",
      });
      expect(count).toBe(1);
    });
  });
});