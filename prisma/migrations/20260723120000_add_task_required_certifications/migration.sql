-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "requiredCertifications" TEXT[] DEFAULT ARRAY[]::TEXT[];
