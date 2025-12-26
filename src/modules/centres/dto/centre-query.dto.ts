import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class CentreQueryDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  near?: string; // "lat,lng"

  @IsOptional()
  @IsNumberString()
  radiusKm?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
