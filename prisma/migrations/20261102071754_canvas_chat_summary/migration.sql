-- CreateTable
CREATE TABLE "canvas_chat_summary" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "coveredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_chat_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canvas_chat_summary_canvasId_sessionId_key" ON "canvas_chat_summary"("canvasId", "sessionId");

-- AddForeignKey
ALTER TABLE "canvas_chat_summary" ADD CONSTRAINT "canvas_chat_summary_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
