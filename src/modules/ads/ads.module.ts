import { Module } from '@nestjs/common';
import { MetaApiModule } from '../meta-api/meta-api.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [MetaApiModule],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
