-- CreateTable
CREATE TABLE "SecondRoundParticipant" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecondRoundParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecondRoundParticipant_cycleId_idx" ON "SecondRoundParticipant"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "SecondRoundParticipant_cycleId_userId_key" ON "SecondRoundParticipant"("cycleId", "userId");

-- AddForeignKey
ALTER TABLE "SecondRoundParticipant" ADD CONSTRAINT "SecondRoundParticipant_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondRoundParticipant" ADD CONSTRAINT "SecondRoundParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
