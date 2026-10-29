-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video', 'audio', 'other');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('pending', 'ready', 'failed');

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'playground_upload',
    "displayName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "thumbnailUrl" TEXT,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_storage_config" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'auto',
    "bucket" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretAccessKeyCipher" TEXT NOT NULL,
    "secretAccessKeyIv" TEXT NOT NULL,
    "publicBaseUrl" TEXT NOT NULL,
    "forcePathStyle" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_storage_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_asset_ownerId_createdAt_idx" ON "media_asset"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "media_asset_ownerId_status_createdAt_idx" ON "media_asset"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_storage_config_userId_key" ON "user_storage_config"("userId");

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_storage_config" ADD CONSTRAINT "user_storage_config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
