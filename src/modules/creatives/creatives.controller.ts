import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  StreamableFile,
  Res,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { CreativesService } from './creatives.service';
import {
  GenerateCreativeDto,
  EditCreativeDto,
  ListCreativesQueryDto,
} from './creatives.dto';

@Controller('creatives')
export class CreativesController {
  constructor(private readonly creativesService: CreativesService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('seedImage', { storage: undefined }))
  generate(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
    @UploadedFile() seedImage?: Express.Multer.File,
  ) {
    const contentType = req.headers['content-type'] ?? '';

    if (contentType.includes('multipart/form-data')) {
      const tags = this.parseTags(body.tags);
      return this.creativesService.generateWithSeedImage({
        prompt: body.prompt as string,
        tags,
        seedImage: seedImage ?? undefined,
        brandAssetId: body.brandAssetId as string | undefined,
        brandAssetPosition: body.brandAssetPosition as string | undefined,
        brandAssetScale: body.brandAssetScale
          ? Number(body.brandAssetScale)
          : undefined,
      });
    }

    return this.creativesService.generate(
      body as unknown as GenerateCreativeDto,
    );
  }

  @Post(':id/edit')
  @HttpCode(HttpStatus.OK)
  edit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EditCreativeDto,
  ) {
    return this.creativesService.edit(id, dto);
  }

  @Get()
  findAll(@Query() query: ListCreativesQueryDto) {
    return this.creativesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.creativesService.findOne(id);
  }

  @Get(':id/image')
  async getImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, id: creativeId } =
      await this.creativesService.getImageBuffer(id);

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="${creativeId}.png"`,
    });

    return new StreamableFile(buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.creativesService.remove(id);
  }

  private parseTags(tags: unknown): string[] | undefined {
    if (!tags) return undefined;
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [tags];
      }
    }
    return undefined;
  }
}
