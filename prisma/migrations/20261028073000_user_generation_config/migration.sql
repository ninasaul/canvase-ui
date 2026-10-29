-- CreateTable
CREATE TABLE "user_generation_config" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeVendorId" TEXT NOT NULL,
    "profilesJson" JSONB NOT NULL,
    "modelsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_generation_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_generation_config_userId_key" ON "user_generation_config"("userId");

-- AddForeignKey
ALTER TABLE "user_generation_config" ADD CONSTRAINT "user_generation_config_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
