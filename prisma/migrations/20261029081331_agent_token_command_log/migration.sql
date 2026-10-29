-- CreateEnum
CREATE TYPE "AgentTokenActorType" AS ENUM ('user', 'agent');

-- CreateTable
CREATE TABLE "agent_token" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_command_log" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "actorType" "AgentTokenActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "versionBefore" INTEGER NOT NULL,
    "versionAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_command_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_token_ownerId_canvasId_idx" ON "agent_token"("ownerId", "canvasId");

-- CreateIndex
CREATE INDEX "agent_token_canvasId_revokedAt_idx" ON "agent_token"("canvasId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_token_tokenHash_key" ON "agent_token"("tokenHash");

-- CreateIndex
CREATE INDEX "canvas_command_log_canvasId_createdAt_idx" ON "canvas_command_log"("canvasId", "createdAt");

-- AddForeignKey
ALTER TABLE "agent_token" ADD CONSTRAINT "agent_token_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_token" ADD CONSTRAINT "agent_token_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_command_log" ADD CONSTRAINT "canvas_command_log_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
