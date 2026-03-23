import { Module } from '@nestjs/common';
import { CreativesModule } from '../creatives/creatives.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AdSetsModule } from '../ad-sets/ad-sets.module';
import { AdsModule } from '../ads/ads.module';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

@Module({
  imports: [CreativesModule, CampaignsModule, AdSetsModule, AdsModule],
  controllers: [PipelinesController],
  providers: [PipelinesService],
})
export class PipelinesModule {}
