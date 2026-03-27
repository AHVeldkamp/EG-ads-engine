import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}

export class TokenStatusResponseDto {
  valid!: boolean;
  expiresAt!: string | null;
  daysRemaining!: number | null;
  lastRefreshed!: string | null;
}
