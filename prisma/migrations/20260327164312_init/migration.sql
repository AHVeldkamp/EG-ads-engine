-- CreateEnum
CREATE TYPE "CreativeStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'EDITING', 'FAILED');

-- CreateEnum
CREATE TYPE "MetaCampaignStatus" AS ENUM ('DRAFT', 'PAUSED', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('PENDING', 'GENERATING_CREATIVE', 'CREATING_CAMPAIGN', 'CREATING_AD_SET', 'CREATING_AD', 'PUBLISHING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "creatives" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-image',
    "imagePath" TEXT,
    "status" "CreativeStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "MetaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "metaCampaignId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dailyBudget" INTEGER NOT NULL,
    "targetCountries" TEXT[],
    "targetAgeMin" INTEGER NOT NULL DEFAULT 18,
    "targetAgeMax" INTEGER NOT NULL DEFAULT 65,
    "targetGenders" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "targetInterests" JSONB NOT NULL DEFAULT '[]',
    "optimizationGoal" TEXT NOT NULL,
    "billingEvent" TEXT NOT NULL,
    "status" "MetaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "metaAdSetId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "status" "MetaCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "metaAdId" TEXT,
    "metaCreativeId" TEXT,
    "metaImageHash" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "creativeId" TEXT,
    "campaignId" TEXT,
    "adSetId" TEXT,
    "adId" TEXT,
    "failedStep" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "ad_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "creatives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
