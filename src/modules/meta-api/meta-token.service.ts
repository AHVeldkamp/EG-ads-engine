import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenStatusResponseDto } from './meta-token.dto';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const REFRESH_THRESHOLD_DAYS = 7;

@Injectable()
export class MetaTokenService implements OnModuleInit {
  private readonly logger = new Logger(MetaTokenService.name);
  private currentToken: string | null = null;
  private reinitializeCallback: ((token: string) => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeToken();
  }

  /**
   * Register a callback that will be invoked whenever the token is refreshed,
   * so the Meta SDK can be re-initialized with the new token.
   */
  setReinitializeCallback(callback: (token: string) => void): void {
    this.reinitializeCallback = callback;
  }

  /**
   * Returns the current valid access token.
   */
  getAccessToken(): string {
    return (
      this.currentToken ??
      this.configService.get<string>('META_ACCESS_TOKEN') ??
      ''
    );
  }

  /**
   * Get the current token status for the health-check endpoint.
   */
  async getTokenStatus(): Promise<TokenStatusResponseDto> {
    const record = await this.prisma.metaToken.findUnique({
      where: { id: 'singleton' },
    });

    if (!record) {
      return {
        valid: false,
        expiresAt: null,
        daysRemaining: null,
        lastRefreshed: null,
      };
    }

    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.floor(
        (record.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const valid = record.expiresAt > now;

    return {
      valid,
      expiresAt: record.expiresAt.toISOString(),
      daysRemaining,
      lastRefreshed: record.refreshedAt.toISOString(),
    };
  }

  /**
   * Manually update the token (e.g. when the user provides a new short-lived token).
   * Exchanges it for a long-lived token and persists it.
   */
  async updateToken(shortLivedToken: string): Promise<TokenStatusResponseDto> {
    const longLived = await this.exchangeForLongLivedToken(shortLivedToken);
    await this.persistToken(longLived.accessToken, longLived.expiresAt);
    this.currentToken = longLived.accessToken;
    this.notifyReinitialize(longLived.accessToken);
    return this.getTokenStatus();
  }

  /**
   * Cron job: runs daily at midnight to check if the token needs refreshing.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refreshTokenIfNeeded(): Promise<void> {
    this.logger.log('Running scheduled token refresh check');

    const record = await this.prisma.metaToken.findUnique({
      where: { id: 'singleton' },
    });

    if (!record) {
      this.logger.warn('No MetaToken record found in database');
      return;
    }

    const now = new Date();

    if (record.expiresAt <= now) {
      this.logger.error(
        'Meta token has expired. User must provide a new short-lived token via POST /api/v1/meta/token',
      );
      return;
    }

    const daysRemaining =
      (record.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysRemaining > REFRESH_THRESHOLD_DAYS) {
      this.logger.log(
        `Token still valid for ${Math.floor(daysRemaining)} days, no refresh needed`,
      );
      return;
    }

    this.logger.log(
      `Token expires in ${Math.floor(daysRemaining)} days, refreshing...`,
    );

    try {
      const longLived = await this.exchangeForLongLivedToken(
        record.accessToken,
      );
      await this.persistToken(longLived.accessToken, longLived.expiresAt);
      this.currentToken = longLived.accessToken;
      this.notifyReinitialize(longLived.accessToken);
      this.logger.log('Token refreshed successfully');
    } catch (error) {
      this.logger.error(
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Startup logic: load token from DB or exchange the env var token.
   */
  private async initializeToken(): Promise<void> {
    const record = await this.prisma.metaToken.findUnique({
      where: { id: 'singleton' },
    });

    if (record) {
      const now = new Date();
      if (record.expiresAt > now) {
        this.logger.log('Using stored Meta token from database');
        this.currentToken = record.accessToken;
        return;
      }

      this.logger.warn(
        'Stored Meta token has expired, falling back to env var token',
      );
    }

    // No record or expired — exchange env var token for long-lived
    const envToken = this.configService.get<string>('META_ACCESS_TOKEN') ?? '';
    if (!envToken) {
      this.logger.error('No META_ACCESS_TOKEN configured');
      return;
    }

    try {
      const longLived = await this.exchangeForLongLivedToken(envToken);
      await this.persistToken(longLived.accessToken, longLived.expiresAt);
      this.currentToken = longLived.accessToken;
      this.logger.log('Exchanged env var token for long-lived token');
    } catch (error) {
      this.logger.warn(
        `Token exchange failed, using env var token as fallback: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.currentToken = envToken;
    }
  }

  /**
   * Exchange a short-lived (or long-lived) token for a new long-lived token.
   */
  private async exchangeForLongLivedToken(
    token: string,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const appId = this.configService.get<string>('META_APP_ID') ?? '';
    const appSecret = this.configService.get<string>('META_APP_SECRET') ?? '';

    const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', token);

    const response = await fetch(url.toString());
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    if (!response.ok || !data.access_token) {
      const errorMessage =
        data.error?.message ?? `HTTP ${response.status}: Token exchange failed`;
      throw new InternalServerErrorException(errorMessage);
    }

    const expiresAt = new Date(
      Date.now() + (data.expires_in ?? 5184000) * 1000,
    );

    return {
      accessToken: data.access_token,
      expiresAt,
    };
  }

  /**
   * Persist the token to the database (upsert singleton record).
   */
  private async persistToken(
    accessToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.metaToken.upsert({
      where: { id: 'singleton' },
      update: {
        accessToken,
        expiresAt,
        refreshedAt: new Date(),
      },
      create: {
        id: 'singleton',
        accessToken,
        expiresAt,
        refreshedAt: new Date(),
      },
    });
  }

  /**
   * Notify the registered callback (MetaApiService) about the new token.
   */
  private notifyReinitialize(token: string): void {
    if (this.reinitializeCallback) {
      this.reinitializeCallback(token);
    }
  }
}
