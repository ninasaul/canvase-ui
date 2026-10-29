-- CreateEnum
CREATE TYPE "CanvasAgentRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "canvas_agent_run" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "CanvasAgentRunStatus" NOT NULL DEFAULT 'queued',
    "nodeIds" TEXT[],
    "nodeStates" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_agent_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvas_agent_run_canvasId_createdAt_idx" ON "canvas_agent_run"("canvasId", "createdAt");

-- CreateIndex
CREATE INDEX "canvas_agent_run_ownerId_status_createdAt_idx" ON "canvas_agent_run"("ownerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "canvas_agent_run" ADD CONSTRAINT "canvas_agent_run_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
