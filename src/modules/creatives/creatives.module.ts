import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { BrandAssetsModule } from '../brand-assets/brand-assets.module';
import { ImageCompositeService } from '../../common/image-composite.service';
import { CreativesController } from './creatives.controller';
import { CreativesService } from './creatives.service';

@Module({
  imports: [GeminiModule, BrandAssetsModule],
  controllers: [CreativesController],
  providers: [CreativesService, ImageCompositeService],
  exports: [CreativesService],
})
export class CreativesModule {}
