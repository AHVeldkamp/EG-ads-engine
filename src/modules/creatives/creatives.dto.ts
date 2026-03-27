import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsUUID,
  IsIn,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { CreativeStatus } from '@prisma/client';
import {
  MAX_PROMPT_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './creatives.types';

export class GenerateCreativeDto {
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
}

export class GenerateCreativeMultipartDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PROMPT_LENGTH)
  prompt!: string;

  @IsOptional()
  tags?: string | string[];

  @IsOptional()
  @IsUUID()
  brandAssetId?: string;

  @IsOptional()
  @IsIn([
    'top-left',
    'top-right',
    'top-center',
    'bottom-left',
    'bottom-right',
    'bottom-center',
  ])
  brandAssetPosition?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(50)
  brandAssetScale?: number;
}

export class EditCreativeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PROMPT_LENGTH)
  prompt!: string;
}

export class ListCreativesQueryDto {
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
  @IsEnum(CreativeStatus)
  status?: CreativeStatus;

  @IsOptional()
  @IsString()
  tag?: string;
}
