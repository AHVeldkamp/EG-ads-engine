import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';
import { UpdateTokenDto, TokenStatusResponseDto } from './meta-token.dto';

@Controller('meta')
export class MetaApiController {
  constructor(private readonly metaTokenService: MetaTokenService) {}

  @Get('token-status')
  getTokenStatus(): Promise<TokenStatusResponseDto> {
    return this.metaTokenService.getTokenStatus();
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  updateToken(@Body() dto: UpdateTokenDto): Promise<TokenStatusResponseDto> {
    return this.metaTokenService.updateToken(dto.accessToken);
  }
}
