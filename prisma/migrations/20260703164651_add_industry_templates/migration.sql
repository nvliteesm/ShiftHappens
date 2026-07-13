-- NOTE: This migration originally re-declared changes that 20260608084819_add_platform_admin
-- already makes (TaskAssignment.rejectionNotes, User.isPlatformAdmin, the AuditLog table with
-- its indexes and foreign keys). Replaying the chain on a fresh database therefore failed with
-- 'column "rejectionNotes" already exists'. Those duplicated statements have been removed so
-- each change is owned by exactly one migration; everything below is unique to this migration.

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "operatingHoursEnd" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "operatingHoursStart" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "customRoleId" TEXT,
ADD COLUMN     "employmentType" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roleId" TEXT,
    "departmentId" TEXT,
    "hoursThreshold" DOUBLE PRECISION,
    "breakHours" DOUBLE PRECISION,
    "maxHours" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Building',
    "description" TEXT NOT NULL,
    "departments" JSONB NOT NULL,
    "workRules" JSONB NOT NULL,
    "certifications" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkRule_organizationId_idx" ON "WorkRule"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkRule_organizationId_name_key" ON "WorkRule"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryTemplate_name_key" ON "IndustryTemplate"("name");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRule" ADD CONSTRAINT "WorkRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRule" ADD CONSTRAINT "WorkRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRule" ADD CONSTRAINT "WorkRule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
