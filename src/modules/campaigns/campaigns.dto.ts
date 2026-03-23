import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { MetaCampaignStatus } from '@prisma/client';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './campaigns.types';

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsIn(['OUTCOME_TRAFFIC', 'OUTCOME_SALES'])
  objective!: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PAUSED', 'ACTIVE'])
  status?: string;

  @IsOptional()
  @IsIn(['OUTCOME_TRAFFIC', 'OUTCOME_SALES'])
  objective?: string;
}

export class ListCampaignsQueryDto {
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
  @IsEnum(MetaCampaignStatus)
  status?: MetaCampaignStatus;
}
