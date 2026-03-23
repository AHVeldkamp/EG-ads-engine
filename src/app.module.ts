import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { CreativesModule } from './modules/creatives/creatives.module';
import { MetaApiModule } from './modules/meta-api/meta-api.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { AdSetsModule } from './modules/ad-sets/ad-sets.module';
import { AdsModule } from './modules/ads/ads.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    GeminiModule,
    CreativesModule,
    MetaApiModule,
    CampaignsModule,
    AdSetsModule,
    AdsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
