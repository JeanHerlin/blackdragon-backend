-- AlterTable: reason text for admin-driven order states (rejected / flagged issue)
ALTER TABLE "Order" ADD COLUMN "adminNote" TEXT;
