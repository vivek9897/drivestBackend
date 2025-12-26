import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateConsentsDto {
  @IsOptional()
  @IsISO8601()
  baseAcceptedAt?: string;

  @IsOptional()
  @IsISO8601()
  ageConfirmedAt?: string;

  @IsOptional()
  @IsIn(['allow', 'skip'])
  analyticsChoice?: 'allow' | 'skip';

  @IsOptional()
  @IsISO8601()
  analyticsAt?: string;

  @IsOptional()
  @IsIn(['enable', 'skip'])
  notificationsChoice?: 'enable' | 'skip';

  @IsOptional()
  @IsISO8601()
  notificationsAt?: string;

  @IsOptional()
  @IsIn(['allow', 'deny', 'skip'])
  locationChoice?: 'allow' | 'deny' | 'skip';

  @IsOptional()
  @IsISO8601()
  locationAt?: string;

  @IsOptional()
  @IsISO8601()
  safetyAcceptedAt?: string;
}
