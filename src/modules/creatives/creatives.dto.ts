import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
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
