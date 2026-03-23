import { Module } from '@nestjs/common';
import { MetaApiService } from './meta-api.service';

@Module({
  providers: [MetaApiService],
  exports: [MetaApiService],
})
export class MetaApiModule {}
