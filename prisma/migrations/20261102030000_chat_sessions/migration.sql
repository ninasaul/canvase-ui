-- Conversation boundary for the canvas agent chat.
ALTER TABLE "canvas_chat_message" ADD COLUMN "sessionId" TEXT;

-- Group every existing message into one session per canvas.
UPDATE "canvas_chat_message"
SET "sessionId" = 'legacy-' || "canvasId"
WHERE "sessionId" IS NULL;

ALTER TABLE "canvas_chat_message" ALTER COLUMN "sessionId" SET NOT NULL;

CREATE INDEX "canvas_chat_message_canvasId_sessionId_createdAt_idx"
  ON "canvas_chat_message"("canvasId", "sessionId", "createdAt");
