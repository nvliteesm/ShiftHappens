/**
 * Demo Data Seed Script
 * 
 * Creates realistic demo data for testing:
 * - 1 Company Admin
 * - 2 Managers
 * - 5 Staff members
 * - 3 Departments
 * - Several tasks
 * - Availability schedules
 * - Certifications
 * 
 * Run with: npx tsx prisma/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  // Get the existing org or create one
  let org = await prisma.organization.findFirst();
  let adminUser = await prisma.user.findFirst();

  if (!org || !adminUser) {
    console.log("Creating admin user and organization...");
    const hashedPassword = await bcrypt.hash("TestPass1!", 12);

    adminUser = await prisma.user.create({
      data: {
        name: "Darryn Wan",
        email: "admin@oceangrill.com",
        hashedPassword,
        emailVerified: new Date(),
      },
    });

    org = await prisma.organization.create({
      data: {
        name: "Ocean Grill",
        slug: "ocean-grill",
        industry: "Hospitality",
        description: "A beachside restaurant and bar",
      },
    });

    await prisma.membership.create({
      data: {
        userId: adminUser.id,
        organizationId: org.id,
        role: "company_admin",
        status: "active",
      },
    });
  }

  const orgId = org.id;
  const hashedPassword = await bcrypt.hash("TestPass1!", 12);

  // Create departments
  const departments = [];
  const deptNames = [
    { name: "Kitchen", description: "Food preparation and cooking" },
    { name: "Bar", description: "Beverage service and cocktails" },
    { name: "Front of House", description: "Guest service, hosting, and dining room" },
  ];

  for (const dept of deptNames) {
    const existing = await prisma.department.findUnique({
      where: { organizationId_name: { organizationId: orgId, name: dept.name } },
    });
    if (existing) {
      departments.push(existing);
    } else {
      const created = await prisma.department.create({
        data: { ...dept, organizationId: orgId },
      });
      departments.push(created);
    }
  }

  console.log(`Created ${departments.length} departments`);

  // Create managers
  const managers = [
    { name: "Sarah Chen", email: "sarah@oceangrill.com", dept: "Kitchen" },
    { name: "Marcus Johnson", email: "marcus@oceangrill.com", dept: "Bar" },
  ];

  for (const mgr of managers) {
    let user = await prisma.user.findUnique({ where: { email: mgr.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: mgr.name,
          email: mgr.email,
          hashedPassword,
          emailVerified: new Date(),
        },
      });
    }

    let membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (!membership) {
      membership = await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          role: "manager",
          status: "active",
        },
      });
    }

    // Assign to department
    const dept = departments.find((d) => d.name === mgr.dept);
    if (dept) {
      const existing = await prisma.departmentMembership.findUnique({
        where: { membershipId_departmentId: { membershipId: membership.id, departmentId: dept.id } },
      });
      if (!existing) {
        await prisma.departmentMembership.create({
          data: { membershipId: membership.id, departmentId: dept.id },
        });
      }
    }
  }

  console.log("Created 2 managers");

  // Create staff
  const staffMembers = [
    { name: "Alex Rivera", email: "alex@oceangrill.com" },
    { name: "Jamie Park", email: "jamie@oceangrill.com" },
    { name: "Taylor Smith", email: "taylor@oceangrill.com" },
    { name: "Jordan Lee", email: "jordan@oceangrill.com" },
    { name: "Casey Brown", email: "casey@oceangrill.com" },
  ];

  const staffMembershipIds: string[] = [];

  for (const staff of staffMembers) {
    let user = await prisma.user.findUnique({ where: { email: staff.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: staff.name,
          email: staff.email,
          hashedPassword,
          emailVerified: new Date(),
        },
      });
    }

    let membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (!membership) {
      membership = await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          role: "staff",
          status: "active",
        },
      });
    }

    staffMembershipIds.push(membership.id);

    // Set weekly availability (varied per staff)
    const schedules: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[] = [];

    if (staff.name === "Alex Rivera") {
      // Morning person, Mon-Fri
      for (let d = 1; d <= 5; d++) schedules.push({ dayOfWeek: d, startTime: "06:00", endTime: "14:00", isAvailable: true });
    } else if (staff.name === "Jamie Park") {
      // Evening person, Mon-Sat
      for (let d = 1; d <= 6; d++) schedules.push({ dayOfWeek: d, startTime: "14:00", endTime: "22:00", isAvailable: true });
    } else if (staff.name === "Taylor Smith") {
      // Full day, Mon-Fri
      for (let d = 1; d <= 5; d++) schedules.push({ dayOfWeek: d, startTime: "08:00", endTime: "18:00", isAvailable: true });
    } else if (staff.name === "Jordan Lee") {
      // Part time, Wed-Sun
      for (let d = 0; d <= 0; d++) schedules.push({ dayOfWeek: d, startTime: "10:00", endTime: "18:00", isAvailable: true });
      for (let d = 3; d <= 6; d++) schedules.push({ dayOfWeek: d, startTime: "10:00", endTime: "18:00", isAvailable: true });
    } else if (staff.name === "Casey Brown") {
      // Flexible, all week
      for (let d = 0; d <= 6; d++) schedules.push({ dayOfWeek: d, startTime: "07:00", endTime: "23:00", isAvailable: true });
    }

    for (const sched of schedules) {
      await prisma.availability.upsert({
        where: {
          membershipId_dayOfWeek: { membershipId: membership.id, dayOfWeek: sched.dayOfWeek },
        },
        update: sched,
        create: { ...sched, membershipId: membership.id },
      });
    }
  }

  console.log("Created 5 staff with availability schedules");

  // Create certifications
  const certData = [
    { staffIndex: 0, name: "Food Safety Level 2", issued: "2026-01-15" },
    { staffIndex: 0, name: "First Aid", issued: "2025-06-01" },
    { staffIndex: 1, name: "Food Safety Level 2", issued: "2026-03-01" },
    { staffIndex: 2, name: "Food Safety Level 2", issued: "2025-11-01" },
    { staffIndex: 2, name: "First Aid", issued: "2026-02-01" },
    { staffIndex: 2, name: "RSA Certification", issued: "2026-01-01", expiry: "2027-01-01" },
    { staffIndex: 4, name: "Food Safety Level 2", issued: "2026-04-01" },
    { staffIndex: 4, name: "Barista Certificate", issued: "2026-03-15" },
  ];

  for (const cert of certData) {
    const existing = await prisma.certification.findFirst({
      where: { membershipId: staffMembershipIds[cert.staffIndex], name: cert.name },
    });
    if (!existing) {
      await prisma.certification.create({
        data: {
          membershipId: staffMembershipIds[cert.staffIndex],
          name: cert.name,
          issuedDate: new Date(cert.issued),
          expiryDate: cert.expiry ? new Date(cert.expiry) : null,
          status: "verified",
          verifiedById: adminUser!.id,
          verifiedAt: new Date(),
        },
      });
    }
  }

  console.log("Created 8 certifications");

  // Create tasks
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const taskData = [
    {
      title: "Morning Kitchen Prep",
      description: "Prepare mise en place, check deliveries, prep sauces",
      departmentId: departments[0].id,
      priority: "high",
      requiredHeadcount: 2,
      startHour: 7,
      endHour: 10,
    },
    {
      title: "Lunch Service",
      description: "Full lunch service including cooking and plating",
      departmentId: departments[0].id,
      priority: "urgent",
      requiredHeadcount: 3,
      startHour: 11,
      endHour: 15,
    },
    {
      title: "Bar Setup & Inventory",
      description: "Stock bar, prepare garnishes, check inventory levels",
      departmentId: departments[1].id,
      priority: "medium",
      requiredHeadcount: 1,
      startHour: 10,
      endHour: 12,
    },
    {
      title: "Evening Dining Service",
      description: "Full dinner service, table management, guest relations",
      departmentId: departments[2].id,
      priority: "high",
      requiredHeadcount: 2,
      startHour: 17,
      endHour: 22,
    },
    {
      title: "Deep Clean Kitchen",
      description: "Weekly deep clean of all kitchen surfaces and equipment",
      departmentId: departments[0].id,
      priority: "medium",
      requiredHeadcount: 2,
      startHour: 15,
      endHour: 17,
    },
  ];

  for (const t of taskData) {
    const start = new Date(tomorrow);
    start.setHours(t.startHour);
    const end = new Date(tomorrow);
    end.setHours(t.endHour);

    const existing = await prisma.task.findFirst({
      where: { title: t.title, organizationId: orgId },
    });
    if (!existing) {
      await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          organizationId: orgId,
          departmentId: t.departmentId,
          priority: t.priority,
          requiredHeadcount: t.requiredHeadcount,
          scheduledStart: start,
          scheduledEnd: end,
          createdById: adminUser!.id,
        },
      });
    }
  }

  console.log("Created 5 tasks for tomorrow");

  // Create company settings
  const existingSettings = await prisma.companySettings.findUnique({
    where: { organizationId: orgId },
  });
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        organizationId: orgId,
        allocationMode: "suggested",
        taskAcceptanceMode: "require_acceptance",
        breakRuleHoursWorked: 8,
        breakRuleBreakHours: 1,
      },
    });
  }

  console.log("\nDemo data seeded successfully!");
  console.log("\nLogin credentials (all accounts):");
  console.log("Password: TestPass1!");
  console.log("\nAccounts:");
  console.log("  Admin:   admin@oceangrill.com");
  console.log("  Manager: sarah@oceangrill.com (Kitchen)");
  console.log("  Manager: marcus@oceangrill.com (Bar)");
  console.log("  Staff:   alex@oceangrill.com (Morning, Mon-Fri)");
  console.log("  Staff:   jamie@oceangrill.com (Evening, Mon-Sat)");
  console.log("  Staff:   taylor@oceangrill.com (Full day, Mon-Fri)");
  console.log("  Staff:   jordan@oceangrill.com (Part time, Wed-Sun)");
  console.log("  Staff:   casey@oceangrill.com (Flexible, all week)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });