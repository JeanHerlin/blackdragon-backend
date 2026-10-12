-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "notificationToken" TEXT;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "productType" SET DEFAULT 'recharge';

-- AlterTable
ALTER TABLE "PromoCode" ALTER COLUMN "title" DROP DEFAULT;
