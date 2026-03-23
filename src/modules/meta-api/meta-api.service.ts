import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bizSdk from 'facebook-nodejs-business-sdk';

const { FacebookAdsApi, AdAccount } = bizSdk;

export interface MetaCampaignParams {
  name: string;
  objective: string;
  status: string;
  special_ad_categories: string[];
}

export interface MetaAdSetParams {
  campaign_id: string;
  name: string;
  daily_budget: number;
  optimization_goal: string;
  billing_event: string;
  targeting: {
    geo_locations: { countries: string[] };
    age_min: number;
    age_max: number;
    genders: number[];
    interests: Array<{ id: string; name: string }>;
  };
  status: string;
}

export interface MetaAdCreativeParams {
  name: string;
  object_story_spec: {
    page_id: string;
    link_data: {
      image_hash: string;
      link: string;
      message: string;
      name: string;
      call_to_action: { type: string };
    };
  };
}

export interface MetaAdParams {
  name: string;
  adset_id: string;
  creative: { creative_id: string };
  status: string;
}

@Injectable()
export class MetaApiService {
  private readonly logger = new Logger(MetaApiService.name);
  private readonly adAccountId: string;
  private readonly pageId: string;

  constructor(private readonly configService: ConfigService) {
    const accessToken =
      this.configService.get<string>('META_ACCESS_TOKEN') ?? '';
    const appId = this.configService.get<string>('META_APP_ID') ?? '';
    const appSecret = this.configService.get<string>('META_APP_SECRET') ?? '';

    FacebookAdsApi.init(accessToken, appId, appSecret);

    this.adAccountId =
      this.configService.get<string>('META_AD_ACCOUNT_ID') ?? '';
    this.pageId = this.configService.get<string>('META_PAGE_ID') ?? '';
  }

  getPageId(): string {
    return this.pageId;
  }

  async createCampaign(params: MetaCampaignParams): Promise<{ id: string }> {
    this.logger.log(`Creating Meta campaign: ${params.name}`);
    try {
      const account = new AdAccount(this.adAccountId);
      const result = await account.createCampaign(
        [],
        params as unknown as Record<string, unknown>,
      );
      const id = result.id ?? result._data?.id;
      this.logger.log(`Meta campaign created: ${id}`);
      return { id };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.warn(`Meta campaign creation failed: ${message}`);
      throw new Error(message);
    }
  }

  async createAdSet(params: MetaAdSetParams): Promise<{ id: string }> {
    this.logger.log(`Creating Meta ad set: ${params.name}`);
    try {
      const account = new AdAccount(this.adAccountId);
      const result = await account.createAdSet(
        [],
        params as unknown as Record<string, unknown>,
      );
      const id = result.id ?? result._data?.id;
      this.logger.log(`Meta ad set created: ${id}`);
      return { id };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.warn(`Meta ad set creation failed: ${message}`);
      throw new Error(message);
    }
  }

  async uploadImage(imagePath: string): Promise<{ hash: string }> {
    this.logger.log(`Uploading image to Meta: ${imagePath}`);
    try {
      const account = new AdAccount(this.adAccountId);
      const result = await account.createAdImage([], {
        filename: imagePath,
      });
      const images = result._data?.images ?? result.images;
      const filename = Object.keys(images)[0];
      const hash = images[filename].hash;
      this.logger.log(`Meta image uploaded, hash: ${hash}`);
      return { hash };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.warn(`Meta image upload failed: ${message}`);
      throw new Error(message);
    }
  }

  async createAdCreative(
    params: MetaAdCreativeParams,
  ): Promise<{ id: string }> {
    this.logger.log(`Creating Meta ad creative: ${params.name}`);
    try {
      const account = new AdAccount(this.adAccountId);
      const result = await account.createAdCreative(
        [],
        params as unknown as Record<string, unknown>,
      );
      const id = result.id ?? result._data?.id;
      this.logger.log(`Meta ad creative created: ${id}`);
      return { id };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.warn(`Meta ad creative creation failed: ${message}`);
      throw new Error(message);
    }
  }

  async createAd(params: MetaAdParams): Promise<{ id: string }> {
    this.logger.log(`Creating Meta ad: ${params.name}`);
    try {
      const account = new AdAccount(this.adAccountId);
      const result = await account.createAd(
        [],
        params as unknown as Record<string, unknown>,
      );
      const id = result.id ?? result._data?.id;
      this.logger.log(`Meta ad created: ${id}`);
      return { id };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.warn(`Meta ad creation failed: ${message}`);
      throw new Error(message);
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // The SDK often wraps errors with a response body
      const sdkError = error as Error & {
        response?: { body?: { error?: { message?: string } } };
        _body?: { error?: { message?: string } };
      };
      const metaMessage =
        sdkError.response?.body?.error?.message ??
        sdkError._body?.error?.message;
      if (metaMessage) {
        return metaMessage;
      }
      return error.message;
    }
    return String(error);
  }
}
