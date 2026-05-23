/**
 * Database Seed Script
 * 
 * Seeds the Permission table with all predefined permissions
 * organized by category. These permissions are used by the RBAC
 * system to control access to features across the application.
 * 
 * Run with: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  // Department management
  { name: "departments:create", description: "Create new departments", category: "departments" },
  { name: "departments:read", description: "View departments", category: "departments" },
  { name: "departments:update", description: "Update department details", category: "departments" },
  { name: "departments:delete", description: "Delete departments", category: "departments" },

  // Member management
  { name: "members:read", description: "View organization members", category: "members" },
  { name: "members:invite", description: "Invite new members", category: "members" },
  { name: "members:update_role", description: "Update member roles", category: "members" },
  { name: "members:deactivate", description: "Activate or deactivate members", category: "members" },

  // Task management (Phase 4)
  { name: "tasks:create", description: "Create new tasks", category: "tasks" },
  { name: "tasks:read", description: "View tasks", category: "tasks" },
  { name: "tasks:update", description: "Update task details", category: "tasks" },
  { name: "tasks:delete", description: "Delete tasks", category: "tasks" },
  { name: "tasks:assign", description: "Assign staff to tasks", category: "tasks" },
  { name: "tasks:accept_reject", description: "Accept or reject task assignments", category: "tasks" },
  { name: "tasks:clock", description: "Clock in and out of tasks", category: "tasks" },

  // Eligibility & allocation (Phase 5)
  { name: "eligibility:view", description: "View eligibility status of staff", category: "eligibility" },
  { name: "eligibility:override", description: "Override eligibility blocks with reason", category: "eligibility" },
  { name: "allocation:use_suggestions", description: "Use AI-powered allocation suggestions", category: "allocation" },
  { name: "allocation:auto_allocate", description: "Trigger auto-allocation for tasks", category: "allocation" },

  // Reporting (Phase 6)
  { name: "reports:view", description: "View reports and analytics", category: "reports" },
  { name: "reports:export", description: "Export reports as CSV or PDF", category: "reports" },

  // Calendar (Phase 6)
  { name: "calendar:view", description: "View calendar", category: "calendar" },
  { name: "calendar:manage_availability", description: "Manage own availability schedule", category: "calendar" },

  // Notifications (Phase 6)
  { name: "notifications:receive", description: "Receive notifications", category: "notifications" },
  { name: "notifications:manage", description: "Manage notification preferences", category: "notifications" },

  // Settings (Phase 3)
  { name: "settings:read", description: "View company settings", category: "settings" },
  { name: "settings:update", description: "Update company settings", category: "settings" },

  // Roles (Phase 3)
  { name: "roles:create", description: "Create custom roles", category: "roles" },
  { name: "roles:read", description: "View roles and permissions", category: "roles" },
  { name: "roles:update", description: "Update role permissions", category: "roles" },
  { name: "roles:delete", description: "Delete custom roles", category: "roles" },

  // Organization (Phase 2)
  { name: "organization:read", description: "View organization details", category: "organization" },
  { name: "organization:update", description: "Update organization profile", category: "organization" },

  // Audit (Phase 7)
  { name: "audit:view", description: "View audit logs", category: "audit" },
];

async function main() {
  console.log("Seeding permissions...");

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, category: perm.category },
      create: perm,
    });
  }

  console.log(`Seeded ${permissions.length} permissions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });