/**
 * Free-tier demo org seed.
 *
 * Creates (or resets) a Company Admin on a **Free** organization so the Stripe
 * upgrade flow can be demonstrated end to end: log in → Settings → Upgrade to
 * Pro → pay with the test card → plan flips to Pro via the webhook.
 *
 * Re-running this script RESETS the org back to Free and clears its Stripe
 * linkage, so you can run the demo again as many times as you like.
 *
 * Run with: npx tsx prisma/seed-free-org.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "demo@bluelagoon.com";
const PASSWORD = "TestPass1!";
const ORG_NAME = "Blue Lagoon Cafe";
const ORG_SLUG = "blue-lagoon-cafe";

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { name: "Demo Admin", hashedPassword, emailVerified: new Date() },
    create: {
      name: "Demo Admin",
      email: EMAIL,
      hashedPassword,
      emailVerified: new Date(), // pre-verified — skips the email step
    },
  });

  let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        slug: ORG_SLUG,
        industry: "Hospitality",
        description: "Demo organization for the Stripe upgrade flow",
      },
    });
  }

  // Always reset to Free and drop any previous Stripe linkage, so the upgrade
  // can be demonstrated repeatedly.
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      subscriptionTier: "free",
      subscriptionStatus: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      billingInterval: null,
      status: "active",
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: { userId: admin.id, organizationId: org.id },
    },
    update: { role: "company_admin", status: "active" },
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: "company_admin",
      status: "active",
    },
  });

  // Settings row so the dashboard and allocation logic have defaults.
  await prisma.companySettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id },
  });

  // A department, so the org isn't completely empty on screen.
  const existingDept = await prisma.department.findFirst({
    where: { organizationId: org.id },
  });
  if (!existingDept) {
    await prisma.department.create({
      data: {
        organizationId: org.id,
        name: "Front of House",
        description: "Service and counter staff",
        color: "#3B82F6",
      },
    });
  }

  console.log("\nFree-tier demo org ready (reset to Free).\n");
  console.log(`  Organization: ${ORG_NAME}  —  plan: FREE`);
  console.log(`  Login:        ${EMAIL}`);
  console.log(`  Password:     ${PASSWORD}`);
  console.log("\nDemo: log in → Settings → Upgrade to Pro → card 4242 4242 4242 4242");
  console.log("Re-run this script to reset the org back to Free.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
