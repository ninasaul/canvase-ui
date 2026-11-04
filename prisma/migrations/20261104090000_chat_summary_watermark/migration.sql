-- Summary position as a watermark instead of a count: counting breaks when the
-- transcript is pruned, cleared or partially loaded.
ALTER TABLE "canvas_chat_summary" ADD COLUMN "coveredThrough" TIMESTAMP(3);
