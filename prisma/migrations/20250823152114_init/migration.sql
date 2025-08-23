/*
  Warnings:

  - You are about to drop the column `availability` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `make` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerKm` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `registrationNo` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isAdmin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AdminAction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Trip` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[carno]` on the table `Car` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `LuggageRack` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carno` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `color` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seats` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."AdminAction" DROP CONSTRAINT "AdminAction_adminId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Car" DROP CONSTRAINT "Car_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_tripId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_revieweeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_tripId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Trip" DROP CONSTRAINT "Trip_carId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Trip" DROP CONSTRAINT "Trip_driverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Trip" DROP CONSTRAINT "Trip_passengerId_fkey";

-- DropIndex
DROP INDEX "public"."Car_registrationNo_key";

-- AlterTable
ALTER TABLE "public"."Car" DROP COLUMN "availability",
DROP COLUMN "make",
DROP COLUMN "ownerId",
DROP COLUMN "pricePerKm",
DROP COLUMN "registrationNo",
DROP COLUMN "verified",
ADD COLUMN     "LuggageRack" BOOLEAN NOT NULL,
ADD COLUMN     "carno" TEXT NOT NULL,
ADD COLUMN     "color" TEXT NOT NULL,
ADD COLUMN     "driverId" INTEGER,
ADD COLUMN     "seats" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "createdAt",
DROP COLUMN "isAdmin",
DROP COLUMN "password",
DROP COLUMN "updatedAt",
DROP COLUMN "verified",
ALTER COLUMN "phone" SET NOT NULL;

-- DropTable
DROP TABLE "public"."AdminAction";

-- DropTable
DROP TABLE "public"."Payment";

-- DropTable
DROP TABLE "public"."Review";

-- DropTable
DROP TABLE "public"."Trip";

-- DropEnum
DROP TYPE "public"."PaymentMethod";

-- DropEnum
DROP TYPE "public"."PaymentStatus";

-- DropEnum
DROP TYPE "public"."Role";

-- DropEnum
DROP TYPE "public"."TripStatus";

-- CreateTable
CREATE TABLE "public"."Driver" (
    "id" SERIAL NOT NULL,
    "seatsavailable" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "public"."Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Car_carno_key" ON "public"."Car"("carno");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- AddForeignKey
ALTER TABLE "public"."Car" ADD CONSTRAINT "Car_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
