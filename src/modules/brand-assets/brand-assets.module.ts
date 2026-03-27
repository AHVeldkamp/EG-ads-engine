import { Module } from '@nestjs/common';
import { BrandAssetsController } from './brand-assets.controller';
import { BrandAssetsService } from './brand-assets.service';

@Module({
  controllers: [BrandAssetsController],
  providers: [BrandAssetsService],
  exports: [BrandAssetsService],
})
export class BrandAssetsModule {}
