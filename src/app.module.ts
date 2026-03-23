import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { CreativesModule } from './modules/creatives/creatives.module';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
