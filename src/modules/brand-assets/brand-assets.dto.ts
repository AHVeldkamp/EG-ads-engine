import { IsString, IsIn, MinLength, MaxLength } from 'class-validator';

export class CreateBrandAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsIn(['logo', 'watermark', 'badge'])
  type!: string;
}
