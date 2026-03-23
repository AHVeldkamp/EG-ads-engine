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
  ParseUUIDPipe,
} from '@nestjs/common';
import { PipelinesService } from './pipelines.service';
import { CreatePipelineDto, ListPipelinesQueryDto } from './pipelines.dto';

@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  run(@Body() dto: CreatePipelineDto) {
    return this.pipelinesService.run(dto);
  }

  @Get()
  findAll(@Query() query: ListPipelinesQueryDto) {
    return this.pipelinesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pipelinesService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pipelinesService.remove(id);
  }
}
