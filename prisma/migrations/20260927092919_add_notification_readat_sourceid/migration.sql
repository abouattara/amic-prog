-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_userId_event_sourceId_idx" ON "Notification"("userId", "event", "sourceId");
