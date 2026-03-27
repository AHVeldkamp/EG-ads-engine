import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MetaApiService } from './meta-api.service';
import { MetaTokenService } from './meta-token.service';
import { MetaApiController } from './meta-api.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MetaApiController],
  providers: [MetaTokenService, MetaApiService],
  exports: [MetaApiService, MetaTokenService],
})
export class MetaApiModule {}
