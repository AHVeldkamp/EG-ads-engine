import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  IsArray,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { MetaCampaignStatus } from '@prisma/client';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_AGE,
  MAX_AGE,
} from './ad-sets.types';

export class CreateAdSetDto {
  @IsUUID()
  campaignId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsInt()
  @Min(1)
  dailyBudget!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetCountries!: string[];

  @IsOptional()
  @IsInt()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  targetAgeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  targetAgeMax?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetGenders?: number[];

  @IsOptional()
  @IsArray()
  targetInterests?: Array<{ id: string; name: string }>;

  @IsString()
  @MinLength(1)
  optimizationGoal!: string;

  @IsString()
  @MinLength(1)
  billingEvent!: string;
}

export class UpdateAdSetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PAUSED', 'ACTIVE'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyBudget?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetCountries?: string[];

  @IsOptional()
  @IsInt()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  targetAgeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_AGE)
  @Max(MAX_AGE)
  targetAgeMax?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetGenders?: number[];

  @IsOptional()
  @IsArray()
  targetInterests?: Array<{ id: string; name: string }>;

  @IsOptional()
  @IsString()
  optimizationGoal?: string;

  @IsOptional()
  @IsString()
  billingEvent?: string;
}

export class ListAdSetsQueryDto {
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
  campaignId?: string;

  @IsOptional()
  @IsEnum(MetaCampaignStatus)
  status?: MetaCampaignStatus;
}
