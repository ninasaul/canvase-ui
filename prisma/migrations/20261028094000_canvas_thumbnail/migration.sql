-- AlterTable
ALTER TABLE "canvas" ADD COLUMN "thumbnailAssetId" TEXT;

-- CreateIndex
CREATE INDEX "canvas_thumbnailAssetId_idx" ON "canvas"("thumbnailAssetId");

-- AddForeignKey
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
