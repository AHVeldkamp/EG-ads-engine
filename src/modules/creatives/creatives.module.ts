import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { CreativesController } from './creatives.controller';
import { CreativesService } from './creatives.service';

@Module({
  imports: [GeminiModule],
  controllers: [CreativesController],
  providers: [CreativesService],
  exports: [CreativesService],
})
export class CreativesModule {}
