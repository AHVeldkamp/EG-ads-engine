import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class AppService implements OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private readonly prisma = new PrismaClient();

  async getHealth(): Promise<{
    status: string;
    database: string;
    uptime: number;
  }> {
    let database = 'connected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      this.logger.warn('Database is unreachable');
      database = 'disconnected';
    }

    return {
      status: 'ok',
      database,
      uptime: process.uptime(),
    };
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
