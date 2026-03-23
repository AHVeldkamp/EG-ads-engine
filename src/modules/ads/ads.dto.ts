import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  IsUUID,
  IsUrl,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MetaCampaignStatus } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './ads.types';

export class CreateAdDto {
  @IsUUID()
  adSetId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsUUID()
  creativeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  headline!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsIn(['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP'])
  callToAction!: string;

  @IsUrl()
  linkUrl!: string;
}

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PAUSED', 'ACTIVE'])
  status?: string;

  @IsOptional()
  @IsUUID()
  creativeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  headline?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsIn(['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP'])
  callToAction?: string;

  @IsOptional()
  @IsUrl()
  linkUrl?: string;
}

export class ListAdsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsUUID()
  adSetId?: string;

  @IsOptional()
  @IsEnum(MetaCampaignStatus)
  status?: MetaCampaignStatus;
}
