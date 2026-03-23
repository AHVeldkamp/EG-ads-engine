import { Module } from '@nestjs/common';
import { MetaApiModule } from '../meta-api/meta-api.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [MetaApiModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
