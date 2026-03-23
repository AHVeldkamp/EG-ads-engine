import { Module } from '@nestjs/common';
import { MetaApiModule } from '../meta-api/meta-api.module';
import { AdSetsController } from './ad-sets.controller';
import { AdSetsService } from './ad-sets.service';

@Module({
  imports: [MetaApiModule],
  controllers: [AdSetsController],
  providers: [AdSetsService],
  exports: [AdSetsService],
})
export class AdSetsModule {}
