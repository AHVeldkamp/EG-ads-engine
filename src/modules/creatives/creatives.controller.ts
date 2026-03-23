import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  StreamableFile,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
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
  generate(@Body() dto: GenerateCreativeDto) {
    return this.creativesService.generate(dto);
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
}
