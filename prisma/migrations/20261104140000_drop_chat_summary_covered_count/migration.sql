-- The summary position is a watermark now; the message count was positional
-- and broke whenever the transcript was pruned, cleared or partially loaded.
ALTER TABLE "canvas_chat_summary" DROP COLUMN IF EXISTS "coveredCount";
