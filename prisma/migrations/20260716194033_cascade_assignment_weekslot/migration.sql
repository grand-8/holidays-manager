-- DropForeignKey
ALTER TABLE "ScheduleAssignment" DROP CONSTRAINT "ScheduleAssignment_weekSlotId_fkey";

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "WeekSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
