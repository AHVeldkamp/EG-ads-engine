import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsUrl,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { PipelineStatus } from '@prisma/client';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_PROMPT_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
} from './pipelines.types';

class TargetInterestDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;
}

export class CreatePipelineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PROMPT_LENGTH)
  prompt!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @ArrayMaxSize(MAX_TAGS)
  tags?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  campaignName!: string;

  @IsIn(['OUTCOME_TRAFFIC', 'OUTCOME_SALES'])
  objective!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  adSetName!: string;

  @IsInt()
  @Min(1)
  dailyBudget!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetCountries!: string[];

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  targetAgeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(65)
  targetAgeMax?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetGenders?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetInterestDto)
  targetInterests?: TargetInterestDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  headline!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PROMPT_LENGTH)
  body!: string;

  @IsIn(['SHOP_NOW', 'LEARN_MORE', 'SIGN_UP'])
  callToAction!: string;

  @IsUrl()
  linkUrl!: string;
}

export class ListPipelinesQueryDto {
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
  @IsEnum(PipelineStatus)
  status?: PipelineStatus;
}
