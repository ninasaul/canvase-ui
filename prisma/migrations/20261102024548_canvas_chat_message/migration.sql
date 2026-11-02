-- CreateTable
CREATE TABLE "canvas_chat_message" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvas_chat_message_canvasId_createdAt_idx" ON "canvas_chat_message"("canvasId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_chat_message_canvasId_clientId_key" ON "canvas_chat_message"("canvasId", "clientId");

-- AddForeignKey
ALTER TABLE "canvas_chat_message" ADD CONSTRAINT "canvas_chat_message_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
