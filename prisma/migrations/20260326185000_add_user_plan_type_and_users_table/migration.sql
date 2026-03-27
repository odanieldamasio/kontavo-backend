-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'ESSENTIAL', 'PREMIUM');

-- RenameTable
ALTER TABLE "User" RENAME TO "users";

-- RenameIndex
ALTER INDEX "User_pkey" RENAME TO "users_pkey";

-- RenameIndex
ALTER INDEX "User_email_key" RENAME TO "users_email_key";

-- AlterTable
ALTER TABLE "users"
    RENAME COLUMN "firstName" TO "name";

-- AlterTable
ALTER TABLE "users"
    DROP COLUMN "lastName",
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "password" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "planType" "PlanType" NOT NULL DEFAULT 'FREE';

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
