import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  StreamableFile,
  Res,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BrandAssetsService } from './brand-assets.service';
import { CreateBrandAssetDto } from './brand-assets.dto';

@Controller('brand-assets')
export class BrandAssetsController {
  constructor(private readonly brandAssetsService: BrandAssetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  create(
    @Body() dto: CreateBrandAssetDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.brandAssetsService.create(dto, file);
  }

  @Get()
  findAll() {
    return this.brandAssetsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandAssetsService.findOne(id);
  }

  @Get(':id/image')
  async getImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, brandAsset } =
      await this.brandAssetsService.getImageBuffer(id);

    res.set({
      'Content-Type': brandAsset.mimeType,
      'Content-Disposition': `inline; filename="${brandAsset.id}.${brandAsset.mimeType.split('/')[1]}"`,
    });

    return new StreamableFile(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.brandAssetsService.remove(id);
  }
}
