-- CreateTable
CREATE TABLE "FreeWeekAssignment" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "weekSlotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeWeekAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeWeekAssignment_cycleId_idx" ON "FreeWeekAssignment"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "FreeWeekAssignment_cycleId_weekSlotId_key" ON "FreeWeekAssignment"("cycleId", "weekSlotId");

-- AddForeignKey
ALTER TABLE "FreeWeekAssignment" ADD CONSTRAINT "FreeWeekAssignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeWeekAssignment" ADD CONSTRAINT "FreeWeekAssignment_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "WeekSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeWeekAssignment" ADD CONSTRAINT "FreeWeekAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
