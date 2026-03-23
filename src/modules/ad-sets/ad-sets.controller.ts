import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdSetsService } from './ad-sets.service';
import {
  CreateAdSetDto,
  UpdateAdSetDto,
  ListAdSetsQueryDto,
} from './ad-sets.dto';

@Controller('ad-sets')
export class AdSetsController {
  constructor(private readonly adSetsService: AdSetsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAdSetDto) {
    return this.adSetsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListAdSetsQueryDto) {
    return this.adSetsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adSetsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdSetDto,
  ) {
    return this.adSetsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adSetsService.remove(id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adSetsService.publish(id);
  }
}
