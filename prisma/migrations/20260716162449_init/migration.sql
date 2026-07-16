-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('config', 'collecte', 'collecte_tour2', 'generation', 'vote', 'mediation', 'cloture');

-- CreateEnum
CREATE TYPE "CycleOrigin" AS ENUM ('genere', 'importe');

-- CreateEnum
CREATE TYPE "PreferenceStatus" AS ENUM ('preferee', 'alternative', 'non_coche', 'impossible');

-- CreateEnum
CREATE TYPE "DecisionMaker" AS ENUM ('auto', 'admin');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "jourBascule" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nomAffiche" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "deadlinePreferences" TIMESTAMP(3),
    "deadlineVote" TIMESTAMP(3),
    "seuilScoreMinimum" INTEGER NOT NULL DEFAULT 40,
    "statut" "CycleStatus" NOT NULL DEFAULT 'config',
    "origine" "CycleOrigin" NOT NULL DEFAULT 'genere',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyRight" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombreSemaines" INTEGER NOT NULL,
    "accepteFractionnement" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FamilyRight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekSlot" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "WeekSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekSlotId" TEXT NOT NULL,
    "statut" "PreferenceStatus" NOT NULL DEFAULT 'non_coche',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptOut" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekInterest" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "weekSlotId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeekInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleProposal" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "scoreGlobal" DOUBLE PRECISION NOT NULL,
    "scoreMinimum" DOUBLE PRECISION NOT NULL,
    "genereLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleAssignment" (
    "id" TEXT NOT NULL,
    "scheduleProposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekSlotId" TEXT NOT NULL,
    "scoreIndividuel" DOUBLE PRECISION NOT NULL,
    "fractionnementForce" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScheduleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "scheduleProposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalSchedule" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "scheduleProposalId" TEXT,
    "decidePar" "DecisionMaker" NOT NULL,
    "commentaireAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tableConcernee" TEXT NOT NULL,
    "enregistrementId" TEXT NOT NULL,
    "champ" TEXT NOT NULL,
    "ancienneValeur" TEXT,
    "nouvelleValeur" TEXT,
    "modifiePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_propertyId_idx" ON "User"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "OtpCode_userId_idx" ON "OtpCode"("userId");

-- CreateIndex
CREATE INDEX "Cycle_propertyId_idx" ON "Cycle"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Cycle_propertyId_annee_key" ON "Cycle"("propertyId", "annee");

-- CreateIndex
CREATE INDEX "FamilyRight_cycleId_idx" ON "FamilyRight"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyRight_cycleId_userId_key" ON "FamilyRight"("cycleId", "userId");

-- CreateIndex
CREATE INDEX "WeekSlot_cycleId_idx" ON "WeekSlot"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekSlot_cycleId_ordre_key" ON "WeekSlot"("cycleId", "ordre");

-- CreateIndex
CREATE INDEX "Preference_cycleId_idx" ON "Preference"("cycleId");

-- CreateIndex
CREATE INDEX "Preference_userId_idx" ON "Preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_cycleId_userId_weekSlotId_key" ON "Preference"("cycleId", "userId", "weekSlotId");

-- CreateIndex
CREATE INDEX "OptOut_cycleId_idx" ON "OptOut"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "OptOut_cycleId_userId_key" ON "OptOut"("cycleId", "userId");

-- CreateIndex
CREATE INDEX "WeekInterest_cycleId_idx" ON "WeekInterest"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekInterest_cycleId_weekSlotId_userId_key" ON "WeekInterest"("cycleId", "weekSlotId", "userId");

-- CreateIndex
CREATE INDEX "ScheduleProposal_cycleId_idx" ON "ScheduleProposal"("cycleId");

-- CreateIndex
CREATE INDEX "ScheduleAssignment_scheduleProposalId_idx" ON "ScheduleAssignment"("scheduleProposalId");

-- CreateIndex
CREATE INDEX "Vote_cycleId_idx" ON "Vote"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_cycleId_userId_key" ON "Vote"("cycleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalSchedule_cycleId_key" ON "FinalSchedule"("cycleId");

-- CreateIndex
CREATE INDEX "AuditLog_tableConcernee_enregistrementId_idx" ON "AuditLog"("tableConcernee", "enregistrementId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cycle" ADD CONSTRAINT "Cycle_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyRight" ADD CONSTRAINT "FamilyRight_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyRight" ADD CONSTRAINT "FamilyRight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekSlot" ADD CONSTRAINT "WeekSlot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "WeekSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptOut" ADD CONSTRAINT "OptOut_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptOut" ADD CONSTRAINT "OptOut_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekInterest" ADD CONSTRAINT "WeekInterest_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekInterest" ADD CONSTRAINT "WeekInterest_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "WeekSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekInterest" ADD CONSTRAINT "WeekInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleProposal" ADD CONSTRAINT "ScheduleProposal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_scheduleProposalId_fkey" FOREIGN KEY ("scheduleProposalId") REFERENCES "ScheduleProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleAssignment" ADD CONSTRAINT "ScheduleAssignment_weekSlotId_fkey" FOREIGN KEY ("weekSlotId") REFERENCES "WeekSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_scheduleProposalId_fkey" FOREIGN KEY ("scheduleProposalId") REFERENCES "ScheduleProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSchedule" ADD CONSTRAINT "FinalSchedule_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSchedule" ADD CONSTRAINT "FinalSchedule_scheduleProposalId_fkey" FOREIGN KEY ("scheduleProposalId") REFERENCES "ScheduleProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
